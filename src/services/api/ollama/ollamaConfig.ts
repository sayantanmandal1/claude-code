/**
 * Ollama configuration — connection settings and model parameters.
 */

export interface OllamaConfig {
	/** Ollama server base URL */
	host: string
	/** Model for coding tasks */
	codingModel: string
	/** Model for general tasks */
	generalModel: string
	/** Number of GPU layers (999 = all, 0 = CPU only) */
	numGpu: number
	/** Auto-pull models if not available */
	autoPull: boolean
	/** Keep model loaded in memory duration (e.g. '5m', '1h', '0' to unload) */
	keepAlive: string
}

let cachedConfig: OllamaConfig | null = null

export function getOllamaConfig(): OllamaConfig {
	if (cachedConfig) return cachedConfig

	cachedConfig = {
		host: process.env.OLLAMA_HOST || 'http://localhost:11434',
		codingModel: process.env.OLLAMA_CODING_MODEL || 'qwen2.5-coder:14b',
		generalModel: process.env.OLLAMA_GENERAL_MODEL || 'qwen2.5:14b',
		numGpu: parseInt(process.env.OLLAMA_NUM_GPU || '999', 10),
		autoPull: process.env.OLLAMA_AUTO_PULL !== 'false',
		keepAlive: process.env.OLLAMA_KEEP_ALIVE || '5m',
	}

	return cachedConfig
}

/** Reset cached config (useful for testing or env var changes) */
export function resetOllamaConfig(): void {
	cachedConfig = null
}
