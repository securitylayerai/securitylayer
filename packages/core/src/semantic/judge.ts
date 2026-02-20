import type { JudgeContext, LLMClassification } from "./types";

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
 * Default LLM judge that makes actual API calls to Anthropic.
 * Falls back to taint-based heuristic when no API key is available.
 */
export function createDefaultLLMJudge(
  apiKey?: string,
  model = "claude-haiku-4-5-20251001",
  timeoutMs = 500,
): LLMJudge {
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
      if (!apiKey) {
        return classifyByTaint(context);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 256,
            system: JUDGE_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Action: ${context.action}\nTaint: ${context.taint}\nSession history: ${JSON.stringify(context.sessionHistory)}\n\nClassify this action.`,
              },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = (await response.json()) as {
          content?: { text?: string }[];
        };
        const text = data.content?.[0]?.text ?? "";
        const parsed = JSON.parse(text) as {
          decision?: string;
          confidence?: number;
          reasoning?: string;
        };

        return {
          decision: (parsed.decision as LLMClassification["decision"]) ?? "ANOMALOUS",
          confidence: parsed.confidence ?? 0.5,
          reasoning: parsed.reasoning ?? "LLM judge classification",
        };
      } catch {
        throw new Error("LLM judge unavailable");
      } finally {
        clearTimeout(timeout);
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
