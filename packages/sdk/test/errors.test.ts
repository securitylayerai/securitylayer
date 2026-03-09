import { describe, expect, it } from "vitest";
import {
  ApprovalTimeoutError,
  CheckError,
  ConfigError,
  InitializationError,
  SecurityLayerError,
} from "@/errors";

describe("SecurityLayerError", () => {
  it("has correct name and message", () => {
    const err = new SecurityLayerError("test message");
    expect(err.name).toBe("SecurityLayerError");
    expect(err.message).toBe("test message");
  });

  it("is instanceof Error", () => {
    const err = new SecurityLayerError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SecurityLayerError);
  });
});

describe("ConfigError", () => {
  it("has correct name and configPath", () => {
    const err = new ConfigError("bad config", "/path/to/config.yaml");
    expect(err.name).toBe("ConfigError");
    expect(err.message).toBe("bad config");
    expect(err.configPath).toBe("/path/to/config.yaml");
  });

  it("is instanceof SecurityLayerError", () => {
    const err = new ConfigError("bad");
    expect(err).toBeInstanceOf(SecurityLayerError);
    expect(err).toBeInstanceOf(Error);
  });

  it("configPath is optional", () => {
    const err = new ConfigError("missing");
    expect(err.configPath).toBeUndefined();
  });
});

describe("InitializationError", () => {
  it("has correct name and cause", () => {
    const cause = new Error("underlying");
    const err = new InitializationError("init failed", cause);
    expect(err.name).toBe("InitializationError");
    expect(err.cause).toBe(cause);
  });

  it("is instanceof SecurityLayerError", () => {
    const err = new InitializationError("fail");
    expect(err).toBeInstanceOf(SecurityLayerError);
  });
});

describe("CheckError", () => {
  it("has correct name and tool", () => {
    const err = new CheckError("check failed", "exec");
    expect(err.name).toBe("CheckError");
    expect(err.tool).toBe("exec");
  });

  it("is instanceof SecurityLayerError", () => {
    const err = new CheckError("fail");
    expect(err).toBeInstanceOf(SecurityLayerError);
    expect(err.tool).toBeUndefined();
  });
});

describe("ApprovalTimeoutError", () => {
  it("has correct name and approvalId", () => {
    const err = new ApprovalTimeoutError("req-123");
    expect(err.name).toBe("ApprovalTimeoutError");
    expect(err.approvalId).toBe("req-123");
    expect(err.message).toContain("req-123");
  });

  it("is instanceof SecurityLayerError", () => {
    const err = new ApprovalTimeoutError("req-456");
    expect(err).toBeInstanceOf(SecurityLayerError);
    expect(err).toBeInstanceOf(Error);
  });
});
