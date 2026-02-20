import { describe, expect, it } from "vitest";
import { BehavioralTracker } from "../../src/semantic/baseline";
import { JUDGE_SYSTEM_PROMPT, NoOpJudge } from "../../src/semantic/judge";
import { calculateRiskScore, TOOL_SEVERITIES } from "../../src/semantic/risk-score";

describe("NoOpJudge", () => {
  it("returns NORMAL with high confidence", async () => {
    const judge = new NoOpJudge();
    const result = await judge.classify({
      action: "exec",
      sessionHistory: [],
      taint: "owner",
    });
    expect(result.decision).toBe("NORMAL");
    expect(result.confidence).toBe(1.0);
  });
});

describe("JUDGE_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof JUDGE_SYSTEM_PROMPT).toBe("string");
    expect(JUDGE_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});

describe("calculateRiskScore", () => {
  it("exec tool gets high tool severity", () => {
    const result = calculateRiskScore("exec");
    expect(result.weights.tool).toBe(TOOL_SEVERITIES.exec);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it("web_fetch gets lower tool severity", () => {
    const result = calculateRiskScore("web_fetch");
    expect(result.weights.tool).toBe(TOOL_SEVERITIES.web_fetch);
    expect(result.score).toBeLessThan(calculateRiskScore("exec").score);
  });

  it("tainted session increases score", () => {
    const clean = calculateRiskScore("exec", "owner");
    const tainted = calculateRiskScore("exec", "web");
    expect(tainted.score).toBeGreaterThan(clean.score);
  });

  it("returns score between 0 and 1", () => {
    const result = calculateRiskScore("exec", "memory");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

describe("BehavioralTracker", () => {
  it("records actions", () => {
    const tracker = new BehavioralTracker();
    tracker.recordAction("exec");
    tracker.recordAction("file.read");
    tracker.endSession();
    const baseline = tracker.getBaseline();
    expect(baseline.toolFrequency.exec).toBe(1);
    expect(baseline.toolFrequency["file.read"]).toBe(1);
    expect(baseline.avgActionsPerSession).toBe(2);
  });

  it("detects anomalous spike", () => {
    const tracker = new BehavioralTracker();
    // Normal usage
    tracker.recordAction("exec");
    tracker.recordAction("file.read");
    tracker.recordAction("web_fetch");
    // Spike exec usage
    for (let i = 0; i < 20; i++) {
      tracker.recordAction("exec");
    }
    expect(tracker.isAnomalous("exec")).toBe(true);
    expect(tracker.isAnomalous("web_fetch")).toBe(false);
  });

  it("tracks paths and domains", () => {
    const tracker = new BehavioralTracker();
    tracker.recordAction("exec", ["/tmp/foo"], ["example.com"]);
    tracker.endSession();
    const baseline = tracker.getBaseline();
    expect(baseline.commonPaths).toContain("/tmp/foo");
    expect(baseline.frequentDomains).toContain("example.com");
  });
});
