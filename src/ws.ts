import type { IncomingMessage } from "http";
import type { Server as HttpServer } from "http";
import type { Socket } from "net";
import { WebSocketServer } from "ws";

import { mcpConfig } from "./lib/config/mcp.config.js";
import { wait } from "./lib/utils/index.js";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

type WebSocketServerOptions = {
  port?: number;
  server?: HttpServer;
  path?: string;
};

export async function createWebSocketServer(
  options: WebSocketServerOptions = {},
): Promise<WebSocketServer> {
  const { server, path = "/ws" } = options;

  if (server) {
    const wss = new WebSocketServer({ noServer: true });

    const handleUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const url = request.url ? request.url.split("?")[0] : "/";

      if (url !== path) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    };

    server.on("upgrade", handleUpgrade);

    wss.on("close", () => {
      server.off("upgrade", handleUpgrade);
    });

    return wss;
  }

  const port = options.port ?? mcpConfig.defaultWsPort;

  killProcessOnPort(port);
  while (await isPortInUse(port)) {
    await wait(100);
  }

  return new WebSocketServer({ port });
}
