import { describe, expect, it } from "vitest";
import { createSandboxConfig, wrapCommand } from "../../src/sandbox/sandbox";
import { buildUlimitArgs, DEFAULT_ULIMITS } from "../../src/sandbox/ulimits";

describe("DEFAULT_ULIMITS", () => {
  it("has expected values", () => {
    expect(DEFAULT_ULIMITS.cpu).toBe(30);
    expect(DEFAULT_ULIMITS.mem).toBe(512 * 1024 * 1024);
    expect(DEFAULT_ULIMITS.fileSize).toBe(100 * 1024 * 1024);
    expect(DEFAULT_ULIMITS.openFiles).toBe(256);
    expect(DEFAULT_ULIMITS.procs).toBe(64);
  });
});

describe("buildUlimitArgs", () => {
  it("generates valid shell flags", () => {
    const args = buildUlimitArgs(DEFAULT_ULIMITS);
    expect(args).toHaveLength(5);
    expect(args[0]).toBe("ulimit -t 30");
    expect(args.some((a) => a.startsWith("ulimit -n"))).toBe(true);
    expect(args.some((a) => a.startsWith("ulimit -u"))).toBe(true);
  });
});

describe("createSandboxConfig", () => {
  it("default config is level 0", () => {
    const config = createSandboxConfig();
    expect(config.level).toBe(0);
    expect(config.network.isolated).toBe(false);
  });

  it("level 1 includes network isolation", () => {
    const config = createSandboxConfig(1);
    expect(config.level).toBe(1);
    expect(config.network.isolated).toBe(true);
  });

  it("explicit level is respected", () => {
    const config = createSandboxConfig(2);
    expect(config.level).toBe(2);
    expect(config.network.isolated).toBe(true);
    expect(config.filesystem.denied?.length).toBeGreaterThan(0);
  });
});

describe("wrapCommand", () => {
  it("wraps command in subshell with ulimits", () => {
    const config = createSandboxConfig(0);
    const wrapped = wrapCommand("ls -la", config);
    expect(wrapped).toContain("ulimit -t");
    expect(wrapped).toContain("exec sh -c 'ls -la'");
    expect(wrapped.startsWith("(")).toBe(true);
    expect(wrapped.endsWith(")")).toBe(true);
  });

  it("escapes single quotes in command to prevent injection", () => {
    const config = createSandboxConfig(0);
    const wrapped = wrapCommand("echo 'hello'", config);
    expect(wrapped).toContain("echo '\\''hello'\\''");
  });
});
