import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { mockLoadConfigOrSuggestInit, mockLoadCallersConfig } = vi.hoisted(() => ({
  mockLoadConfigOrSuggestInit: vi.fn().mockResolvedValue({}),
  mockLoadCallersConfig: vi.fn(),
}));

vi.mock("@securitylayer/core", () => ({
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
  loadConfigOrSuggestInit: mockLoadConfigOrSuggestInit,
  loadCallersConfig: mockLoadCallersConfig,
  formatTaintLevel: (t: string) => t.toUpperCase(),
  configExists: () => true,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runCallersList, runCallersProfile } from "@/callers";

describe("Callers Commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runCallersList", () => {
    it("displays all callers with display names", async () => {
      mockLoadCallersConfig.mockResolvedValue({
        version: 1,
        callers: {
          "claude-code": {
            name: "claude-code",
            display_name: "Claude Code",
            capabilities: ["exec", "file.read"],
            default_taint: "trusted",
            detection: { env_vars: ["CLAUDE_CODE_SESSION"], process_names: ["claude"] },
          },
          cursor: {
            name: "cursor",
            display_name: "Cursor",
            capabilities: ["exec"],
            default_taint: "trusted",
            detection: { env_vars: ["CURSOR_SESSION_ID"], process_names: ["cursor"] },
          },
        },
      });

      await runCallersList({ _: ["callers", "list"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Claude Code");
      expect(output).toContain("Cursor");
    });

    it("shows capabilities for each caller", async () => {
      mockLoadCallersConfig.mockResolvedValue({
        version: 1,
        callers: {
          "claude-code": {
            name: "claude-code",
            display_name: "Claude Code",
            capabilities: ["exec", "file.read"],
            default_taint: "trusted",
            detection: { env_vars: [], process_names: [] },
          },
        },
      });

      await runCallersList({ _: ["callers", "list"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("exec, file.read");
    });

    it("shows env vars and process names for detection", async () => {
      mockLoadCallersConfig.mockResolvedValue({
        version: 1,
        callers: {
          "claude-code": {
            name: "claude-code",
            display_name: "Claude Code",
            capabilities: ["exec"],
            default_taint: "trusted",
            detection: { env_vars: ["CLAUDE_CODE_SESSION"], process_names: ["claude"] },
          },
        },
      });

      await runCallersList({ _: ["callers", "list"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("CLAUDE_CODE_SESSION");
      expect(output).toContain("claude");
    });

    it('shows "(no callers configured)" when empty', async () => {
      mockLoadCallersConfig.mockResolvedValue({
        version: 1,
        callers: {},
      });

      await runCallersList({ _: ["callers", "list"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("(no callers configured)");
    });

    it('shows "(none)" for caller with no capabilities', async () => {
      mockLoadCallersConfig.mockResolvedValue({
        version: 1,
        callers: {
          empty: {
            name: "empty",
            display_name: "Empty",
            capabilities: [],
            default_taint: "untrusted",
            detection: { env_vars: [], process_names: [] },
          },
        },
      });

      await runCallersList({ _: ["callers", "list"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("(none)");
    });
  });

  describe("runCallersProfile", () => {
    const callerConfig = {
      version: 1,
      callers: {
        "claude-code": {
          name: "claude-code",
          display_name: "Claude Code",
          capabilities: ["exec", "file.read", "file.write"],
          default_taint: "trusted",
          detection: { env_vars: ["CLAUDE_CODE_SESSION"], process_names: ["claude"] },
        },
      },
    };

    it("displays detailed profile for known caller", async () => {
      mockLoadCallersConfig.mockResolvedValue(callerConfig);

      await runCallersProfile({ _: ["callers", "profile", "claude-code"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Caller Profile: Claude Code");
      expect(output).toContain("claude-code");
    });

    it("exits 1 when name argument missing", async () => {
      mockLoadCallersConfig.mockResolvedValue(callerConfig);
      exitSpy.mockImplementation((() => {
        throw new Error("exit");
      }) as never);
      await expect(runCallersProfile({ _: ["callers", "profile"] } as CliArgs)).rejects.toThrow(
        "exit",
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits 1 for unknown caller name, lists known callers", async () => {
      mockLoadCallersConfig.mockResolvedValue(callerConfig);
      exitSpy.mockImplementation((() => {
        throw new Error("exit");
      }) as never);

      await expect(
        runCallersProfile({ _: ["callers", "profile", "unknown-tool"] } as CliArgs),
      ).rejects.toThrow("exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown caller"));
    });

    it("shows capabilities section with items", async () => {
      mockLoadCallersConfig.mockResolvedValue(callerConfig);

      await runCallersProfile({ _: ["callers", "profile", "claude-code"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Capabilities:");
      expect(output).toContain("exec");
      expect(output).toContain("file.read");
    });

    it('shows "(none)" for empty capabilities/env vars/process names', async () => {
      mockLoadCallersConfig.mockResolvedValue({
        version: 1,
        callers: {
          empty: {
            name: "empty",
            display_name: "Empty Tool",
            capabilities: [],
            default_taint: "untrusted",
            detection: { env_vars: [], process_names: [] },
          },
        },
      });

      await runCallersProfile({ _: ["callers", "profile", "empty"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("(none)");
    });

    it("shows detection env vars and process names", async () => {
      mockLoadCallersConfig.mockResolvedValue(callerConfig);

      await runCallersProfile({ _: ["callers", "profile", "claude-code"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Detection:");
      expect(output).toContain("CLAUDE_CODE_SESSION");
      expect(output).toContain("claude");
    });
  });
});
