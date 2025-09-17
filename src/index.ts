#!/usr/bin/env node
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { program } from "commander";
import express from "express";
import cors from "cors";

import { appConfig } from "./lib/config/app.config.js";

import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import * as common from "@/tools/common";
import * as custom from "@/tools/custom";
import * as snapshot from "@/tools/snapshot";
import type { Tool } from "@/tools/tool";

import packageJSON from "../package.json";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const commonTools: Tool[] = [common.pressKey, common.wait];

const customTools: Tool[] = [custom.getConsoleLogs, custom.screenshot];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  ...commonTools,
  ...customTools,
];

const resources: Resource[] = [];

async function createMCPServer(): Promise<Server> {
  return createServerWithTools({
    name: appConfig.name,
    version: packageJSON.version,
    tools: snapshotTools,
    resources,
  });
}

async function startHTTPServer(port: number) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'browsermcp-mcp-server',
      timestamp: new Date().toISOString(),
      transport: 'sse'
    });
  });

  // MCP Server-Sent Events endpoint for ElevenLabs
  app.post('/sse', async (req, res) => {
    console.log('🔗 ElevenLabs Conversational AI connected via SSE');

    const server = await createMCPServer();
    const transport = new SSEServerTransport('/message', res);

    await server.connect(transport);

    // Handle client disconnect
    req.on('close', () => {
      console.log('🔌 ElevenLabs disconnected');
      server.close();
    });
  });

  app.listen(port, () => {
    console.log(`🌐 Browser MCP HTTP Server started on port ${port}`);
    console.log(`📡 Health check: http://localhost:${port}/health`);
    console.log(`🔗 SSE endpoint: http://localhost:${port}/sse`);
    console.log(`🎤 Ready for ElevenLabs Conversational AI connection`);
  });
}

/**
 * Note: Tools must be defined *before* calling `createServer` because only declarations are hoisted, not the initializations
 */
program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .description("Browser MCP Server for UX Auditing - Automate your browser with AI");

program
  .command("stdio")
  .description("Start MCP server with stdio transport")
  .action(async () => {
    console.log("🔌 Starting Browser MCP Server (stdio)...");
    const server = await createMCPServer();
    setupExitWatchdog(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  });

program
  .command("http")
  .description("Start HTTP server with SSE transport for ElevenLabs")
  .option("-p, --port <port>", "Port to run HTTP server on", "3000")
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    await startHTTPServer(port);
  });

// Default action - auto-detect based on environment
program.action(async () => {
  if (process.env.PORT) {
    // Deployment environment - start HTTP server
    const port = parseInt(process.env.PORT, 10);
    console.log(`🌐 Auto-detected deployment environment, starting HTTP server on port ${port}`);
    await startHTTPServer(port);
  } else {
    // Development environment - start stdio
    console.log("🔌 Starting Browser MCP Server (stdio)...");
    const server = await createMCPServer();
    setupExitWatchdog(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
});

program.parse(process.argv);
