import { isTaintSufficient, TAINT_SEVERITY, type TaintLevel } from "../taint/index.js";
import { type BaseCapability, isBaseCapability, type ParsedCapability } from "./types.js";

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

  const taint = parts[1] as TaintLevel | undefined;
  return { base, taint };
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
export class CapabilitySet {
  /** `undefined` value = unrestricted (no taint requirement). */
  private caps = new Map<BaseCapability, TaintLevel | undefined>();

  constructor(capStrings: string[] = []) {
    for (const s of capStrings) {
      const parsed = parseCapabilityString(s);
      this.addParsed(parsed);
    }
  }

  private addParsed(parsed: ParsedCapability): void {
    const existing = this.caps.get(parsed.base);

    if (existing === undefined && this.caps.has(parsed.base)) {
      // Already unrestricted — nothing more permissive.
      return;
    }

    if (parsed.taint === undefined) {
      // Unrestricted grant overrides any qualification.
      this.caps.set(parsed.base, undefined);
      return;
    }

    if (existing === undefined && !this.caps.has(parsed.base)) {
      // First entry for this capability.
      this.caps.set(parsed.base, parsed.taint);
      return;
    }

    // Both have taint: keep the more permissive (higher severity number).
    if (existing !== undefined && TAINT_SEVERITY[parsed.taint] > TAINT_SEVERITY[existing]) {
      this.caps.set(parsed.base, parsed.taint);
    }
  }

  /** Check if this set grants the given capability, optionally under a taint level. */
  has(base: BaseCapability, taint?: TaintLevel): boolean {
    if (!this.caps.has(base)) return false;

    const required = this.caps.get(base);
    if (required === undefined) return true; // unrestricted
    if (taint === undefined) return true; // no taint context, grant is present
    return isTaintSufficient(taint, required);
  }

  /** Returns the taint restriction for a capability, or undefined if unrestricted/absent. */
  getRestriction(base: BaseCapability): TaintLevel | undefined {
    return this.caps.get(base);
  }

  /** Whether this set has any entry for the given base capability. */
  hasBase(base: BaseCapability): boolean {
    return this.caps.has(base);
  }

  get size(): number {
    return this.caps.size;
  }

  /**
   * Intersect two capability sets: result contains only capabilities present
   * in BOTH, with the most restrictive taint qualification.
   */
  static intersect(a: CapabilitySet, b: CapabilitySet): CapabilitySet {
    const result = new CapabilitySet();

    for (const [base, aTaint] of a.caps) {
      if (!b.caps.has(base)) continue;
      const bTaint = b.caps.get(base);

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

      if (taint === undefined) {
        result.caps.set(base, undefined);
      } else {
        result.caps.set(base, taint);
      }
    }

    return result;
  }
}
