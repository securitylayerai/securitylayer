import { describe, expect, it, vi } from "vitest";

// Mock @securitylayer/core before anything imports it
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
  loadConfig: vi.fn(),
  createPipeline: vi.fn(),
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
}));

import {
  defaultCallersConfig,
  defaultProjectsConfig,
  detectShell,
  formatDecision,
  formatTaintLevel,
  getProjectTaint,
  getShellProfilePath,
} from "@/shared";

describe("formatDecision", () => {
  it("formats ALLOW in green", () => {
    const result = formatDecision("ALLOW");
    expect(result).toContain("ALLOW");
    expect(result).toContain("\x1b[32m");
  });

  it("formats DENY in red", () => {
    const result = formatDecision("DENY");
    expect(result).toContain("DENY");
    expect(result).toContain("\x1b[31m");
  });

  it("formats REQUIRE_APPROVAL in yellow", () => {
    const result = formatDecision("REQUIRE_APPROVAL");
    expect(result).toContain("REQUIRE_APPROVAL");
    expect(result).toContain("\x1b[33m");
  });

  it("returns unknown values unchanged", () => {
    expect(formatDecision("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("formatTaintLevel", () => {
  it("formats owner in green", () => {
    expect(formatTaintLevel("owner")).toContain("OWNER");
  });

  it("formats web in magenta", () => {
    expect(formatTaintLevel("web")).toContain("WEB_CONTENT");
  });

  it("formats all valid levels", () => {
    const levels = ["owner", "trusted", "untrusted", "web", "skill", "memory"];
    for (const level of levels) {
      const result = formatTaintLevel(level);
      expect(result).toContain("\x1b["); // Has color
      expect(result).toContain("\x1b[0m"); // Has reset
    }
  });
});

describe("getProjectTaint", () => {
  const config = defaultProjectsConfig();

  it("matches exact path with glob suffix", () => {
    const home = process.env.HOME ?? "/Users/test";
    const taint = getProjectTaint(`${home}/Dev/Personal/myproject`, config);
    expect(taint).toBe("owner");
  });

  it("matches nested path", () => {
    const home = process.env.HOME ?? "/Users/test";
    const taint = getProjectTaint(`${home}/Dev/Work/company/project`, config);
    expect(taint).toBe("trusted");
  });

  it("returns default for unmatched paths", () => {
    const taint = getProjectTaint("/some/random/path", config);
    expect(taint).toBe("untrusted");
  });

  it("matches /tmp as web taint", () => {
    const taint = getProjectTaint("/tmp/downloaded-repo", config);
    expect(taint).toBe("web");
  });

  it("matches Downloads as web taint", () => {
    const home = process.env.HOME ?? "/Users/test";
    const taint = getProjectTaint(`${home}/Downloads/project`, config);
    expect(taint).toBe("web");
  });
});

describe("detectShell", () => {
  it("returns shell name from SHELL env", () => {
    const originalShell = process.env.SHELL;
    process.env.SHELL = "/bin/zsh";
    expect(detectShell()).toBe("zsh");
    process.env.SHELL = originalShell;
  });

  it("defaults to bash", () => {
    const originalShell = process.env.SHELL;
    delete process.env.SHELL;
    expect(detectShell()).toBe("bash");
    process.env.SHELL = originalShell;
  });
});

describe("getShellProfilePath", () => {
  it("returns .zshrc for zsh", () => {
    expect(getShellProfilePath("zsh")).toContain(".zshrc");
  });

  it("returns .bashrc for bash", () => {
    expect(getShellProfilePath("bash")).toContain(".bashrc");
  });

  it("returns fish config for fish", () => {
    expect(getShellProfilePath("fish")).toContain("config.fish");
  });
});

describe("config defaults", () => {
  it("default callers config has claude-code profile", () => {
    const config = defaultCallersConfig();
    expect(config.version).toBe(1);
    expect(config.callers["claude-code"]).toBeDefined();
    expect(config.callers["claude-code"].display_name).toBe("Claude Code");
    expect(config.callers["claude-code"].capabilities).toContain("exec");
    expect(config.callers["claude-code"].detection.env_vars).toContain("CLAUDE_CODE_SESSION");
  });

  it("default callers config has cursor profile", () => {
    const config = defaultCallersConfig();
    expect(config.callers.cursor).toBeDefined();
    expect(config.callers.cursor.display_name).toBe("Cursor");
  });

  it("default callers config has aider and copilot profiles", () => {
    const config = defaultCallersConfig();
    expect(config.callers.aider).toBeDefined();
    expect(config.callers.copilot).toBeDefined();
  });

  it("default projects config has trust rules", () => {
    const config = defaultProjectsConfig();
    expect(config.version).toBe(1);
    expect(config.trust_rules.length).toBeGreaterThan(0);
    expect(config.default).toBe("untrusted");
  });

  it("default projects config includes owner for Personal dev", () => {
    const config = defaultProjectsConfig();
    const personalRule = config.trust_rules.find((r) => r.path.includes("Personal"));
    expect(personalRule?.taint).toBe("owner");
  });
});
