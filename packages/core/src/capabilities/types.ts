import type { TaintLevel } from "../taint/index.js";

// ---------------------------------------------------------------------------
// Base capabilities — the 14 structural capability names
// ---------------------------------------------------------------------------

export const BASE_CAPABILITIES = [
  "exec",
  "exec.elevated",
  "file.read",
  "file.write",
  "browser",
  "browser.login",
  "channel.send",
  "channel.send.external",
  "cron.create",
  "skill.install",
  "memory.read.all_zones",
  "memory.write",
  "web_fetch",
  "node.invoke",
] as const;

export type BaseCapability = (typeof BASE_CAPABILITIES)[number];

const BASE_CAPABILITY_SET = new Set<string>(BASE_CAPABILITIES);

export function isBaseCapability(s: string): s is BaseCapability {
  return BASE_CAPABILITY_SET.has(s);
}

// ---------------------------------------------------------------------------
// Parsed capability
// ---------------------------------------------------------------------------

export interface ParsedCapability {
  base: BaseCapability;
  taint?: TaintLevel;
}

// ---------------------------------------------------------------------------
// Action → Capability mapping
// ---------------------------------------------------------------------------

/**
 * Maps a tool/action name to its required base capability.
 * Throws on unknown tools so the gate can catch and deny.
 */
const ACTION_MAP: Record<string, BaseCapability> = {
  bash: "exec",
  shell: "exec",
  exec: "exec",
  "exec.elevated": "exec.elevated",
  "file.read": "file.read",
  read: "file.read",
  "file.write": "file.write",
  write: "file.write",
  edit: "file.write",
  browser: "browser",
  "browser.login": "browser.login",
  "channel.send": "channel.send",
  "channel.send.external": "channel.send.external",
  "cron.create": "cron.create",
  "skill.install": "skill.install",
  "memory.read.all_zones": "memory.read.all_zones",
  "memory.write": "memory.write",
  web_fetch: "web_fetch",
  "node.invoke": "node.invoke",
};

export function actionToCapability(action: string): BaseCapability {
  const cap = ACTION_MAP[action];
  if (!cap) {
    throw new Error(`Unknown action: ${action}`);
  }
  return cap;
}

// ---------------------------------------------------------------------------
// Capability result
// ---------------------------------------------------------------------------

export interface CapabilityResult {
  allowed: boolean;
  reason?: string;
}
