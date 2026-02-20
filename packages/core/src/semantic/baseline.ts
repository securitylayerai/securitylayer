import type { BehavioralBaseline } from "./types.js";

/**
 * In-memory behavioral tracker. Records actions and computes baselines.
 * v0: simple in-memory tracking. v1 adds persistence and ML.
 */
export class BehavioralTracker {
  private toolCounts = new Map<string, number>();
  private paths = new Set<string>();
  private domains = new Set<string>();
  private hours = new Map<number, number>();
  private sessionActionCounts: number[] = [];
  private currentSessionActions = 0;

  /** Record an action for baseline tracking. */
  recordAction(tool: string, actionPaths?: string[], actionDomains?: string[]): void {
    this.toolCounts.set(tool, (this.toolCounts.get(tool) ?? 0) + 1);
    this.currentSessionActions++;

    if (actionPaths) {
      for (const p of actionPaths) this.paths.add(p);
    }
    if (actionDomains) {
      for (const d of actionDomains) this.domains.add(d);
    }

    const hour = new Date().getHours();
    this.hours.set(hour, (this.hours.get(hour) ?? 0) + 1);
  }

  /** End the current session and start tracking a new one. */
  endSession(): void {
    this.sessionActionCounts.push(this.currentSessionActions);
    this.currentSessionActions = 0;
  }

  /** Get the computed behavioral baseline. */
  getBaseline(): BehavioralBaseline {
    const toolFrequency: Record<string, number> = {};
    for (const [tool, count] of this.toolCounts) {
      toolFrequency[tool] = count;
    }

    const totalSessions = this.sessionActionCounts.length;
    const totalActions = this.sessionActionCounts.reduce((a, b) => a + b, 0);

    return {
      toolFrequency,
      commonPaths: [...this.paths],
      frequentDomains: [...this.domains],
      activeHours: [...this.hours.keys()].sort((a, b) => a - b),
      avgActionsPerSession: totalSessions > 0 ? totalActions / totalSessions : 0,
    };
  }

  /**
   * Simple anomaly detection: checks if the action count for a tool
   * is significantly above the baseline average.
   */
  isAnomalous(tool: string): boolean {
    const count = this.toolCounts.get(tool) ?? 0;
    const total = [...this.toolCounts.values()].reduce((a, b) => a + b, 0);
    const uniqueTools = this.toolCounts.size;

    if (uniqueTools === 0 || total === 0) return false;

    const avgPerTool = total / uniqueTools;
    // Flag if usage is >2x the average
    return count > avgPerTool * 2;
  }
}
