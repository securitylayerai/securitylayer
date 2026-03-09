import type { AgentAdapter } from "./interface";
import {
  type Action,
  FrameParseError,
  type InboundEvent,
  type InboundEventType,
  type OpenClawFrame,
  type OutboundAction,
  type SessionInfo,
  type ToolCall,
} from "./types";

const TOOL_TO_CAPABILITY: Record<string, string> = {
  exec: "exec",
  bash: "exec",
  shell: "exec",
  "exec.elevated": "exec.elevated",
  read: "file.read",
  "file.read": "file.read",
  write: "file.write",
  edit: "file.write",
  "file.write": "file.write",
  browser: "browser",
  "browser.login": "browser.login",
  web_fetch: "web_fetch",
  "channel.send": "channel.send",
  "channel.send.external": "channel.send.external",
  "cron.create": "cron.create",
  "skill.install": "skill.install",
  "memory.read.all_zones": "memory.read.all_zones",
  "memory.read.trusted": "memory.read.trusted",
  "memory.write": "memory.write",
  "node.invoke": "node.invoke",
};

const FRAME_TYPE_TO_EVENT: Record<string, InboundEventType> = {
  "req:send": "message",
  "req:agent": "agent_instruction",
  "req:sessions.patch": "config_change",
  "req:cron.create": "cron_create",
  "event:skills.install": "skill_install",
  "event:chat": "chat",
};

function parseFrame(raw: Buffer): OpenClawFrame {
  const text = raw.toString("utf-8");
  try {
    return JSON.parse(text) as OpenClawFrame;
  } catch {
    throw new FrameParseError("Failed to parse OpenClaw frame: invalid JSON", text);
  }
}

function toolToCapability(tool: string): string {
  // Handle namespaced tools like "browser.navigate" -> "browser"
  const cap = TOOL_TO_CAPABILITY[tool];
  if (cap) return cap;

  // Check prefix (e.g., "node.something" -> "node.invoke")
  if (tool.startsWith("node.")) return "node.invoke";
  if (tool.startsWith("browser.")) return "browser";

  return tool;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function extractToolUseBlocks(content: unknown): ToolUseBlock[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (block): block is ToolUseBlock =>
      typeof block === "object" && block !== null && block.type === "tool_use",
  );
}

export interface OpenClawAdapterConfig {
  sessions?: Map<string, SessionInfo>;
}

export function createOpenClawAdapter(config?: OpenClawAdapterConfig): AgentAdapter {
  const sessions = config?.sessions ?? new Map<string, SessionInfo>();

  return {
    parseInboundFrame(raw: Buffer): InboundEvent {
      const frame = parseFrame(raw);
      const eventType = FRAME_TYPE_TO_EVENT[frame.type];

      if (!eventType) {
        return {
          type: "message",
          sessionId: frame.sessionId ?? "unknown",
          data: frame.data,
        };
      }

      return {
        type: eventType,
        sessionId: frame.sessionId ?? "unknown",
        sender: frame.data?.sender as string | undefined,
        channel: frame.data?.channel as string | undefined,
        data: frame.data,
      };
    },

    parseOutboundFrame(raw: Buffer): OutboundAction[] {
      const frame = parseFrame(raw);

      if (frame.type === "res:agent" && frame.data?.content) {
        const toolCalls = extractToolUseBlocks(frame.data.content);
        return toolCalls.map((tc) => ({
          tool: tc.name,
          params: tc.input,
          requiredCapability: toolToCapability(tc.name),
          toolCallId: tc.id,
        }));
      }

      // Outbound message (agent sending to a channel)
      if (frame.type === "req:send") {
        return [
          {
            tool: "channel.send",
            params: { message: frame.data?.message, channel: frame.data?.channel },
            requiredCapability: "channel.send",
          },
        ];
      }

      return [];
    },

    injectDenyResponse(action: Action, reason: string, toolCallId?: string): Buffer {
      const response = {
        type: "res:agent",
        data: {
          content: [
            {
              type: "tool_result",
              tool_use_id: toolCallId ?? "denied",
              content: `[SecurityLayer] Action denied: ${reason}`,
              is_error: true,
            },
          ],
        },
      };
      return Buffer.from(JSON.stringify(response));
    },

    getSessionMetadata(sessionId: string): SessionInfo {
      return (
        sessions.get(sessionId) ?? {
          id: sessionId,
          channel: null,
          activeSkill: null,
          owner: false,
        }
      );
    },

    extractToolCalls(frame: Buffer): ToolCall[] {
      const parsed = parseFrame(frame);
      if (parsed.type !== "res:agent" || !parsed.data?.content) return [];

      return extractToolUseBlocks(parsed.data.content).map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input,
      }));
    },

    wrapReplayAction(action: Action): Buffer {
      const frame = {
        type: "req:agent",
        data: {
          tool: action.tool,
          params: action.params,
          replay: true,
        },
      };
      return Buffer.from(JSON.stringify(frame));
    },
  };
}
