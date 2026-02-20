import { describe, expect, it } from "vitest";
import { normalizeExecAction } from "../../src/normalize/normalizer";
import { BehavioralTracker } from "../../src/semantic/baseline";
import { DefaultLLMJudge, JUDGE_SYSTEM_PROMPT, NoOpJudge } from "../../src/semantic/judge";
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

  // M1: verify updated severity values
  it("node.invoke has severity 1.0", () => {
    expect(TOOL_SEVERITIES["node.invoke"]).toBe(1.0);
  });

  it("file.read has severity 0.3", () => {
    expect(TOOL_SEVERITIES["file.read"]).toBe(0.3);
  });

  it("channel.send has severity 0.2", () => {
    expect(TOOL_SEVERITIES["channel.send"]).toBe(0.2);
  });

  it("web_fetch has severity 0.2", () => {
    expect(TOOL_SEVERITIES["web_fetch"]).toBe(0.2);
  });

  it("browser.login has severity 0.8", () => {
    expect(TOOL_SEVERITIES["browser.login"]).toBe(0.8);
  });

  it("cron.create has severity 0.8", () => {
    expect(TOOL_SEVERITIES["cron.create"]).toBe(0.8);
  });

  it("channel.send.external has severity 0.5", () => {
    expect(TOOL_SEVERITIES["channel.send.external"]).toBe(0.5);
  });

  // 1.1-#4b: obfuscation bonus when decodedCommand !== raw
  it("obfuscation bonus increases score when decoded differs from raw", () => {
    const normalized = normalizeExecAction("%2Fetc%2Fpasswd");
    const withObfuscation = calculateRiskScore("exec", "owner", undefined, normalized);
    const withoutObfuscation = calculateRiskScore("exec", "owner");
    expect(withObfuscation.score).toBeGreaterThan(withoutObfuscation.score);
  });

  it("no obfuscation bonus when decoded equals raw", () => {
    const normalized = normalizeExecAction("git status");
    const withNormalized = calculateRiskScore("exec", "owner", undefined, normalized);
    const withoutNormalized = calculateRiskScore("exec", "owner");
    expect(withNormalized.score).toBe(withoutNormalized.score);
  });
});

// 1.1-#4: DefaultLLMJudge taint-based fallback
describe("DefaultLLMJudge", () => {
  it("falls back to taint heuristic when no API key", async () => {
    const judge = new DefaultLLMJudge(); // no API key
    const result = await judge.classify({
      action: "exec",
      sessionHistory: [],
      taint: "owner",
    });
    expect(result.decision).toBe("NORMAL");
    expect(result.confidence).toBe(0.8);
  });

  it("flags elevated taint as ANOMALOUS when no API key", async () => {
    const judge = new DefaultLLMJudge();
    const result = await judge.classify({
      action: "exec",
      sessionHistory: [],
      taint: "web",
    });
    expect(result.decision).toBe("ANOMALOUS");
    expect(result.confidence).toBe(0.5);
  });

  it("treats 'trusted' taint as low severity (NORMAL)", async () => {
    const judge = new DefaultLLMJudge();
    const result = await judge.classify({
      action: "exec",
      sessionHistory: [],
      taint: "trusted",
    });
    expect(result.decision).toBe("NORMAL");
  });

  it("treats 'skill' taint as elevated (ANOMALOUS)", async () => {
    const judge = new DefaultLLMJudge();
    const result = await judge.classify({
      action: "exec",
      sessionHistory: [],
      taint: "skill",
    });
    expect(result.decision).toBe("ANOMALOUS");
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
