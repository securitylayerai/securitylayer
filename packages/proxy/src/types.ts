import type { AgentAdapter } from "@securitylayerai/adapters";

/**
 * Proxy-local type for the security evaluation function.
 * Avoids importing PipelineDeps from core which triggers
 * full core barrel export resolution.
 */
export type EvaluateActionFn = (
  action: string,
  context: { sessionId: string; skillId?: string; channelId?: string },
  command?: string,
) => Promise<{ decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" }>;

export interface ProxyConfig {
  /** Port the proxy listens on for client connections */
  listenPort: number;
  /** Host the proxy listens on */
  listenHost: string;
  /** Upstream agent gateway URL (ws://...) */
  upstreamUrl: string;
  /** Adapter for parsing agent protocol frames */
  adapter: AgentAdapter;
  /** Security evaluation function from core pipeline */
  evaluateAction: EvaluateActionFn;
  /** Gateway lockdown configuration */
  gatewayLock?: GatewayLockConfig;
}

export interface GatewayLockConfig {
  strategy: "validation_token" | "unix_socket" | "firewall";
  /** For validation_token: the token to use */
  token?: string;
  /** For unix_socket: the socket path */
  socketPath?: string;
  /** Original gateway port for firewall rules */
  originalPort?: number;
}

export interface ProxyState {
  running: boolean;
  clientCount: number;
  // TODO: wire to upstream.onConnect/onDisconnect
  upstreamConnected: boolean;
  startedAt: number | null;
}

export interface ConnectionInfo {
  id: string;
  sessionId: string;
  connectedAt: number;
  remoteAddress: string;
}
