/**
 * Ollama adapter module — provides local LLM support via Ollama.
 *
 * Implements the Anthropic SDK interface so the rest of the codebase
 * can use Ollama models transparently through the same provider pattern.
 */

export { OllamaAnthropicClient } from './ollamaClient.js'
export { getOllamaConfig, type OllamaConfig } from './ollamaConfig.js'
export {
	detectTaskType,
	type TaskType,
	OLLAMA_MODEL_REGISTRY,
} from './taskDetector.js'
export {
	anthropicToOllama,
	ollamaStreamToAnthropicEvents,
} from './formatConverter.js'
