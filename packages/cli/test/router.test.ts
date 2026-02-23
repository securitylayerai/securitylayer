import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

// Mock all command handlers
vi.mock("@/init", () => ({ runInit: vi.fn() }));
vi.mock("@/status", () => ({ runStatus: vi.fn() }));
vi.mock("@/capabilities", () => ({ runCapabilitiesShow: vi.fn() }));
vi.mock("@/taint", () => ({ runTaintShow: vi.fn(), runTaintClear: vi.fn() }));
vi.mock("@/policy-check", () => ({ runPolicyCheck: vi.fn() }));
vi.mock("@/learn", () => ({ runLearn: vi.fn() }));
vi.mock("@/completions", () => ({ runCompletions: vi.fn() }));
vi.mock("@/shield", () => ({
  runShieldEnable: vi.fn(),
  runShieldDisable: vi.fn(),
  runShieldStatus: vi.fn(),
}));
vi.mock("@/setup", () => ({
  runSetupClaudeCode: vi.fn(),
  runSetupCursor: vi.fn(),
}));
vi.mock("@/hook", () => ({ runHook: vi.fn() }));
vi.mock("@/check", () => ({ runCheck: vi.fn() }));
vi.mock("@/callers", () => ({
  runCallersList: vi.fn(),
  runCallersProfile: vi.fn(),
}));
vi.mock("@/projects", () => ({
  runProjectsList: vi.fn(),
  runProjectsTrust: vi.fn(),
  runProjectsUntrust: vi.fn(),
}));
vi.mock("@/rules", () => ({
  runRulesList: vi.fn(),
  runRulesRevoke: vi.fn(),
  runRulesClear: vi.fn(),
}));

describe("CLI Router", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeArgs(positional: string[], flags: Record<string, unknown> = {}): CliArgs {
    return { _: positional, ...flags } as CliArgs;
  }

  it("shows version with --version flag", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs([], { version: true }));
    expect(logSpy).toHaveBeenCalledWith("0.0.1");
  });

  it("shows help with --help flag", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs([], { help: true }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("securitylayer"));
  });

  it("shows help and exits 1 when no command given", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs([]));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("routes init command", async () => {
    const { runMain } = await import("@/index");
    const { runInit } = await import("@/init");
    await runMain(makeArgs(["init"]));
    expect(runInit).toHaveBeenCalled();
  });

  it("routes status command", async () => {
    const { runMain } = await import("@/index");
    const { runStatus } = await import("@/status");
    await runMain(makeArgs(["status"]));
    expect(runStatus).toHaveBeenCalled();
  });

  it("routes shield enable", async () => {
    const { runMain } = await import("@/index");
    const { runShieldEnable } = await import("@/shield");
    await runMain(makeArgs(["shield", "enable"]));
    expect(runShieldEnable).toHaveBeenCalled();
  });

  it("routes shield disable", async () => {
    const { runMain } = await import("@/index");
    const { runShieldDisable } = await import("@/shield");
    await runMain(makeArgs(["shield", "disable"]));
    expect(runShieldDisable).toHaveBeenCalled();
  });

  it("routes setup claude-code", async () => {
    const { runMain } = await import("@/index");
    const { runSetupClaudeCode } = await import("@/setup");
    await runMain(makeArgs(["setup", "claude-code"]));
    expect(runSetupClaudeCode).toHaveBeenCalled();
  });

  it("routes hook command", async () => {
    const { runMain } = await import("@/index");
    const { runHook } = await import("@/hook");
    await runMain(makeArgs(["hook", "claude-code"], { tool: "Bash" }));
    expect(runHook).toHaveBeenCalled();
  });

  it("routes check command", async () => {
    const { runMain } = await import("@/index");
    const { runCheck } = await import("@/check");
    await runMain(makeArgs(["check"], { tool: "exec", command: "ls" }));
    expect(runCheck).toHaveBeenCalled();
  });

  it("routes projects list", async () => {
    const { runMain } = await import("@/index");
    const { runProjectsList } = await import("@/projects");
    await runMain(makeArgs(["projects", "list"]));
    expect(runProjectsList).toHaveBeenCalled();
  });

  it("routes rules list", async () => {
    const { runMain } = await import("@/index");
    const { runRulesList } = await import("@/rules");
    await runMain(makeArgs(["rules", "list"]));
    expect(runRulesList).toHaveBeenCalled();
  });

  it("routes callers list", async () => {
    const { runMain } = await import("@/index");
    const { runCallersList } = await import("@/callers");
    await runMain(makeArgs(["callers", "list"]));
    expect(runCallersList).toHaveBeenCalled();
  });

  it("routes taint show", async () => {
    const { runMain } = await import("@/index");
    const { runTaintShow } = await import("@/taint");
    await runMain(makeArgs(["taint", "show"]));
    expect(runTaintShow).toHaveBeenCalled();
  });

  it("routes policy check", async () => {
    const { runMain } = await import("@/index");
    const { runPolicyCheck } = await import("@/policy-check");
    await runMain(makeArgs(["policy", "check"]));
    expect(runPolicyCheck).toHaveBeenCalled();
  });

  it("exits 1 for unknown command", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs(["foobar"]));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });

  it("routes capabilities show (default subcommand)", async () => {
    const { runMain } = await import("@/index");
    const { runCapabilitiesShow } = await import("@/capabilities");
    await runMain(makeArgs(["capabilities"]));
    expect(runCapabilitiesShow).toHaveBeenCalled();
  });

  it("routes learn command", async () => {
    const { runMain } = await import("@/index");
    const { runLearn } = await import("@/learn");
    await runMain(makeArgs(["learn"]));
    expect(runLearn).toHaveBeenCalled();
  });

  it("routes completions command", async () => {
    const { runMain } = await import("@/index");
    const { runCompletions } = await import("@/completions");
    await runMain(makeArgs(["completions", "bash"]));
    expect(runCompletions).toHaveBeenCalled();
  });

  it("routes shield status (default subcommand when no subcommand given)", async () => {
    const { runMain } = await import("@/index");
    const { runShieldStatus } = await import("@/shield");
    await runMain(makeArgs(["shield"]));
    expect(runShieldStatus).toHaveBeenCalled();
  });

  it("routes setup cursor", async () => {
    const { runMain } = await import("@/index");
    const { runSetupCursor } = await import("@/setup");
    await runMain(makeArgs(["setup", "cursor"]));
    expect(runSetupCursor).toHaveBeenCalled();
  });

  it("routes taint clear", async () => {
    const { runMain } = await import("@/index");
    const { runTaintClear } = await import("@/taint");
    await runMain(makeArgs(["taint", "clear"]));
    expect(runTaintClear).toHaveBeenCalled();
  });

  it("routes taint with no subcommand (defaults to show)", async () => {
    const { runMain } = await import("@/index");
    const { runTaintShow } = await import("@/taint");
    await runMain(makeArgs(["taint"]));
    expect(runTaintShow).toHaveBeenCalled();
  });

  it("routes projects trust", async () => {
    const { runMain } = await import("@/index");
    const { runProjectsTrust } = await import("@/projects");
    await runMain(makeArgs(["projects", "trust", "/some/path"]));
    expect(runProjectsTrust).toHaveBeenCalled();
  });

  it("routes projects untrust", async () => {
    const { runMain } = await import("@/index");
    const { runProjectsUntrust } = await import("@/projects");
    await runMain(makeArgs(["projects", "untrust", "/some/path"]));
    expect(runProjectsUntrust).toHaveBeenCalled();
  });

  it("routes projects with no subcommand (defaults to list)", async () => {
    const { runMain } = await import("@/index");
    const { runProjectsList } = await import("@/projects");
    await runMain(makeArgs(["projects"]));
    expect(runProjectsList).toHaveBeenCalled();
  });

  it("routes callers profile", async () => {
    const { runMain } = await import("@/index");
    const { runCallersProfile } = await import("@/callers");
    await runMain(makeArgs(["callers", "profile", "claude-code"]));
    expect(runCallersProfile).toHaveBeenCalled();
  });

  it("routes callers with no subcommand (defaults to list)", async () => {
    const { runMain } = await import("@/index");
    const { runCallersList } = await import("@/callers");
    await runMain(makeArgs(["callers"]));
    expect(runCallersList).toHaveBeenCalled();
  });

  it("routes rules revoke", async () => {
    const { runMain } = await import("@/index");
    const { runRulesRevoke } = await import("@/rules");
    await runMain(makeArgs(["rules", "revoke", "some-id"]));
    expect(runRulesRevoke).toHaveBeenCalled();
  });

  it("routes rules clear", async () => {
    const { runMain } = await import("@/index");
    const { runRulesClear } = await import("@/rules");
    await runMain(makeArgs(["rules", "clear"]));
    expect(runRulesClear).toHaveBeenCalled();
  });

  it("routes rules with no subcommand (defaults to list)", async () => {
    const { runMain } = await import("@/index");
    const { runRulesList } = await import("@/rules");
    await runMain(makeArgs(["rules"]));
    expect(runRulesList).toHaveBeenCalled();
  });

  it("exits 1 for unknown subcommand: shield foobar", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs(["shield", "foobar"]));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });

  it("exits 1 for unknown subcommand: setup foobar", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs(["setup", "foobar"]));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });

  it("version flag should NOT show help text", async () => {
    const { runMain } = await import("@/index");
    await runMain(makeArgs([], { version: true }));
    expect(logSpy).toHaveBeenCalledWith("0.0.1");
    // Should NOT contain help text
    const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(allOutput).not.toContain("Usage:");
    expect(allOutput).not.toContain("Commands:");
  });

  it("--version takes priority even with a command", async () => {
    const { runMain } = await import("@/index");
    const { runInit } = await import("@/init");
    (runInit as unknown as ReturnType<typeof vi.fn>).mockClear();
    await runMain(makeArgs(["init"], { version: true }));
    expect(logSpy).toHaveBeenCalledWith("0.0.1");
    expect(runInit).not.toHaveBeenCalled();
  });
});
