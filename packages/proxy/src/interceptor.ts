import type { AgentAdapter } from "@securitylayerai/adapters";
import type { EvaluateActionFn } from "./types";

export type InterceptDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface InterceptResult {
  decision: InterceptDecision;
  /** Modified frame (or original if allowed unmodified) */
  frame: Buffer | null;
  /** Deny response to send back to the client */
  denyResponse?: Buffer;
  /** Actions that were evaluated */
  actions: Array<{
    tool: string;
    decision: InterceptDecision;
    reason?: string;
  }>;
  /** Time taken in ms */
  latencyMs: number;
}

export interface Interceptor {
  /** Intercept an outbound frame (agent -> world) */
  interceptOutbound(raw: Buffer, sessionId: string, channelId?: string): Promise<InterceptResult>;

  /** Process an inbound frame (client -> agent) for taint tagging */
  processInbound(raw: Buffer): {
    sessionId: string;
    channel?: string;
    sender?: string;
  };
}

export function createInterceptor(
  adapter: AgentAdapter,
  evaluateAction: EvaluateActionFn,
): Interceptor {
  return {
    async interceptOutbound(
      raw: Buffer,
      sessionId: string,
      channelId?: string,
    ): Promise<InterceptResult> {
      const start = performance.now();
      const actions = adapter.parseOutboundFrame(raw);

      if (actions.length === 0) {
        return {
          decision: "ALLOW",
          frame: raw,
          actions: [],
          latencyMs: performance.now() - start,
        };
      }

      const results: InterceptResult["actions"] = [];
      let worstDecision: InterceptDecision = "ALLOW";
      let denyResponse: Buffer | undefined;

      for (const action of actions) {
        const context = { sessionId, channelId };

        // Extract command for exec actions
        const command =
          action.tool === "exec" || action.tool === "bash" || action.tool === "shell"
            ? (action.params.command as string | undefined)
            : undefined;

        const result = await evaluateAction(action.requiredCapability, context, command);

        results.push({
          tool: action.tool,
          decision: result.decision,
        });

        if (result.decision === "DENY") {
          worstDecision = "DENY";
          denyResponse = adapter.injectDenyResponse(
            { tool: action.tool, params: action.params },
            `Action denied by security policy`,
            action.toolCallId,
          );
          break; // DENY is absolute
        }

        if (result.decision === "REQUIRE_APPROVAL" && worstDecision === "ALLOW") {
          worstDecision = "REQUIRE_APPROVAL";
        }
      }

      return {
        decision: worstDecision,
        frame: worstDecision === "DENY" ? null : raw,
        denyResponse,
        actions: results,
        latencyMs: performance.now() - start,
      };
    },

    processInbound(raw: Buffer) {
      const event = adapter.parseInboundFrame(raw);
      return {
        sessionId: event.sessionId,
        channel: event.channel,
        sender: event.sender,
      };
    },
  };
}
