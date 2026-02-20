import type { TaintLevel } from "../taint/index.js";

export interface LLMClassification {
  decision: "NORMAL" | "ANOMALOUS" | "DANGEROUS";
  confidence: number;
  reasoning: string;
}

export interface BehavioralBaseline {
  toolFrequency: Record<string, number>;
  commonPaths: string[];
  frequentDomains: string[];
  activeHours: number[];
  avgActionsPerSession: number;
}

export interface JudgeContext {
  action: string;
  sessionHistory: string[];
  taint: TaintLevel;
  baseline?: BehavioralBaseline;
}
