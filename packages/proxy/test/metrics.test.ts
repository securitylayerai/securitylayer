import { describe, expect, it } from "vitest";
import { createMetricsCollector } from "../src/metrics";

describe("createMetricsCollector", () => {
  it("starts with empty metrics", () => {
    const metrics = createMetricsCollector();
    const output = metrics.toPrometheus();

    expect(output).toContain("securitylayer_actions_total");
    expect(output).toContain("securitylayer_proxy_latency_seconds");
    expect(output).toContain("securitylayer_proxy_latency_seconds_count 0");
  });

  describe("recordAction", () => {
    it("tracks action counts by decision and layer", () => {
      const metrics = createMetricsCollector();

      metrics.recordAction("ALLOW", "rules", 10);
      metrics.recordAction("ALLOW", "rules", 20);
      metrics.recordAction("DENY", "rules", 5);

      const output = metrics.toPrometheus();

      expect(output).toContain('securitylayer_actions_total{decision="ALLOW",layer="rules"} 2');
      expect(output).toContain('securitylayer_actions_total{decision="DENY",layer="rules"} 1');
    });

    it("tracks latency in seconds", () => {
      const metrics = createMetricsCollector();

      metrics.recordAction("ALLOW", "rules", 100); // 100ms = 0.1s
      metrics.recordAction("ALLOW", "rules", 200); // 200ms = 0.2s

      const output = metrics.toPrometheus();

      expect(output).toContain("securitylayer_proxy_latency_seconds_count 2");
      expect(output).toContain("securitylayer_proxy_latency_seconds_sum 0.3");
    });

    it("computes latency percentiles", () => {
      const metrics = createMetricsCollector();

      // Insert 100 values from 10ms to 1000ms
      for (let i = 1; i <= 100; i++) {
        metrics.recordAction("ALLOW", "rules", i * 10);
      }

      const output = metrics.toPrometheus();

      // p50 should be around 0.5s (500ms)
      expect(output).toMatch(/securitylayer_proxy_latency_seconds\{quantile="0.5"\} 0\.5/);
      // p95 should be around 0.95s (950ms)
      expect(output).toMatch(/securitylayer_proxy_latency_seconds\{quantile="0.95"\} 0\.95/);
      // p99 should be around 0.99s (990ms)
      expect(output).toMatch(/securitylayer_proxy_latency_seconds\{quantile="0.99"\} 0\.99/);
    });
  });

  describe("recordTaintElevation", () => {
    it("tracks taint level changes", () => {
      const metrics = createMetricsCollector();

      metrics.recordTaintElevation("owner", "trusted");
      metrics.recordTaintElevation("owner", "trusted");
      metrics.recordTaintElevation("trusted", "untrusted");

      const output = metrics.toPrometheus();

      expect(output).toContain('securitylayer_taint_elevations_total{from="owner",to="trusted"} 2');
      expect(output).toContain(
        'securitylayer_taint_elevations_total{from="trusted",to="untrusted"} 1',
      );
    });
  });

  describe("recordRuleTrigger", () => {
    it("tracks rule trigger counts", () => {
      const metrics = createMetricsCollector();

      metrics.recordRuleTrigger("dangerous-rm-rf");
      metrics.recordRuleTrigger("dangerous-rm-rf");
      metrics.recordRuleTrigger("cred-env-access");

      const output = metrics.toPrometheus();

      expect(output).toContain('securitylayer_rules_triggered_total{rule="dangerous-rm-rf"} 2');
      expect(output).toContain('securitylayer_rules_triggered_total{rule="cred-env-access"} 1');
    });
  });

  describe("recordApproval", () => {
    it("tracks approval outcomes", () => {
      const metrics = createMetricsCollector();

      metrics.recordApproval("approved");
      metrics.recordApproval("approved");
      metrics.recordApproval("denied");
      metrics.recordApproval("timeout");

      const output = metrics.toPrometheus();

      expect(output).toContain('securitylayer_approvals_total{outcome="approved"} 2');
      expect(output).toContain('securitylayer_approvals_total{outcome="denied"} 1');
      expect(output).toContain('securitylayer_approvals_total{outcome="timeout"} 1');
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      const metrics = createMetricsCollector();

      metrics.recordAction("ALLOW", "rules", 100);
      metrics.recordTaintElevation("owner", "trusted");
      metrics.recordRuleTrigger("test-rule");
      metrics.recordApproval("approved");

      metrics.reset();

      const output = metrics.toPrometheus();

      // Should have no action counts
      expect(output).not.toContain('decision="ALLOW"');
      // Should have zero latency
      expect(output).toContain("securitylayer_proxy_latency_seconds_count 0");
      expect(output).toContain("securitylayer_proxy_latency_seconds_sum 0");
      // Should have no taint elevations
      expect(output).not.toContain('from="owner"');
      // Should have no rule triggers
      expect(output).not.toContain('rule="test-rule"');
      // Should have no approvals
      expect(output).not.toContain('outcome="approved"');
    });
  });

  describe("toPrometheus", () => {
    it("includes HELP and TYPE annotations", () => {
      const metrics = createMetricsCollector();
      const output = metrics.toPrometheus();

      expect(output).toContain("# HELP securitylayer_actions_total");
      expect(output).toContain("# TYPE securitylayer_actions_total counter");
      expect(output).toContain("# HELP securitylayer_proxy_latency_seconds");
      expect(output).toContain("# TYPE securitylayer_proxy_latency_seconds summary");
      expect(output).toContain("# HELP securitylayer_taint_elevations_total");
      expect(output).toContain("# TYPE securitylayer_taint_elevations_total counter");
      expect(output).toContain("# HELP securitylayer_rules_triggered_total");
      expect(output).toContain("# TYPE securitylayer_rules_triggered_total counter");
      expect(output).toContain("# HELP securitylayer_approvals_total");
      expect(output).toContain("# TYPE securitylayer_approvals_total counter");
    });

    it("ends with a newline", () => {
      const metrics = createMetricsCollector();
      const output = metrics.toPrometheus();
      expect(output.endsWith("\n")).toBe(true);
    });

    it("handles zero latency gracefully", () => {
      const metrics = createMetricsCollector();
      const output = metrics.toPrometheus();

      expect(output).toContain('securitylayer_proxy_latency_seconds{quantile="0.5"} 0');
      expect(output).toContain('securitylayer_proxy_latency_seconds{quantile="0.95"} 0');
      expect(output).toContain('securitylayer_proxy_latency_seconds{quantile="0.99"} 0');
    });
  });
});
