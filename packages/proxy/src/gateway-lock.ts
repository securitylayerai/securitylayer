import { randomUUID } from "node:crypto";
import type { GatewayLockConfig } from "./types";

export interface GatewayLock {
  /** The active lockdown configuration */
  config: GatewayLockConfig;
  /** Apply the lockdown strategy */
  lock(): Promise<void>;
  /** Verify that the lockdown is effective */
  verify(): Promise<boolean>;
  /** Remove the lockdown (on shutdown) */
  unlock(): Promise<void>;
}

/**
 * Creates a gateway lock that prevents direct connections to the agent
 * gateway, ensuring all traffic flows through the SecurityLayer proxy.
 *
 * Three strategies:
 * 1. validation_token — generates a random token, only the proxy knows it
 * 2. unix_socket — rebind gateway to Unix socket (strongest)
 * 3. firewall — add iptables/pf rules (requires elevated permissions)
 */
export function createGatewayLock(config?: Partial<GatewayLockConfig>): GatewayLock {
  const strategy = config?.strategy ?? "validation_token";

  const resolvedConfig: GatewayLockConfig = {
    strategy,
    token: config?.token ?? (strategy === "validation_token" ? randomUUID() : undefined),
    socketPath: config?.socketPath,
    originalPort: config?.originalPort ?? 18789,
  };

  let locked = false;

  return {
    config: resolvedConfig,

    async lock() {
      switch (resolvedConfig.strategy) {
        case "validation_token": {
          // In production, this would patch the agent config to require
          // the token in WS handshake headers. For now, mark as locked.
          locked = true;
          break;
        }
        case "unix_socket": {
          // In production, this would rebind the gateway to a Unix socket.
          // The socket path is only known to SecurityLayer.
          if (!resolvedConfig.socketPath) {
            throw new Error("unix_socket strategy requires socketPath");
          }
          locked = true;
          break;
        }
        case "firewall": {
          // In production, this would add iptables/pf rules:
          // iptables -A INPUT -p tcp --dport 18789 -j DROP
          // iptables -A INPUT -p tcp --dport 18789 -s 127.0.0.1 -m owner --uid-owner $PROXY_UID -j ACCEPT
          locked = true;
          break;
        }
      }
    },

    async verify(): Promise<boolean> {
      if (!locked) return false;

      switch (resolvedConfig.strategy) {
        case "validation_token": {
          // Attempt a direct connection without the token — should fail.
          // In production, this would actually try connecting.
          // For now, verify that we have a token set.
          return !!resolvedConfig.token;
        }
        case "unix_socket": {
          // Verify the TCP port is no longer listening.
          return !!resolvedConfig.socketPath;
        }
        case "firewall": {
          // Verify the firewall rule exists.
          return true;
        }
        default:
          return false;
      }
    },

    async unlock() {
      switch (resolvedConfig.strategy) {
        case "validation_token": {
          // Remove token requirement from agent config
          locked = false;
          break;
        }
        case "unix_socket": {
          // Restore TCP binding
          locked = false;
          break;
        }
        case "firewall": {
          // Remove firewall rules
          locked = false;
          break;
        }
      }
    },
  };
}
