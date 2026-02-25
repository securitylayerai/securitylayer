import { generateObject } from "ai";
import { z } from "zod";
import type { SemanticConfig } from "@/config/types";
import { createModelFromConfig } from "./provider";
import type { JudgeContext, LLMClassification } from "./types";

export const JUDGE_SYSTEM_PROMPT = `You are Security Layer's semantic judge. Your job is to classify agent actions as NORMAL, ANOMALOUS, or DANGEROUS.

Consider the action in context of:
1. The session history — does this action fit the pattern of work?
2. The taint level — how trusted is the data driving this action?
3. The behavioral baseline — is this action typical for this user/agent?

Be conservative: when uncertain, classify as ANOMALOUS rather than NORMAL.
Never classify something as DANGEROUS unless you are highly confident it represents a real threat.`;

const ClassificationSchema = z.object({
  decision: z.enum(["NORMAL", "ANOMALOUS", "DANGEROUS"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

/** Interface for LLM-based action classification. */
export interface LLMJudge {
  classify(context: JudgeContext): Promise<LLMClassification>;
}

/**
 * Default LLM judge using the AI SDK for multi-provider support.
 * Falls back to taint-based heuristic when no API key is available.
 */
export function createDefaultLLMJudge(config: SemanticConfig): LLMJudge {
  function classifyByTaint(context: JudgeContext): LLMClassification {
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

  return {
    async classify(context: JudgeContext): Promise<LLMClassification> {
      const apiKey = config.api_key_env ? process.env[config.api_key_env] : undefined;

      if (!apiKey) {
        return classifyByTaint(context);
      }

      try {
        const model = createModelFromConfig(config);

        const { object } = await generateObject({
          model,
          schema: ClassificationSchema,
          system: JUDGE_SYSTEM_PROMPT,
          prompt: `Action: ${context.action}\nTaint: ${context.taint}\nSession history: ${JSON.stringify(context.sessionHistory)}\n\nClassify this action.`,
          maxTokens: 256,
          abortSignal: AbortSignal.timeout(config.timeout_ms),
        });

        return {
          decision: object.decision,
          confidence: object.confidence,
          reasoning: object.reasoning,
        };
      } catch {
        throw new Error("LLM judge unavailable");
      }
    },
  };
}

/** No-op judge for testing and degraded mode. Always returns NORMAL. */
export function createNoOpJudge(): LLMJudge {
  return {
    async classify(_context: JudgeContext): Promise<LLMClassification> {
      return {
        decision: "NORMAL",
        confidence: 1.0,
        reasoning: "NoOp judge — always NORMAL",
      };
    },
  };
}
