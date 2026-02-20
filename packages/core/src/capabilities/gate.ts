import type { TaintLevel } from "@/taint/index";
import { type CapabilitySet, intersectCapabilities } from "./set";
import { actionToCapability, type CapabilityResult } from "./types";

// ---------------------------------------------------------------------------
// Capability store interface (decoupled from config)
// ---------------------------------------------------------------------------

export interface CapabilityStore {
  getSessionCaps(sessionId: string): CapabilitySet | undefined;
  getSkillCaps(skillId: string): CapabilitySet;
  getChannelCaps(channelId: string): CapabilitySet | undefined;
}

// ---------------------------------------------------------------------------
// Gate context
// ---------------------------------------------------------------------------

export interface ExecutionContext {
  sessionId: string;
  skillId?: string;
  channelId?: string;
}

// ---------------------------------------------------------------------------
// THE gate function — pure, synchronous, zero I/O
// ---------------------------------------------------------------------------

/**
 * Check whether an action is allowed given the execution context.
 *
 * Effective capabilities = Session ∩ Skill ∩ Channel.
 * Returns `{ allowed: true }` or `{ allowed: false, reason }`.
 */
export function checkCapability(
  action: string,
  context: ExecutionContext,
  store: CapabilityStore,
  taint?: TaintLevel,
): CapabilityResult {
  // Map action to base capability
  let baseCap: ReturnType<typeof actionToCapability>;
  try {
    baseCap = actionToCapability(action);
  } catch {
    return { allowed: false, reason: `Unknown action: ${action}` };
  }

  // Session capabilities
  const sessionCaps = store.getSessionCaps(context.sessionId);
  if (!sessionCaps) {
    return { allowed: false, reason: `Unknown session: ${context.sessionId}` };
  }

  // Start with session, intersect with skill and channel
  let effective = sessionCaps;

  if (context.skillId) {
    const skillCaps = store.getSkillCaps(context.skillId);
    effective = intersectCapabilities(effective, skillCaps);
  }

  if (context.channelId) {
    const channelCaps = store.getChannelCaps(context.channelId);
    if (!channelCaps) {
      return { allowed: false, reason: `Unknown channel: ${context.channelId}` };
    }
    effective = intersectCapabilities(effective, channelCaps);
  }

  // Check if effective set grants the capability
  if (!effective.has(baseCap, taint)) {
    const tainting = taint ? ` at taint level "${taint}"` : "";
    return {
      allowed: false,
      reason: `Capability "${baseCap}" not granted${tainting}`,
    };
  }

  return { allowed: true };
}
