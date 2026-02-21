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

vi.mock("@/shared", () => ({
  loadProjectsConfig: vi.fn().mockResolvedValue({
    version: 1,
    trust_rules: [],
    default: "untrusted",
  }),
  getProjectTaint: () => "untrusted",
  loadConfigOrSuggestInit: vi.fn(),
  configExists: () => true,
  ensureConfigDir: vi.fn(),
  formatDecision: (d: string) => d,
  formatTaintLevel: (t: string) => t,
  detectShell: () => "bash",
  getShellProfilePath: () => "/tmp/.bashrc",
  defaultCallersConfig: () => ({ version: 1, callers: {} }),
  defaultProjectsConfig: () => ({ version: 1, trust_rules: [], default: "untrusted" }),
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
  CallersConfigSchema: {},
  ProjectsConfigSchema: {},
  resolveRealBinary: vi.fn(),
  loadCallersConfig: vi.fn(),
}));

import { runHook } from "@/hook";

describe("Hook Handler", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits 1 when --tool is missing", async () => {
    await runHook({ _: ["hook", "claude-code"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 0 for unknown tools (allow by default)", async () => {
    await runHook({ _: ["hook", "claude-code"], tool: "UnknownTool" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits 0 for PostToolUse (always)", async () => {
    await runHook({ _: ["hook", "claude-code"], tool: "Read", post: true } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits 0 when action is ALLOW", async () => {
    mockLoadConfig.mockResolvedValue({
      main: { version: 1, log_level: "info", proxy: {}, semantic: { enabled: false } },
      sessions: {
        version: 1,
        sessions: { "claude-code": { capabilities: ["exec"], default_taint: "owner" } },
      },
      channels: { version: 1, channels: {} },
      skills: { version: 1, skills: {} },
      learnedRules: { version: 1, rules: [] },
    });
    mockCreatePipeline.mockReturnValue({
      capabilityStore: {},
      taintTracker: {
        onContentIngested: vi.fn(),
        getEffectiveTaint: () => "owner",
        getSources: () => [],
        clear: vi.fn(),
      },
      judge: { classify: vi.fn() },
      extraRules: [],
      learnedRules: { version: 1, rules: [] },
    });
    mockEvaluateAction.mockResolvedValue({
      decision: "ALLOW",
      layers: { capability: { allowed: true } },
      degraded: false,
      timing: { total: 1 },
    });

    await runHook({
      _: ["hook", "claude-code"],
      tool: "Bash",
      input: JSON.stringify({ command: "git status" }),
    } as CliArgs);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits 2 when action is DENY", async () => {
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
        getEffectiveTaint: () => "owner",
        getSources: () => [],
        clear: vi.fn(),
      },
      judge: { classify: vi.fn() },
      extraRules: [],
    });
    mockEvaluateAction.mockResolvedValue({
      decision: "DENY",
      layers: { capability: { allowed: false, reason: "no exec capability" } },
      degraded: false,
      timing: { total: 1 },
    });

    await runHook({
      _: ["hook", "claude-code"],
      tool: "Bash",
      input: JSON.stringify({ command: "rm -rf /" }),
    } as CliArgs);

    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("DENY"));
  });

  it("exits 2 on unexpected error (fail safe)", async () => {
    mockLoadConfig.mockRejectedValue(new Error("config corrupt"));

    await runHook({
      _: ["hook", "claude-code"],
      tool: "Bash",
      input: JSON.stringify({ command: "ls" }),
    } as CliArgs);

    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
