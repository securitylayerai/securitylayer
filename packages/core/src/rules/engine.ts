import type { NormalizedExec } from "../normalize/types.js";
import { isTaintSufficient, type TaintLevel } from "../taint/index.js";
import { BUILTIN_RULES } from "./builtin.js";
import type { Rule, RuleResult } from "./types.js";

/**
 * Evaluates a normalized command against all rules.
 * Returns the first matching rule result, or {matched: false, decision: "ALLOW"}.
 */
export function evaluateRules(
  normalized: NormalizedExec,
  taint?: TaintLevel,
  extraRules: Rule[] = [],
): RuleResult {
  const allRules = [...BUILTIN_RULES, ...extraRules];

  for (const rule of allRules) {
    // Check override: if taint is below threshold, skip this rule
    if (rule.override?.taintBelow && taint && isTaintSufficient(taint, rule.override.taintBelow)) {
      continue;
    }

    if (matchesRule(normalized, rule)) {
      return {
        matched: true,
        rule,
        decision: rule.decision,
        reason: rule.reason,
      };
    }
  }

  return { matched: false, decision: "ALLOW" };
}

function matchesRule(normalized: NormalizedExec, rule: Rule): boolean {
  const { match } = rule;

  switch (match.type) {
    case "binary": {
      // Check primary binary and all chained commands
      if (normalized.binary === match.value) return true;
      if (normalized.binary.startsWith(`${match.value}.`)) return true; // e.g. mkfs.ext4
      for (const cmd of normalized.chainedCommands) {
        const bin = cmd.trim().split(/\s+/)[0];
        if (bin === match.value || bin?.startsWith(`${match.value}.`)) return true;
      }
      return false;
    }

    case "path": {
      const pathStr = typeof match.value === "string" ? match.value : match.value.toString();
      // Expand ~ for comparison
      const home = process.env.HOME ?? "";
      const expandedPattern = pathStr.replace(/^~/, home);
      for (const p of normalized.paths) {
        if (p.startsWith(expandedPattern)) return true;
      }
      // Also check raw command for path patterns
      const rawExpanded = normalized.raw.replace(/~/g, home);
      if (rawExpanded.includes(expandedPattern)) return true;
      return false;
    }

    case "pipe": {
      const pipeTarget = typeof match.value === "string" ? match.value : match.value.toString();
      for (const dest of normalized.pipeDestinations) {
        const destBin = dest.trim().split(/\s+/)[0];
        if (destBin === pipeTarget) return true;
      }
      return false;
    }

    case "pattern": {
      const regex = match.value instanceof RegExp ? match.value : new RegExp(match.value);
      return regex.test(normalized.raw);
    }
  }
}
