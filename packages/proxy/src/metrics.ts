export interface MetricsCollector {
  /** Record an action evaluation with its decision and latency */
  recordAction(decision: string, layer: string, latencyMs: number): void;
  /** Record a taint elevation */
  recordTaintElevation(from: string, to: string): void;
  /** Record a rule trigger */
  recordRuleTrigger(ruleId: string): void;
  /** Record an approval outcome */
  recordApproval(outcome: string): void;
  /** Get Prometheus-compatible metrics text */
  toPrometheus(): string;
  /** Reset all counters */
  reset(): void;
}

interface LatencyBucket {
  values: number[];
  sum: number;
  count: number;
}

function createLatencyBucket(): LatencyBucket {
  return { values: [], sum: 0, count: 0 };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function createMetricsCollector(): MetricsCollector {
  const actionCounts = new Map<string, number>();
  const latency = createLatencyBucket();
  const taintElevations = new Map<string, number>();
  const rulesTriggers = new Map<string, number>();
  const approvals = new Map<string, number>();

  function incMap(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return {
    recordAction(decision: string, layer: string, latencyMs: number) {
      incMap(actionCounts, `${decision}:${layer}`);
      latency.values.push(latencyMs / 1000); // Convert to seconds
      latency.sum += latencyMs / 1000;
      latency.count++;
    },

    recordTaintElevation(from: string, to: string) {
      incMap(taintElevations, `${from}:${to}`);
    },

    recordRuleTrigger(ruleId: string) {
      incMap(rulesTriggers, ruleId);
    },

    recordApproval(outcome: string) {
      incMap(approvals, outcome);
    },

    toPrometheus(): string {
      const lines: string[] = [];

      // Action counts
      lines.push("# HELP securitylayer_actions_total Total actions by decision and layer");
      lines.push("# TYPE securitylayer_actions_total counter");
      for (const [key, count] of actionCounts) {
        const [decision, layer] = key.split(":");
        lines.push(`securitylayer_actions_total{decision="${decision}",layer="${layer}"} ${count}`);
      }

      // Latency quantiles
      const sorted = [...latency.values].sort((a, b) => a - b);
      lines.push("# HELP securitylayer_proxy_latency_seconds Pipeline latency in seconds");
      lines.push("# TYPE securitylayer_proxy_latency_seconds summary");
      lines.push(`securitylayer_proxy_latency_seconds{quantile="0.5"} ${percentile(sorted, 50)}`);
      lines.push(`securitylayer_proxy_latency_seconds{quantile="0.95"} ${percentile(sorted, 95)}`);
      lines.push(`securitylayer_proxy_latency_seconds{quantile="0.99"} ${percentile(sorted, 99)}`);
      lines.push(`securitylayer_proxy_latency_seconds_sum ${latency.sum}`);
      lines.push(`securitylayer_proxy_latency_seconds_count ${latency.count}`);

      // Taint elevations
      lines.push("# HELP securitylayer_taint_elevations_total Taint level changes");
      lines.push("# TYPE securitylayer_taint_elevations_total counter");
      for (const [key, count] of taintElevations) {
        const [from, to] = key.split(":");
        lines.push(`securitylayer_taint_elevations_total{from="${from}",to="${to}"} ${count}`);
      }

      // Rule triggers
      lines.push("# HELP securitylayer_rules_triggered_total Rule trigger counts");
      lines.push("# TYPE securitylayer_rules_triggered_total counter");
      for (const [ruleId, count] of rulesTriggers) {
        lines.push(`securitylayer_rules_triggered_total{rule="${ruleId}"} ${count}`);
      }

      // Approvals
      lines.push("# HELP securitylayer_approvals_total Approval outcomes");
      lines.push("# TYPE securitylayer_approvals_total counter");
      for (const [outcome, count] of approvals) {
        lines.push(`securitylayer_approvals_total{outcome="${outcome}"} ${count}`);
      }

      return `${lines.join("\n")}\n`;
    },

    reset() {
      actionCounts.clear();
      latency.values.length = 0;
      latency.sum = 0;
      latency.count = 0;
      taintElevations.clear();
      rulesTriggers.clear();
      approvals.clear();
    },
  };
}
