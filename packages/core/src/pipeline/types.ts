import type { CapabilityStore } from "../capabilities/gate.js";
import type { CapabilityResult } from "../capabilities/types.js";
import type { EgressScanResult } from "../egress/types.js";
import type { RuleResult } from "../rules/types.js";
import type { SandboxConfig } from "../sandbox/types.js";
import type { LLMJudge } from "../semantic/judge.js";
import type { RiskScore } from "../semantic/risk-score.js";
import type { LLMClassification } from "../semantic/types.js";
import type { SessionTaintTracker } from "../taint/tracker.js";

export type PipelineDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface LayerResults {
  capability: CapabilityResult;
  taint?: string;
  rules?: RuleResult;
  llm?: LLMClassification;
  egress?: EgressScanResult;
  riskScore?: RiskScore;
}

export interface EvaluationResult {
  decision: PipelineDecision;
  layers: LayerResults;
  degraded: boolean;
  timing: {
    total: number;
    capability?: number;
    rules?: number;
    llm?: number;
    egress?: number;
  };
}

export interface PipelineDeps {
  capabilityStore: CapabilityStore;
  taintTracker: SessionTaintTracker;
  judge: LLMJudge;
  sandboxConfig: SandboxConfig;
}
