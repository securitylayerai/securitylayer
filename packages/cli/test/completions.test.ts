import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCompletions } from "@/completions";
import type { CliArgs } from "@/index";

describe("Completions", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("bash completions", () => {
    it("outputs bash completion script containing all 14 commands", async () => {
      await runCompletions({ _: ["completions", "bash"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      const commands = [
        "init",
        "status",
        "capabilities",
        "taint",
        "policy",
        "learn",
        "completions",
        "shield",
        "setup",
        "hook",
        "check",
        "callers",
        "projects",
        "rules",
      ];
      for (const cmd of commands) {
        expect(output).toContain(cmd);
      }
    });

    it("outputs complete -F registration", async () => {
      await runCompletions({ _: ["completions", "bash"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("complete -F _securitylayer_completions securitylayer");
    });

    it("includes subcommands for shield, setup, etc.", async () => {
      await runCompletions({ _: ["completions", "bash"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("enable");
      expect(output).toContain("disable");
      expect(output).toContain("claude-code");
      expect(output).toContain("cursor");
    });
  });

  describe("zsh completions", () => {
    it("outputs #compdef securitylayer header", async () => {
      await runCompletions({ _: ["completions", "zsh"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("#compdef securitylayer");
    });

    it("includes _arguments and command descriptions", async () => {
      await runCompletions({ _: ["completions", "zsh"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_arguments");
      expect(output).toContain("Interactive guided setup");
    });

    it("includes subcommands in case statement", async () => {
      await runCompletions({ _: ["completions", "zsh"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("case $words[2] in");
      expect(output).toContain("shield)");
    });
  });

  describe("fish completions", () => {
    it("outputs complete -c securitylayer lines", async () => {
      await runCompletions({ _: ["completions", "fish"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("complete -c securitylayer");
    });

    it("includes all 14 commands with descriptions", async () => {
      await runCompletions({ _: ["completions", "fish"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("'init'");
      expect(output).toContain("'status'");
      expect(output).toContain("Interactive guided setup");
    });

    it("includes subcommands with __fish_seen_subcommand_from", async () => {
      await runCompletions({ _: ["completions", "fish"] } as CliArgs);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("__fish_seen_subcommand_from");
      expect(output).toContain("__fish_seen_subcommand_from shield");
    });
  });

  it("defaults to bash when no shell arg provided", async () => {
    await runCompletions({ _: ["completions"] } as CliArgs);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("complete -F _securitylayer_completions securitylayer");
  });

  it("exits 1 for unsupported shell", async () => {
    await runCompletions({ _: ["completions", "tcsh"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unsupported shell"));
  });
});
