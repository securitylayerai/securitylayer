import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { TEST_DIR, mockLoadProjectsConfig, mockWriteFile } = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  const d = path.join(os.tmpdir(), `securitylayer-test-projects-${Date.now()}`);
  return { TEST_DIR: d, mockLoadProjectsConfig: vi.fn(), mockWriteFile: vi.fn() };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, writeFile: mockWriteFile };
});

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
  loadConfigOrSuggestInit: vi.fn().mockResolvedValue({}),
  loadProjectsConfig: mockLoadProjectsConfig,
  configExists: () => true,
  formatDecision: (d: string) => d,
  formatTaintLevel: (t: string) => t.toUpperCase(),
  CLI_CONFIG_PATHS: {
    callers: join(TEST_DIR, "ai-tools.yaml"),
    projects: join(TEST_DIR, "projects.yaml"),
  },
}));

import { runProjectsList, runProjectsTrust, runProjectsUntrust } from "@/projects";

describe("Projects Commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockWriteFile.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("lists project trust rules", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [
        { path: "~/Dev/Personal/**", taint: "owner" },
        { path: "/tmp/**", taint: "web" },
      ],
      default: "untrusted",
    });

    await runProjectsList({ _: ["projects", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Project Trust Rules");
    expect(output).toContain("~/Dev/Personal/**");
    expect(output).toContain("/tmp/**");
  });

  it("shows empty state when no trust rules", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [],
      default: "untrusted",
    });

    await runProjectsList({ _: ["projects", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("no trust rules configured");
  });

  it("exits 1 when trust path is missing", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [],
      default: "untrusted",
    });
    await runProjectsTrust({ _: ["projects", "trust"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("adds trust rule and writes config", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [{ path: "/tmp/**", taint: "web" }],
      default: "untrusted",
    });

    await runProjectsTrust({ _: ["projects", "trust", "~/Dev/Work/**"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Trusted");
    expect(output).toContain("~/Dev/Work/**");
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("trust replaces existing rule for same path", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [{ path: "~/Dev/Work/**", taint: "untrusted" }],
      default: "untrusted",
    });

    await runProjectsTrust({
      _: ["projects", "trust", "~/Dev/Work/**"],
      taint: "trusted",
    } as unknown as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Trusted");
    expect(output).toContain("~/Dev/Work/**");
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("exits 1 when untrust path is missing", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [],
      default: "untrusted",
    });
    await runProjectsUntrust({ _: ["projects", "untrust"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("removes trust rule and writes config", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [
        { path: "~/Dev/Personal/**", taint: "owner" },
        { path: "/tmp/**", taint: "web" },
      ],
      default: "untrusted",
    });

    await runProjectsUntrust({ _: ["projects", "untrust", "/tmp/**"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Removed trust rule for: /tmp/**");
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("untrust shows message when path not found", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [{ path: "/tmp/**", taint: "web" }],
      default: "untrusted",
    });

    await runProjectsUntrust({ _: ["projects", "untrust", "/nonexistent/**"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No trust rule found for: /nonexistent/**");
  });

  it("list displays default taint level at the bottom", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [{ path: "~/Dev/**", taint: "owner" }],
      default: "untrusted",
    });

    await runProjectsList({ _: ["projects", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Default: UNTRUSTED");
  });

  it("list displays rule numbers (1., 2., etc.)", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [
        { path: "~/Dev/Personal/**", taint: "owner" },
        { path: "~/Dev/Work/**", taint: "trusted" },
        { path: "/tmp/**", taint: "web" },
      ],
      default: "untrusted",
    });

    await runProjectsList({ _: ["projects", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1. ~/Dev/Personal/**");
    expect(output).toContain("2. ~/Dev/Work/**");
    expect(output).toContain("3. /tmp/**");
  });

  it("list with formatted taint levels (formatTaintLevel mock is called)", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [
        { path: "~/Dev/Personal/**", taint: "owner" },
        { path: "/tmp/**", taint: "web" },
      ],
      default: "untrusted",
    });

    await runProjectsList({ _: ["projects", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    // formatTaintLevel mock uppercases the taint value
    expect(output).toContain("OWNER");
    expect(output).toContain("WEB");
    expect(output).toContain("UNTRUSTED");
  });

  it("trust with custom --taint flag uses provided taint level", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [],
      default: "untrusted",
    });

    await runProjectsTrust({
      _: ["projects", "trust", "~/Dev/Work/**"],
      taint: "trusted",
    } as unknown as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("~/Dev/Work/**");
    expect(output).toContain("TRUSTED");
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('untrust displays "will now use the default taint" message after removal', async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [
        { path: "~/Dev/Personal/**", taint: "owner" },
        { path: "/tmp/**", taint: "web" },
      ],
      default: "untrusted",
    });

    await runProjectsUntrust({ _: ["projects", "untrust", "/tmp/**"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("will now use the default taint");
    expect(output).toContain("UNTRUSTED");
  });
});
