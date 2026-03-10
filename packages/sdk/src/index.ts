// @securitylayerai/sdk — public API

export { createSecurityLayer } from "./client";
export {
  ApprovalTimeoutError,
  CheckError,
  ConfigError,
  InitializationError,
  SecurityLayerError,
} from "./errors";
export { type MiddlewareOptions, withSecurityLayer } from "./middleware";
export { createSessionState, type SessionState } from "./session";
export type {
  ApprovalOptions,
  CheckResult,
  ContentMetadata,
  EgressFinding,
  EgressScanResult,
  EventBus,
  ExecutionContext,
  LayerResults,
  LoadedConfig,
  PipelineDecision,
  SecurityEvent,
  SecurityEventMap,
  SecurityEventType,
  SecurityLayer,
  SecurityLayerOptions,
  TaintLevel,
} from "./types";
