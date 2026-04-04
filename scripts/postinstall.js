#!/usr/bin/env node
// Create stub packages for Anthropic-internal dependencies
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const stubs = [
  {
    name: '@anthropic-ai/sandbox-runtime',
    packageJson: {
      name: '@anthropic-ai/sandbox-runtime',
      version: '0.0.0-stub',
      type: 'module',
      main: 'index.js'
    },
    indexJs: `// Stub for @anthropic-ai/sandbox-runtime
export class SandboxManager {}
export class SandboxViolationStore {}
export const SandboxRuntimeConfigSchema = {}
export default {}
`
  },
  {
    name: '@anthropic-ai/claude-agent-sdk',
    packageJson: {
      name: '@anthropic-ai/claude-agent-sdk',
      version: '0.0.0-stub',
      type: 'module',
      main: 'index.js'
    },
    indexJs: `// Stub for @anthropic-ai/claude-agent-sdk
export default {}
`
  },
  {
    name: '@ant/computer-use-mcp',
    packageJson: {
      name: '@ant/computer-use-mcp',
      version: '0.0.0-stub',
      type: 'module',
      main: 'index.js',
      exports: {
        '.': './index.js',
        './*': './*.js'
      }
    },
    indexJs: `// Stub for @ant/computer-use-mcp - exports everything as empty functions
const handler = {
  get: (target, prop) => {
    if (prop === 'default') return {};
    if (prop === Symbol.toStringTag) return 'Module';
    if (prop === '__esModule') return true;
    // Return empty function or empty object
    return typeof prop === 'string' ? (() => {}) : undefined;
  }
};

const stub = new Proxy({}, handler);

// Export specific known exports
export const API_RESIZE_PARAMS = {};
export const targetImageSize = () => ({});
export const bindSessionContext = () => {};
export const DEFAULT_GRANT_FLAGS = [];
export const buildComputerUseTools = () => [];
export const COMPUTER_USE_TOOL_NAMES = [];
export const ComputerUseTool = class {};
export const createComputerUseMcpServer = () => ({});

export default stub;
`,
    extraFiles: {
      'sentinelApps.js': '// Stub\nexport const getSentinelCategory = () => null\nexport default []\n',
      'types.js': '// Stub\nexport const DEFAULT_GRANT_FLAGS = []\nexport default {}\n'
    }
  },
  {
    name: '@ant/claude-for-chrome-mcp',
    packageJson: {
      name: '@ant/claude-for-chrome-mcp',
      version: '0.0.0-stub',
      type: 'module',
      main: 'index.js',
      exports: {
        '.': './index.js',
        './*': './*.js'
      }
    },
    indexJs: `// Stub for @ant/claude-for-chrome-mcp
export const BROWSER_TOOLS = [];
export const createClaudeForChromeMcpServer = () => ({});
export default {};
`
  }
]

for (const stub of stubs) {
  const dir = join(ROOT, 'node_modules', ...stub.name.split('/'))
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify(stub.packageJson, null, 2))
    writeFileSync(join(dir, 'index.js'), stub.indexJs)
    
    // Write extra files if any
    if (stub.extraFiles) {
      for (const [filename, content] of Object.entries(stub.extraFiles)) {
        writeFileSync(join(dir, filename), content)
      }
    }
    
    console.log(`Created stub for ${stub.name}`)
  } catch (err) {
    console.error(`Failed to create stub for ${stub.name}:`, err.message)
  }
}
