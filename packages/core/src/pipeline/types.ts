import type { CapabilityStore } from "../capabilities/gate";
import type { CapabilityResult } from "../capabilities/types";
import type { LearnedRulesConfig } from "../config/types";
import type { EgressScanResult } from "../egress/types";
import type { EventBus } from "../events/bus";
import type { Rule, RuleResult } from "../rules/types";
import type { LLMJudge } from "../semantic/judge";
import type { RiskScore } from "../semantic/risk-score";
import type { LLMClassification } from "../semantic/types";
import type { SessionTaintTracker } from "../taint/tracker";

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
  extraRules?: Rule[];
  sessionHistory?: string[];
  learnedRules?: LearnedRulesConfig;
  eventBus?: EventBus;
}
