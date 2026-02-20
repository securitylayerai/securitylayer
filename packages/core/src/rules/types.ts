import type { TaintLevel } from "../taint/index.js";

export interface RuleMatch {
  type: "binary" | "path" | "pipe" | "pattern";
  value: string | RegExp;
}

export interface Rule {
  id: string;
  description: string;
  match: RuleMatch;
  decision: "DENY" | "REQUIRE_APPROVAL";
  reason: string;
  override?: {
    taintBelow?: TaintLevel;
  };
}

export interface RuleResult {
  matched: boolean;
  rule?: Rule;
  decision: "DENY" | "REQUIRE_APPROVAL" | "ALLOW";
  reason?: string;
}
