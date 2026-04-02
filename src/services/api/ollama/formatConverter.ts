/**
 * Format converter — bidirectional translation between Anthropic SDK
 * message format and Ollama /api/chat format.
 *
 * Anthropic uses a structured content block model:
 *   { role, content: [{ type: 'text', text }, { type: 'tool_use', ... }] }
 *
 * Ollama uses OpenAI-compatible chat format:
 *   { role, content, tool_calls: [{ function: { name, arguments } }] }
 */

// ---------------------------------------------------------------------------
// Types — Ollama API shapes
// ---------------------------------------------------------------------------

export interface OllamaMessage {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string
	tool_calls?: OllamaToolCall[]
	images?: string[]
}

export interface OllamaToolCall {
	id?: string
	function: {
		name: string
		arguments: Record<string, unknown>
	}
}

export interface OllamaTool {
	type: 'function'
	function: {
		name: string
		description: string
		parameters: Record<string, unknown>
	}
}

export interface OllamaChatRequest {
	model: string
	messages: OllamaMessage[]
	stream: boolean
	tools?: OllamaTool[]
	options?: {
		num_gpu?: number
		temperature?: number
		num_ctx?: number
	}
	keep_alive?: string
}

export interface OllamaStreamChunk {
	model: string
	created_at: string
	message: {
		role: 'assistant'
		content: string
		tool_calls?: OllamaToolCall[]
	}
	done: boolean
	done_reason?: string
	total_duration?: number
	load_duration?: number
	prompt_eval_count?: number
	eval_count?: number
	eval_duration?: number
}

// ---------------------------------------------------------------------------
// Anthropic → Ollama conversion
// ---------------------------------------------------------------------------

/**
 * Convert Anthropic-format messages to Ollama-format messages.
 * Handles text, tool_use, tool_result, and image content blocks.
 */
export function anthropicToOllama(
	messages: Array<{
		role: string
		content: string | Array<Record<string, unknown>>
	}>,
	system?: string | Array<Record<string, unknown>>,
): OllamaMessage[] {
	const result: OllamaMessage[] = []

	// Add system message if present
	if (system) {
		const systemText =
			typeof system === 'string'
				? system
				: system
						.filter((b) => b.type === 'text')
						.map((b) => b.text as string)
						.join('\n')
		if (systemText) {
			result.push({ role: 'system', content: systemText })
		}
	}

	for (const msg of messages) {
		if (typeof msg.content === 'string') {
			result.push({
				role: msg.role as OllamaMessage['role'],
				content: msg.content,
			})
			continue
		}

		// Array content — process block by block
		const blocks = msg.content as Array<Record<string, unknown>>

		if (msg.role === 'assistant') {
			// Collect text and tool calls
			const textParts: string[] = []
			const toolCalls: OllamaToolCall[] = []

			for (const block of blocks) {
				if (block.type === 'text') {
					textParts.push(block.text as string)
				} else if (block.type === 'tool_use') {
					toolCalls.push({
						id: block.id as string,
						function: {
							name: block.name as string,
							arguments: (block.input as Record<string, unknown>) || {},
						},
					})
				}
				// Skip thinking blocks — Ollama doesn't support them
			}

			const ollamaMsg: OllamaMessage = {
				role: 'assistant',
				content: textParts.join('\n'),
			}
			if (toolCalls.length > 0) {
				ollamaMsg.tool_calls = toolCalls
			}
			result.push(ollamaMsg)
		} else if (msg.role === 'user') {
			// Handle tool results and text
			const textParts: string[] = []
			const images: string[] = []

			for (const block of blocks) {
				if (block.type === 'text') {
					textParts.push(block.text as string)
				} else if (block.type === 'tool_result') {
					// Convert tool result to a tool role message
					const toolContent = block.content
					let resultText: string
					if (typeof toolContent === 'string') {
						resultText = toolContent
					} else if (Array.isArray(toolContent)) {
						resultText = (toolContent as Array<Record<string, unknown>>)
							.filter((b) => b.type === 'text')
							.map((b) => b.text as string)
							.join('\n')
					} else {
						resultText = String(toolContent || '')
					}

					// Add as tool message (Ollama expects this for tool results)
					result.push({
						role: 'tool',
						content: resultText,
					})
				} else if (block.type === 'image') {
					// Extract base64 image data
					const source = block.source as Record<string, unknown>
					if (source && source.type === 'base64') {
						images.push(source.data as string)
					}
				}
			}

			if (textParts.length > 0 || images.length > 0) {
				const ollamaMsg: OllamaMessage = {
					role: 'user',
					content: textParts.join('\n'),
				}
				if (images.length > 0) {
					ollamaMsg.images = images
				}
				result.push(ollamaMsg)
			}
		}
	}

	return result
}

/**
 * Convert Anthropic tool definitions to Ollama tool format.
 */
export function anthropicToolsToOllama(
	tools?: Array<Record<string, unknown>>,
): OllamaTool[] | undefined {
	if (!tools || tools.length === 0) return undefined

	return tools
		.filter((tool) => tool.name && tool.input_schema)
		.map((tool) => ({
			type: 'function' as const,
			function: {
				name: tool.name as string,
				description: (tool.description as string) || '',
				parameters: (tool.input_schema as Record<string, unknown>) || {},
			},
		}))
}

// ---------------------------------------------------------------------------
// Ollama → Anthropic streaming event conversion
// ---------------------------------------------------------------------------

/**
 * Convert an async iterable of Ollama stream chunks into
 * Anthropic-compatible BetaRawMessageStreamEvent objects.
 *
 * This is a generator that yields events one at a time,
 * matching the exact event sequence the Anthropic SDK produces:
 *   message_start → content_block_start → content_block_delta* →
 *   content_block_stop → message_delta → message_stop
 */
export async function* ollamaStreamToAnthropicEvents(
	chunks: AsyncIterable<OllamaStreamChunk>,
	model: string,
): AsyncGenerator<Record<string, unknown>> {
	let blockIndex = 0
	let inputTokens = 0
	let outputTokens = 0
	let textStarted = false
	let toolCallsAccumulator: Map<
		number,
		{ id: string; name: string; argsJson: string }
	> = new Map()
	let pendingToolCalls = false
	let firstChunk = true

	for await (const chunk of chunks) {
		// Emit message_start on first chunk
		if (firstChunk) {
			firstChunk = false
			yield {
				type: 'message_start',
				message: {
					id: `msg_ollama_${Date.now()}`,
					type: 'message',
					role: 'assistant',
					content: [],
					model,
					stop_reason: null,
					stop_sequence: null,
					usage: {
						input_tokens: 0,
						output_tokens: 0,
					},
				},
			}
		}

		const { message: msg, done } = chunk

		// Handle text content
		if (msg.content && msg.content.length > 0) {
			if (!textStarted) {
				textStarted = true
				yield {
					type: 'content_block_start',
					index: blockIndex,
					content_block: { type: 'text', text: '' },
				}
			}
			yield {
				type: 'content_block_delta',
				index: blockIndex,
				delta: { type: 'text_delta', text: msg.content },
			}
		}

		// Handle tool calls in stream
		if (msg.tool_calls && msg.tool_calls.length > 0) {
			// Close text block if open
			if (textStarted) {
				yield { type: 'content_block_stop', index: blockIndex }
				blockIndex++
				textStarted = false
			}

			for (const tc of msg.tool_calls) {
				const toolId =
					tc.id || `toolu_ollama_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
				const name = tc.function.name
				const argsJson = JSON.stringify(tc.function.arguments || {})

				// Emit tool_use block
				yield {
					type: 'content_block_start',
					index: blockIndex,
					content_block: {
						type: 'tool_use',
						id: toolId,
						name,
						input: '',
					},
				}

				// Emit the full arguments as a single delta
				yield {
					type: 'content_block_delta',
					index: blockIndex,
					delta: { type: 'input_json_delta', input: argsJson },
				}

				yield { type: 'content_block_stop', index: blockIndex }
				blockIndex++
				pendingToolCalls = true
			}
		}

		// Handle stream completion
		if (done) {
			// Close text block if still open
			if (textStarted) {
				yield { type: 'content_block_stop', index: blockIndex }
				blockIndex++
			}

			// Capture token counts from Ollama's response
			inputTokens = chunk.prompt_eval_count || 0
			outputTokens = chunk.eval_count || 0

			const stopReason = pendingToolCalls ? 'tool_use' : 'end_turn'

			yield {
				type: 'message_delta',
				delta: {
					stop_reason: stopReason,
					stop_sequence: null,
				},
				usage: {
					output_tokens: outputTokens,
				},
			}

			yield { type: 'message_stop' }
		}
	}
}
