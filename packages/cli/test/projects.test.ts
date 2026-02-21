import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { TEST_DIR, mockLoadProjectsConfig } = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  const d = path.join(os.tmpdir(), `securitylayer-test-projects-${Date.now()}`);
  return { TEST_DIR: d, mockLoadProjectsConfig: vi.fn() };
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

  it("exits 1 when trust path is missing", async () => {
    mockLoadProjectsConfig.mockResolvedValue({
      version: 1,
      trust_rules: [],
      default: "untrusted",
    });
    await runProjectsTrust({ _: ["projects", "trust"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
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
});
