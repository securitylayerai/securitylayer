import type { SandboxConfig, SandboxLevel } from "./types";
import { buildUlimitArgs, DEFAULT_ULIMITS } from "./ulimits";

/**
 * Creates a sandbox configuration for the given level.
 *
 * Level 0: ulimits only (default)
 * Level 1: ulimits + network isolation
 * Level 2: ulimits + network isolation + filesystem restrictions
 * Level 3: full container isolation (v1+)
 */
export function createSandboxConfig(level: SandboxLevel = 0): SandboxConfig {
  const base: SandboxConfig = {
    level,
    ulimits: { ...DEFAULT_ULIMITS },
    network: { isolated: false },
    filesystem: {},
  };

  if (level >= 1) {
    base.network.isolated = true;
    base.network.allowedHosts = [];
  }

  if (level >= 2) {
    base.filesystem.denied = ["/etc/shadow", "/etc/passwd"];
    base.filesystem.readOnly = ["/usr", "/bin", "/lib"];
  }

  return base;
}

/**
 * Wraps a command with sandbox restrictions (ulimits).
 * Returns the wrapped command string.
 */
export function wrapCommand(command: string, config: SandboxConfig): string {
  const ulimits = buildUlimitArgs(config.ulimits);
  // Join ulimits with && to ensure they apply before the command
  return `${ulimits.join(" && ")} && ${command}`;
}
