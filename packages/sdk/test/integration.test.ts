import { describe, expect, it } from "vitest";
import { createEventBus } from "@securitylayerai/core";
import { createSecurityLayer } from "@/client";
import { SecurityLayerError } from "@/errors";
import { withSecurityLayer } from "@/middleware";
import { makeTestConfig } from "./helpers";

describe("integration", () => {
  it("full flow: create → check → ingest → check with elevated taint", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    // Initial check at owner taint
    const r1 = await sl.check("exec", { command: "echo hello" });
    expect(r1.decision).toBe("ALLOW");
    expect(sl.getSessionTaint()).toBe("owner");

    // Ingest web content — taint escalates
    sl.ingestContent("web data", { source: "web", url: "https://example.com" });
    expect(sl.getSessionTaint()).toBe("web");

    // Check again — exec at web taint may still be allowed if no taint restriction
    const r2 = await sl.check("exec", { command: "echo test" });
    expect(r2.decision).toBeDefined();

    sl.destroy();
  });

  it("REQUIRE_APPROVAL → waitForApproval → timeout", async () => {
    const config = makeTestConfig({
      sessions: {
        version: 1,
        sessions: {
          test: {
            capabilities: ["cron.create"],
            default_taint: "owner",
          },
        },
      },
    });
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const result = await sl.check("cron.create", {});
    expect(result.decision).toBe("REQUIRE_APPROVAL");
    expect(result.approvalId).toBeDefined();

    // Wait with short timeout — should return false
    const approved = await sl.waitForApproval(result.approvalId!, { timeout: 50 });
    expect(approved).toBe(false);

    sl.destroy();
  });

  it("middleware with real SecurityLayer instance", async () => {
    const config = makeTestConfig();
    const sl = await createSecurityLayer({ config, sessionId: "test" });

    const executed: string[] = [];
    const runCommand = async (cmd: string) => {
      executed.push(cmd);
      return `output of: ${cmd}`;
    };

    const safeRun = withSecurityLayer(sl, runCommand, "exec");

    const output = await safeRun("echo hello");
    expect(output).toBe("output of: echo hello");
    expect(executed).toContain("echo hello");

    sl.destroy();
  });

  it("events are emitted across methods", async () => {
    const config = makeTestConfig();
    const bus = createEventBus();
    const sl = await createSecurityLayer({ config, sessionId: "test", eventBus: bus });

    const eventTypes: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bus.onAny((e: any) => eventTypes.push(e.type));

    // check emits action.evaluated
    await sl.check("exec", { command: "echo hello" });
    expect(eventTypes).toContain("action.evaluated");

    // ingest emits taint.elevated
    sl.ingestContent("web data", { source: "web" });
    expect(eventTypes).toContain("taint.elevated");

    sl.destroy();
  });
});
