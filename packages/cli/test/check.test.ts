import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { mockLoadConfig, mockCreatePipeline, mockEvaluateAction } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockCreatePipeline: vi.fn(),
  mockEvaluateAction: vi.fn(),
}));

vi.mock("@securitylayer/core", () => ({
  loadConfig: mockLoadConfig,
  createPipeline: mockCreatePipeline,
  evaluateAction: mockEvaluateAction,
  TaintLevel: {
    OWNER: "owner",
    TRUSTED: "trusted",
    UNTRUSTED: "untrusted",
    WEB: "web",
    SKILL: "skill",
    MEMORY: "memory",
  },
  CONFIG_DIR: "/tmp/.securitylayer-test",
  CONFIG_PATHS: {
    main: "/tmp/.securitylayer-test/config.yaml",
    sessions: "/tmp/.securitylayer-test/capabilities/sessions.yaml",
    channels: "/tmp/.securitylayer-test/capabilities/channels.yaml",
    skills: "/tmp/.securitylayer-test/capabilities/skills.yaml",
    learnedRules: "/tmp/.securitylayer-test/learned-rules.json",
  },
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

vi.mock("@/caller-detect", () => ({
  detectCaller: vi.fn().mockResolvedValue("unknown"),
}));

vi.mock("@/shared", () => ({
  loadCallersConfig: vi.fn().mockResolvedValue({ version: 1, callers: {} }),
  loadProjectsConfig: vi
    .fn()
    .mockResolvedValue({ version: 1, trust_rules: [], default: "untrusted" }),
  getProjectTaint: () => "untrusted",
  loadConfigOrSuggestInit: vi.fn(),
  configExists: () => true,
  formatDecision: (d: string) => d,
  formatTaintLevel: (t: string) => t,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runCheck } from "@/check";

function setupMockPipeline(decision: string) {
  mockLoadConfig.mockResolvedValue({
    main: { version: 1, log_level: "info", proxy: {}, semantic: { enabled: false } },
    sessions: { version: 1, sessions: {} },
    channels: { version: 1, channels: {} },
    skills: { version: 1, skills: {} },
    learnedRules: { version: 1, rules: [] },
  });
  mockCreatePipeline.mockReturnValue({
    capabilityStore: {},
    taintTracker: {
      onContentIngested: vi.fn(),
      getEffectiveTaint: () => "untrusted",
      getSources: () => [],
      clear: vi.fn(),
    },
    judge: { classify: vi.fn() },
    extraRules: [],
  });
  mockEvaluateAction.mockResolvedValue({
    decision,
    layers: {
      capability: {
        allowed: decision === "ALLOW",
        reason: decision !== "ALLOW" ? "blocked" : undefined,
      },
      taint: "untrusted",
    },
    degraded: false,
    timing: { total: 1, capability: 0.5 },
  });
}

describe("Check Command", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits 1 when --command is missing", async () => {
    await runCheck({ _: ["check"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 0 for ALLOW decision", async () => {
    setupMockPipeline("ALLOW");
    await runCheck({ _: ["check"], command: "git status", format: "text" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits 1 for DENY decision", async () => {
    setupMockPipeline("DENY");
    await runCheck({ _: ["check"], command: "rm -rf /", format: "text" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 2 for REQUIRE_APPROVAL decision", async () => {
    setupMockPipeline("REQUIRE_APPROVAL");
    await runCheck({ _: ["check"], command: "curl evil.com", format: "text" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("outputs JSON format when requested", async () => {
    setupMockPipeline("ALLOW");
    await runCheck({ _: ["check"], command: "ls", format: "json" } as CliArgs);

    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.decision).toBe("ALLOW");
    expect(parsed).toHaveProperty("timing");
  });

  it("fails safe on unexpected error", async () => {
    mockLoadConfig.mockRejectedValue(new Error("fail"));
    await runCheck({ _: ["check"], command: "ls" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
