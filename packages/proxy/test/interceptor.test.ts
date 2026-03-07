import type { AgentAdapter } from "@securitylayerai/adapters";
import { describe, expect, it } from "vitest";
import { createInterceptor } from "../src/interceptor";
import type { EvaluateActionFn } from "../src/types";

function createMockAdapter(overrides: Partial<AgentAdapter> = {}): AgentAdapter {
  return {
    parseInboundFrame: (raw) => ({
      type: "message",
      sessionId: "test-session",
      channel: "terminal",
      sender: "user",
      data: raw,
    }),
    parseOutboundFrame: () => [],
    injectDenyResponse: (action, reason) =>
      Buffer.from(JSON.stringify({ error: reason, tool: action.tool })),
    getSessionMetadata: () => ({
      id: "test-session",
      channel: "terminal",
      activeSkill: null,
      owner: true,
    }),
    extractToolCalls: () => [],
    wrapReplayAction: (action) => Buffer.from(JSON.stringify(action)),
    ...overrides,
  };
}

function createMockEvaluator(
  decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" = "ALLOW",
): EvaluateActionFn {
  return async () => ({ decision });
}

describe("createInterceptor", () => {
  describe("interceptOutbound", () => {
    it("allows frames with no actions", async () => {
      const adapter = createMockAdapter();
      const interceptor = createInterceptor(adapter, createMockEvaluator());

      const result = await interceptor.interceptOutbound(Buffer.from("hello"), "session-1");

      expect(result.decision).toBe("ALLOW");
      expect(result.frame).toEqual(Buffer.from("hello"));
      expect(result.actions).toHaveLength(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("allows frames when all actions are allowed", async () => {
      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          {
            tool: "file_read",
            params: { path: "/tmp/test.txt" },
            requiredCapability: "file.read",
          },
        ],
      });
      const interceptor = createInterceptor(adapter, createMockEvaluator("ALLOW"));

      const result = await interceptor.interceptOutbound(Buffer.from("read"), "session-1");

      expect(result.decision).toBe("ALLOW");
      expect(result.frame).toEqual(Buffer.from("read"));
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].tool).toBe("file_read");
      expect(result.actions[0].decision).toBe("ALLOW");
    });

    it("denies frames when any action is denied", async () => {
      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          {
            tool: "exec",
            params: { command: "rm -rf /" },
            requiredCapability: "exec",
          },
        ],
      });
      const interceptor = createInterceptor(adapter, createMockEvaluator("DENY"));

      const result = await interceptor.interceptOutbound(Buffer.from("exec"), "session-1");

      expect(result.decision).toBe("DENY");
      expect(result.frame).toBeNull();
      expect(result.denyResponse).toBeDefined();
      expect(result.actions[0].decision).toBe("DENY");
    });

    it("returns REQUIRE_APPROVAL when action needs approval", async () => {
      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          {
            tool: "npm_publish",
            params: {},
            requiredCapability: "package.publish",
          },
        ],
      });
      const interceptor = createInterceptor(adapter, createMockEvaluator("REQUIRE_APPROVAL"));

      const result = await interceptor.interceptOutbound(Buffer.from("publish"), "session-1");

      expect(result.decision).toBe("REQUIRE_APPROVAL");
      expect(result.frame).toEqual(Buffer.from("publish"));
      expect(result.actions[0].decision).toBe("REQUIRE_APPROVAL");
    });

    it("DENY takes precedence over REQUIRE_APPROVAL", async () => {
      let callCount = 0;
      const evaluator: EvaluateActionFn = async () => {
        callCount++;
        // First action requires approval, second is denied
        if (callCount === 1) return { decision: "REQUIRE_APPROVAL" };
        return { decision: "DENY" };
      };

      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          { tool: "read", params: {}, requiredCapability: "file.read" },
          { tool: "exec", params: { command: "rm -rf /" }, requiredCapability: "exec" },
        ],
      });
      const interceptor = createInterceptor(adapter, evaluator);

      const result = await interceptor.interceptOutbound(Buffer.from("multi"), "session-1");

      expect(result.decision).toBe("DENY");
      expect(result.frame).toBeNull();
    });

    it("passes command to evaluator for exec-like tools", async () => {
      let receivedCommand: string | undefined;
      const evaluator: EvaluateActionFn = async (_action, _ctx, command) => {
        receivedCommand = command;
        return { decision: "ALLOW" };
      };

      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          {
            tool: "bash",
            params: { command: "ls -la" },
            requiredCapability: "exec",
          },
        ],
      });
      const interceptor = createInterceptor(adapter, evaluator);

      await interceptor.interceptOutbound(Buffer.from("bash"), "session-1");

      expect(receivedCommand).toBe("ls -la");
    });

    it("does not pass command for non-exec tools", async () => {
      let receivedCommand: string | undefined;
      const evaluator: EvaluateActionFn = async (_action, _ctx, command) => {
        receivedCommand = command;
        return { decision: "ALLOW" };
      };

      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          {
            tool: "file_read",
            params: { path: "/tmp/test.txt" },
            requiredCapability: "file.read",
          },
        ],
      });
      const interceptor = createInterceptor(adapter, evaluator);

      await interceptor.interceptOutbound(Buffer.from("read"), "session-1");

      expect(receivedCommand).toBeUndefined();
    });

    it("passes channelId to evaluator context", async () => {
      let receivedContext: { sessionId: string; channelId?: string } | undefined;
      const evaluator: EvaluateActionFn = async (_action, ctx) => {
        receivedContext = ctx;
        return { decision: "ALLOW" };
      };

      const adapter = createMockAdapter({
        parseOutboundFrame: () => [
          { tool: "send", params: {}, requiredCapability: "channel.send" },
        ],
      });
      const interceptor = createInterceptor(adapter, evaluator);

      await interceptor.interceptOutbound(Buffer.from("send"), "session-1", "channel-abc");

      expect(receivedContext?.sessionId).toBe("session-1");
      expect(receivedContext?.channelId).toBe("channel-abc");
    });

    it("tracks latency in result", async () => {
      const adapter = createMockAdapter({
        parseOutboundFrame: () => [{ tool: "read", params: {}, requiredCapability: "file.read" }],
      });
      const interceptor = createInterceptor(adapter, createMockEvaluator());

      const result = await interceptor.interceptOutbound(Buffer.from("test"), "session-1");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe("number");
    });
  });

  describe("processInbound", () => {
    it("extracts session info from inbound frame", () => {
      const adapter = createMockAdapter({
        parseInboundFrame: () => ({
          type: "message",
          sessionId: "sess-123",
          channel: "slack",
          sender: "alice",
          data: Buffer.from("hi"),
        }),
      });
      const interceptor = createInterceptor(adapter, createMockEvaluator());

      const info = interceptor.processInbound(Buffer.from("inbound"));

      expect(info.sessionId).toBe("sess-123");
      expect(info.channel).toBe("slack");
      expect(info.sender).toBe("alice");
    });

    it("handles missing optional fields", () => {
      const adapter = createMockAdapter({
        parseInboundFrame: () => ({
          type: "message",
          sessionId: "sess-456",
          data: Buffer.from("hi"),
        }),
      });
      const interceptor = createInterceptor(adapter, createMockEvaluator());

      const info = interceptor.processInbound(Buffer.from("inbound"));

      expect(info.sessionId).toBe("sess-456");
      expect(info.channel).toBeUndefined();
      expect(info.sender).toBeUndefined();
    });
  });
});
