import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { mockLoadConfigOrSuggestInit, mockLoadProjectsConfig, mockGetProjectTaint } = vi.hoisted(
  () => ({
    mockLoadConfigOrSuggestInit: vi.fn().mockResolvedValue({}),
    mockLoadProjectsConfig: vi.fn(),
    mockGetProjectTaint: vi.fn(),
  }),
);

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
  loadProjectsConfig: mockLoadProjectsConfig,
  getProjectTaint: mockGetProjectTaint,
  formatTaintLevel: (t: string) => t.toUpperCase(),
  configExists: () => true,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runTaintClear, runTaintShow } from "@/taint";

describe("Taint Commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runTaintShow", () => {
    it("displays trust rules with formatted taint levels", async () => {
      mockLoadProjectsConfig.mockResolvedValue({
        version: 1,
        trust_rules: [
          { path: "~/Dev/Personal/**", taint: "owner" },
          { path: "/tmp/**", taint: "web" },
        ],
        default: "untrusted",
      });
      mockGetProjectTaint.mockReturnValue("owner");

      await runTaintShow({ _: ["taint", "show"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Taint Configuration");
      expect(output).toContain("~/Dev/Personal/**");
      expect(output).toContain("OWNER");
      expect(output).toContain("WEB");
    });

    it('displays "(no rules configured)" when empty', async () => {
      mockLoadProjectsConfig.mockResolvedValue({
        version: 1,
        trust_rules: [],
        default: "untrusted",
      });
      mockGetProjectTaint.mockReturnValue("untrusted");

      await runTaintShow({ _: ["taint", "show"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("(no rules configured)");
    });

    it("shows default taint level", async () => {
      mockLoadProjectsConfig.mockResolvedValue({
        version: 1,
        trust_rules: [],
        default: "untrusted",
      });
      mockGetProjectTaint.mockReturnValue("untrusted");

      await runTaintShow({ _: ["taint", "show"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Default:");
      expect(output).toContain("UNTRUSTED");
    });

    it("shows current directory taint", async () => {
      mockLoadProjectsConfig.mockResolvedValue({
        version: 1,
        trust_rules: [],
        default: "untrusted",
      });
      mockGetProjectTaint.mockReturnValue("trusted");

      await runTaintShow({ _: ["taint", "show"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Current directory taint:");
      expect(output).toContain("TRUSTED");
    });

    it("includes note about CLI mode", async () => {
      mockLoadProjectsConfig.mockResolvedValue({
        version: 1,
        trust_rules: [],
        default: "untrusted",
      });
      mockGetProjectTaint.mockReturnValue("untrusted");

      await runTaintShow({ _: ["taint", "show"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Session taint is runtime state");
      expect(output).toContain("CLI mode");
    });
  });

  describe("runTaintClear", () => {
    it("displays informational message about CLI vs daemon", async () => {
      await runTaintClear({ _: ["taint", "clear"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Taint Clear");
      expect(output).toContain("CLI mode");
      expect(output).toContain("taint resets each invocation");
    });

    it("mentions projects trust command", async () => {
      await runTaintClear({ _: ["taint", "clear"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("securitylayer projects trust");
    });
  });
});
