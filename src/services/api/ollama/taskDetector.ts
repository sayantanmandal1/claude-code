/**
 * Task detector — classifies user prompts as coding or general tasks
 * and selects the appropriate Ollama model.
 */

import { getOllamaConfig } from './ollamaConfig.js'

export type TaskType = 'coding' | 'general'

export interface ModelProfile {
	model: string
	taskType: TaskType
	description: string
}

export const OLLAMA_MODEL_REGISTRY: Record<TaskType, ModelProfile> = {
	coding: {
		model: 'qwen2.5-coder:14b',
		taskType: 'coding',
		description: 'Code generation, debugging, refactoring, implementation',
	},
	general: {
		model: 'qwen2.5:14b',
		taskType: 'general',
		description: 'Chat, analysis, documentation, planning, explanations',
	},
}

/** Keywords that strongly indicate a coding task */
const CODING_SIGNALS = new Set([
	'implement',
	'debug',
	'fix',
	'refactor',
	'code',
	'function',
	'class',
	'method',
	'variable',
	'compile',
	'build',
	'error',
	'bug',
	'test',
	'unittest',
	'api',
	'endpoint',
	'import',
	'export',
	'module',
	'package',
	'dependency',
	'type',
	'interface',
	'struct',
	'enum',
	'async',
	'await',
	'promise',
	'callback',
	'loop',
	'array',
	'object',
	'string',
	'number',
	'boolean',
	'null',
	'undefined',
	'return',
	'const',
	'let',
	'var',
	'if',
	'else',
	'switch',
	'try',
	'catch',
	'throw',
	'typescript',
	'javascript',
	'python',
	'rust',
	'golang',
	'java',
	'csharp',
	'cpp',
	'sql',
	'html',
	'css',
	'react',
	'vue',
	'angular',
	'node',
	'deno',
	'bun',
	'npm',
	'yarn',
	'pnpm',
	'git',
	'commit',
	'merge',
	'rebase',
	'pull',
	'push',
	'branch',
	'dockerfile',
	'docker',
	'kubernetes',
	'deploy',
	'ci',
	'cd',
	'pipeline',
	'lint',
	'format',
	'prettier',
	'eslint',
	'biome',
	'webpack',
	'vite',
	'esbuild',
	'rollup',
	'regex',
	'algorithm',
	'data structure',
	'binary',
	'hash',
	'tree',
	'graph',
	'stack',
	'queue',
	'linked list',
	'database',
	'schema',
	'migration',
	'query',
	'orm',
	'prisma',
	'sequelize',
	'middleware',
	'authentication',
	'authorization',
	'jwt',
	'oauth',
	'cors',
	'websocket',
	'rest',
	'graphql',
	'grpc',
])

/** Keywords that strongly indicate a general (non-coding) task */
const GENERAL_SIGNALS = new Set([
	'explain',
	'summarize',
	'summary',
	'plan',
	'review',
	'document',
	'documentation',
	'help',
	'what is',
	'how does',
	'why',
	'describe',
	'compare',
	'analyze',
	'analysis',
	'brainstorm',
	'idea',
	'suggest',
	'recommendation',
	'advice',
	'opinion',
	'think',
	'consider',
	'evaluate',
	'assess',
	'pros and cons',
	'tradeoff',
	'strategy',
	'approach',
	'design',
	'architecture',
	'overview',
	'outline',
	'draft',
	'write',
	'email',
	'message',
	'letter',
	'report',
	'presentation',
	'meeting',
	'agenda',
	'notes',
	'translate',
	'rephrase',
	'rewrite',
	'simplify',
	'elaborate',
])

/**
 * Detect whether a user prompt is a coding task or general task.
 * Uses keyword matching with scoring — coding signals get weighted
 * higher if code blocks or file paths are present.
 */
export function detectTaskType(prompt: string): TaskType {
	const lower = prompt.toLowerCase()
	const words = lower.split(/\s+/)

	let codingScore = 0
	let generalScore = 0

	// Check for code blocks (strong coding signal)
	if (/```[\s\S]*```/.test(prompt) || /`[^`]+`/.test(prompt)) {
		codingScore += 3
	}

	// Check for file paths (strong coding signal)
	if (
		/\.(ts|tsx|js|jsx|py|rs|go|java|cs|cpp|c|h|rb|php|swift|kt|scala|sql|sh|bash|yaml|yml|json|toml|xml|html|css|scss|less|md|txt)\b/.test(
			lower,
		)
	) {
		codingScore += 2
	}

	// Check for file path patterns
	if (/(?:src|lib|bin|dist|build|node_modules|\.config)\//i.test(prompt)) {
		codingScore += 2
	}

	// Check for error stack traces
	if (/at\s+\w+\s+\(.*:\d+:\d+\)/.test(prompt) || /Error:/.test(prompt)) {
		codingScore += 3
	}

	// Score individual words
	for (const word of words) {
		const cleanWord = word.replace(/[^a-z0-9]/g, '')
		if (CODING_SIGNALS.has(cleanWord)) {
			codingScore += 1
		}
		if (GENERAL_SIGNALS.has(cleanWord)) {
			generalScore += 1
		}
	}

	// Check multi-word phrases
	for (const phrase of GENERAL_SIGNALS) {
		if (phrase.includes(' ') && lower.includes(phrase)) {
			generalScore += 2
		}
	}
	for (const phrase of CODING_SIGNALS) {
		if (phrase.includes(' ') && lower.includes(phrase)) {
			codingScore += 2
		}
	}

	// Default to coding if tied or ambiguous (safer for a dev tool)
	return codingScore >= generalScore ? 'coding' : 'general'
}

/**
 * Get the appropriate Ollama model for a given task type.
 * Uses environment variable overrides if set, otherwise defaults
 * from the model registry.
 */
export function getOllamaModelForTask(taskType: TaskType): string {
	const config = getOllamaConfig()
	return taskType === 'coding' ? config.codingModel : config.generalModel
}

/** Currently loaded model (for tracking switches) */
let currentLoadedModel: string | null = null

export function getCurrentLoadedModel(): string | null {
	return currentLoadedModel
}

export function setCurrentLoadedModel(model: string | null): void {
	currentLoadedModel = model
}
