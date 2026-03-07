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

import { createGatewayLock } from "./gateway-lock";
import { createInterceptor } from "./interceptor";
import { createMetricsCollector } from "./metrics";
import { createProxyServer } from "./server";
import type { ProxyConfig } from "./types";
import { createUpstreamConnection } from "./upstream";

export interface ProxyInstance {
  start(): void;
  stop(): void;
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

  const server = createProxyServer({
    port: config.listenPort,
    host: config.listenHost,
    adapter: config.adapter,
    async onClientMessage(connectionId, data) {
      // Process inbound for taint tagging
      const inbound = interceptor.processInbound(data);

      // Forward to upstream
      upstream.send(data);

      return null; // No immediate response to the client
    },
  });

  // Route upstream messages back through interceptor
  upstream.onMessage(async (data) => {
    const result = await interceptor.interceptOutbound(data, "default");

    for (const action of result.actions) {
      metrics.recordAction(action.decision, "rules", result.latencyMs);
    }

    if (result.decision === "ALLOW" && result.frame) {
      server.broadcastToClients(result.frame);
    } else if (result.decision === "DENY" && result.denyResponse) {
      server.broadcastToClients(result.denyResponse);
    }
  });

  return {
    start() {
      if (gatewayLock) {
        gatewayLock.lock();
      }
      upstream.connect();
      server.start();
    },

    stop() {
      server.stop();
      upstream.disconnect();
      if (gatewayLock) {
        gatewayLock.unlock();
      }
    },

    metricsText() {
      return metrics.toPrometheus();
    },
  };
}
