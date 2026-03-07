import { describe, expect, it } from "vitest";
import { createGenericAdapter } from "../src/generic";
import type { SessionInfo } from "../src/types";

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

describe("createGenericAdapter", () => {
  const adapter = createGenericAdapter();

  describe("parseInboundFrame", () => {
    it("parses message frames", () => {
      const frame = toBuffer({
        type: "message",
        sessionId: "sess-1",
        sender: "user",
        channel: "webchat",
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("message");
      expect(event.sessionId).toBe("sess-1");
      expect(event.sender).toBe("user");
    });

    it("parses tool_call frames as agent_instruction", () => {
      const frame = toBuffer({
        type: "tool_call",
        sessionId: "sess-1",
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("agent_instruction");
    });

    it("defaults unknown session to unknown", () => {
      const frame = toBuffer({ type: "message" });
      const event = adapter.parseInboundFrame(frame);
      expect(event.sessionId).toBe("unknown");
    });
  });

  describe("parseOutboundFrame", () => {
    it("extracts tool calls from frame", () => {
      const frame = toBuffer({
        toolCalls: [
          { id: "1", name: "exec", input: { command: "ls" } },
          { id: "2", name: "write", input: { path: "/tmp/x", content: "hello" } },
        ],
      });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions).toHaveLength(2);
      expect(actions[0].tool).toBe("exec");
      expect(actions[0].requiredCapability).toBe("exec");
      expect(actions[1].tool).toBe("write");
      expect(actions[1].requiredCapability).toBe("file.write");
    });

    it("returns empty for frames without tool calls", () => {
      const frame = toBuffer({ type: "text", message: "hello" });
      expect(adapter.parseOutboundFrame(frame)).toHaveLength(0);
    });

    it("uses custom capability mapping", () => {
      const custom = createGenericAdapter({
        toolCapabilityMap: { custom_tool: "custom.cap" },
      });
      const frame = toBuffer({
        toolCalls: [{ id: "1", name: "custom_tool", input: {} }],
      });
      const actions = custom.parseOutboundFrame(frame);
      expect(actions[0].requiredCapability).toBe("custom.cap");
    });
  });

  describe("injectDenyResponse", () => {
    it("creates error response", () => {
      const buf = adapter.injectDenyResponse(
        { tool: "exec", params: { command: "rm -rf /" } },
        "blocked",
      );
      const parsed = JSON.parse(buf.toString());
      expect(parsed.type).toBe("error");
      expect(parsed.error.code).toBe("SECURITY_DENIED");
      expect(parsed.error.tool).toBe("exec");
      expect(parsed.error.reason).toBe("blocked");
    });
  });

  describe("getSessionMetadata", () => {
    it("returns default for unknown sessions", () => {
      const info = adapter.getSessionMetadata("unknown-session");
      expect(info.id).toBe("unknown-session");
      expect(info.owner).toBe(false);
    });

    it("returns configured session info", () => {
      const sessions = new Map<string, SessionInfo>();
      sessions.set("admin", {
        id: "admin",
        channel: "terminal",
        activeSkill: "devops",
        owner: true,
      });
      const custom = createGenericAdapter({ sessions });
      const info = custom.getSessionMetadata("admin");
      expect(info.owner).toBe(true);
      expect(info.activeSkill).toBe("devops");
    });
  });

  describe("extractToolCalls", () => {
    it("extracts tool calls", () => {
      const frame = toBuffer({
        toolCalls: [{ id: "tc1", name: "read", input: { path: "/etc/hosts" } }],
      });
      const calls = adapter.extractToolCalls(frame);
      expect(calls).toHaveLength(1);
      expect(calls[0].id).toBe("tc1");
      expect(calls[0].name).toBe("read");
    });

    it("returns empty when no tool calls", () => {
      const frame = toBuffer({ message: "hello" });
      expect(adapter.extractToolCalls(frame)).toHaveLength(0);
    });
  });

  describe("wrapReplayAction", () => {
    it("wraps action for replay", () => {
      const buf = adapter.wrapReplayAction({
        tool: "exec",
        params: { command: "git push" },
      });
      const parsed = JSON.parse(buf.toString());
      expect(parsed.type).toBe("tool_call");
      expect(parsed.toolCalls).toHaveLength(1);
      expect(parsed.toolCalls[0].name).toBe("exec");
      expect(parsed.replay).toBe(true);
    });
  });
});
