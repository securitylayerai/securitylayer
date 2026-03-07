import { describe, expect, it } from "vitest";
import { createOpenClawAdapter } from "../src/openclaw";
import type { SessionInfo } from "../src/types";

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

describe("createOpenClawAdapter", () => {
  const adapter = createOpenClawAdapter();

  describe("parseInboundFrame", () => {
    it("parses req:send as message event", () => {
      const frame = toBuffer({
        type: "req:send",
        sessionId: "main",
        data: { message: "hello", sender: "user1", channel: "whatsapp" },
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("message");
      expect(event.sessionId).toBe("main");
      expect(event.sender).toBe("user1");
      expect(event.channel).toBe("whatsapp");
    });

    it("parses req:agent as agent_instruction", () => {
      const frame = toBuffer({
        type: "req:agent",
        sessionId: "main",
        data: { instruction: "do something" },
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("agent_instruction");
    });

    it("parses event:chat as chat event", () => {
      const frame = toBuffer({
        type: "event:chat",
        sessionId: "group-1",
        data: { sender: "alice", channel: "telegram" },
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("chat");
      expect(event.sender).toBe("alice");
      expect(event.channel).toBe("telegram");
    });

    it("parses event:skills.install as skill_install", () => {
      const frame = toBuffer({
        type: "event:skills.install",
        sessionId: "main",
        data: { skill: "test-skill" },
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("skill_install");
    });

    it("parses req:cron.create as cron_create", () => {
      const frame = toBuffer({
        type: "req:cron.create",
        sessionId: "main",
        data: { schedule: "0 * * * *" },
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("cron_create");
    });

    it("parses req:sessions.patch as config_change", () => {
      const frame = toBuffer({
        type: "req:sessions.patch",
        sessionId: "main",
        data: { model: "claude-3-opus" },
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("config_change");
    });

    it("defaults unknown frame types to message", () => {
      const frame = toBuffer({
        type: "some:unknown",
        sessionId: "main",
        data: {},
      });
      const event = adapter.parseInboundFrame(frame);
      expect(event.type).toBe("message");
    });

    it("defaults missing sessionId to unknown", () => {
      const frame = toBuffer({ type: "req:send", data: {} });
      const event = adapter.parseInboundFrame(frame);
      expect(event.sessionId).toBe("unknown");
    });
  });

  describe("parseOutboundFrame", () => {
    it("extracts tool_use blocks from res:agent", () => {
      const frame = toBuffer({
        type: "res:agent",
        data: {
          content: [
            {
              type: "tool_use",
              id: "tc_1",
              name: "exec",
              input: { command: "ls -la" },
            },
          ],
        },
      });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions).toHaveLength(1);
      expect(actions[0].tool).toBe("exec");
      expect(actions[0].params).toEqual({ command: "ls -la" });
      expect(actions[0].requiredCapability).toBe("exec");
    });

    it("maps tool names to capabilities", () => {
      const frame = toBuffer({
        type: "res:agent",
        data: {
          content: [
            { type: "tool_use", id: "1", name: "write", input: { path: "/tmp/x" } },
            { type: "tool_use", id: "2", name: "web_fetch", input: { url: "https://example.com" } },
            { type: "tool_use", id: "3", name: "node.invoke", input: {} },
          ],
        },
      });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions[0].requiredCapability).toBe("file.write");
      expect(actions[1].requiredCapability).toBe("web_fetch");
      expect(actions[2].requiredCapability).toBe("node.invoke");
    });

    it("parses req:send as channel.send action", () => {
      const frame = toBuffer({
        type: "req:send",
        data: { message: "hello", channel: "whatsapp" },
      });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions).toHaveLength(1);
      expect(actions[0].requiredCapability).toBe("channel.send");
    });

    it("returns empty array for non-action frames", () => {
      const frame = toBuffer({ type: "event:chat", data: {} });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions).toHaveLength(0);
    });

    it("handles res:agent with no content", () => {
      const frame = toBuffer({ type: "res:agent", data: {} });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions).toHaveLength(0);
    });

    it("handles multiple tool calls in one frame", () => {
      const frame = toBuffer({
        type: "res:agent",
        data: {
          content: [
            { type: "tool_use", id: "1", name: "exec", input: { command: "ls" } },
            { type: "text", text: "some text" },
            { type: "tool_use", id: "2", name: "read", input: { path: "/tmp" } },
          ],
        },
      });
      const actions = adapter.parseOutboundFrame(frame);
      expect(actions).toHaveLength(2);
      expect(actions[0].tool).toBe("exec");
      expect(actions[1].tool).toBe("read");
    });
  });

  describe("injectDenyResponse", () => {
    it("creates a valid deny response buffer", () => {
      const buf = adapter.injectDenyResponse(
        { tool: "exec", params: { id: "tc_1", command: "rm -rf /" } },
        "Destructive command blocked",
      );
      const parsed = JSON.parse(buf.toString());
      expect(parsed.type).toBe("res:agent");
      expect(parsed.data.content[0].is_error).toBe(true);
      expect(parsed.data.content[0].content).toContain("Destructive command blocked");
      expect(parsed.data.content[0].tool_use_id).toBe("tc_1");
    });

    it("uses 'denied' as fallback tool_use_id", () => {
      const buf = adapter.injectDenyResponse({ tool: "exec", params: {} }, "blocked");
      const parsed = JSON.parse(buf.toString());
      expect(parsed.data.content[0].tool_use_id).toBe("denied");
    });
  });

  describe("getSessionMetadata", () => {
    it("returns default for unknown sessions", () => {
      const info = adapter.getSessionMetadata("nonexistent");
      expect(info.id).toBe("nonexistent");
      expect(info.owner).toBe(false);
      expect(info.channel).toBeNull();
      expect(info.activeSkill).toBeNull();
    });

    it("returns configured session metadata", () => {
      const sessions = new Map<string, SessionInfo>();
      sessions.set("main", {
        id: "main",
        channel: "terminal",
        activeSkill: null,
        owner: true,
      });

      const configured = createOpenClawAdapter({ sessions });
      const info = configured.getSessionMetadata("main");
      expect(info.owner).toBe(true);
      expect(info.channel).toBe("terminal");
    });
  });

  describe("extractToolCalls", () => {
    it("extracts tool calls from res:agent", () => {
      const frame = toBuffer({
        type: "res:agent",
        data: {
          content: [
            { type: "tool_use", id: "tc_1", name: "exec", input: { command: "ls" } },
            { type: "tool_use", id: "tc_2", name: "read", input: { path: "/tmp" } },
          ],
        },
      });
      const calls = adapter.extractToolCalls(frame);
      expect(calls).toHaveLength(2);
      expect(calls[0].id).toBe("tc_1");
      expect(calls[0].name).toBe("exec");
      expect(calls[1].id).toBe("tc_2");
    });

    it("returns empty for non-agent frames", () => {
      const frame = toBuffer({ type: "event:chat", data: {} });
      expect(adapter.extractToolCalls(frame)).toHaveLength(0);
    });
  });

  describe("wrapReplayAction", () => {
    it("wraps action for re-injection", () => {
      const buf = adapter.wrapReplayAction({
        tool: "exec",
        params: { command: "git status" },
      });
      const parsed = JSON.parse(buf.toString());
      expect(parsed.type).toBe("req:agent");
      expect(parsed.data.tool).toBe("exec");
      expect(parsed.data.params.command).toBe("git status");
      expect(parsed.data.replay).toBe(true);
    });
  });
});
