import { afterEach, describe, expect, it } from "vitest";
import { detectCaller } from "@/caller-detect";

describe("Caller Detection", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it("returns explicit SECURITYLAYER_CALLER when set", async () => {
    process.env.SECURITYLAYER_CALLER = "cursor";
    const result = await detectCaller();
    expect(result).toBe("cursor");
  });

  it("ignores invalid SECURITYLAYER_CALLER values", async () => {
    process.env.SECURITYLAYER_CALLER = "not-a-real-caller";
    delete process.env.CLAUDE_CODE_SESSION;
    delete process.env.CURSOR_SESSION_ID;
    delete process.env.AIDER_SESSION;
    const result = await detectCaller();
    // Should fall through to other detection methods
    expect(["claude-code", "cursor", "aider", "copilot", "unknown"]).toContain(result);
  });

  it("detects claude-code from CLAUDE_CODE_SESSION", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    process.env.CLAUDE_CODE_SESSION = "test-session";
    const result = await detectCaller();
    expect(result).toBe("claude-code");
  });

  it("detects cursor from CURSOR_SESSION_ID", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    delete process.env.CLAUDE_CODE_SESSION;
    process.env.CURSOR_SESSION_ID = "test-session";
    const result = await detectCaller();
    expect(result).toBe("cursor");
  });

  it("detects aider from AIDER_SESSION", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    delete process.env.CLAUDE_CODE_SESSION;
    delete process.env.CURSOR_SESSION_ID;
    process.env.AIDER_SESSION = "test-session";
    const result = await detectCaller();
    expect(result).toBe("aider");
  });

  it("returns a valid CallerName", async () => {
    const result = await detectCaller();
    expect(["claude-code", "cursor", "aider", "copilot", "unknown"]).toContain(result);
  });

  it("prioritizes explicit env over heuristics", async () => {
    process.env.SECURITYLAYER_CALLER = "aider";
    process.env.CLAUDE_CODE_SESSION = "test-session"; // Would normally detect claude-code
    const result = await detectCaller();
    expect(result).toBe("aider");
  });
});
