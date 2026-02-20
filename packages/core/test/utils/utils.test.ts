import { describe, expect, it } from "vitest";
import { hashSHA256 } from "@/utils/crypto";
import { createLogger } from "@/utils/logger";

describe("hashSHA256", () => {
  it("returns consistent hex string", () => {
    const hash = hashSHA256("hello world");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSHA256("hello world")).toBe(hash);
  });

  it("detects changes (different input → different hash)", () => {
    const a = hashSHA256("content-a");
    const b = hashSHA256("content-b");
    expect(a).not.toBe(b);
  });
});

describe("createLogger", () => {
  it("creates without error and has expected methods", () => {
    const logger = createLogger("test");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });
});
