import { randomUUID } from "node:crypto";
import type { AgentAdapter } from "@securitylayerai/adapters";
import type { ConnectionInfo, ProxyState } from "./types";

export interface ProxyServerConfig {
  port: number;
  host: string;
  adapter: AgentAdapter;
  onClientMessage: (connectionId: string, data: Buffer) => Promise<Buffer | null>;
  onUpstreamMessage?: (connectionId: string, data: Buffer) => Promise<Buffer | null>;
}

export interface ProxyServer {
  state: ProxyState;
  connections: Map<string, ConnectionInfo>;
  start(): void;
  stop(): void;
  broadcastToClients(data: Buffer): void;
  sendToClient(connectionId: string, data: Buffer): void;
}

export function createProxyServer(config: ProxyServerConfig): ProxyServer {
  const connections = new Map<string, ConnectionInfo>();
  const clientSockets = new Map<string, { send(data: string | Buffer): void }>();

  const state: ProxyState = {
    running: false,
    clientCount: 0,
    upstreamConnected: false,
    startedAt: null,
  };

  let server: ReturnType<typeof Bun.serve> | null = null;

  return {
    state,
    connections,

    start() {
      server = Bun.serve({
        port: config.port,
        hostname: config.host,

        fetch(req, server) {
          const url = new URL(req.url);

          // Health check endpoint
          if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", clients: state.clientCount }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          // WebSocket upgrade
          if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
            const connectionId = randomUUID();
            const success = server.upgrade(req, { data: { connectionId } });
            if (!success) {
              return new Response("WebSocket upgrade failed", { status: 400 });
            }
            return undefined;
          }

          return new Response("SecurityLayer Proxy", { status: 200 });
        },

        websocket: {
          open(ws) {
            const connectionId = (ws.data as { connectionId: string }).connectionId;
            const info: ConnectionInfo = {
              id: connectionId,
              sessionId: "pending",
              connectedAt: Date.now(),
              remoteAddress: "unknown",
            };
            connections.set(connectionId, info);
            clientSockets.set(connectionId, ws);
            state.clientCount = connections.size;
          },

          async message(ws, message) {
            const connectionId = (ws.data as { connectionId: string }).connectionId;
            const raw = typeof message === "string" ? Buffer.from(message) : Buffer.from(message);

            const result = await config.onClientMessage(connectionId, raw);
            if (result) {
              ws.send(result);
            }
          },

          close(ws) {
            const connectionId = (ws.data as { connectionId: string }).connectionId;
            connections.delete(connectionId);
            clientSockets.delete(connectionId);
            state.clientCount = connections.size;
          },
        },
      });

      state.running = true;
      state.startedAt = Date.now();
    },

    stop() {
      server?.stop();
      server = null;
      connections.clear();
      clientSockets.clear();
      state.running = false;
      state.clientCount = 0;
      state.startedAt = null;
    },

    broadcastToClients(data: Buffer) {
      for (const socket of clientSockets.values()) {
        socket.send(data);
      }
    },

    sendToClient(connectionId: string, data: Buffer) {
      const socket = clientSockets.get(connectionId);
      socket?.send(data);
    },
  };
}
