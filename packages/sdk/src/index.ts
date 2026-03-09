// @securitylayerai/sdk — public API

export { createSecurityLayer } from "./client";
export { withSecurityLayer, type MiddlewareOptions } from "./middleware";
export { createSessionState, type SessionState } from "./session";
export {
  SecurityLayerError,
  ConfigError,
  InitializationError,
  CheckError,
  ApprovalTimeoutError,
} from "./errors";
export type {
  SecurityLayerOptions,
  ExecutionContext,
  ContentMetadata,
  CheckResult,
  ApprovalOptions,
  SecurityLayer,
  TaintLevel,
  EgressFinding,
  EgressScanResult,
  PipelineDecision,
  LayerResults,
  SecurityEvent,
  SecurityEventType,
  SecurityEventMap,
  LoadedConfig,
  EventBus,
} from "./types";
