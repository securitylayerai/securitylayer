import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const {
  TEST_DIR,
  mockWriteFile,
  mockConfigExists,
  mockEnsureConfigDir,
  mockIntro,
  mockOutro,
  mockConfirm,
  mockText,
  mockMultiselect,
  mockSelect,
  mockIsCancel,
  mockSpinner,
} = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  const d = path.join(os.tmpdir(), `securitylayer-test-init-${Date.now()}`);
  return {
    TEST_DIR: d,
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockConfigExists: vi.fn(),
    mockEnsureConfigDir: vi.fn().mockResolvedValue(undefined),
    mockIntro: vi.fn(),
    mockOutro: vi.fn(),
    mockConfirm: vi.fn(),
    mockText: vi.fn(),
    mockMultiselect: vi.fn(),
    mockSelect: vi.fn(),
    mockIsCancel: vi.fn().mockReturnValue(false),
    mockSpinner: vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn() }),
  };
});

vi.mock("@clack/prompts", () => ({
  intro: mockIntro,
  outro: mockOutro,
  confirm: mockConfirm,
  text: mockText,
  multiselect: mockMultiselect,
  select: mockSelect,
  isCancel: mockIsCancel,
  spinner: mockSpinner,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, writeFile: mockWriteFile };
});

vi.mock("@securitylayer/core", () => ({
  CONFIG_DIR: TEST_DIR,
  BASE_CAPABILITIES: [
    "exec",
    "exec.elevated",
    "file.read",
    "file.write",
    "browser",
    "browser.login",
    "channel.send",
    "channel.send.external",
    "cron.create",
    "skill.install",
    "memory.read.all_zones",
    "memory.read.trusted",
    "memory.write",
    "web_fetch",
    "node.invoke",
  ],
  PROVIDER_DEFAULTS: {
    anthropic: { model: "claude-sonnet-4-5-20250929", apiKeyEnv: "ANTHROPIC_API_KEY" },
    openai: { model: "gpt-4o", apiKeyEnv: "OPENAI_API_KEY" },
    google: { model: "gemini-2.0-flash", apiKeyEnv: "GOOGLE_API_KEY" },
    xai: { model: "grok-3", apiKeyEnv: "XAI_API_KEY" },
    "openai-compatible": { model: "deepseek-chat", apiKeyEnv: "DEEPSEEK_API_KEY" },
  },
  CONFIG_PATHS: { main: join(TEST_DIR, "config.yaml") },
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

vi.mock("@/shared", () => ({
  configExists: mockConfigExists,
  ensureConfigDir: mockEnsureConfigDir,
  defaultCallersConfig: () => ({ version: 1, callers: {} }),
  defaultProjectsConfig: () => ({ version: 1, trust_rules: [], default: "untrusted" }),
  CLI_CONFIG_PATHS: {
    callers: join(TEST_DIR, "capabilities", "ai-tools.yaml"),
    projects: join(TEST_DIR, "taint", "projects.yaml"),
  },
  detectShell: () => "bash",
}));

vi.mock("@/setup", () => ({ runSetupClaudeCode: vi.fn() }));
vi.mock("@/shield", () => ({ runShieldEnable: vi.fn() }));

import { runInit } from "@/init";

describe("Init Command", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  function setupHappyPathPrompts() {
    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue("claude-code"); // session name
    mockMultiselect.mockResolvedValue(["exec", "file.read", "file.write"]);
    mockSelect.mockResolvedValue("owner"); // taint
    mockConfirm
      .mockResolvedValueOnce(false) // enable semantic
      .mockResolvedValueOnce(false); // enable shield
  }

  it("creates all config files when no existing config", async () => {
    setupHappyPathPrompts();

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockEnsureConfigDir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    // Should write config.yaml, sessions.yaml, channels.yaml, skills.yaml, ai-tools.yaml, projects.yaml, learned-rules.json
    expect(mockWriteFile.mock.calls.length).toBeGreaterThanOrEqual(7);
    expect(mockOutro).toHaveBeenCalledWith("SecurityLayer is ready.");
  });

  it("cancel at session name returns early without writing files", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue(Symbol("cancel"));
    mockIsCancel.mockImplementation((v) => typeof v === "symbol");

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("cancel at capabilities returns early", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue("claude-code");
    mockMultiselect.mockResolvedValue(Symbol("cancel"));
    mockIsCancel.mockImplementation((v) => typeof v === "symbol");

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("cancel at taint selection returns early", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue("claude-code");
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect.mockResolvedValue(Symbol("cancel"));
    mockIsCancel.mockImplementation((v) => typeof v === "symbol");

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("cancel at semantic judge returns early", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue("claude-code");
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect.mockResolvedValue("owner");
    mockConfirm.mockResolvedValue(Symbol("cancel"));
    mockIsCancel.mockImplementation((v) => typeof v === "symbol");

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("config exists + overwrite declined returns early", async () => {
    mockConfigExists.mockReturnValue(true);
    mockConfirm.mockResolvedValue(false);

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockOutro).toHaveBeenCalledWith("Setup cancelled.");
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("config exists + overwrite confirmed continues setup", async () => {
    mockConfigExists.mockReturnValue(true);
    mockConfirm
      .mockResolvedValueOnce(true) // overwrite
      .mockResolvedValueOnce(false) // semantic
      .mockResolvedValueOnce(false); // shield
    mockText.mockResolvedValue("claude-code");
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect.mockResolvedValue("owner");

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockOutro).toHaveBeenCalledWith("SecurityLayer is ready.");
  });

  it("semantic enabled prompts for provider, model, api key", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText
      .mockResolvedValueOnce("claude-code") // session name
      .mockResolvedValueOnce("claude-sonnet-4-5-20250929") // model
      .mockResolvedValueOnce("ANTHROPIC_API_KEY"); // api key env
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect
      .mockResolvedValueOnce("owner") // taint
      .mockResolvedValueOnce("anthropic"); // provider
    mockConfirm
      .mockResolvedValueOnce(true) // enable semantic
      .mockResolvedValueOnce(false); // shield

    await runInit({ _: ["init"] } as CliArgs);

    // Should have prompted for provider (select)
    expect(mockSelect).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("OpenAI-compatible provider prompts for base URL", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText
      .mockResolvedValueOnce("claude-code") // session name
      .mockResolvedValueOnce("deepseek-chat") // model
      .mockResolvedValueOnce("DEEPSEEK_API_KEY") // api key
      .mockResolvedValueOnce("https://api.deepseek.com/v1"); // base url
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect
      .mockResolvedValueOnce("owner") // taint
      .mockResolvedValueOnce("openai-compatible"); // provider
    mockConfirm
      .mockResolvedValueOnce(true) // enable semantic
      .mockResolvedValueOnce(false); // shield

    await runInit({ _: ["init"] } as CliArgs);

    // 4 text prompts: session name, model, api key, base url
    expect(mockText).toHaveBeenCalledTimes(4);
  });

  it("cancel at provider selection returns early", async () => {
    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue("claude-code");
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect
      .mockResolvedValueOnce("owner") // taint
      .mockResolvedValueOnce(Symbol("cancel")); // provider cancel
    mockConfirm.mockResolvedValueOnce(true); // semantic enabled
    mockIsCancel.mockImplementation((v) => typeof v === "symbol");

    await runInit({ _: ["init"] } as CliArgs);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("writes correct sessions.yaml with session name + capabilities + taint", async () => {
    setupHappyPathPrompts();

    await runInit({ _: ["init"] } as CliArgs);

    const sessionsCall = mockWriteFile.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("sessions.yaml"),
    );
    expect(sessionsCall).toBeDefined();
    const content = sessionsCall?.[1] as string;
    expect(content).toContain("claude-code");
    expect(content).toContain("exec");
    expect(content).toContain("file.read");
  });

  it("writes correct config.yaml with version, log_level, proxy, semantic", async () => {
    setupHappyPathPrompts();

    await runInit({ _: ["init"] } as CliArgs);

    const configCall = mockWriteFile.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("config.yaml"),
    );
    expect(configCall).toBeDefined();
    const content = configCall?.[1] as string;
    expect(content).toContain("version: 1");
    expect(content).toContain("log_level: info");
    expect(content).toContain("proxy:");
    expect(content).toContain("semantic:");
  });

  it("shield setup calls runShieldEnable when confirmed", async () => {
    // Ensure Claude Code is NOT detected to keep confirm sequence predictable
    const origClaudeSession = process.env.CLAUDE_CODE_SESSION;
    const origHome = process.env.HOME;
    delete process.env.CLAUDE_CODE_SESSION;
    process.env.HOME = TEST_DIR; // No .claude dir here

    mockConfigExists.mockReturnValue(false);
    mockText.mockResolvedValue("claude-code");
    mockMultiselect.mockResolvedValue(["exec"]);
    mockSelect.mockResolvedValue("owner");
    mockConfirm
      .mockResolvedValueOnce(false) // semantic
      .mockResolvedValueOnce(true); // shield

    await runInit({ _: ["init"] } as CliArgs);

    const { runShieldEnable } = await import("@/shield");
    expect(runShieldEnable).toHaveBeenCalled();

    process.env.CLAUDE_CODE_SESSION = origClaudeSession;
    process.env.HOME = origHome;
  });
});
