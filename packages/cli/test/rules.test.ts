import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { RULES_PATH, TEST_DIR } = vi.hoisted(() => {
  const os = require("node:os");
  const path = require("node:path");
  const d = path.join(os.tmpdir(), `securitylayer-test-rules-${Date.now()}`);
  return { TEST_DIR: d, RULES_PATH: path.join(d, "learned-rules.json") };
});

vi.mock("@securitylayer/core", () => ({
  CONFIG_PATHS: {
    main: "/tmp/.securitylayer-test/config.yaml",
    sessions: "/tmp/.securitylayer-test/capabilities/sessions.yaml",
    channels: "/tmp/.securitylayer-test/capabilities/channels.yaml",
    skills: "/tmp/.securitylayer-test/capabilities/skills.yaml",
    learnedRules: RULES_PATH,
  },
  CONFIG_DIR: "/tmp/.securitylayer-test",
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

vi.mock("@/shared", () => ({
  loadConfigOrSuggestInit: vi.fn().mockResolvedValue({}),
  configExists: () => true,
  formatDecision: (d: string) => d,
  formatTaintLevel: (t: string) => t,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runRulesClear, runRulesList, runRulesRevoke } from "@/rules";

describe("Rules Commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("lists learned rules", async () => {
    await writeFile(
      RULES_PATH,
      JSON.stringify({
        version: 1,
        rules: [
          { pattern: "git status", capability: "exec", created_at: "2025-01-01T00:00:00Z" },
          {
            pattern: "npm test",
            capability: "exec",
            created_at: "2025-01-02T00:00:00Z",
            session_id: "claude",
          },
        ],
      }),
    );

    await runRulesList({ _: ["rules", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Learned Rules");
    expect(output).toContain("git status");
    expect(output).toContain("npm test");
    expect(output).toContain("Total: 2");
  });

  it("shows empty state when no rules", async () => {
    await writeFile(RULES_PATH, JSON.stringify({ version: 1, rules: [] }));

    await runRulesList({ _: ["rules", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("no learned rules");
  });

  it("clears all rules", async () => {
    await writeFile(
      RULES_PATH,
      JSON.stringify({
        version: 1,
        rules: [{ pattern: "git status", capability: "exec", created_at: "2025-01-01T00:00:00Z" }],
      }),
    );

    await runRulesClear({ _: ["rules", "clear"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Cleared 1");

    const content = JSON.parse(await readFile(RULES_PATH, "utf-8"));
    expect(content.rules).toHaveLength(0);
  });

  it("exits 1 when revoke id is missing", async () => {
    await runRulesRevoke({ _: ["rules", "revoke"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("revokes a rule by number", async () => {
    await writeFile(
      RULES_PATH,
      JSON.stringify({
        version: 1,
        rules: [
          { pattern: "git status", capability: "exec", created_at: "2025-01-01T00:00:00Z" },
          { pattern: "npm test", capability: "exec", created_at: "2025-01-02T00:00:00Z" },
        ],
      }),
    );

    await runRulesRevoke({ _: ["rules", "revoke", "1"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Revoked rule: git status");

    const content = JSON.parse(await readFile(RULES_PATH, "utf-8"));
    expect(content.rules).toHaveLength(1);
    expect(content.rules[0].pattern).toBe("npm test");
  });

  it("exits 1 for out-of-range revoke id", async () => {
    await writeFile(
      RULES_PATH,
      JSON.stringify({
        version: 1,
        rules: [{ pattern: "git status", capability: "exec", created_at: "2025-01-01T00:00:00Z" }],
      }),
    );

    await runRulesRevoke({ _: ["rules", "revoke", "5"] } as CliArgs);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("clears shows message when no rules to clear", async () => {
    await writeFile(RULES_PATH, JSON.stringify({ version: 1, rules: [] }));

    await runRulesClear({ _: ["rules", "clear"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No learned rules to clear");
  });

  it("loads empty rules when file does not exist", async () => {
    await rm(RULES_PATH, { force: true }).catch(() => {});

    await runRulesList({ _: ["rules", "list"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("no learned rules");
  });
});
