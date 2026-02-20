import { checkCapability, type ExecutionContext } from "../capabilities/gate";
import type { LearnedRulesConfig } from "../config/types";
import { eventBus as singletonBus } from "../events/bus";
import { normalizeExecAction } from "../normalize/normalizer";
import type { NormalizedExec } from "../normalize/types";
import { evaluateRules } from "../rules/engine";
import { calculateRiskScore } from "../semantic/risk-score";
import type { LLMClassification } from "../semantic/types";
import { mergeDecisions } from "./merger";
import type { EvaluationResult, PipelineDeps } from "./types";

/**
 * Evaluates an action through the full security pipeline:
 * 1. Capability gate (synchronous, fast)
 * 2. Taint check
 * 3. Normalize the command
 * 4. Learned rules check (skip Layer 2/3 if match)
 * 5. Rules + LLM in parallel
 * 6. Merge all layer decisions
 * 7. Mandatory approval for high-risk actions
 *
 * Emits `action.evaluated` event on completion.
 */
export async function evaluateAction(
  action: string,
  context: ExecutionContext,
  deps: PipelineDeps,
  command?: string,
  _isChainedSubCommand = false,
): Promise<EvaluationResult> {
  const bus = deps.eventBus ?? singletonBus;
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
    emitEvaluation(action, result, bus);
    return result;
  }

  // 2. Normalize (if exec action with command)
  const normalized = command ? normalizeExecAction(command) : undefined;

  // 3. Chained command evaluation — each sub-command through full pipeline
  if (!_isChainedSubCommand && normalized && normalized.chainedCommands.length > 1) {
    let worstDecision: EvaluationResult["decision"] = "ALLOW";
    let worstResult: EvaluationResult | undefined;

    for (const subCmd of normalized.chainedCommands) {
      const subResult = await evaluateAction(action, context, deps, subCmd, true);

      if (subResult.decision === "DENY") {
        timing.total = performance.now() - startTime;
        subResult.timing = timing;
        emitEvaluation(action, subResult, bus);
        return subResult;
      }

      if (subResult.decision === "REQUIRE_APPROVAL" && worstDecision !== "REQUIRE_APPROVAL") {
        worstDecision = "REQUIRE_APPROVAL";
        worstResult = subResult;
      }

      if (!worstResult) worstResult = subResult;
    }

    if (worstDecision === "REQUIRE_APPROVAL" && worstResult) {
      timing.total = performance.now() - startTime;
      worstResult.timing = timing;
      worstResult.decision = "REQUIRE_APPROVAL";
      emitEvaluation(action, worstResult, bus);
      return worstResult;
    }

    if (worstResult) {
      timing.total = performance.now() - startTime;
      worstResult.timing = timing;
      emitEvaluation(action, worstResult, bus);
      return worstResult;
    }
  }

  // 4. Learned rules check — skip expensive Layer 2/3 if match
  if (deps.learnedRules && normalized) {
    const learned = checkLearnedRules(normalized, deps.learnedRules);
    if (learned) {
      timing.total = performance.now() - startTime;
      const result: EvaluationResult = {
        decision: "ALLOW",
        layers: { capability: capResult, taint },
        degraded: false,
        timing,
      };
      emitEvaluation(action, result, bus);
      return result;
    }
  }

  // 5. Rules + LLM in parallel
  let degraded = false;

  const rulesStart = performance.now();
  const rulesResult = normalized
    ? evaluateRules(normalized, taint, deps.extraRules ?? [])
    : undefined;
  timing.rules = performance.now() - rulesStart;

  // LLM judge
  let llmResult: LLMClassification | undefined;
  try {
    const llmStart = performance.now();
    llmResult = await deps.judge.classify({
      action,
      sessionHistory: deps.sessionHistory ?? [],
      taint,
    });
    timing.llm = performance.now() - llmStart;
  } catch {
    degraded = true;
  }

  // 6. Risk score
  const riskScore = calculateRiskScore(action, taint, undefined, normalized);

  // 7. Merge decisions
  let decision = mergeDecisions(rulesResult, llmResult, riskScore, degraded);

  // Mandatory approval for high-risk actions (after merge so DENY still takes precedence)
  if ((action === "cron.create" || action === "node.invoke") && decision === "ALLOW") {
    decision = "REQUIRE_APPROVAL";
  }

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

  emitEvaluation(action, result, bus);
  return result;
}

function checkLearnedRules(normalized: NormalizedExec, config: LearnedRulesConfig): boolean {
  for (const rule of config.rules) {
    if (normalized.raw.includes(rule.pattern) || normalized.binary === rule.pattern) {
      return true;
    }
  }
  return false;
}

function emitEvaluation(action: string, result: EvaluationResult, bus: typeof singletonBus): void {
  bus.emit({
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
