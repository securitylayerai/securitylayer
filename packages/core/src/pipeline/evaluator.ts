import { checkCapability, type ExecutionContext } from "../capabilities/gate.js";
import { eventBus } from "../events/bus.js";
import { normalizeExecAction } from "../normalize/normalizer.js";
import { evaluateRules } from "../rules/engine.js";
import { calculateRiskScore } from "../semantic/risk-score.js";
import type { LLMClassification } from "../semantic/types.js";
import { mergeDecisions } from "./merger.js";
import type { EvaluationResult, PipelineDeps } from "./types.js";

/**
 * Evaluates an action through the full security pipeline:
 * 1. Capability gate (synchronous, fast)
 * 2. Taint check
 * 3. Normalize the command
 * 4. Rules + LLM in parallel
 * 5. Merge all layer decisions
 *
 * Emits `action.evaluated` event on completion.
 */
export async function evaluateAction(
  action: string,
  context: ExecutionContext,
  deps: PipelineDeps,
  command?: string,
): Promise<EvaluationResult> {
  const startTime = performance.now();
  const timing: EvaluationResult["timing"] = { total: 0 };

  // 1. Capability gate
  const capStart = performance.now();
  const taint = deps.taintTracker.getEffectiveTaint();
  const capResult = checkCapability(action, context, deps.capabilityStore, taint);
  timing.capability = performance.now() - capStart;

  if (!capResult.allowed) {
    timing.total = performance.now() - startTime;
    const result: EvaluationResult = {
      decision: "DENY",
      layers: { capability: capResult, taint },
      degraded: false,
      timing,
    };
    emitEvaluation(action, result);
    return result;
  }

  // 2. Normalize (if exec action with command)
  const normalized = command ? normalizeExecAction(command) : undefined;

  // 3. Rules + LLM in parallel
  let degraded = false;

  const rulesStart = performance.now();
  const rulesResult = normalized ? evaluateRules(normalized, taint) : undefined;
  timing.rules = performance.now() - rulesStart;

  // LLM judge
  let llmResult: LLMClassification | undefined;
  try {
    const llmStart = performance.now();
    llmResult = await deps.judge.classify({
      action,
      sessionHistory: [],
      taint,
    });
    timing.llm = performance.now() - llmStart;
  } catch {
    degraded = true;
  }

  // 4. Risk score
  const riskScore = calculateRiskScore(action, taint);

  // 5. Merge decisions
  const decision = mergeDecisions(rulesResult, llmResult, riskScore, degraded);

  timing.total = performance.now() - startTime;

  const result: EvaluationResult = {
    decision,
    layers: {
      capability: capResult,
      taint,
      rules: rulesResult,
      llm: llmResult,
      riskScore,
    },
    degraded,
    timing,
  };

  emitEvaluation(action, result);
  return result;
}

function emitEvaluation(action: string, result: EvaluationResult): void {
  eventBus.emit({
    type: "action.evaluated",
    action,
    allowed: result.decision === "ALLOW",
    reason:
      result.decision !== "ALLOW"
        ? (result.layers.rules?.reason ??
          result.layers.llm?.reasoning ??
          result.layers.capability.reason)
        : undefined,
    taint: result.layers.taint as
      | "owner"
      | "trusted"
      | "untrusted"
      | "web"
      | "skill"
      | "memory"
      | undefined,
  });
}
