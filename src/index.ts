#!/usr/bin/env node
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";

import { appConfig } from "./lib/config/app.config.js";

import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import * as common from "@/tools/common";
import * as custom from "@/tools/custom";
import * as snapshot from "@/tools/snapshot";
import type { Tool } from "@/tools/tool";

import packageJSON from "../package.json";

// JSON-RPC 2.0 types for MCP compliance
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

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

  // Enhanced CORS configuration for ElevenLabs integration
  app.use(cors({
    origin: [
      'https://elevenlabs.io',
      'https://*.elevenlabs.io',
      'http://localhost:*',
      'https://localhost:*'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Logging function that only outputs to stderr
  const logToStderr = (message: string) => {
    process.stderr.write(`[${new Date().toISOString()}] ${message}\n`);
  };

  // Error handler
  const createJsonRpcError = (id: string | number | null, code: number, message: string, data?: any): JsonRpcResponse => {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message, data }
    };
  };

  // Success response helper
  const createJsonRpcSuccess = (id: string | number | null, result: any): JsonRpcResponse => {
    return {
      jsonrpc: "2.0",
      id,
      result
    };
  };

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'browsermcp-mcp-server',
      timestamp: new Date().toISOString(),
      transport: 'http-streamable',
      mcp_version: '2025-03-26',
      tools_available: snapshotTools.length
    });
  });

  // MCP Tools discovery endpoint (ElevenLabs compatible)
  app.post('/tools/list', async (req: Request, res: Response) => {
    try {
      const request: JsonRpcRequest = req.body;

      if (!request || request.jsonrpc !== "2.0" || request.method !== "tools/list") {
        return res.status(400).json(
          createJsonRpcError(
            request?.id || null,
            -32600,
            "Invalid Request",
            "Expected JSON-RPC 2.0 request with method 'tools/list'"
          )
        );
      }

      logToStderr(`Tools discovery request from ElevenLabs: ${JSON.stringify(request)}`);

      const tools = snapshotTools.map((tool) => ({
        name: tool.schema.name,
        description: tool.schema.description,
        inputSchema: tool.schema.inputSchema
      }));

      const response = createJsonRpcSuccess(request.id, { tools });
      logToStderr(`Returning ${tools.length} tools to ElevenLabs`);

      res.json(response);
    } catch (error) {
      logToStderr(`Error in tools/list: ${error}`);
      res.status(500).json(
        createJsonRpcError(
          null,
          -32603,
          "Internal error",
          String(error)
        )
      );
    }
  });

  // MCP Tools execution endpoint (ElevenLabs compatible)
  app.post('/tools/call', async (req: Request, res: Response) => {
    try {
      const request: JsonRpcRequest = req.body;

      if (!request || request.jsonrpc !== "2.0" || request.method !== "tools/call") {
        return res.status(400).json(
          createJsonRpcError(
            request?.id || null,
            -32600,
            "Invalid Request",
            "Expected JSON-RPC 2.0 request with method 'tools/call'"
          )
        );
      }

      const { name, arguments: args } = request.params || {};

      if (!name) {
        return res.status(400).json(
          createJsonRpcError(
            request.id,
            -32602,
            "Invalid params",
            "Tool name is required"
          )
        );
      }

      logToStderr(`Tool execution request: ${name} with args: ${JSON.stringify(args)}`);

      // Create server instance for tool execution
      const server = await createMCPServer();
      const tool = snapshotTools.find((t) => t.schema.name === name);

      if (!tool) {
        return res.status(404).json(
          createJsonRpcError(
            request.id,
            -32601,
            "Method not found",
            `Tool '${name}' not found`
          )
        );
      }

      // Execute the tool
      const context = new (await import("@/context")).Context();
      const result = await tool.handle(context, args || {});

      const response = createJsonRpcSuccess(request.id, result);
      logToStderr(`Tool ${name} executed successfully`);

      res.json(response);

      // Cleanup
      await context.close();

    } catch (error) {
      logToStderr(`Error in tools/call: ${error}`);
      res.status(500).json(
        createJsonRpcError(
          req.body?.id || null,
          -32603,
          "Internal error",
          String(error)
        )
      );
    }
  });

  // Unified MCP endpoint for ElevenLabs (Streamable HTTP specification)
  app.all('/mcp', async (req: Request, res: Response) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id');
        return res.status(200).end();
      }

      // Set required headers for ElevenLabs MCP integration
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id');

      // Handle GET request - return server capabilities
      if (req.method === 'GET') {
        return res.json({
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            logging: {}
          },
          serverInfo: {
            name: appConfig.name,
            version: packageJSON.version,
            description: "Browser MCP Server for UX Auditing"
          },
          transport: "http-streamable",
          toolsAvailable: snapshotTools.length
        });
      }

      // Handle POST request - process JSON-RPC methods
      if (req.method === 'POST') {
        const request: JsonRpcRequest = req.body;

        if (!request || request.jsonrpc !== "2.0") {
          return res.status(400).json(
            createJsonRpcError(
              request?.id || null,
              -32600,
              "Invalid Request",
              "Expected JSON-RPC 2.0 request"
            )
          );
        }

        logToStderr(`MCP unified endpoint request: ${request.method}`);

        // Route JSON-RPC methods to appropriate handlers
        switch (request.method) {
          case "initialize":
            const initParams = request.params || {};
            const initResult = {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                resources: {},
                logging: {}
              },
              serverInfo: {
                name: appConfig.name,
                version: packageJSON.version,
                description: "Browser MCP Server for UX Auditing"
              }
            };
            logToStderr(`MCP initialization completed for client: ${initParams.clientInfo?.name || 'unknown'}`);
            return res.json(createJsonRpcSuccess(request.id, initResult));

          case "tools/list":
            // Route to existing tools/list logic
            const tools = snapshotTools.map((tool) => ({
              name: tool.schema.name,
              description: tool.schema.description,
              inputSchema: tool.schema.inputSchema
            }));
            logToStderr(`MCP tools/list: returning ${tools.length} tools`);
            return res.json(createJsonRpcSuccess(request.id, { tools }));

          case "tools/call":
            // Route to existing tools/call logic
            const { name, arguments: args } = request.params || {};

            if (!name) {
              return res.status(400).json(
                createJsonRpcError(
                  request.id,
                  -32602,
                  "Invalid params",
                  "Tool name is required"
                )
              );
            }

            logToStderr(`MCP tools/call: executing ${name} with args: ${JSON.stringify(args)}`);

            const tool = snapshotTools.find((t) => t.schema.name === name);
            if (!tool) {
              return res.status(404).json(
                createJsonRpcError(
                  request.id,
                  -32601,
                  "Method not found",
                  `Tool '${name}' not found`
                )
              );
            }

            // Execute the tool
            const context = new (await import("@/context")).Context();
            const result = await tool.handle(context, args || {});

            logToStderr(`MCP tools/call: ${name} executed successfully`);

            // Cleanup
            await context.close();

            return res.json(createJsonRpcSuccess(request.id, result));

          case "ping":
            return res.json(createJsonRpcSuccess(request.id, {}));

          case "notifications/initialized":
            // Handle initialization notification (optional)
            logToStderr(`MCP client initialization notification received`);
            return res.status(204).end();

          default:
            return res.status(404).json(
              createJsonRpcError(
                request.id,
                -32601,
                "Method not found",
                `Method '${request.method}' not supported`
              )
            );
        }
      }

      // Unsupported method
      return res.status(405).json(
        createJsonRpcError(
          null,
          -32600,
          "Invalid Request",
          `Method ${req.method} not supported`
        )
      );

    } catch (error) {
      logToStderr(`Error in unified MCP endpoint: ${error}`);
      res.status(500).json(
        createJsonRpcError(
          req.body?.id || null,
          -32603,
          "Internal error",
          String(error)
        )
      );
    }
  });

  // Root endpoint alias for MCP (some clients expect this)
  app.all('/', (req: Request, res: Response) => {
    if (req.headers['content-type']?.includes('application/json') && req.body?.jsonrpc) {
      // Forward JSON-RPC requests to /mcp endpoint
      req.url = '/mcp';
      return app._router.handle(req, res);
    } else {
      // Redirect to health endpoint for browser visits
      return res.redirect('/health');
    }
  });

  // Global error handler
  app.use((error: Error, req: Request, res: Response, next: any) => {
    logToStderr(`Unhandled error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json(
        createJsonRpcError(
          null,
          -32603,
          "Internal error",
          error.message
        )
      );
    }
  });

  app.listen(port, () => {
    logToStderr(`Browser MCP HTTP Server started on port ${port}`);
    logToStderr(`Health check: http://localhost:${port}/health`);
    logToStderr(`Tools discovery: http://localhost:${port}/tools/list`);
    logToStderr(`Tools execution: http://localhost:${port}/tools/call`);
    logToStderr(`Generic MCP: http://localhost:${port}/mcp`);
    logToStderr(`Ready for ElevenLabs Conversational AI connection`);
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
  .description("Start HTTP server with JSON-RPC 2.0 transport for ElevenLabs")
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
