import { beforeEach, describe, expect, it } from "vitest";
import type { CapabilityStore } from "@/capabilities/gate";
import { createCapabilitySet } from "@/capabilities/set";
import { eventBus } from "@/events/bus";
import { evaluateAction } from "@/pipeline/evaluator";
import { mergeDecisions } from "@/pipeline/merger";
import type { PipelineDeps } from "@/pipeline/types";
import { createNoOpJudge } from "@/semantic/judge";
import { createTaintTracker } from "@/taint/tracker";

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
    [
      "s1",
      createCapabilitySet([
        "exec",
        "file.read",
        "file.write",
        "channel.send",
        "node.invoke",
        "cron.create",
      ]),
    ],
  ]);
  const minimumSkillCaps = createCapabilitySet(["channel.send"]);

  const store: CapabilityStore = {
    getSessionCaps: (id) => sessions.get(id),
    getSkillCaps: (_id) => minimumSkillCaps,
    getChannelCaps: () => undefined,
  };

  return {
    capabilityStore: overrides?.capabilityStore ?? store,
    taintTracker: overrides?.taintTracker ?? createTaintTracker(),
    judge: overrides?.judge ?? createNoOpJudge(),
    ...overrides,
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

// T2: Chained command evaluation tests
describe("chained command evaluation", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("ls; rm -rf / → DENY (rm triggers rule)", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "ls; rm -rf /");
    expect(result.decision).toBe("DENY");
  });

  it("echo hello && cat ~/.ssh/id_rsa → DENY (path rule)", async () => {
    const deps = makeDeps();
    const result = await evaluateAction(
      "exec",
      { sessionId: "s1" },
      deps,
      "echo hello && cat ~/.ssh/id_rsa",
    );
    expect(result.decision).toBe("DENY");
  });

  it("echo ok; echo fine → ALLOW (both safe)", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "echo ok; echo fine");
    expect(result.decision).toBe("ALLOW");
  });
});

// T4: Pipeline degraded mode tests
describe("pipeline degraded mode", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("judge throws → degraded=true, risk>0.3 → REQUIRE_APPROVAL", async () => {
    const failingJudge = {
      classify: async () => {
        throw new Error("LLM unavailable");
      },
    };
    const deps = makeDeps({ judge: failingJudge as never });
    // exec has high risk score (0.9 tool severity → score > 0.3)
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "rm something");
    expect(result.degraded).toBe(true);
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });

  it("judge throws → degraded=true, low-risk action → ALLOW", async () => {
    const failingJudge = {
      classify: async () => {
        throw new Error("LLM unavailable");
      },
    };
    // channel.send has 0.2 tool severity → low risk
    const sessions = new Map([["s1", createCapabilitySet(["channel.send"])]]);
    const store: CapabilityStore = {
      getSessionCaps: (id) => sessions.get(id),
      getSkillCaps: () => createCapabilitySet(["channel.send"]),
      getChannelCaps: () => undefined,
    };
    const deps = makeDeps({
      judge: failingJudge as never,
      capabilityStore: store,
    });
    const result = await evaluateAction("channel.send", { sessionId: "s1" }, deps);
    expect(result.degraded).toBe(true);
    expect(result.decision).toBe("ALLOW");
  });
});

// L1: Learned rules check
describe("learned rules in evaluator", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("learned rule match skips LLM and allows action", async () => {
    const deps = makeDeps({
      learnedRules: {
        version: 1,
        rules: [
          {
            pattern: "git status",
            capability: "exec",
            created_at: new Date().toISOString(),
          },
        ],
      },
    });
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "git status");
    expect(result.decision).toBe("ALLOW");
    // Should still have allowed through capability gate
    expect(result.layers.capability.allowed).toBe(true);
  });

  it("learned rule for safe pattern does not affect unrelated dangerous commands", async () => {
    const deps = makeDeps({
      learnedRules: {
        version: 1,
        rules: [
          {
            pattern: "git status",
            capability: "exec",
            created_at: new Date().toISOString(),
          },
        ],
      },
    });
    // "git status" is learned, but "rm -rf /" is not — should still DENY
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "git status; rm -rf /");
    expect(result.decision).toBe("DENY");
  });

  it("non-matching learned rule does not bypass rules engine", async () => {
    const deps = makeDeps({
      learnedRules: {
        version: 1,
        rules: [
          {
            pattern: "npm install",
            capability: "exec",
            created_at: new Date().toISOString(),
          },
        ],
      },
    });
    // Learned rule is for "npm install", not "rm -rf /" — rules engine should catch it
    const result = await evaluateAction("exec", { sessionId: "s1" }, deps, "rm -rf /");
    expect(result.decision).toBe("DENY");
  });
});

// M10: sessionHistory wired into evaluator
describe("sessionHistory wiring", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("passes sessionHistory to LLM judge", async () => {
    let receivedHistory: string[] = [];
    const spyJudge = {
      classify: async (ctx: { sessionHistory: string[] }) => {
        receivedHistory = ctx.sessionHistory;
        return { decision: "NORMAL" as const, confidence: 1.0, reasoning: "ok" };
      },
    };
    const deps = makeDeps({
      judge: spyJudge as never,
      sessionHistory: ["previous action 1", "previous action 2"],
    });
    await evaluateAction("exec", { sessionId: "s1" }, deps, "git log");
    expect(receivedHistory).toEqual(["previous action 1", "previous action 2"]);
  });

  it("defaults to empty sessionHistory when not provided", async () => {
    let receivedHistory: string[] | undefined;
    const spyJudge = {
      classify: async (ctx: { sessionHistory: string[] }) => {
        receivedHistory = ctx.sessionHistory;
        return { decision: "NORMAL" as const, confidence: 1.0, reasoning: "ok" };
      },
    };
    const deps = makeDeps({ judge: spyJudge as never });
    await evaluateAction("exec", { sessionId: "s1" }, deps, "git log");
    expect(receivedHistory).toEqual([]);
  });
});

// T8: node.invoke/cron.create mandatory approval tests
describe("mandatory approval for high-risk actions", () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it("node.invoke with all capabilities → REQUIRE_APPROVAL (not ALLOW)", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("node.invoke", { sessionId: "s1" }, deps);
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });

  it("cron.create with all capabilities → REQUIRE_APPROVAL (not ALLOW)", async () => {
    const deps = makeDeps();
    const result = await evaluateAction("cron.create", { sessionId: "s1" }, deps);
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });
});
