import type { TaintLevel } from "../taint/index.js";

export interface ApprovalRequest {
  id: string;
  action: string;
  context: {
    session?: string;
    channel?: string;
    sender?: string;
    taint?: TaintLevel;
  };
  blockedBy: string;
  reason: string;
  expiresAt: Date;
}

export type ApprovalOutcome = "approved" | "denied" | "timeout";

export interface ApprovalResult {
  outcome: ApprovalOutcome;
  approvedAt?: Date;
}
