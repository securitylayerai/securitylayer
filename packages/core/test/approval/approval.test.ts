import { beforeEach, describe, expect, it } from "vitest";
import { type ApprovalManager, createApprovalManager } from "@/approval/manager";
import { eventBus } from "@/events/bus";

describe("ApprovalManager", () => {
  let manager: ApprovalManager;

  beforeEach(() => {
    manager = createApprovalManager();
    eventBus.clear();
  });

  it("creates request with auto-generated ID", () => {
    manager.request({
      action: "exec",
      context: { session: "s1" },
      blockedBy: "rule-1",
      reason: "Destructive operation",
    });
    const pending = manager.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toMatch(/^[0-9a-f]{8}-/);
  });

  it("resolves request as approved", async () => {
    const promise = manager.request({
      action: "exec",
      context: {},
      blockedBy: "rule-1",
      reason: "test",
    });

    const pending = manager.getPending();
    manager.resolve(pending[0].id, "approved");

    const result = await promise;
    expect(result.outcome).toBe("approved");
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it("resolves request as denied", async () => {
    const promise = manager.request({
      action: "exec",
      context: {},
      blockedBy: "rule-1",
      reason: "test",
    });

    const pending = manager.getPending();
    manager.resolve(pending[0].id, "denied");

    const result = await promise;
    expect(result.outcome).toBe("denied");
    expect(result.approvedAt).toBeUndefined();
  });

  it("times out after expiry", async () => {
    const promise = manager.request(
      {
        action: "exec",
        context: {},
        blockedBy: "rule-1",
        reason: "test",
      },
      50, // 50ms timeout
    );

    const result = await promise;
    expect(result.outcome).toBe("timeout");
  });

  it("getPending returns unresolved requests", () => {
    manager.request({ action: "a", context: {}, blockedBy: "r1", reason: "test1" });
    manager.request({ action: "b", context: {}, blockedBy: "r2", reason: "test2" });
    expect(manager.getPending()).toHaveLength(2);
  });

  it("resolved request removed from pending", async () => {
    const promise = manager.request({
      action: "exec",
      context: {},
      blockedBy: "rule-1",
      reason: "test",
    });

    const pending = manager.getPending();
    expect(pending).toHaveLength(1);

    manager.resolve(pending[0].id, "approved");
    await promise;

    expect(manager.getPending()).toHaveLength(0);
  });
});
