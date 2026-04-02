/**
 * OllamaAnthropicClient — wraps Ollama's HTTP API to implement
 * the Anthropic SDK interface that the rest of the codebase expects.
 *
 * This is the bridge between Claude Code's provider-agnostic architecture
 * and local Ollama models. It handles:
 * - Converting Anthropic message format to Ollama format
 * - Streaming responses with proper event emission
 * - Automatic model switching based on task type
 * - Partial GPU offloading configuration
 * - Auto-pulling models when not available
 */

import { getOllamaConfig } from './ollamaConfig.js'
import {
	anthropicToOllama,
	anthropicToolsToOllama,
	ollamaStreamToAnthropicEvents,
	type OllamaChatRequest,
	type OllamaStreamChunk,
} from './formatConverter.js'
import {
	detectTaskType,
	getOllamaModelForTask,
	getCurrentLoadedModel,
	setCurrentLoadedModel,
} from './taskDetector.js'

// ---------------------------------------------------------------------------
// Ollama HTTP helpers
// ---------------------------------------------------------------------------

async function ollamaFetch(
	path: string,
	body?: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<Response> {
	const config = getOllamaConfig()
	const url = `${config.host}${path}`

	const init: RequestInit = {
		method: body ? 'POST' : 'GET',
		headers: { 'Content-Type': 'application/json' },
		...(body && { body: JSON.stringify(body) }),
		...(signal && { signal }),
	}

	return fetch(url, init)
}

/**
 * Check if a model is available locally in Ollama.
 */
async function isModelAvailable(model: string): Promise<boolean> {
	try {
		const resp = await ollamaFetch('/api/tags')
		if (!resp.ok) return false
		const data = (await resp.json()) as {
			models: Array<{ name: string }>
		}
		return data.models.some(
			(m) => m.name === model || m.name === `${model}:latest`,
		)
	} catch {
		return false
	}
}

/**
 * Pull a model from the Ollama registry.
 */
async function pullModel(model: string): Promise<void> {
	// biome-ignore lint/suspicious/noConsole: intentional — user notification
	console.error(`[Ollama] Pulling model ${model}... this may take a while.`)

	const resp = await ollamaFetch('/api/pull', {
		name: model,
		stream: true,
	})

	if (!resp.ok) {
		throw new Error(
			`Failed to pull model ${model}: ${resp.status} ${resp.statusText}`,
		)
	}

	// Consume the stream to completion (shows progress in Ollama)
	const reader = resp.body?.getReader()
	if (reader) {
		const decoder = new TextDecoder()
		let lastStatus = ''
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			try {
				const text = decoder.decode(value, { stream: true })
				for (const line of text.split('\n').filter(Boolean)) {
					const parsed = JSON.parse(line)
					if (parsed.status && parsed.status !== lastStatus) {
						lastStatus = parsed.status
						// biome-ignore lint/suspicious/noConsole: intentional — pull progress
						console.error(`[Ollama] ${parsed.status}`)
					}
				}
			} catch {
				// Non-JSON line, skip
			}
		}
	}

	// biome-ignore lint/suspicious/noConsole: intentional — user notification
	console.error(`[Ollama] Model ${model} ready.`)
}

/**
 * Ensure a model is available, pulling it if auto-pull is enabled.
 */
async function ensureModelAvailable(model: string): Promise<void> {
	const available = await isModelAvailable(model)
	if (available) return

	const config = getOllamaConfig()
	if (!config.autoPull) {
		throw new Error(
			`Ollama model "${model}" is not available locally. ` +
				`Run "ollama pull ${model}" or set OLLAMA_AUTO_PULL=true.`,
		)
	}

	await pullModel(model)
}

/**
 * Unload the current model from Ollama memory.
 * Used when switching between coding and general models.
 */
async function unloadModel(model: string): Promise<void> {
	try {
		await ollamaFetch('/api/chat', {
			model,
			messages: [],
			keep_alive: 0,
		})
	} catch {
		// Non-fatal — model may already be unloaded
	}
}

// ---------------------------------------------------------------------------
// Streaming parser
// ---------------------------------------------------------------------------

/**
 * Parse Ollama's NDJSON streaming response into async iterable of chunks.
 */
async function* parseOllamaStream(
	response: Response,
): AsyncGenerator<OllamaStreamChunk> {
	const reader = response.body?.getReader()
	if (!reader) {
		throw new Error('No response body from Ollama')
	}

	const decoder = new TextDecoder()
	let buffer = ''

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			// Keep the last (potentially incomplete) line in the buffer
			buffer = lines.pop() || ''

			for (const line of lines) {
				const trimmed = line.trim()
				if (!trimmed) continue
				try {
					yield JSON.parse(trimmed) as OllamaStreamChunk
				} catch {
					// Skip malformed JSON lines
				}
			}
		}

		// Process any remaining buffer
		if (buffer.trim()) {
			try {
				yield JSON.parse(buffer.trim()) as OllamaStreamChunk
			} catch {
				// Skip
			}
		}
	} finally {
		reader.releaseLock()
	}
}

// ---------------------------------------------------------------------------
// Anthropic-compatible client
// ---------------------------------------------------------------------------

/**
 * A mock Stream class that wraps an async generator and provides
 * the same interface as the Anthropic SDK's Stream class.
 */
class OllamaStream {
	private generator: AsyncGenerator<Record<string, unknown>>
	private _response: Response
	private _request_id: string

	constructor(
		generator: AsyncGenerator<Record<string, unknown>>,
		response: Response,
		requestId: string,
	) {
		this.generator = generator
		this._response = response
		this._request_id = requestId
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Record<string, unknown>> {
		yield* this.generator
	}

	/**
	 * Collect all events and build the final message.
	 */
	async finalMessage(): Promise<Record<string, unknown>> {
		const contentBlocks: Array<Record<string, unknown>> = []
		let stopReason = 'end_turn'
		let inputTokens = 0
		let outputTokens = 0
		let model = ''

		for await (const event of this.generator) {
			if (event.type === 'message_start') {
				const msg = event.message as Record<string, unknown>
				model = msg.model as string
			} else if (event.type === 'content_block_start') {
				const block = event.content_block as Record<string, unknown>
				contentBlocks.push({ ...block })
			} else if (event.type === 'content_block_delta') {
				const idx = event.index as number
				const delta = event.delta as Record<string, unknown>
				if (delta.type === 'text_delta' && contentBlocks[idx]) {
					contentBlocks[idx].text =
						((contentBlocks[idx].text as string) || '') +
						(delta.text as string)
				} else if (
					delta.type === 'input_json_delta' &&
					contentBlocks[idx]
				) {
					contentBlocks[idx].input =
						((contentBlocks[idx].input as string) || '') +
						(delta.input as string)
				}
			} else if (event.type === 'message_delta') {
				const delta = event.delta as Record<string, unknown>
				stopReason = (delta.stop_reason as string) || stopReason
				const usage = event.usage as Record<string, unknown>
				if (usage) {
					outputTokens = (usage.output_tokens as number) || outputTokens
				}
			}
		}

		// Parse JSON input fields for tool_use blocks
		for (const block of contentBlocks) {
			if (block.type === 'tool_use' && typeof block.input === 'string') {
				try {
					block.input = JSON.parse(block.input as string)
				} catch {
					block.input = {}
				}
			}
		}

		return {
			id: `msg_ollama_${Date.now()}`,
			type: 'message',
			role: 'assistant',
			content: contentBlocks,
			model,
			stop_reason: stopReason,
			stop_sequence: null,
			usage: {
				input_tokens: inputTokens,
				output_tokens: outputTokens,
			},
		}
	}

	withResponse(): {
		data: OllamaStream
		request_id: string
		response: Response
	} {
		return {
			data: this,
			request_id: this._request_id,
			response: this._response,
		}
	}
}

/**
 * The main Ollama client that masquerades as an Anthropic client.
 * Implements the subset of the Anthropic SDK interface used by Claude Code.
 */
export class OllamaAnthropicClient {
	beta: {
		messages: {
			create: (
				params: Record<string, unknown>,
				options?: Record<string, unknown>,
			) => OllamaStream
		}
	}

	messages: {
		create: (
			params: Record<string, unknown>,
			options?: Record<string, unknown>,
		) => OllamaStream
	}

	models: {
		list: (params?: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>
	}

	constructor() {
		const self = this

		const createFn = (
			params: Record<string, unknown>,
			options?: Record<string, unknown>,
		): OllamaStream => {
			return self._createStream(params, options)
		}

		this.beta = { messages: { create: createFn } }
		this.messages = { create: createFn }
		this.models = {
			async *list() {
				// Return empty — Ollama model capabilities are handled locally
			},
		}
	}

	private _createStream(
		params: Record<string, unknown>,
		options?: Record<string, unknown>,
	): OllamaStream {
		const requestId = `req_ollama_${Date.now()}`
		const signal = options?.signal as AbortSignal | undefined

		// Determine model — either explicitly set or auto-detect from messages
		let model = params.model as string
		const config = getOllamaConfig()

		// If model is an Anthropic model name (e.g. claude-sonnet-4-20250514),
		// or not explicitly an Ollama model, use task detection
		if (!model || model.startsWith('claude-') || model.includes('anthropic')) {
			const messages = params.messages as Array<Record<string, unknown>>
			const lastUserMsg = [...messages]
				.reverse()
				.find((m) => m.role === 'user')
			let promptText = ''
			if (lastUserMsg) {
				if (typeof lastUserMsg.content === 'string') {
					promptText = lastUserMsg.content
				} else if (Array.isArray(lastUserMsg.content)) {
					promptText = (
						lastUserMsg.content as Array<Record<string, unknown>>
					)
						.filter((b) => b.type === 'text')
						.map((b) => b.text as string)
						.join(' ')
				}
			}

			const taskType = detectTaskType(promptText)
			const newModel = getOllamaModelForTask(taskType)

			// Handle model switching — unload previous model if different
			const currentModel = getCurrentLoadedModel()
			if (currentModel && currentModel !== newModel) {
				// Fire and forget unload — don't block the request
				unloadModel(currentModel).catch(() => {})
			}

			model = newModel
			setCurrentLoadedModel(model)
		}

		// Create async generator that handles the full request lifecycle
		const generator = (async function* () {
			// Ensure model is available (auto-pull if needed)
			await ensureModelAvailable(model)

			// Convert messages
			const ollamaMessages = anthropicToOllama(
				params.messages as Array<{
					role: string
					content: string | Array<Record<string, unknown>>
				}>,
				params.system as
					| string
					| Array<Record<string, unknown>>
					| undefined,
			)

			// Convert tools
			const ollamaTools = anthropicToolsToOllama(
				params.tools as Array<Record<string, unknown>> | undefined,
			)

			// Build request
			const chatRequest: OllamaChatRequest = {
				model,
				messages: ollamaMessages,
				stream: true,
				...(ollamaTools && { tools: ollamaTools }),
				options: {
					num_gpu: config.numGpu,
					...(params.temperature !== undefined && {
						temperature: params.temperature as number,
					}),
					// Use a reasonable context window
					num_ctx: 32768,
				},
				keep_alive: config.keepAlive,
			}

			// Make the request
			const resp = await ollamaFetch(
				'/api/chat',
				chatRequest as unknown as Record<string, unknown>,
				signal,
			)

			if (!resp.ok) {
				const errorText = await resp.text().catch(() => 'Unknown error')
				throw new Error(
					`Ollama API error: ${resp.status} ${resp.statusText} — ${errorText}`,
				)
			}

			// Parse and convert the stream
			const ollamaChunks = parseOllamaStream(resp)
			yield* ollamaStreamToAnthropicEvents(ollamaChunks, model)
		})()

		// Create a mock Response to satisfy the withResponse() interface
		const mockResponse = new Response(null, { status: 200 })

		return new OllamaStream(generator, mockResponse, requestId)
	}
}
