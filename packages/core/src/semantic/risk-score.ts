import { TAINT_SEVERITY, type TaintLevel } from "../taint/index";
import type { BehavioralBaseline } from "./types";

export interface RiskScore {
  score: number;
  weights: {
    tool: number;
    data: number;
    blast: number;
    session: number;
    taint: number;
  };
}

/** Severity map for common tools (0.0 to 1.0). */
export const TOOL_SEVERITIES: Record<string, number> = {
  exec: 0.9,
  "exec.elevated": 1.0,
  bash: 0.9,
  shell: 0.9,
  "file.write": 0.6,
  "file.read": 0.2,
  write: 0.6,
  read: 0.2,
  edit: 0.5,
  web_fetch: 0.3,
  browser: 0.4,
  "browser.login": 0.7,
  "channel.send": 0.4,
  "channel.send.external": 0.6,
  "skill.install": 0.8,
  "cron.create": 0.7,
  "memory.write": 0.5,
  "memory.read.all_zones": 0.4,
  "node.invoke": 0.6,
};

/** Weight distribution for risk score components. */
const WEIGHTS = {
  tool: 0.3,
  data: 0.25,
  blast: 0.2,
  session: 0.15,
  taint: 0.1,
};

/**
 * Calculates a composite risk score (0.0–1.0) for an action.
 */
export function calculateRiskScore(
  action: string,
  taint?: TaintLevel,
  _baseline?: BehavioralBaseline,
): RiskScore {
  const toolSeverity = TOOL_SEVERITIES[action] ?? 0.5;
  const taintScore = taint ? TAINT_SEVERITY[taint] / 5 : 0; // Normalize to 0-1

  // Data sensitivity — simple heuristic based on tool type
  const dataSensitivity = ["file.read", "memory.read.all_zones", "read"].includes(action)
    ? 0.3
    : ["file.write", "write", "edit", "memory.write"].includes(action)
      ? 0.5
      : 0.1;

  // Blast radius — higher for system-wide tools
  const blastRadius = ["exec", "exec.elevated", "bash", "shell", "skill.install"].includes(action)
    ? 0.7
    : 0.2;

  // Session risk — placeholder (baseline integration in v1)
  const sessionRisk = 0.1;

  const weights = {
    tool: toolSeverity,
    data: dataSensitivity,
    blast: blastRadius,
    session: sessionRisk,
    taint: taintScore,
  };

  const score =
    weights.tool * WEIGHTS.tool +
    weights.data * WEIGHTS.data +
    weights.blast * WEIGHTS.blast +
    weights.session * WEIGHTS.session +
    weights.taint * WEIGHTS.taint;

  return { score, weights };
}
