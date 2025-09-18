# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Browser MCP (Model Context Protocol) server that enables AI applications to automate web browsers. It provides 12 browser automation tools (navigate, click, type, screenshot, etc.) via both MCP protocol and HTTP API endpoints.

**Key Purpose**: Voice-first UX audit agent that can navigate websites, interact with elements, and generate audit reports with evidence.

## Development Commands

### Core Commands
```bash
# Build the project
npm run build

# Type checking
npm run typecheck

# Start server in different modes
npm start                    # Auto-detect mode (stdio or http based on environment)
node dist/index.js stdio     # MCP stdio transport (for Claude Desktop, etc.)
node dist/index.js http -p 3000  # HTTP server for ElevenLabs integration

# Development
npm run watch               # Watch mode for development
npm run inspector          # MCP Inspector for debugging

# Environment detection
PORT=3000 npm start         # Forces HTTP mode on specified port
```

### Testing Integration
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test MCP unified endpoint (ElevenLabs compatible)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test individual tool endpoints (legacy)
curl -X POST http://localhost:3000/tools/list \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Architecture

### Dual Transport Support
The server supports two primary modes:
1. **MCP Protocol** (stdio) - For AI applications like Claude Desktop
2. **HTTP API** (unified endpoint) - For ElevenLabs Conversational AI integration

### Core Architecture Components

**Entry Point**: `src/index.ts`
- Unified MCP endpoint at `/mcp` (GET/POST) following MCP spec 2024-11-05
- Legacy individual endpoints (`/tools/list`, `/tools/call`) for backward compatibility
- Auto-detection between stdio and HTTP modes based on environment

**Tool System** (`src/tools/`):
- `tool.ts` - Base interfaces for Tool, ToolSchema, ToolResult
- `common.ts` - Navigation tools (navigate, back, forward, wait, keys)
- `snapshot.ts` - Interactive tools (click, hover, type, select) with accessibility snapshots
- `custom.ts` - Utility tools (screenshot, console logs)

**Browser Communication** (`src/context.ts`):
- WebSocket connection to Browser MCP Chrome extension
- Message routing between MCP server and browser extension
- Connection state management with error handling

**MCP Server Factory** (`src/server.ts`):
- Creates MCP server instances with tool and resource handlers
- WebSocket server setup for browser extension connections
- Request routing for MCP protocol methods

**Local Dependencies** (`src/lib/`):
- Stub implementations replacing original monorepo dependencies
- `config/` - App and MCP configuration
- `messaging/` - WebSocket message handling
- `types/` - MCP tool definitions and message schemas
- `utils/` - Utility functions (wait, etc.)

### JSON-RPC 2.0 Compliance
The server implements proper JSON-RPC 2.0 with:
- Method routing: `initialize`, `tools/list`, `tools/call`, `ping`
- Error codes: -32600 (Invalid Request), -32601 (Method not found), -32602 (Invalid params), -32603 (Internal error)
- ElevenLabs-specific CORS headers and session ID support

### Browser Integration Requirements
- Requires Browser MCP Chrome extension to be installed and connected
- Extension provides WebSocket connection for actual browser automation
- Context class manages connection state and provides error messages when not connected

## Key Integration Points

**ElevenLabs Conversational AI**: Use `/mcp` endpoint with JSON-RPC 2.0 protocol
**Claude Desktop/MCP Clients**: Use stdio transport mode
**Browser Extension**: WebSocket connection on configurable port (default 9001)

## Important Notes

- All browser automation requires active WebSocket connection to browser extension
- Server logs only to stderr to avoid stdout contamination in MCP protocol
- TypeScript path mapping uses `@/*` for `src/*` imports
- Build output goes to `dist/` with executable permissions set on entry point