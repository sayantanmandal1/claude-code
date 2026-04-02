# Contributing

Thanks for your interest in contributing to Claude Code!

## What You Can Contribute

- **Documentation** — Improve or expand the [docs/](docs/) directory
- **MCP Server** — Enhance the exploration MCP server in [mcp-server/](mcp-server/)
- **Ollama Integration** — Improve local LLM support, add new model profiles
- **Analysis** — Write-ups, architecture diagrams, or annotated walkthroughs
- **Tooling** — Scripts or tools that aid in development
- **Bug fixes** — Fix issues in the MCP server, Ollama adapter, or supporting infrastructure

## Getting Started

### Prerequisites

- **[Bun](https://bun.sh)** v1.1.0+ (runtime)
- **[Node.js](https://nodejs.org)** 18+ (for the MCP server)
- **Git**

### Setup

```bash
git clone https://github.com/sayantanmandal/claude-code.git
cd claude-code
bun install
```

### Development

```bash
bun run dev           # Run in development mode
bun run build         # Debug build
bun run build:prod    # Production build
bun run typecheck     # TypeScript type check
bun run lint          # Biome lint
bun run check         # Lint + typecheck
```

### MCP Server Development

```bash
cd mcp-server
npm install
npm run dev    # Run with tsx (no build step)
npm run build  # Compile to dist/
```

## Code Style

- TypeScript with strict mode
- ES modules
- Tabs for indentation (matches Biome config)
- Descriptive variable names, minimal comments

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes
4. Run `bun run check` to validate
5. Commit with a clear message
6. Push and open a pull request

## Questions?

Open an issue on [GitHub](https://github.com/sayantanmandal/claude-code/issues).
