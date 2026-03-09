export type InboundEventType =
  | "message"
  | "agent_instruction"
  | "config_change"
  | "cron_create"
  | "skill_install"
  | "chat";

export interface InboundEvent {
  type: InboundEventType;
  sessionId: string;
  sender?: string;
  channel?: string;
  data: unknown;
}

export interface OutboundAction {
  tool: string;
  params: Record<string, unknown>;
  requiredCapability: string;
  toolCallId?: string;
}

export class FrameParseError extends Error {
  constructor(
    message: string,
    public readonly rawData: string,
  ) {
    super(message);
    this.name = "FrameParseError";
  }
}

export interface SessionInfo {
  id: string;
  channel: string | null;
  activeSkill: string | null;
  owner: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface Action {
  tool: string;
  params: Record<string, unknown>;
}

export type OpenClawFrameType =
  | "req:send"
  | "req:agent"
  | "req:sessions.patch"
  | "req:cron.create"
  | "event:skills.install"
  | "event:chat"
  | "res:agent";

export interface OpenClawFrame {
  type: OpenClawFrameType | string;
  data?: Record<string, unknown>;
  sessionId?: string;
}
