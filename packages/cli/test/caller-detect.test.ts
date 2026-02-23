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

  it("accepts 'claude-code' as SECURITYLAYER_CALLER", async () => {
    process.env.SECURITYLAYER_CALLER = "claude-code";
    const result = await detectCaller();
    expect(result).toBe("claude-code");
  });

  it("accepts 'aider' as SECURITYLAYER_CALLER", async () => {
    process.env.SECURITYLAYER_CALLER = "aider";
    const result = await detectCaller();
    expect(result).toBe("aider");
  });

  it("accepts 'copilot' as SECURITYLAYER_CALLER", async () => {
    process.env.SECURITYLAYER_CALLER = "copilot";
    const result = await detectCaller();
    expect(result).toBe("copilot");
  });

  it("accepts 'unknown' as a valid SECURITYLAYER_CALLER value", async () => {
    process.env.SECURITYLAYER_CALLER = "unknown";
    const result = await detectCaller();
    expect(result).toBe("unknown");
  });

  it("falls through when SECURITYLAYER_CALLER is empty string", async () => {
    process.env.SECURITYLAYER_CALLER = "";
    delete process.env.CLAUDE_CODE_SESSION;
    delete process.env.CURSOR_SESSION_ID;
    delete process.env.AIDER_SESSION;
    const result = await detectCaller();
    // Empty string is falsy, so isValidCaller check is skipped, falls through to other detection
    expect(["claude-code", "cursor", "aider", "copilot", "unknown"]).toContain(result);
  });

  it("returns a valid result when all env vars are cleared", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    delete process.env.CLAUDE_CODE_SESSION;
    delete process.env.CURSOR_SESSION_ID;
    delete process.env.AIDER_SESSION;
    const result = await detectCaller();
    // With no env hints, falls through to process-based detection or returns unknown
    expect(["claude-code", "cursor", "aider", "copilot", "unknown"]).toContain(result);
  });

  it("env heuristics priority: CLAUDE_CODE_SESSION wins over CURSOR_SESSION_ID", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    process.env.CLAUDE_CODE_SESSION = "session-1";
    process.env.CURSOR_SESSION_ID = "session-2";
    process.env.AIDER_SESSION = "session-3";
    const result = await detectCaller();
    expect(result).toBe("claude-code");
  });

  it("env heuristics priority: CURSOR_SESSION_ID wins over AIDER_SESSION", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    delete process.env.CLAUDE_CODE_SESSION;
    process.env.CURSOR_SESSION_ID = "session-2";
    process.env.AIDER_SESSION = "session-3";
    const result = await detectCaller();
    expect(result).toBe("cursor");
  });

  it("env heuristics priority: AIDER_SESSION is last in heuristic chain", async () => {
    delete process.env.SECURITYLAYER_CALLER;
    delete process.env.CLAUDE_CODE_SESSION;
    delete process.env.CURSOR_SESSION_ID;
    process.env.AIDER_SESSION = "session-3";
    const result = await detectCaller();
    expect(result).toBe("aider");
  });
});
