import type { AgentAdapter } from "./interface";
import {
  type Action,
  FrameParseError,
  type InboundEvent,
  type OutboundAction,
  type SessionInfo,
  type ToolCall,
} from "./types";

interface GenericFrame {
  type: string;
  sessionId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  message?: string;
  sender?: string;
  channel?: string;
  data?: Record<string, unknown>;
}

const TOOL_TO_CAPABILITY: Record<string, string> = {
  exec: "exec",
  bash: "exec",
  shell: "exec",
  read: "file.read",
  write: "file.write",
  edit: "file.write",
  web_fetch: "web_fetch",
  browser: "browser",
  "channel.send": "channel.send",
};

function parseFrame(raw: Buffer): GenericFrame {
  const text = raw.toString("utf-8");
  try {
    return JSON.parse(text) as GenericFrame;
  } catch {
    throw new FrameParseError("Failed to parse generic frame: invalid JSON", text);
  }
}

function toolToCapability(tool: string): string {
  return TOOL_TO_CAPABILITY[tool] ?? tool;
}

export interface GenericAdapterConfig {
  sessions?: Map<string, SessionInfo>;
  toolCapabilityMap?: Record<string, string>;
}

export function createGenericAdapter(config?: GenericAdapterConfig): AgentAdapter {
  const sessions = config?.sessions ?? new Map<string, SessionInfo>();
  const capMap = config?.toolCapabilityMap ?? TOOL_TO_CAPABILITY;

  return {
    parseInboundFrame(raw: Buffer): InboundEvent {
      const frame = parseFrame(raw);
      return {
        type: frame.type === "tool_call" ? "agent_instruction" : "message",
        sessionId: frame.sessionId ?? "unknown",
        sender: frame.sender,
        channel: frame.channel,
        data: frame.data ?? frame,
      };
    },

    parseOutboundFrame(raw: Buffer): OutboundAction[] {
      const frame = parseFrame(raw);
      if (!frame.toolCalls || !Array.isArray(frame.toolCalls)) return [];

      return frame.toolCalls.map((tc) => ({
        tool: tc.name,
        params: tc.input,
        requiredCapability: capMap[tc.name] ?? toolToCapability(tc.name),
        toolCallId: tc.id,
      }));
    },

    injectDenyResponse(action: Action, reason: string, _toolCallId?: string): Buffer {
      const response = {
        type: "error",
        error: {
          code: "SECURITY_DENIED",
          tool: action.tool,
          reason,
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
      if (!parsed.toolCalls) return [];

      return parsed.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input,
      }));
    },

    wrapReplayAction(action: Action): Buffer {
      const frame = {
        type: "tool_call",
        toolCalls: [
          {
            id: `replay-${Date.now()}`,
            name: action.tool,
            input: action.params,
          },
        ],
        replay: true,
      };
      return Buffer.from(JSON.stringify(frame));
    },
  };
}
