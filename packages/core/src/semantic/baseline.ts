import type { BehavioralBaseline } from "./types";

/**
 * In-memory behavioral tracker. Records actions and computes baselines.
 * v0: simple in-memory tracking. v1 adds persistence and ML.
 */
export function createBehavioralTracker() {
  const toolCounts = new Map<string, number>();
  const paths = new Set<string>();
  const domains = new Set<string>();
  const hours = new Map<number, number>();
  const sessionActionCounts: number[] = [];
  let currentSessionActions = 0;

  return {
    /** Record an action for baseline tracking. */
    recordAction(tool: string, actionPaths?: string[], actionDomains?: string[]): void {
      toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
      currentSessionActions++;

      if (actionPaths) {
        for (const p of actionPaths) paths.add(p);
      }
      if (actionDomains) {
        for (const d of actionDomains) domains.add(d);
      }

      const hour = new Date().getHours();
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
    },

    /** End the current session and start tracking a new one. */
    endSession(): void {
      sessionActionCounts.push(currentSessionActions);
      currentSessionActions = 0;
    },

    /** Get the computed behavioral baseline. */
    getBaseline(): BehavioralBaseline {
      const toolFrequency: Record<string, number> = {};
      for (const [tool, count] of toolCounts) {
        toolFrequency[tool] = count;
      }

      const totalSessions = sessionActionCounts.length;
      const totalActions = sessionActionCounts.reduce((a, b) => a + b, 0);

      return {
        toolFrequency,
        commonPaths: [...paths],
        frequentDomains: [...domains],
        activeHours: [...hours.keys()].sort((a, b) => a - b),
        avgActionsPerSession: totalSessions > 0 ? totalActions / totalSessions : 0,
      };
    },

    /**
     * Simple anomaly detection: checks if the action count for a tool
     * is significantly above the baseline average.
     */
    isAnomalous(tool: string): boolean {
      const count = toolCounts.get(tool) ?? 0;
      const total = [...toolCounts.values()].reduce((a, b) => a + b, 0);
      const uniqueTools = toolCounts.size;

      if (uniqueTools === 0 || total === 0) return false;

      const avgPerTool = total / uniqueTools;
      // Flag if usage is >2x the average
      return count > avgPerTool * 2;
    },
  };
}

export type BehavioralTracker = ReturnType<typeof createBehavioralTracker>;
