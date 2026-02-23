import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { TEST_DIR, CONFIG_MAIN } = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  const d = path.join(os.tmpdir(), `securitylayer-test-learn-${Date.now()}`);
  return { TEST_DIR: d, CONFIG_MAIN: path.join(d, "config.yaml") };
});

vi.mock("@securitylayer/core", () => ({
  CONFIG_PATHS: {
    main: CONFIG_MAIN,
    sessions: "/tmp/.securitylayer-test/capabilities/sessions.yaml",
    channels: "/tmp/.securitylayer-test/capabilities/channels.yaml",
    skills: "/tmp/.securitylayer-test/capabilities/skills.yaml",
    learnedRules: "/tmp/.securitylayer-test/learned-rules.json",
  },
  CONFIG_DIR: "/tmp/.securitylayer-test",
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

vi.mock("@/shared", () => ({
  loadConfigOrSuggestInit: vi.fn().mockResolvedValue({}),
  configExists: () => true,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runLearn } from "@/learn";

describe("Learn Command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(CONFIG_MAIN, "version: 1\nlog_level: info\n");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("default duration 7d when no arg provided", async () => {
    await runLearn({ _: ["learn"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Duration: 7d");
  });

  it("writes mode=learning and learning_expires to config.yaml", async () => {
    await runLearn({ _: ["learn"] } as CliArgs);

    const content = await readFile(CONFIG_MAIN, "utf-8");
    expect(content).toContain("mode: learning");
    expect(content).toContain("learning_expires:");
  });

  it("exits 1 on invalid duration format", async () => {
    await runLearn({ _: ["learn"], duration: "abc" } as CliArgs);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid duration"));
  });

  it("displays success message with duration and expiry", async () => {
    await runLearn({ _: ["learn"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Learning Mode Enabled");
    expect(output).toContain("Duration:");
    expect(output).toContain("Expires:");
  });

  it('custom duration "24h" works', async () => {
    await runLearn({ _: ["learn"], duration: "24h" } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Duration: 24h");
  });

  it("custom duration 30m works", async () => {
    await runLearn({ _: ["learn"], duration: "30m" } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Duration: 30m");
  });

  it("expiry date is calculated correctly", async () => {
    const before = Date.now();
    await runLearn({ _: ["learn"], duration: "1h" } as CliArgs);
    const after = Date.now();

    const content = await readFile(CONFIG_MAIN, "utf-8");
    const match = content.match(/learning_expires: (.+)/);
    expect(match).not.toBeNull();
    const expiryMs = new Date(match?.[1]).getTime();
    // 1h = 3600000ms
    expect(expiryMs).toBeGreaterThanOrEqual(before + 3600000);
    expect(expiryMs).toBeLessThanOrEqual(after + 3600000);
  });

  it("exits 1 for empty string duration", async () => {
    await runLearn({ _: ["learn"], duration: "" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 for duration without unit", async () => {
    await runLearn({ _: ["learn"], duration: "1" } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
