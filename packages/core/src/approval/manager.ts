import { randomUUID } from "node:crypto";
import { type EventBus, eventBus as singletonBus } from "@/events/bus";
import type { ApprovalOutcome, ApprovalRequest, ApprovalResult } from "./types";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates an approval manager with in-memory store.
 * Supports request creation, resolution, and timeout.
 */
export function createApprovalManager(bus?: EventBus) {
  const pending = new Map<
    string,
    { request: ApprovalRequest; resolve: (result: ApprovalResult) => void }
  >();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const activeBus = bus ?? singletonBus;

  function resolveInternal(id: string, outcome: ApprovalOutcome): void {
    const entry = pending.get(id);
    if (!entry) return;

    // Clear timeout
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }

    pending.delete(id);

    const result: ApprovalResult = {
      outcome,
      approvedAt: outcome === "approved" ? new Date() : undefined,
    };

    activeBus.emit({
      type: "approval.resolved",
      requestId: id,
      outcome,
    });

    entry.resolve(result);
  }

  return {
    /**
     * Create an approval request and wait for resolution.
     * Returns a promise that resolves when approved, denied, or timed out.
     */
    request(
      params: Omit<ApprovalRequest, "id" | "expiresAt">,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    ): Promise<ApprovalResult> {
      const id = randomUUID();
      const expiresAt = new Date(Date.now() + timeoutMs);

      const req: ApprovalRequest = { ...params, id, expiresAt };

      return new Promise<ApprovalResult>((resolvePromise) => {
        pending.set(id, { request: req, resolve: resolvePromise });

        // Set timeout
        const timer = setTimeout(() => {
          resolveInternal(id, "timeout");
        }, timeoutMs);
        timers.set(id, timer);

        activeBus.emit({
          type: "approval.requested",
          requestId: id,
          action: req.action,
          reason: req.reason,
        });
      });
    },

    /** Resolve a pending approval request. */
    resolve(id: string, outcome: ApprovalOutcome): void {
      resolveInternal(id, outcome);
    },

    /** Returns all unresolved approval requests. */
    getPending(): ApprovalRequest[] {
      return [...pending.values()].map((e) => e.request);
    },
  };
}

export type ApprovalManager = ReturnType<typeof createApprovalManager>;
