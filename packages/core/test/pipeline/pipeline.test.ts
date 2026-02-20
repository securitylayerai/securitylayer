import { beforeEach, describe, expect, it } from "vitest";
import type { CapabilityStore } from "../../src/capabilities/gate.js";
import { CapabilitySet } from "../../src/capabilities/set.js";
import { eventBus } from "../../src/events/bus.js";
import { evaluateAction } from "../../src/pipeline/evaluator.js";
import { mergeDecisions } from "../../src/pipeline/merger.js";
import type { PipelineDeps } from "../../src/pipeline/types.js";
import { createSandboxConfig } from "../../src/sandbox/sandbox.js";
import { NoOpJudge } from "../../src/semantic/judge.js";
import { SessionTaintTracker } from "../../src/taint/tracker.js";

describe("mergeDecisions", () => {
  it("rules DENY always wins", () => {
    const result = mergeDecisions(
      { matched: true, decision: "DENY", reason: "test", rule: undefined as never },
      { decision: "NORMAL", confidence: 1.0, reasoning: "ok" },
      { score: 0.1, weights: { tool: 0, data: 0, blast: 0, session: 0, taint: 0 } },
      false,
    );
    expect(result).toBe("DENY");
  });

  it("LLM DANGEROUS (≥0.8) → DENY", () => {
    const result = mergeDecisions(
      undefined,
      { decision: "DANGEROUS", confidence: 0.9, reasoning: "threat" },
      undefined,
      false,
    );
    expect(result).toBe("DENY");
  });

  it("LLM ANOMALOUS → REQUIRE_APPROVAL", () => {
    const result = mergeDecisions(
      undefined,
      { decision: "ANOMALOUS", confidence: 0.7, reasoning: "unusual" },
      undefined,
      false,
    );
    expect(result).toBe("REQUIRE_APPROVAL");
  });

  it("LLM DANGEROUS (<0.8) → REQUIRE_APPROVAL", () => {
    const result = mergeDecisions(
      undefined,
      { decision: "DANGEROUS", confidence: 0.6, reasoning: "maybe" },
      undefined,
      false,
    );
    expect(result).toBe("REQUIRE_APPROVAL");
  });

  it("degraded + high risk → REQUIRE_APPROVAL", () => {
    const result = mergeDecisions(
      undefined,
      undefined,
      { score: 0.5, weights: { tool: 0.5, data: 0.3, blast: 0.5, session: 0.1, taint: 0.2 } },
      true,
    );
    expect(result).toBe("REQUIRE_APPROVAL");
  });

  it("all layers ALLOW → ALLOW", () => {
    const result = mergeDecisions(
      { matched: false, decision: "ALLOW" },
      { decision: "NORMAL", confidence: 0.9, reasoning: "ok" },
      { score: 0.1, weights: { tool: 0, data: 0, blast: 0, session: 0, taint: 0 } },
      false,
    );
    expect(result).toBe("ALLOW");
  });
});

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  const sessions = new Map([
    ["s1", new CapabilitySet(["exec", "file.read", "file.write", "channel.send"])],
  ]);
  const minimumSkillCaps = new CapabilitySet(["channel.send"]);

  const store: CapabilityStore = {
    getSessionCaps: (id) => sessions.get(id),
    getSkillCaps: (_id) => minimumSkillCaps,
    getChannelCaps: () => undefined,
  };

  return {
    capabilityStore: overrides?.capabilityStore ?? store,
    taintTracker: overrides?.taintTracker ?? new SessionTaintTracker(),
    judge: overrides?.judge ?? new NoOpJudge(),
    sandboxConfig: overrides?.sandboxConfig ?? createSandboxConfig(0),
  };
}

describe("evaluateAction", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("capability denied → immediate DENY", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("browser", { sessionId: "s1" }, deps);
    expect(result.decision).toBe("DENY");
    expect(result.layers.capability.allowed).toBe(false);
  });

  it("full pipeline with mock deps", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "git status");
    expect(result.decision).toBe("ALLOW");
    expect(result.layers.capability.allowed).toBe(true);
  });

  it("degraded mode when judge fails", async () => {
    const failingJudge = {
      classify: async () => {
        throw new Error("API unavailable");
      },
    };
    const deps = makeDeps({ judge: failingJudge as never });
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "git status");
    expect(result.degraded).toBe(true);
  });

  it("timing fields are populated", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps);
    expect(result.timing.total).toBeGreaterThanOrEqual(0);
    expect(result.timing.capability).toBeGreaterThanOrEqual(0);
  });

  it("emits action.evaluated event", async () => {
    const events: unknown[] = [];
    eventBus.on("action.evaluated", (e) => events.push(e));

    const deps = makeDeps();
    await evaluateAction("exec", { sessionId: "s1" }, deps);
    expect(events).toHaveLength(1);
  });
});
