<div align="center">

# Claude Code

**An AI-powered development assistant CLI**

[![TypeScript](https://img.shields.io/badge/TypeScript-512K%2B_lines-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![Bun](https://img.shields.io/badge/Runtime-Bun-f472b6?logo=bun&logoColor=white)](#tech-stack)
[![React + Ink](https://img.shields.io/badge/UI-React_%2B_Ink-61DAFB?logo=react&logoColor=black)](#tech-stack)
[![Files](https://img.shields.io/badge/~1,900_files-source_only-grey)](#directory-structure)
[![MCP Server](https://img.shields.io/badge/MCP-Explorer_Server-blueviolet)](#-explore-with-mcp-server)
[![npm](https://img.shields.io/npm/v/sayantan-claudemaster?label=npm&color=cb3837&logo=npm)](https://www.npmjs.com/package/sayantan-claudemaster)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Table of Contents

- [What Is Claude Code?](#what-is-claude-code)
- [Features](#features)
- [Quick Start](#quick-start)
- [Ollama (Local LLM) Support](#ollama-local-llm-support)
- [Documentation](#-documentation)
- [Explore with MCP Server](#-explore-with-mcp-server)
- [Directory Structure](#directory-structure)
- [Architecture](#architecture)
  - [Tool System](#1-tool-system)
  - [Command System](#2-command-system)
  - [Service Layer](#3-service-layer)
  - [Bridge System](#4-bridge-system)
  - [Permission System](#5-permission-system)
  - [Feature Flags](#6-feature-flags)
- [Key Files](#key-files)
- [Tech Stack](#tech-stack)
- [Design Patterns](#design-patterns)
- [Contributing](#contributing)
- [License](#license)

---

## What Is Claude Code?

Claude Code is a powerful CLI tool for interacting with AI directly from the terminal — editing files, running commands, searching codebases, managing git workflows, and more. It supports both **Anthropic's Claude API** and **locally hosted Ollama models** for fully offline, private AI-powered development.

| | |
|---|---|
| **Author** | [Sayantan](https://github.com/sayantanmandal) |
| **Language** | TypeScript (strict) |
| **Runtime** | [Bun](https://bun.sh) |
| **Terminal UI** | [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) |
| **Scale** | ~1,900 files · 512,000+ lines of code |

---

## Features

- **Multi-provider AI support** — Anthropic API, AWS Bedrock, Google Vertex, Azure Foundry, and **Ollama (local)**
- **Automatic model switching** — Automatically selects the best Ollama model for the task (coding vs. general)
- **Partial GPU offloading** — Run 14B parameter models on hardware with limited VRAM
- **40+ agent tools** — File I/O, search, shell execution, sub-agents, and more
- **85+ slash commands** — Git, code review, context management, configuration
- **IDE integration** — VS Code and JetBrains bridge
- **Multi-agent orchestration** — Spawn sub-agents and coordinate teams
- **MCP support** — Model Context Protocol for extensibility
- **Plugin system** — Built-in and third-party plugins

---

## Quick Start

### Prerequisites

- **[Bun](https://bun.sh)** v1.1.0+ (runtime)
- **[Node.js](https://nodejs.org)** 18+ (for MCP server)
- **Anthropic API key** OR **[Ollama](https://ollama.ai)** installed locally

### Install & Build

```bash
# Clone the repository
git clone https://github.com/sayantanmandal/claude-code.git
cd claude-code

# Install dependencies
bun install

# Build for production
bun run build:prod

# Run
node dist/cli.mjs
```

### Using with Anthropic API

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node dist/cli.mjs
```

### Using with Ollama (Local LLM)

```bash
export CLAUDE_CODE_USE_OLLAMA=true
export OLLAMA_HOST=http://localhost:11434  # optional, this is the default
node dist/cli.mjs
```

### Docker Quick Start

```bash
# With Anthropic API
docker build -t claude-code .
docker run --rm -e ANTHROPIC_API_KEY=sk-ant-... claude-code -p "hello"

# With Ollama (see Ollama section below for full docker-compose setup)
docker run --rm -e CLAUDE_CODE_USE_OLLAMA=true -e OLLAMA_HOST=http://host.docker.internal:11434 claude-code -p "hello"
```

---

## Ollama (Local LLM) Support

Claude Code supports running entirely offline using locally hosted Ollama models. The system automatically selects the right model based on your task:

| Task Type | Default Model | Best For |
|-----------|--------------|----------|
| **Coding** | `qwen2.5-coder:14b` | Code generation, debugging, refactoring |
| **General** | `qwen2.5:14b` | Chat, analysis, documentation, planning |

### Setup (Native)

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull the models (auto-pulled if OLLAMA_AUTO_PULL=true)
ollama pull qwen2.5-coder:14b
ollama pull qwen2.5:14b

# 3. Start Ollama (if not already running)
ollama serve

# 4. Run Claude Code with Ollama
CLAUDE_CODE_USE_OLLAMA=true node dist/cli.mjs
```

### Setup (Docker Compose)

```bash
cd docker

# Start both Claude Code web terminal and Ollama with GPU support
docker compose -f docker-compose.yml -f docker-compose.ollama.yml up

# Or without GPU (CPU only — slower but works everywhere)
docker compose -f docker-compose.yml -f docker-compose.ollama.yml up
# Set OLLAMA_NUM_GPU=0 in your .env for CPU-only mode
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CODE_USE_OLLAMA` | `false` | Enable Ollama provider |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server address |
| `OLLAMA_CODING_MODEL` | `qwen2.5-coder:14b` | Model for coding tasks |
| `OLLAMA_GENERAL_MODEL` | `qwen2.5:14b` | Model for general tasks |
| `OLLAMA_NUM_GPU` | `999` | GPU layers (999=all, lower=partial offload) |
| `OLLAMA_AUTO_PULL` | `true` | Auto-pull models if missing |
| `OLLAMA_KEEP_ALIVE` | `5m` | Keep model loaded in memory |

### Partial GPU Offloading

For machines with limited VRAM, you can partially load models — keeping some layers on GPU and the rest on CPU:

```bash
# Load only 20 layers on GPU (rest on CPU) — enables 14B models on 8GB VRAM
export OLLAMA_NUM_GPU=20

# CPU-only mode
export OLLAMA_NUM_GPU=0
```

### Model Switching

The system automatically detects whether your prompt is a coding task or a general task and switches models accordingly. When switching:
- The previous model is unloaded from memory (`keep_alive: 0`)
- The new model is loaded with the configured GPU settings
- No manual intervention needed

You can also force a specific model with the `/model` command or `ANTHROPIC_MODEL` env var.

---

## 📚 Documentation

For in-depth guides, see the [`docs/`](docs/) directory:

| Guide | Description |
|-------|-------------|
| **[Architecture](docs/architecture.md)** | Core pipeline, startup sequence, state management, rendering, data flow |
| **[Tools Reference](docs/tools.md)** | Complete catalog of all ~40 agent tools with categories and permission model |
| **[Commands Reference](docs/commands.md)** | All ~85 slash commands organized by category |
| **[Subsystems Guide](docs/subsystems.md)** | Deep dives into Bridge, MCP, Permissions, Plugins, Skills, Tasks, Memory, Voice |
| **[Exploration Guide](docs/exploration-guide.md)** | How to navigate the codebase — study paths, grep patterns, key files |

Also see: [CONTRIBUTING.md](CONTRIBUTING.md) · [MCP Server README](mcp-server/README.md)

---

## 🔍 Explore with MCP Server

This repo ships an [MCP server](https://modelcontextprotocol.io/) that lets any MCP-compatible client (Claude Code, Claude Desktop, VS Code Copilot, Cursor) explore the full source interactively.

### Install from npm

The MCP server is published as [`sayantan-claudemaster`](https://www.npmjs.com/package/sayantan-claudemaster) on npm:

```bash
# Claude Code
claude mcp add sayantan-claudemaster -- npx -y sayantan-claudemaster
```

### One-liner setup (from source)

```bash
git clone https://github.com/sayantanmandal/claude-code.git ~/claude-code \
  && cd ~/claude-code/mcp-server \
  && npm install && npm run build \
  && claude mcp add claude-code-explorer -- node ~/claude-code/mcp-server/dist/index.js
```

<details>
<summary><strong>Step-by-step setup</strong></summary>

```bash
# 1. Clone the repo
git clone https://github.com/sayantanmandal/claude-code.git
cd claude-code/mcp-server

# 2. Install & build
npm install && npm run build

# 3. Register with Claude Code
claude mcp add claude-code-explorer -- node /absolute/path/to/claude-code/mcp-server/dist/index.js
```

Replace `/absolute/path/to/claude-code` with your actual clone path.

</details>

<details>
<summary><strong>VS Code / Cursor / Claude Desktop config</strong></summary>

**VS Code** — add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "claude-code-explorer": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": { "CLAUDE_CODE_SRC_ROOT": "${workspaceFolder}/src" }
    }
  }
}
```

**Claude Desktop** — add to your config file:
```json
{
  "mcpServers": {
    "claude-code-explorer": {
      "command": "node",
      "args": ["/absolute/path/to/claude-code/mcp-server/dist/index.js"],
      "env": { "CLAUDE_CODE_SRC_ROOT": "/absolute/path/to/claude-code/src" }
    }
  }
}
```

**Cursor** — add to `~/.cursor/mcp.json` (same format as Claude Desktop).

</details>

### Available tools & prompts

| Tool | Description |
|------|-------------|
| `list_tools` | List all ~40 agent tools with source files |
| `list_commands` | List all ~50 slash commands with source files |
| `get_tool_source` | Read full source of any tool (e.g. BashTool, FileEditTool) |
| `get_command_source` | Read source of any slash command (e.g. review, mcp) |
| `read_source_file` | Read any file from `src/` by path |
| `search_source` | Grep across the entire source tree |
| `list_directory` | Browse `src/` directories |
| `get_architecture` | High-level architecture overview |

| Prompt | Description |
|--------|-------------|
| `explain_tool` | Deep-dive into how a specific tool works |
| `explain_command` | Understand a slash command's implementation |
| `architecture_overview` | Guided tour of the full architecture |
| `how_does_it_work` | Explain any subsystem (permissions, MCP, bridge, etc.) |
| `compare_tools` | Side-by-side comparison of two tools |

**Try asking:** *"How does the BashTool work?"* · *"Search for where permissions are checked"* · *"Show me the /review command source"*

### Custom source path / Remove

```bash
# Custom source location
claude mcp add claude-code-explorer -e CLAUDE_CODE_SRC_ROOT=/path/to/src -- node /path/to/mcp-server/dist/index.js

# Remove
claude mcp remove claude-code-explorer
```

---

## Directory Structure

```
src/
├── main.tsx                 # Entrypoint — Commander.js CLI parser + React/Ink renderer
├── QueryEngine.ts           # Core LLM API caller (~46K lines)
├── Tool.ts                  # Tool type definitions (~29K lines)
├── commands.ts              # Command registry (~25K lines)
├── tools.ts                 # Tool registry
├── context.ts               # System/user context collection
├── cost-tracker.ts          # Token cost tracking
│
├── tools/                   # Agent tool implementations (~40)
├── commands/                # Slash command implementations (~50)
├── components/              # Ink UI components (~140)
├── services/                # External service integrations
│   └── api/
│       └── ollama/          # Ollama adapter (local LLM support)
├── hooks/                   # React hooks (incl. permission checks)
├── types/                   # TypeScript type definitions
├── utils/                   # Utility functions
├── screens/                 # Full-screen UIs (Doctor, REPL, Resume)
│
├── bridge/                  # IDE integration (VS Code, JetBrains)
├── coordinator/             # Multi-agent orchestration
├── plugins/                 # Plugin system
├── skills/                  # Skill system
├── server/                  # Server mode
├── remote/                  # Remote sessions
├── memdir/                  # Persistent memory directory
├── tasks/                   # Task management
├── state/                   # State management
│
├── voice/                   # Voice input
├── vim/                     # Vim mode
├── keybindings/             # Keybinding configuration
├── schemas/                 # Config schemas (Zod)
├── migrations/              # Config migrations
├── entrypoints/             # Initialization logic
├── query/                   # Query pipeline
├── ink/                     # Ink renderer wrapper
├── buddy/                   # Companion sprite
├── native-ts/               # Native TypeScript utils
├── outputStyles/            # Output styling
└── upstreamproxy/           # Proxy configuration
```

---

## Architecture

### 1. Tool System

> `src/tools/` — Every tool Claude can invoke is a self-contained module with its own input schema, permission model, and execution logic.

| Tool | Description |
|---|---|
| **File I/O** | |
| `FileReadTool` | Read files (images, PDFs, notebooks) |
| `FileWriteTool` | Create / overwrite files |
| `FileEditTool` | Partial modification (string replacement) |
| `NotebookEditTool` | Jupyter notebook editing |
| **Search** | |
| `GlobTool` | File pattern matching |
| `GrepTool` | ripgrep-based content search |
| `WebSearchTool` | Web search |
| `WebFetchTool` | Fetch URL content |
| **Execution** | |
| `BashTool` | Shell command execution |
| `SkillTool` | Skill execution |
| `MCPTool` | MCP server tool invocation |
| `LSPTool` | Language Server Protocol integration |
| **Agents & Teams** | |
| `AgentTool` | Sub-agent spawning |
| `SendMessageTool` | Inter-agent messaging |
| `TeamCreateTool` / `TeamDeleteTool` | Team management |
| `TaskCreateTool` / `TaskUpdateTool` | Task management |
| **Mode & State** | |
| `EnterPlanModeTool` / `ExitPlanModeTool` | Plan mode toggle |
| `EnterWorktreeTool` / `ExitWorktreeTool` | Git worktree isolation |
| `ToolSearchTool` | Deferred tool discovery |
| `SleepTool` | Proactive mode wait |
| `CronCreateTool` | Scheduled triggers |
| `RemoteTriggerTool` | Remote trigger |
| `SyntheticOutputTool` | Structured output generation |

### 2. Command System

> `src/commands/` — User-facing slash commands invoked with `/` in the REPL.

| Command | Description | | Command | Description |
|---|---|---|---|---|
| `/commit` | Git commit | | `/memory` | Persistent memory |
| `/review` | Code review | | `/skills` | Skill management |
| `/compact` | Context compression | | `/tasks` | Task management |
| `/mcp` | MCP server management | | `/vim` | Vim mode toggle |
| `/config` | Settings | | `/diff` | View changes |
| `/doctor` | Environment diagnostics | | `/cost` | Check usage cost |
| `/login` / `/logout` | Auth | | `/theme` | Change theme |
| `/context` | Context visualization | | `/share` | Share session |
| `/pr_comments` | PR comments | | `/resume` | Restore session |
| `/desktop` | Desktop handoff | | `/mobile` | Mobile handoff |

### 3. Service Layer

> `src/services/` — External integrations and core infrastructure.

| Service | Description |
|---|---|
| `api/` | API clients (Anthropic, Ollama), file API, bootstrap |
| `api/ollama/` | Ollama adapter for local LLM support |
| `mcp/` | Model Context Protocol connection & management |
| `oauth/` | OAuth 2.0 authentication |
| `lsp/` | Language Server Protocol manager |
| `analytics/` | GrowthBook feature flags & analytics |
| `plugins/` | Plugin loader |
| `compact/` | Conversation context compression |
| `extractMemories/` | Automatic memory extraction |
| `teamMemorySync/` | Team memory synchronization |
| `tokenEstimation.ts` | Token count estimation |
| `policyLimits/` | Organization policy limits |
| `remoteManagedSettings/` | Remote managed settings |

### 4. Bridge System

> `src/bridge/` — Bidirectional communication layer connecting IDE extensions (VS Code, JetBrains) with the CLI.

Key files: `bridgeMain.ts` (main loop) · `bridgeMessaging.ts` (protocol) · `bridgePermissionCallbacks.ts` (permission callbacks) · `replBridge.ts` (REPL session) · `jwtUtils.ts` (JWT auth) · `sessionRunner.ts` (session execution)

### 5. Permission System

> `src/hooks/toolPermission/` — Checks permissions on every tool invocation.

Prompts the user for approval/denial or auto-resolves based on the configured permission mode: `default`, `plan`, `bypassPermissions`, `auto`, etc.

### 6. Feature Flags

Dead code elimination at build time via Bun's `bun:bundle`:

```typescript
import { feature } from 'bun:bundle'

const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
```

Notable flags: `PROACTIVE` · `KAIROS` · `BRIDGE_MODE` · `DAEMON` · `VOICE_MODE` · `AGENT_TRIGGERS` · `MONITOR_TOOL`

---

## Key Files

| File | Lines | Purpose |
|------|------:|---------|
| `QueryEngine.ts` | ~46K | Core LLM API engine — streaming, tool loops, thinking mode, retries, token counting |
| `Tool.ts` | ~29K | Base types/interfaces for all tools — input schemas, permissions, progress state |
| `commands.ts` | ~25K | Command registration & execution with conditional per-environment imports |
| `main.tsx` | — | CLI parser + React/Ink renderer; parallelizes MDM, keychain, and GrowthBook on startup |

---

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict) |
| Terminal UI | [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) |
| CLI Parsing | [Commander.js](https://github.com/tj/commander.js) (extra-typings) |
| Schema Validation | [Zod v4](https://zod.dev) |
| Code Search | [ripgrep](https://github.com/BurntSushi/ripgrep) (via GrepTool) |
| Protocols | [MCP SDK](https://modelcontextprotocol.io) · LSP |
| API | [Anthropic SDK](https://docs.anthropic.com) · [Ollama](https://ollama.ai) |
| Telemetry | OpenTelemetry + gRPC |
| Feature Flags | GrowthBook |
| Auth | OAuth 2.0 · JWT · macOS Keychain |

---

## Design Patterns

<details>
<summary><strong>Parallel Prefetch</strong> — Startup optimization</summary>

MDM settings, keychain reads, and API preconnect fire in parallel as side-effects before heavy module evaluation:

```typescript
// main.tsx
startMdmRawRead()
startKeychainPrefetch()
```

</details>

<details>
<summary><strong>Lazy Loading</strong> — Deferred heavy modules</summary>

OpenTelemetry (~400KB) and gRPC (~700KB) are loaded via dynamic `import()` only when needed.

</details>

<details>
<summary><strong>Agent Swarms</strong> — Multi-agent orchestration</summary>

Sub-agents spawn via `AgentTool`, with `coordinator/` handling orchestration. `TeamCreateTool` enables team-level parallel work.

</details>

<details>
<summary><strong>Skill System</strong> — Reusable workflows</summary>

Defined in `skills/` and executed through `SkillTool`. Users can add custom skills.

</details>

<details>
<summary><strong>Plugin Architecture</strong> — Extensibility</summary>

Built-in and third-party plugins loaded through the `plugins/` subsystem.

</details>

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Sayantan
