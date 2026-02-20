import type { JudgeContext, LLMClassification } from "./types.js";

export const JUDGE_SYSTEM_PROMPT = `You are SecurityLayer's semantic judge. Your job is to classify agent actions as NORMAL, ANOMALOUS, or DANGEROUS.

Consider the action in context of:
1. The session history — does this action fit the pattern of work?
2. The taint level — how trusted is the data driving this action?
3. The behavioral baseline — is this action typical for this user/agent?

Respond with a JSON object: { "decision": "NORMAL|ANOMALOUS|DANGEROUS", "confidence": 0.0-1.0, "reasoning": "..." }

Be conservative: when uncertain, classify as ANOMALOUS rather than NORMAL.
Never classify something as DANGEROUS unless you are highly confident it represents a real threat.`;

/** Interface for LLM-based action classification. */
export interface LLMJudge {
  classify(context: JudgeContext): Promise<LLMClassification>;
}

/**
 * Default LLM judge that makes actual API calls.
 * v0: scaffold — implementation requires API integration.
 */
export class DefaultLLMJudge implements LLMJudge {
  async classify(context: JudgeContext): Promise<LLMClassification> {
    // v0: Placeholder — actual API integration is v1
    // For now, return a conservative classification based on taint
    const taintSeverity = ["owner", "trusted"].includes(context.taint) ? "low" : "elevated";
    if (taintSeverity === "elevated") {
      return {
        decision: "ANOMALOUS",
        confidence: 0.5,
        reasoning: `Elevated taint level (${context.taint}) — flagging for review`,
      };
    }
    return {
      decision: "NORMAL",
      confidence: 0.8,
      reasoning: "Action appears normal given trusted context",
    };
  }
}

/** No-op judge for testing and degraded mode. Always returns NORMAL. */
export class NoOpJudge implements LLMJudge {
  async classify(_context: JudgeContext): Promise<LLMClassification> {
    return {
      decision: "NORMAL",
      confidence: 1.0,
      reasoning: "NoOp judge — always NORMAL",
    };
  }
}
