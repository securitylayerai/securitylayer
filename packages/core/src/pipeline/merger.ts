import type { RuleResult } from "../rules/types.js";
import type { RiskScore } from "../semantic/risk-score.js";
import type { LLMClassification } from "../semantic/types.js";
import type { PipelineDecision } from "./types.js";

/**
 * Merges decisions from multiple security layers.
 * Most restrictive wins:
 * 1. Rules DENY → always DENY
 * 2. LLM DANGEROUS with confidence ≥ 0.8 → DENY
 * 3. LLM ANOMALOUS → REQUIRE_APPROVAL
 * 4. LLM DANGEROUS with confidence < 0.8 → REQUIRE_APPROVAL
 * 5. Degraded mode + risk > 0.3 → REQUIRE_APPROVAL
 * 6. Otherwise → ALLOW
 */
export function mergeDecisions(
  rules: RuleResult | undefined,
  llm: LLMClassification | undefined,
  riskScore: RiskScore | undefined,
  degraded: boolean,
): PipelineDecision {
  // Rules DENY is absolute
  if (rules?.matched && rules.decision === "DENY") {
    return "DENY";
  }

  // Rules REQUIRE_APPROVAL
  if (rules?.matched && rules.decision === "REQUIRE_APPROVAL") {
    return "REQUIRE_APPROVAL";
  }

  // LLM DANGEROUS with high confidence → DENY
  if (llm?.decision === "DANGEROUS" && llm.confidence >= 0.8) {
    return "DENY";
  }

  // LLM ANOMALOUS → REQUIRE_APPROVAL
  if (llm?.decision === "ANOMALOUS") {
    return "REQUIRE_APPROVAL";
  }

  // LLM DANGEROUS with lower confidence → REQUIRE_APPROVAL
  if (llm?.decision === "DANGEROUS" && llm.confidence < 0.8) {
    return "REQUIRE_APPROVAL";
  }

  // Degraded mode with elevated risk → REQUIRE_APPROVAL
  if (degraded && riskScore && riskScore.score > 0.3) {
    return "REQUIRE_APPROVAL";
  }

  return "ALLOW";
}
