import { WebSocket } from "ws";
import { MessageType, MessagePayload } from "../types.js";

export function createSocketMessageSender<T>(ws: WebSocket) {
  return {
    async sendSocketMessage<K extends MessageType<T>>(
      type: K,
      payload: MessagePayload<T, K>,
      options: { timeoutMs?: number } = { timeoutMs: 30000 }
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        const message = JSON.stringify({ type, payload });

        const timeout = setTimeout(() => {
          reject(new Error('Message timeout'));
        }, options.timeoutMs);

        ws.send(message, (error) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            // For simplicity, immediately resolve - in real implementation
            // you'd wait for a response message
            resolve({ success: true });
          }
        });
      });
    }
  };
}