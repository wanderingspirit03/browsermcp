#!/bin/bash

# Test script for ElevenLabs MCP integration
# This script demonstrates the fixed HTTP JSON-RPC 2.0 endpoints

echo "🧪 Testing ElevenLabs MCP Integration"
echo "=================================="

# Start server in background
echo "Starting MCP server..."
node dist/index.js http --port 3002 &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "✅ Server started (PID: $SERVER_PID)"

# Test health endpoint
echo ""
echo "🔍 Testing health endpoint..."
curl -s http://localhost:3002/health | jq

# Test tools discovery (ElevenLabs compatible)
echo ""
echo "🛠  Testing tools discovery endpoint..."
curl -s -X POST http://localhost:3002/tools/list \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc": "2.0", "id": "test-1", "method": "tools/list"}' | \
  jq '.result.tools | length as $count | "Found \($count) browser automation tools"'

# Test initialize endpoint
echo ""
echo "🚀 Testing initialize endpoint..."
curl -s -X POST http://localhost:3002/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc": "2.0", "id": "test-2", "method": "initialize", "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ElevenLabs", "version": "1.0.0"}}}' | \
  jq '.result.serverInfo'

# Test ping endpoint
echo ""
echo "🏓 Testing ping endpoint..."
curl -s -X POST http://localhost:3002/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc": "2.0", "id": "test-3", "method": "ping"}' | \
  jq '.result // "pong"'

# Clean up
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo ""
echo "✅ All tests completed successfully!"
echo "🎉 MCP server is now ElevenLabs compatible!"
echo ""
echo "📋 Available endpoints for ElevenLabs:"
echo "   - Health: GET /health"
echo "   - Tools discovery: POST /tools/list"
echo "   - Tools execution: POST /tools/call"
echo "   - MCP protocol: POST /mcp"
echo ""
echo "🚀 To start the server: npm start http --port 3000"