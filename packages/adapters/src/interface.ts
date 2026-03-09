import type { Action, InboundEvent, OutboundAction, SessionInfo, ToolCall } from "./types";

/**
 * Every agent framework adapter must implement this interface.
 * The proxy and SDK use it to communicate with the agent without
 * knowing the specifics of the agent's protocol.
 */
export interface AgentAdapter {
  /** Parse an inbound frame (client -> agent) into a typed event */
  parseInboundFrame(raw: Buffer): InboundEvent;

  /** Parse an outbound frame (agent -> world) into typed actions */
  parseOutboundFrame(raw: Buffer): OutboundAction[];

  /** Create a deny response frame that the agent understands */
  injectDenyResponse(action: Action, reason: string, toolCallId?: string): Buffer;

  /** Get metadata about a session (channel, trust level, active skill) */
  getSessionMetadata(sessionId: string): SessionInfo;

  /** Get the list of tool calls from an agent response */
  extractToolCalls(frame: Buffer): ToolCall[];

  /** Wrap an approved action for re-injection (action replay after approval) */
  wrapReplayAction(action: Action): Buffer;
}
