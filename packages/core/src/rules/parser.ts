import { parse as parseYaml } from "yaml";
import type { Rule, RuleMatch } from "./types";

const VALID_MATCH_TYPES = new Set(["binary", "path", "pipe", "pattern", "pipe_pair"]);
const VALID_DECISIONS = new Set(["DENY", "REQUIRE_APPROVAL"]);

interface YamlRule {
  id: string;
  description: string;
  match: { type: string; value: string; from?: string[]; to?: string[] };
  decision: string;
  reason: string;
}

/**
 * Parses YAML content into Rule objects.
 * Expected format:
 * ```yaml
 * rules:
 *   - id: my-rule
 *     description: ...
 *     match: { type: pattern, value: "regex" }
 *     decision: DENY
 *     reason: ...
 * ```
 */
export function parseRulesYaml(content: string): Rule[] {
  const parsed = parseYaml(content);
  if (!parsed?.rules || !Array.isArray(parsed.rules)) {
    return [];
  }

  return parsed.rules.map((raw: YamlRule) => {
    if (!VALID_MATCH_TYPES.has(raw.match.type)) {
      throw new Error(
        `Invalid match type "${raw.match.type}" in rule "${raw.id}". Valid types: ${[...VALID_MATCH_TYPES].join(", ")}`,
      );
    }

    if (!VALID_DECISIONS.has(raw.decision)) {
      throw new Error(
        `Invalid decision "${raw.decision}" in rule "${raw.id}". Valid decisions: ${[...VALID_DECISIONS].join(", ")}`,
      );
    }

    const match: RuleMatch = {
      type: raw.match.type as RuleMatch["type"],
      value: raw.match.type === "pattern" ? new RegExp(raw.match.value) : raw.match.value,
    };

    if (raw.match.from) match.from = raw.match.from;
    if (raw.match.to) match.to = raw.match.to;

    return {
      id: raw.id,
      description: raw.description,
      match,
      decision: raw.decision as Rule["decision"],
      reason: raw.reason,
    };
  });
}
