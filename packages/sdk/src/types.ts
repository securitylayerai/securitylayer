// Re-export core types so SDK users don't need @securitylayerai/core
export type {
  EgressFinding,
  EgressScanResult,
  EventBus,
  LayerResults,
  LoadedConfig,
  PipelineDecision,
  SecurityEvent,
  SecurityEventMap,
  SecurityEventType,
  TaintLevel,
} from "@securitylayerai/core";

// ---------------------------------------------------------------------------
// SDK-specific types
// ---------------------------------------------------------------------------

export interface SecurityLayerOptions {
  /** Directory containing .securitylayer config files */
  configDir?: string;
  /** Caller identifier (e.g. "claude-code", "cursor") */
  caller?: string;
  /** Session ID — auto-generated if not provided */
  sessionId?: string;
  /** Pre-loaded config for dependency injection (skips file loading) */
  config?: import("@securitylayerai/core").LoadedConfig;
  /** Pre-created event bus for dependency injection */
  eventBus?: import("@securitylayerai/core").EventBus;
}

export interface ExecutionContext {
  sessionId?: string;
  skillId?: string;
  channelId?: string;
}

export interface ContentMetadata {
  source: "web" | "file" | "channel" | "skill" | "memory";
  path?: string;
  url?: string;
}

export interface CheckResult {
  decision: import("@securitylayerai/core").PipelineDecision;
  reason: string;
  approvalId?: string;
  layers: import("@securitylayerai/core").LayerResults;
  degraded: boolean;
  timing: {
    total: number;
    capability?: number;
    rules?: number;
    llm?: number;
  };
}

export interface ApprovalOptions {
  timeout?: number;
}

export interface SecurityLayer {
  check(
    tool: string,
    params: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<CheckResult>;

  waitForApproval(approvalId: string, options?: ApprovalOptions): Promise<boolean>;

  ingestContent(content: string, metadata: ContentMetadata): void;

  scanEgress(content: string): import("@securitylayerai/core").EgressScanResult;

  getSessionTaint(): import("@securitylayerai/core").TaintLevel;

  on<K extends import("@securitylayerai/core").SecurityEventType>(
    type: K,
    handler: (event: import("@securitylayerai/core").SecurityEventMap[K]) => void,
  ): () => void;

  destroy(): void;
}
