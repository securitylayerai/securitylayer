// @securitylayerai/proxy

export type { GatewayLock } from "./gateway-lock";
export { createGatewayLock } from "./gateway-lock";
export type { InterceptDecision, Interceptor, InterceptResult } from "./interceptor";
export { createInterceptor } from "./interceptor";
export type { MetricsCollector } from "./metrics";
export { createMetricsCollector } from "./metrics";
export type { ProxyServer, ProxyServerConfig } from "./server";
export { createProxyServer } from "./server";
export type {
  ConnectionInfo,
  EvaluateActionFn,
  GatewayLockConfig,
  ProxyConfig,
  ProxyState,
} from "./types";
export type { UpstreamConfig, UpstreamConnection } from "./upstream";
export { createUpstreamConnection } from "./upstream";

import { FrameParseError } from "@securitylayerai/adapters";
import { createGatewayLock } from "./gateway-lock";
import { createInterceptor } from "./interceptor";
import { createMetricsCollector } from "./metrics";
import { createProxyServer } from "./server";
import type { ProxyConfig } from "./types";
import { createUpstreamConnection } from "./upstream";

export interface ProxyInstance {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly metricsText: () => string;
}

/**
 * Wire everything together and start the proxy.
 */
export function startProxy(config: ProxyConfig): ProxyInstance {
  const metrics = createMetricsCollector();
  const interceptor = createInterceptor(config.adapter, config.evaluateAction);

  const gatewayLock = config.gatewayLock ? createGatewayLock(config.gatewayLock) : null;

  const upstream = createUpstreamConnection({
    url: config.upstreamUrl,
    token: gatewayLock?.config.token,
  });

  let lastKnownSessionId = "default";

  const server = createProxyServer({
    port: config.listenPort,
    host: config.listenHost,
    getMetricsText: () => metrics.toPrometheus(),
    async onClientMessage(connectionId, data) {
      try {
        const inbound = interceptor.processInbound(data);
        if (inbound.sessionId && inbound.sessionId !== "unknown") {
          lastKnownSessionId = inbound.sessionId;
          server.updateConnectionSession(connectionId, inbound.sessionId);
        }
        upstream.send(data);
      } catch (err) {
        console.error("[SecurityLayer] Error processing inbound frame:", err);
      }
      return null;
    },
  });

  // Route upstream messages back through interceptor
  upstream.onMessage(async (data) => {
    try {
      const result = await interceptor.interceptOutbound(data, lastKnownSessionId);

      // Record latency once per frame, not per action (P6 fix)
      if (result.actions.length > 0) {
        metrics.recordAction(result.decision, "pipeline", result.latencyMs);
      }

      if (result.decision === "ALLOW" && result.frame) {
        server.broadcastToClients(result.frame);
      } else if (result.decision === "DENY" && result.denyResponse) {
        server.broadcastToClients(result.denyResponse);
      } else if (result.decision === "REQUIRE_APPROVAL") {
        const pendingActions = result.actions
          .filter((a) => a.decision === "REQUIRE_APPROVAL")
          .map((a) => a.tool);
        console.warn(
          `[SecurityLayer] Actions require approval: ${pendingActions.join(", ")} (session: ${lastKnownSessionId})`,
        );
        // v0: send placeholder deny — approval flow will replay in v1
        const firstPending = result.actions.find((a) => a.decision === "REQUIRE_APPROVAL");
        if (firstPending) {
          const placeholder = config.adapter.injectDenyResponse(
            { tool: firstPending.tool, params: {} },
            "Action requires approval — approval flow not yet implemented",
          );
          server.broadcastToClients(placeholder);
        }
      }
    } catch (err) {
      if (err instanceof FrameParseError) {
        console.error("[SecurityLayer] Malformed frame received, dropping:", err.message);
      } else {
        console.error("[SecurityLayer] Error in outbound interception, defaulting to DENY:", err);
      }
      // Fail safe: deny on error — don't forward the frame to clients
    }
  });

  return {
    async start() {
      if (gatewayLock) {
        await gatewayLock.lock();
      }
      upstream.connect();
      server.start();
    },

    async stop() {
      server.stop();
      upstream.disconnect();
      if (gatewayLock) {
        await gatewayLock.unlock();
      }
    },

    metricsText() {
      return metrics.toPrometheus();
    },
  };
}
