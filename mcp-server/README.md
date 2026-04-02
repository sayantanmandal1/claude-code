# Sayantan Claudemaster — MCP Server

A standalone [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets any MCP-compatible client explore the Claude Code source code. By [Sayantan](https://github.com/sayantanmandal). Supports **STDIO**, **Streamable HTTP**, and **SSE** transports.

## What It Does

Exposes 8 tools, 3 resources, and 5 prompts for navigating the ~1,900-file, 512K+ line Claude Code codebase. Published as `sayantan-claudemaster` on npm.

### Transports

| Transport | Endpoint | Best For |
|-----------|----------|----------|
| **STDIO** | `node dist/index.js` | Claude Desktop, local Claude Code, VS Code |
| **Streamable HTTP** | `POST/GET /mcp` | Modern MCP clients, remote hosting |
| **Legacy SSE** | `GET /sse` + `POST /messages` | Older MCP clients |

### Tools

| Tool | Description |
|------|-------------|
| `list_tools` | List all 40+ agent tools (BashTool, FileEditTool, etc.) |
| `list_commands` | List all 50+ slash commands (/commit, /review, etc.) |
| `get_tool_source` | Read a specific tool's implementation |
| `get_command_source` | Read a specific command's implementation |
| `read_source_file` | Read any file from `src/` by relative path |
| `search_source` | Regex search across the entire source tree |
| `list_directory` | List contents of any directory under `src/` |
| `get_architecture` | Get a full architecture overview |

### Resources

| URI | Description |
|-----|-------------|
| `claude-code://architecture` | README / architecture overview |
| `claude-code://tools` | Tool registry (JSON) |
| `claude-code://commands` | Command registry (JSON) |
| `claude-code://source/{path}` | Any source file (template) |

### Prompts

| Prompt | Description |
|--------|-------------|
| `explain_tool` | Deep-dive into how a specific tool works |
| `explain_command` | Understand a slash command's implementation |
| `architecture_overview` | Guided tour of the full architecture |
| `how_does_it_work` | Explain any subsystem |
| `compare_tools` | Side-by-side comparison of two tools |

## Quick Install

```bash
# Via npm (no clone needed)
claude mcp add sayantan-claudemaster -- npx -y sayantan-claudemaster

# From source
git clone https://github.com/sayantanmandal/claude-code.git
cd claude-code/mcp-server
npm install && npm run build
claude mcp add claude-code-explorer -- node $(pwd)/dist/index.js
```

## Development

```bash
npm install
npm run dev    # Run with tsx (hot reload)
npm run build  # Compile to dist/
npm start      # Run compiled version
```

## License

MIT — see [LICENSE](../LICENSE) for details.
