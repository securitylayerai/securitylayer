import { randomUUID } from "node:crypto";
import { type EventBus, eventBus as singletonBus } from "@/events/bus";
import type { ApprovalOutcome, ApprovalRequest, ApprovalResult } from "./types";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Manages approval requests with in-memory store.
 * Supports request creation, resolution, and timeout.
 */
export class ApprovalManager {
  private pending = new Map<
    string,
    { request: ApprovalRequest; resolve: (result: ApprovalResult) => void }
  >();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private bus: EventBus;

  constructor(bus?: EventBus) {
    this.bus = bus ?? singletonBus;
  }

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
      this.pending.set(id, { request: req, resolve: resolvePromise });

      // Set timeout
      const timer = setTimeout(() => {
        this.resolveInternal(id, "timeout");
      }, timeoutMs);
      this.timers.set(id, timer);

      this.bus.emit({
        type: "approval.requested",
        requestId: id,
        action: req.action,
        reason: req.reason,
      });
    });
  }

  /** Resolve a pending approval request. */
  resolve(id: string, outcome: ApprovalOutcome): void {
    this.resolveInternal(id, outcome);
  }

  private resolveInternal(id: string, outcome: ApprovalOutcome): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    // Clear timeout
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.pending.delete(id);

    const result: ApprovalResult = {
      outcome,
      approvedAt: outcome === "approved" ? new Date() : undefined,
    };

    this.bus.emit({
      type: "approval.resolved",
      requestId: id,
      outcome,
    });

    entry.resolve(result);
  }

  /** Returns all unresolved approval requests. */
  getPending(): ApprovalRequest[] {
    return [...this.pending.values()].map((e) => e.request);
  }
}
