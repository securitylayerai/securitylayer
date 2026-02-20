import type { TaintLevel } from "@/taint/index";

export interface RuleMatch {
  type: "binary" | "path" | "pipe" | "pattern" | "pipe_pair";
  value: string | RegExp;
  from?: string[];
  to?: string[];
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
