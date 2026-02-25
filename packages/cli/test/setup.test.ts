import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { TEST_DIR } = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  return { TEST_DIR: path.join(os.tmpdir(), `securitylayer-test-setup-${Date.now()}`) };
});

const CLAUDE_DIR = join(TEST_DIR, ".claude");
const HOOKS_PATH = join(CLAUDE_DIR, "hooks.json");

// We need to mock homedir so that the module uses our test directory
vi.mock("node:os", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:os")>();
  return { ...original, homedir: () => TEST_DIR };
});

vi.mock("@securitylayer/core", () => ({
  CONFIG_DIR: "/tmp/.securitylayer-test",
  CONFIG_PATHS: {
    main: "/tmp/.securitylayer-test/config.yaml",
  },
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

import { runSetupClaudeCode, runSetupCursor } from "@/setup";

describe("Setup Commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let _errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    _errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  describe("runSetupClaudeCode", () => {
    it("returns without error when .claude/ dir missing", async () => {
      // Don't create CLAUDE_DIR
      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Claude Code directory not found");
    });

    it("creates hooks.json when Claude dir exists but no hooks file", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });

      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      expect(existsSync(HOOKS_PATH)).toBe(true);
      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));
      expect(content.PreToolUse).toBeDefined();
      expect(content.PostToolUse).toBeDefined();
    });

    it("merges hooks into existing hooks.json preserving non-SL hooks", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });
      await writeFile(
        HOOKS_PATH,
        JSON.stringify({
          PreToolUse: [{ matcher: "Custom", command: "custom-tool check" }],
          PostToolUse: [],
        }),
        "utf-8",
      );

      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));
      // Custom hook preserved
      const customHooks = content.PreToolUse.filter(
        (h: { command: string }) => h.command === "custom-tool check",
      );
      expect(customHooks).toHaveLength(1);
      // SL hooks added
      const slHooks = content.PreToolUse.filter((h: { command: string }) =>
        h.command.includes("securitylayer hook"),
      );
      expect(slHooks.length).toBeGreaterThan(0);
    });

    it("removes old Security Layer hooks before adding (idempotent)", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });

      // Run twice
      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);
      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));
      const slPreHooks = content.PreToolUse.filter((h: { command: string }) =>
        h.command.includes("securitylayer hook"),
      );
      // Should have exactly 5 (one per PRE_TOOL_USE_TOOLS), not 10
      expect(slPreHooks).toHaveLength(5);
    });

    it("adds 5 PreToolUse hooks", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });

      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));
      expect(content.PreToolUse).toHaveLength(5);

      const matchers = content.PreToolUse.map((h: { matcher: string }) => h.matcher);
      expect(matchers).toContain("Bash");
      expect(matchers).toContain("Write");
      expect(matchers).toContain("Edit");
      expect(matchers).toContain("WebFetch");
      expect(matchers).toContain("NotebookEdit");
    });

    it("adds 3 PostToolUse hooks", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });

      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));
      expect(content.PostToolUse).toHaveLength(3);

      const matchers = content.PostToolUse.map((h: { matcher: string }) => h.matcher);
      expect(matchers).toContain("Bash");
      expect(matchers).toContain("Read");
      expect(matchers).toContain("WebFetch");
    });

    it("handles malformed hooks.json (uses empty object)", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });
      await writeFile(HOOKS_PATH, "not valid json{{{", "utf-8");

      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));
      expect(content.PreToolUse).toBeDefined();
      expect(content.PostToolUse).toBeDefined();
    });

    it("buildHookCommand generates correct pre and post commands", async () => {
      await mkdir(CLAUDE_DIR, { recursive: true });

      await runSetupClaudeCode({ _: ["setup", "claude-code"] } as CliArgs);

      const content = JSON.parse(await readFile(HOOKS_PATH, "utf-8"));

      // Pre hooks have --input
      const preBash = content.PreToolUse.find((h: { matcher: string }) => h.matcher === "Bash");
      expect(preBash.command).toContain("--tool Bash");
      expect(preBash.command).toContain("--input");
      expect(preBash.command).not.toContain("--post");

      // Post hooks have --post and --output
      const postBash = content.PostToolUse.find((h: { matcher: string }) => h.matcher === "Bash");
      expect(postBash.command).toContain("--post");
      expect(postBash.command).toContain("--output");
    });
  });

  describe("runSetupCursor", () => {
    it("displays setup instructions mentioning shield", async () => {
      await runSetupCursor({ _: ["setup", "cursor"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Cursor Integration Setup");
      expect(output).toContain("Shield");
    });

    it("mentions securitylayer shield enable", async () => {
      await runSetupCursor({ _: ["setup", "cursor"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("securitylayer shield enable");
    });
  });
});
