import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "@securitylayerai/core";
import { createSecurityLayer } from "@/client";
import { SecurityLayerError } from "@/errors";
import { withSecurityLayer } from "@/middleware";
import { makeTestConfig } from "./helpers";

describe("withSecurityLayer", () => {
  it("calls fn when ALLOW", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn().mockReturnValue("result");
    const wrapped = withSecurityLayer(sl, fn, "exec");

    const result = await wrapped("echo hello");
    expect(fn).toHaveBeenCalledWith("echo hello");
    expect(result).toBe("result");
    sl.destroy();
  });

  it("throws SecurityLayerError on DENY", async () => {
    const config = makeTestConfig({
      sessions: {
        version: 1,
        sessions: {
          test: {
            capabilities: ["file.read"],
            default_taint: "owner",
          },
        },
      },
    });
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn();
    const wrapped = withSecurityLayer(sl, fn, "exec");

    await expect(wrapped("ls")).rejects.toThrow(SecurityLayerError);
    expect(fn).not.toHaveBeenCalled();
    sl.destroy();
  });

  it("uses custom extractParams", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn().mockReturnValue("ok");
    const wrapped = withSecurityLayer(sl, fn, "exec", {
      extractParams: (cmd: unknown) => ({ command: cmd }),
    });

    const result = await wrapped("echo custom");
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledWith("echo custom");
    sl.destroy();
  });

  it("passes through return value from fn", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn().mockResolvedValue({ data: 42 });
    const wrapped = withSecurityLayer(sl, fn, "file.read");

    const result = await wrapped({ path: "/tmp/file" });
    expect(result).toEqual({ data: 42 });
    sl.destroy();
  });

  it("passes through errors from fn", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn().mockRejectedValue(new Error("fn error"));
    const wrapped = withSecurityLayer(sl, fn, "exec");

    await expect(wrapped("echo test")).rejects.toThrow("fn error");
    sl.destroy();
  });

  it("extracts first object arg as params by default", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn().mockReturnValue("ok");
    const wrapped = withSecurityLayer(sl, fn, "file.read");

    const result = await wrapped({ path: "/tmp/file" });
    expect(result).toBe("ok");
    sl.destroy();
  });

  it("handles empty args gracefully", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const fn = vi.fn().mockReturnValue("ok");
    const wrapped = withSecurityLayer(sl, fn, "exec");

    // No args — should still work, extracting empty params
    const result = await (wrapped as Function)();
    expect(result).toBe("ok");
    sl.destroy();
  });
});
