import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Context } from "@/context";
import type { Resource } from "@/resources/resource";
import type { Tool } from "@/tools/tool";
import { createWebSocketServer } from "@/ws";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

type Options = {
  name: string;
  version: string;
  tools: Tool[];
  resources: Resource[];
  context?: Context;
  websocketServer?: WebSocketServer;
};

export async function createServerWithTools(options: Options): Promise<Server> {
  const { name, version, tools, resources } = options;
  const context = options.context ?? new Context();
  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const wss = options.websocketServer ?? (await createWebSocketServer());

  const handleConnection = (websocket: WebSocket) => {
    if (context.hasWs()) {
      context.ws.close();
    }
    context.ws = websocket;
    websocket.on("close", () => {
      context.clearWs();
    });
  };

  wss.on("connection", handleConnection);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map((tool) => tool.schema) };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map((resource) => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((tool) => tool.schema.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Tool "${request.params.name}" not found` },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handle(context, request.params.arguments);
      return result;
    } catch (error) {
      return {
        content: [{ type: "text", text: String(error) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resources.find(
      (resource) => resource.schema.uri === request.params.uri,
    );
    if (!resource) {
      return { contents: [] };
    }

    const contents = await resource.read(context, request.params.uri);
    return { contents };
  });

  const originalClose = server.close.bind(server);

  server.close = async () => {
    await originalClose();
    if (!options.websocketServer) {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    }
    if (!options.context) {
      await context.close();
    }
  };

  return server;
}
