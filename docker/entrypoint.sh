#!/bin/sh
set -e

# ── Validate required env vars ────────────────────────────────
if [ -z "$ANTHROPIC_API_KEY" ] && [ "$CLAUDE_CODE_USE_OLLAMA" != "true" ]; then
  echo "ERROR: No AI provider configured." >&2
  echo "" >&2
  echo "  Option 1 — Anthropic API:" >&2
  echo "    docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... claude-web" >&2
  echo "" >&2
  echo "  Option 2 — Ollama (local LLM):" >&2
  echo "    docker run -p 3000:3000 -e CLAUDE_CODE_USE_OLLAMA=true -e OLLAMA_HOST=http://host.docker.internal:11434 claude-web" >&2
  echo "" >&2
  echo "  Or via docker-compose with a .env file:" >&2
  echo "    ANTHROPIC_API_KEY=sk-ant-... docker compose up" >&2
  exit 1
fi

# ── Ollama readiness check ─────────────────────────────────────
if [ "$CLAUDE_CODE_USE_OLLAMA" = "true" ]; then
  OLLAMA_ENDPOINT="${OLLAMA_HOST:-http://localhost:11434}"
  echo "Ollama mode enabled. Checking connectivity to ${OLLAMA_ENDPOINT}..."

  # Wait for Ollama to be ready (up to 60 seconds)
  RETRIES=0
  MAX_RETRIES=12
  while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -sf "${OLLAMA_ENDPOINT}/api/tags" > /dev/null 2>&1; then
      echo "  Ollama is ready."
      break
    fi
    RETRIES=$((RETRIES + 1))
    echo "  Waiting for Ollama... (attempt ${RETRIES}/${MAX_RETRIES})"
    sleep 5
  done

  if [ $RETRIES -eq $MAX_RETRIES ]; then
    echo "WARNING: Could not reach Ollama at ${OLLAMA_ENDPOINT}." >&2
    echo "  Models will be pulled on first request (if OLLAMA_AUTO_PULL=true)." >&2
  fi
fi

echo "Claude Web Terminal starting on port ${PORT:-3000}..."
if [ -n "$AUTH_TOKEN" ]; then
  echo "  Auth token protection: enabled"
fi
if [ -n "$ALLOWED_ORIGINS" ]; then
  echo "  Allowed origins: $ALLOWED_ORIGINS"
fi
echo "  Max sessions: ${MAX_SESSIONS:-5}"
if [ "$CLAUDE_CODE_USE_OLLAMA" = "true" ]; then
  echo "  Provider: Ollama (${OLLAMA_HOST:-http://localhost:11434})"
  echo "  Coding model: ${OLLAMA_CODING_MODEL:-qwen2.5-coder:14b}"
  echo "  General model: ${OLLAMA_GENERAL_MODEL:-qwen2.5:14b}"
  echo "  GPU layers: ${OLLAMA_NUM_GPU:-999}"
else
  echo "  Provider: Anthropic API"
fi

# Hand off to the PTY WebSocket server
exec bun /app/src/server/web/pty-server.ts
