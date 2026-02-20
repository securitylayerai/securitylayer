import { eventBus } from "@/events/bus";
import type { NormalizedExec } from "@/normalize/types";
import { isTaintSufficient, type TaintLevel } from "@/taint/index";
import { BUILTIN_RULES } from "./builtin";
import type { Rule, RuleResult } from "./types";

/**
 * Evaluates a normalized command against all rules.
 * Collects all matching rules and returns the most restrictive result:
 * DENY > REQUIRE_APPROVAL > ALLOW.
 */
export function evaluateRules(
  normalized: NormalizedExec,
  taint?: TaintLevel,
  extraRules: Rule[] = [],
): RuleResult {
  const allRules = [...BUILTIN_RULES, ...extraRules];
  let mostRestrictive: RuleResult = { matched: false, decision: "ALLOW" };

  for (const rule of allRules) {
    // Check override: if taint is below threshold, skip this rule
    if (rule.override?.taintBelow && taint && isTaintSufficient(taint, rule.override.taintBelow)) {
      continue;
    }

    if (matchesRule(normalized, rule)) {
      const candidate: RuleResult = {
        matched: true,
        rule,
        decision: rule.decision,
        reason: rule.reason,
      };

      if (candidate.decision === "DENY") {
        // DENY is absolute — emit and short-circuit
        eventBus.emit({
          type: "rule.triggered",
          ruleId: rule.id,
          action: normalized.raw,
          decision: rule.decision,
        });
        return candidate;
      }

      // Keep the more restrictive result
      if (!mostRestrictive.matched || mostRestrictive.decision === "ALLOW") {
        mostRestrictive = candidate;
      }
    }
  }

  // Emit event for the winning match (if any)
  if (mostRestrictive.matched && mostRestrictive.rule) {
    eventBus.emit({
      type: "rule.triggered",
      ruleId: mostRestrictive.rule.id,
      action: normalized.raw,
      decision: mostRestrictive.decision,
    });
  }

  return mostRestrictive;
}

/**
 * Converts a glob pattern to a RegExp for path matching.
 * Supports **, *, and ? wildcards.
 */
function matchGlob(pattern: string, path: string): boolean {
  const regexStr = pattern
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/{{GLOBSTAR}}/g, ".*")
    .replace(/\./g, "\\.");
  return new RegExp(`^${regexStr}$`).test(path);
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
        // Try glob matching first, fall back to startsWith
        if (matchGlob(expandedPattern, p) || p.startsWith(expandedPattern)) return true;
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

    case "pipe_pair": {
      if (!match.from || !match.to) return false;
      // Check if normalized has a pipe where source is in `from` and destination is in `to`
      const sourceBin = normalized.binary;
      for (const dest of normalized.pipeDestinations) {
        const destBin = dest.trim().split(/\s+/)[0] ?? "";
        if (match.from.includes(sourceBin) && match.to.includes(destBin)) return true;
      }
      // Also check chained commands for pipe pairs
      for (const cmd of normalized.chainedCommands) {
        const stages = cmd.split("|").map((s) => s.trim().split(/\s+/)[0] ?? "");
        for (let i = 0; i < stages.length - 1; i++) {
          if (match.from.includes(stages[i]) && match.to.includes(stages[i + 1])) return true;
        }
      }
      return false;
    }
  }
}
