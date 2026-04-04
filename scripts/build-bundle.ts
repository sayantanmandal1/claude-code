// scripts/build-bundle.ts
// Usage: bun scripts/build-bundle.ts [--watch] [--minify] [--no-sourcemap]
//
// Production build: bun scripts/build-bundle.ts --minify
// Dev build:        bun scripts/build-bundle.ts
// Watch mode:       bun scripts/build-bundle.ts --watch

import * as esbuild from 'esbuild'
import { resolve, dirname } from 'path'
import { chmodSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

// Bun: import.meta.dir — Node 21+: import.meta.dirname — fallback
const __dir: string =
  (import.meta as any).dir ??
  (import.meta as any).dirname ??
  dirname(fileURLToPath(import.meta.url))

const ROOT = resolve(__dir, '..')
const watch = process.argv.includes('--watch')
const minify = process.argv.includes('--minify')
const noSourcemap = process.argv.includes('--no-sourcemap')

// Read version from package.json for MACRO injection
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))
const version = pkg.version || '0.0.0-dev'

// ── Plugin: resolve .js imports to .ts files ──
// The codebase uses `import ... from './foo.js'` but the actual files are .ts/.tsx
// This plugin resolves those imports to the correct TypeScript files.
const srcResolverPlugin: esbuild.Plugin = {
  name: 'src-resolver',
  setup(build) {
    // Handle bare 'src/' imports (tsconfig baseUrl: ".")
    build.onResolve({ filter: /^src\// }, (args) => {
      const basePath = resolve(ROOT, args.path)
      return resolveToTsFile(basePath)
    })

    // Handle relative .js/.jsx imports
    build.onResolve({ filter: /\.(js|jsx)$/ }, (args) => {
      // Skip external packages
      if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
        return undefined
      }

      const basePath = resolve(args.resolveDir, args.path)
      return resolveToTsFile(basePath)
    })
  },
}

function resolveToTsFile(basePath: string): esbuild.OnResolveResult | undefined {
  // Already exists as-is
  if (existsSync(basePath)) {
    return { path: basePath }
  }

  // Strip .js/.jsx and try TypeScript extensions
  const withoutExt = basePath.replace(/\.(js|jsx)$/, '')
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = withoutExt + ext
    if (existsSync(candidate)) {
      return { path: candidate }
    }
  }

  // Try as directory with index file
  const dirPath = basePath.replace(/\.(js|jsx)$/, '')
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = resolve(dirPath, 'index' + ext)
    if (existsSync(candidate)) {
      return { path: candidate }
    }
  }

  // Let esbuild handle it (will error if truly missing)
  return undefined
}

// ── Plugin: load .md and .txt files as strings ──
const textFileLoaderPlugin: esbuild.Plugin = {
  name: 'text-file-loader',
  setup(build) {
    build.onLoad({ filter: /\.(md|txt)$/ }, async (args) => {
      // Check if file exists
      if (!existsSync(args.path)) {
        // Return empty string for missing files
        return {
          contents: `export default ''`,
          loader: 'js',
        }
      }
      
      const text = readFileSync(args.path, 'utf-8')
      return {
        contents: `export default ${JSON.stringify(text)}`,
        loader: 'js',
      }
    })
  },
}

// ── Plugin: handle missing optional files (feature-gated code) ──
// Many imports are behind feature() checks and may not exist in external builds
// This plugin stubs them out so the build doesn't fail
const optionalFilePlugin: esbuild.Plugin = {
  name: 'optional-file',
  setup(build) {
    // List of path patterns that are optional (Anthropic-internal features)
    const optionalPatterns = [
      /\/ink\/devtools\.js$/,
      /\/ink\/global\.d\.ts$/,
      /\/commands\/proactive\.js$/,
      /\/commands\/assistant\//,
      /\/commands\/fork\//,
      /\/commands\/force-snip\.js$/,
      /\/commands\/workflows\//,
      /\/commands\/subscribe-pr\.js$/,
      /\/commands\/torch\.js$/,
      /\/commands\/peers\//,
      /\/commands\/buddy\//,
      /\/jobs\/classifier\.js$/,
      /\/skills\/bundled\/dream\.js$/,
      /\/skills\/bundled\/hunter\.js$/,
      /\/skills\/bundled\/runSkillGenerator\.js$/,
      /\/skills\/bundled\/verify\//,
      /\/skills\/bundled\/claude-api\//,
      /yolo-classifier-prompts\//,
      /\/filePersistence\/types\.js$/,
      /\/proactive\//,
      /\/assistant\//,
      /\/daemon\//,
      /\/cli\/bg\.js$/,
      /\/coordinator\//,
      /\/sdk\//,
      /\/server\//,
      /\/ssh\//,
      /\/utils\/ultraplan\/prompt\.txt$/,
      /snipCompact/,
      /snipProjection/,
      /contextCollapse/,
      /skillSearch/,
      /\/classifier\//,
      /attributionHooks/,
      /attributionTrailer/,
      /udsMessaging/,
      /udsClient/,
      /peerSessions/,
      /sessionTranscript/,
      /memoryShapeTelemetry/,
      /TungstenTool/,
      /remoteControlServer/,
      /\/workflows\//,
      /\/peers\//,
      /\/buddy\//,
      /connectorText/,
      /SnipBoundaryMessage/,
      /UserGitHubWebhookMessage/,
      /UserForkBoilerplateMessage/,
      /UserCrossSessionMessage/,
      /SnapshotUpdateDialog/,
      /AssistantSessionChooser/,
      /WorkflowDetailDialog/,
      /MonitorMcpDetailDialog/,
      /ReviewArtifact/,
      /WorkflowPermissionRequest/,
      /MonitorPermissionRequest/,
      /MonitorTool/,
      /WorkflowTool/,
      /WebBrowserPanel/,
      /TungstenLiveMonitor/,
      /useProactive/,
      /SendUserFileTool/,
      /SnipTool/,
      /\/tools\/SleepTool\//,
      /PushNotificationTool/,
      /SubscribePRTool/,
      /VerifyPlanExecutionTool/,
      /OverflowTestTool/,
      /CtxInspectTool/,
      /TerminalCaptureTool/,
      /WebBrowserTool/,
      /ListPeersTool/,
      /LocalWorkflowTask/,
      /MonitorMcpTask/,
      /reactiveCompact/,
      /\/claude-api\//,
      /\/verify\//,
      /systemThemeWatcher/,
      /cachedMCConfig/,
      /DiscoverSkillsTool/,
      /mcpSkills/,
      /skillsIndex/,
      /skillsLoader/,
      /skillsRegistry/,
      /skillsTypes/,
      /skillsUtils/,
      /skillsValidation/,
      /skillsWorker/,
      /skillsWorkflow/,
      /skillsWorkspace/,
      /skillsZod/,
      /\/bg\.js$/,
      /templateJobs/,
      /environment-runner/,
      /taskSummary/,
      /self-hosted-runner/,
      /cachedMicrocompact/,
      /\/utils\/forkedAgent/,
      /\/tasks\/InProcessTeammateTask\//,
      /\/utils\/swarm\//,
      /\/utils\/todo\//,
      /\/vim\//,
      /\/utils\/settings\/mdm\//,
      /directConnectManager/,
      /\/bridge\/isReplBridgeActive/,
      /\/handlers\/coordinatorHandler/,
      /\/utils\/classifierApprovals/,
      /coreTypes\.generated\.js$/,
    ]

    // High priority - run before other resolvers
    build.onResolve({ filter: /.*/ }, (args) => {
      // Skip if already in stub namespace
      if (args.namespace === 'stub-ns') return undefined
      
      // Skip external packages
      if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('src/')) {
        return undefined
      }

      // Resolve the full path to check against patterns
      const fullPath = args.path.startsWith('.') 
        ? resolve(args.resolveDir, args.path)
        : resolve(ROOT, args.path)

      // Check if this matches an optional pattern
      const isOptional = optionalPatterns.some(pattern => pattern.test(fullPath))
      if (isOptional) {
        return {
          path: fullPath,
          namespace: 'stub-ns',
        }
      }
      
      // Also stub if file doesn't exist and matches patterns
      if (!existsSync(fullPath)) {
        const isLikelyOptional = optionalPatterns.some(pattern => pattern.test(args.path))
        if (isLikelyOptional) {
          return {
            path: fullPath,
            namespace: 'stub-ns',
          }
        }
      }
      
      // Let other plugins handle it
      return undefined
    })

    // Provide empty stubs for optional files
    build.onLoad({ filter: /.*/, namespace: 'stub-ns' }, () => {
      return {
        contents: `
          // Stub for optional/missing file
          export default {};
          // Export a Proxy that returns empty functions for any property access
          const stub = new Proxy({}, {
            get: () => () => {},
            has: () => true
          });
          // Re-export everything from the stub
          export * from 'data:text/javascript,export default new Proxy({}, { get: () => () => {}, has: () => true })';
          // Named exports that might be imported
          export const __stub = true;
        `,
        loader: 'js',
      }
    })
  },
}

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [resolve(ROOT, 'src/entrypoints/cli.tsx')],
  bundle: true,
  platform: 'node',
  target: ['node20', 'es2022'],
  format: 'esm',
  outdir: resolve(ROOT, 'dist'),
  outExtension: { '.js': '.mjs' },

  // Single-file output — no code splitting for CLI tools
  splitting: false,

  plugins: [srcResolverPlugin, textFileLoaderPlugin, optionalFilePlugin],

  // Use tsconfig for baseUrl / paths resolution (complements plugin above)
  tsconfig: resolve(ROOT, 'tsconfig.json'),

  // Alias bun:bundle to our runtime shim
  alias: {
    'bun:bundle': resolve(ROOT, 'src/shims/bun-bundle.ts'),
  },

  // Don't bundle node built-ins or problematic native packages
  external: [
    // Node built-ins (with and without node: prefix)
    'fs', 'path', 'os', 'crypto', 'child_process', 'http', 'https',
    'net', 'tls', 'url', 'util', 'stream', 'events', 'buffer',
    'querystring', 'readline', 'zlib', 'assert', 'tty', 'worker_threads',
    'perf_hooks', 'async_hooks', 'dns', 'dgram', 'cluster',
    'string_decoder', 'module', 'vm', 'constants', 'domain',
    'console', 'process', 'v8', 'inspector',
    'node:*',
    // Native addons that can't be bundled
    'fsevents',
    'sharp',
    'image-processor-napi',
    'audio-capture-napi',
    'modifiers-napi',
    // Optional dependencies
    'bidi-js',
    'xss',
    'lru-cache',
    'asciichart',
    'turndown',
    'https-proxy-agent',
    'indent-string',
    '@alcalzone/ansi-tokenize',
    // Optional cloud/platform SDKs
    'env-paths',
    'shell-quote',
    'fflate',
    '@aws-sdk/client-bedrock',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-sts',
    '@aws-sdk/credential-provider-node',
    '@smithy/node-http-handler',
    '@smithy/core',
    '@anthropic-ai/bedrock-sdk',
    '@anthropic-ai/foundry-sdk',
    '@anthropic-ai/vertex-sdk',
    '@anthropic-ai/mcpb',
    '@azure/identity',
    'google-auth-library',
    // VSCode language server packages
    'vscode-jsonrpc',
    'vscode-languageserver',
    'vscode-languageserver-protocol',
    // OpenTelemetry exporters (optional)
    '@opentelemetry/exporter-metrics-otlp-grpc',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-proto',
    '@opentelemetry/exporter-prometheus',
    '@opentelemetry/exporter-logs-otlp-grpc',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/exporter-logs-otlp-proto',
    '@opentelemetry/exporter-trace-otlp-grpc',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-trace-otlp-proto',
    // Anthropic-internal packages (not published externally)
    '@anthropic-ai/sandbox-runtime',
    '@anthropic-ai/claude-agent-sdk',
    // Anthropic-internal (@ant/) packages — gated behind USER_TYPE === 'ant'
    '@ant/*',
  ],

  jsx: 'automatic',

  // Source maps for production debugging (external .map files)
  sourcemap: noSourcemap ? false : 'external',

  // Minification for production
  minify,

  // Tree shaking (on by default, explicit for clarity)
  treeShaking: true,

  // Define replacements — inline constants at build time
  // MACRO.* — originally inlined by Bun's bundler at compile time
  // process.env.USER_TYPE — eliminates 'ant' (Anthropic-internal) code branches
  define: {
    'MACRO.VERSION': JSON.stringify(version),
    'MACRO.PACKAGE_URL': JSON.stringify('@sayantanmandal/claude-code'),
    'MACRO.ISSUES_EXPLAINER': JSON.stringify(
      'report issues at https://github.com/sayantanmandal/claude-code/issues'
    ),
    'process.env.USER_TYPE': '"external"',
    'process.env.NODE_ENV': minify ? '"production"' : '"development"',
  },

  // Banner: shebang for direct CLI execution
  banner: {
    js: '#!/usr/bin/env node\n',
  },

  // Handle the .js → .ts resolution that the codebase uses
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],

  logLevel: 'info',

  // Metafile for bundle analysis
  metafile: true,
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('Watching for changes...')
  } else {
    const startTime = Date.now()
    const result = await esbuild.build(buildOptions)

    if (result.errors.length > 0) {
      console.error('Build failed')
      process.exit(1)
    }

    // Make the output executable
    const outPath = resolve(ROOT, 'dist/cli.mjs')
    try {
      chmodSync(outPath, 0o755)
    } catch {
      // chmod may fail on some platforms, non-fatal
    }

    const elapsed = Date.now() - startTime

    // Print bundle size info
    if (result.metafile) {
      const text = await esbuild.analyzeMetafile(result.metafile, { verbose: false })
      const outFiles = Object.entries(result.metafile.outputs)
      for (const [file, info] of outFiles) {
        if (file.endsWith('.mjs')) {
          const sizeMB = ((info as { bytes: number }).bytes / 1024 / 1024).toFixed(2)
          console.log(`\n  ${file}: ${sizeMB} MB`)
        }
      }
      console.log(`\nBuild complete in ${elapsed}ms → dist/`)

      // Write metafile for further analysis
      const { writeFileSync } = await import('fs')
      writeFileSync(
        resolve(ROOT, 'dist/meta.json'),
        JSON.stringify(result.metafile),
      )
      console.log('  Metafile written to dist/meta.json')
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
