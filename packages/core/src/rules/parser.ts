import { parse as parseYaml } from "yaml";
import type { Rule, RuleMatch } from "./types.js";

interface YamlRule {
  id: string;
  description: string;
  match: { type: string; value: string };
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
    const match: RuleMatch = {
      type: raw.match.type as RuleMatch["type"],
      value: raw.match.type === "pattern" ? new RegExp(raw.match.value) : raw.match.value,
    };

    return {
      id: raw.id,
      description: raw.description,
      match,
      decision: raw.decision as Rule["decision"],
      reason: raw.reason,
    };
  });
}
