import { isTaintSufficient, TAINT_SEVERITY, type TaintLevel } from "@/taint/index";
import { type BaseCapability, isBaseCapability, type ParsedCapability } from "./types";

/**
 * Parses a capability string like `"exec"` or `"exec:trusted"` into a
 * `ParsedCapability`. Throws on invalid format.
 */
export function parseCapabilityString(s: string): ParsedCapability {
  const parts = s.split(":");
  if (parts.length > 2) {
    throw new Error(`Invalid capability string: ${s}`);
  }

  const base = parts[0];
  if (!isBaseCapability(base)) {
    throw new Error(`Unknown base capability: ${base}`);
  }

  const taint = parts[1];
  if (taint !== undefined) {
    if (!(taint in TAINT_SEVERITY)) {
      throw new Error(`Invalid taint level "${taint}" in capability string: ${s}`);
    }
  }
  return { base, taint: taint as TaintLevel | undefined };
}

/**
 * A set of capabilities with optional taint qualifications.
 *
 * Stores the *most permissive* grant per base capability:
 * - unrestricted (`exec`) overrides qualified (`exec:trusted`)
 * - among qualifications, higher severity (less trusted) wins as "most permissive"
 *
 * For intersection, takes the *most restrictive*:
 * - qualified overrides unrestricted
 * - among qualifications, lower severity (more trusted) wins
 */
export function createCapabilitySet(capStrings: string[] = []) {
  /** `undefined` value = unrestricted (no taint requirement). */
  const caps = new Map<BaseCapability, TaintLevel | undefined>();

  function addParsed(parsed: ParsedCapability): void {
    const existing = caps.get(parsed.base);

    if (existing === undefined && caps.has(parsed.base)) {
      // Already unrestricted — nothing more permissive.
      return;
    }

    if (parsed.taint === undefined) {
      // Unrestricted grant overrides any qualification.
      caps.set(parsed.base, undefined);
      return;
    }

    if (existing === undefined && !caps.has(parsed.base)) {
      // First entry for this capability.
      caps.set(parsed.base, parsed.taint);
      return;
    }

    // Both have taint: keep the more permissive (higher severity number).
    if (existing !== undefined && TAINT_SEVERITY[parsed.taint] > TAINT_SEVERITY[existing]) {
      caps.set(parsed.base, parsed.taint);
    }
  }

  for (const s of capStrings) {
    addParsed(parseCapabilityString(s));
  }

  return {
    /** Check if this set grants the given capability, optionally under a taint level. */
    has(base: BaseCapability, taint?: TaintLevel): boolean {
      if (!caps.has(base)) return false;

      const required = caps.get(base);
      if (required === undefined) return true; // unrestricted
      if (taint === undefined) return true; // no taint context, grant is present
      return isTaintSufficient(taint, required);
    },

    /** Returns the taint restriction for a capability, or undefined if unrestricted/absent. */
    getRestriction(base: BaseCapability): TaintLevel | undefined {
      return caps.get(base);
    },

    /** Whether this set has any entry for the given base capability. */
    hasBase(base: BaseCapability): boolean {
      return caps.has(base);
    },

    get size(): number {
      return caps.size;
    },

    /** Returns the internal entries for use by intersectCapabilities. */
    entries(): IterableIterator<[BaseCapability, TaintLevel | undefined]> {
      return caps.entries();
    },
  };
}

export type CapabilitySet = ReturnType<typeof createCapabilitySet>;

/**
 * Intersect two capability sets: result contains only capabilities present
 * in BOTH, with the most restrictive taint qualification.
 */
export function intersectCapabilities(a: CapabilitySet, b: CapabilitySet): CapabilitySet {
  const capStrings: string[] = [];

  for (const [base, aTaint] of a.entries()) {
    if (!b.hasBase(base)) continue;
    const bTaint = b.getRestriction(base);

    let taint: TaintLevel | undefined;
    if (aTaint === undefined && bTaint === undefined) {
      taint = undefined; // both unrestricted
    } else if (aTaint === undefined) {
      taint = bTaint; // b is more restrictive
    } else if (bTaint === undefined) {
      taint = aTaint; // a is more restrictive
    } else {
      // Both have taint: pick lower severity (more restrictive / more trusted).
      taint = TAINT_SEVERITY[aTaint] <= TAINT_SEVERITY[bTaint] ? aTaint : bTaint;
    }

    capStrings.push(taint === undefined ? base : `${base}:${taint}`);
  }

  return createCapabilitySet(capStrings);
}
