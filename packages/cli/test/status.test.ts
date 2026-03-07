import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { TEST_DIR, mockConfigExists, mockLoadConfig } = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  const d = path.join(os.tmpdir(), `securitylayer-test-status-${Date.now()}`);
  return {
    TEST_DIR: d,
    mockConfigExists: vi.fn(),
    mockLoadConfig: vi.fn(),
  };
});

vi.mock("@securitylayerai/core", () => ({
  CONFIG_DIR: TEST_DIR,
  CONFIG_PATHS: {
    main: join(TEST_DIR, "config.yaml"),
    sessions: join(TEST_DIR, "capabilities", "sessions.yaml"),
    channels: join(TEST_DIR, "capabilities", "channels.yaml"),
    skills: join(TEST_DIR, "capabilities", "skills.yaml"),
    learnedRules: join(TEST_DIR, "learned-rules.json"),
  },
  loadConfig: mockLoadConfig,
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

vi.mock("@/shared", () => ({
  configExists: mockConfigExists,
  CLI_CONFIG_PATHS: {
    callers: join(TEST_DIR, "capabilities", "ai-tools.yaml"),
    projects: join(TEST_DIR, "taint", "projects.yaml"),
  },
}));

import { runStatus } from "@/status";

describe("Status Command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(join(TEST_DIR, "capabilities"), { recursive: true });
    await mkdir(join(TEST_DIR, "taint"), { recursive: true });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('shows "not found" and returns early when config missing', async () => {
    mockConfigExists.mockReturnValue(false);

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("not found");
    expect(output).toContain("securitylayer init");
  });

  it('shows "loaded" when config exists', async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("loaded");
  });

  it("lists config files with existence check", async () => {
    mockConfigExists.mockReturnValue(true);
    // Create a file so existsSync can find it
    await writeFile(join(TEST_DIR, "config.yaml"), "version: 1\n");
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Config files:");
    expect(output).toContain("Main config:");
  });

  it('shows shield as "inactive" when shim dir missing', async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Shield:");
    // Should be inactive since bin dir likely doesn't exist or not in PATH
    expect(output).toContain("inactive");
  });

  it('shows hooks as "not installed" when hooks.json missing', async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Claude Code hooks:");
    expect(output).toContain("not installed");
  });

  it("shows session info with capabilities count and taint", async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: {
        sessions: {
          "claude-code": { capabilities: ["exec", "file.read"], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Sessions (1)");
    expect(output).toContain("claude-code:");
    expect(output).toContain("2 capabilities");
    expect(output).toContain("taint=owner");
  });

  it("shows learning mode active with expiry", async () => {
    mockConfigExists.mockReturnValue(true);
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockLoadConfig.mockResolvedValue({
      main: { version: 1, mode: "learning", learning_expires: futureDate },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Learning mode: ACTIVE");
    expect(output).toContain("Expires:");
  });

  it("handles loadConfig failure gracefully", async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockRejectedValue(new Error("parse error"));

    await runStatus({ _: ["status"] } as CliArgs);

    // Should not throw, status still displays
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Security Layer Status");
  });

  it('shows "Run `securitylayer init` to get started" when no config', async () => {
    mockConfigExists.mockReturnValue(false);

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Run `securitylayer init` to get started");
  });

  it('shows shield as "active" when shim dir exists AND PATH includes it', async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    // Create the bin directory so existsSync returns true
    const shimDir = join(TEST_DIR, "bin");
    await mkdir(shimDir, { recursive: true });

    // Mock PATH to include the shim directory
    const originalPath = process.env.PATH;
    process.env.PATH = `${shimDir}:${originalPath}`;

    try {
      await runStatus({ _: ["status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Shield:");
      expect(output).toContain("active");
      expect(output).not.toContain("inactive");
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('shows hooks as "installed" when hooks.json contains "securitylayer hook"', async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    // Create a mock hooks.json with "securitylayer hook" in the user's .claude directory
    const claudeDir = join(process.env.HOME ?? "", ".claude");
    await mkdir(claudeDir, { recursive: true });
    const hooksPath = join(claudeDir, "hooks.json");

    // Check if hooks.json already exists to restore later
    const { readFile } = await import("node:fs/promises");
    let originalContent: string | null = null;
    try {
      originalContent = await readFile(hooksPath, "utf-8");
    } catch {
      // file doesn't exist
    }

    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: { PreToolUse: [{ command: "securitylayer hook pre" }] },
      }),
    );

    try {
      await runStatus({ _: ["status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Claude Code hooks:");
      expect(output).toContain("installed");
      expect(output).not.toContain("not installed");
    } finally {
      // Restore original hooks.json or remove it
      if (originalContent !== null) {
        await writeFile(hooksPath, originalContent);
      } else {
        await rm(hooksPath, { force: true }).catch(() => {});
      }
    }
  });

  it("shows multiple sessions with individual capability counts", async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: {
        sessions: {
          "claude-code": {
            capabilities: ["exec", "file.read", "file.write"],
            default_taint: "owner",
          },
          cursor: { capabilities: ["file.read"], default_taint: "trusted" },
          aider: { capabilities: ["exec", "file.read"], default_taint: "untrusted" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Sessions (3)");
    expect(output).toContain("claude-code:");
    expect(output).toContain("3 capabilities");
    expect(output).toContain("cursor:");
    expect(output).toContain("1 capabilities");
    expect(output).toContain("aider:");
    expect(output).toContain("2 capabilities");
  });

  it("shows config dir path in output", async () => {
    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      main: { version: 1 },
      sessions: { sessions: {} },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runStatus({ _: ["status"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Config dir:");
    expect(output).toContain(TEST_DIR);
  });
});
