import { z } from "zod";

export const TaintLevel = {
  OWNER: "owner",
  TRUSTED: "trusted",
  UNTRUSTED: "untrusted",
  WEB: "web",
  SKILL: "skill",
  MEMORY: "memory",
} as const;

export type TaintLevel = (typeof TaintLevel)[keyof typeof TaintLevel];

export const TaintLevelSchema = z.enum(["owner", "trusted", "untrusted", "web", "skill", "memory"]);

/** Lower number = more trusted. */
export const TAINT_SEVERITY: Record<TaintLevel, number> = {
  owner: 0,
  trusted: 1,
  untrusted: 2,
  web: 3,
  skill: 4,
  memory: 5,
};

/** Returns the higher-severity (less trusted) of two taint levels. */
export function worstOf(a: TaintLevel, b: TaintLevel): TaintLevel {
  return TAINT_SEVERITY[a] >= TAINT_SEVERITY[b] ? a : b;
}

/** Returns true if `actual` is at least as trusted as `required`. */
export function isTaintSufficient(actual: TaintLevel, required: TaintLevel): boolean {
  return TAINT_SEVERITY[actual] <= TAINT_SEVERITY[required];
}

export { SessionTaintTracker } from "./tracker.js";
// Re-export new files
export type { TaintedData, TaintOrigin } from "./types.js";
