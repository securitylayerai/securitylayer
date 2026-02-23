import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { mockLoadConfigOrSuggestInit } = vi.hoisted(() => ({
  mockLoadConfigOrSuggestInit: vi.fn(),
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
  formatTaintLevel: (t: string) => t.toUpperCase(),
  configExists: () => true,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runCapabilitiesShow } from "@/capabilities";

describe("Capabilities Show", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("displays session names with capability count", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          "claude-code": { capabilities: ["exec", "file.read"], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Capability Grants");
    expect(output).toContain("claude-code");
    expect(output).toContain("Sessions (1)");
  });

  it('shows "(no capabilities granted)" for empty capabilities array', async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          empty: { capabilities: [], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("(no capabilities granted)");
  });

  it("shows taint-qualified capabilities", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          "claude-code": {
            capabilities: ["exec:trusted", "file.read:owner"],
            default_taint: "trusted",
          },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("exec");
    expect(output).toContain("requires");
    expect(output).toContain("TRUSTED");
  });

  it("shows plain capabilities without taint qualification", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          "claude-code": { capabilities: ["exec", "file.read"], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("exec");
    expect(output).toContain("file.read");
  });

  it("shows multiple sessions", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          "claude-code": { capabilities: ["exec"], default_taint: "owner" },
          cursor: { capabilities: ["file.read"], default_taint: "trusted" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Sessions (2)");
    expect(output).toContain("claude-code");
    expect(output).toContain("cursor");
  });

  it('shows channels with "ALL" capabilities', async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          main: { capabilities: ["exec"], default_taint: "owner" },
        },
      },
      channels: {
        channels: {
          slack: { max_capabilities: "ALL" },
        },
      },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Channels (1)");
    expect(output).toContain("slack");
    expect(output).toContain("ALL (unrestricted)");
  });

  it("shows channels with specific capabilities", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          main: { capabilities: ["exec"], default_taint: "owner" },
        },
      },
      channels: {
        channels: {
          slack: { max_capabilities: ["channel.send", "file.read"] },
        },
      },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("channel.send");
    expect(output).toContain("file.read");
  });

  it("skips channels section when no channels defined", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          main: { capabilities: ["exec"], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).not.toContain("Channels");
  });

  it("shows skills with capabilities", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          main: { capabilities: ["exec"], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: {
        skills: {
          "code-review": { capabilities: ["file.read", "exec"] },
        },
      },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Skills (1)");
    expect(output).toContain("code-review");
    expect(output).toContain("file.read");
  });

  it("skips skills section when no skills defined", async () => {
    mockLoadConfigOrSuggestInit.mockResolvedValue({
      sessions: {
        sessions: {
          main: { capabilities: ["exec"], default_taint: "owner" },
        },
      },
      channels: { channels: {} },
      skills: { skills: {} },
    });

    await runCapabilitiesShow({ _: ["capabilities", "show"] } as CliArgs);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).not.toContain("Skills");
  });
});
