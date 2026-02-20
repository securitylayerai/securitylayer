import { z } from "zod";
import { TaintLevelSchema } from "../taint/index.js";

// ---------------------------------------------------------------------------
// Base event fields
// ---------------------------------------------------------------------------

const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sessionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Event variants
// ---------------------------------------------------------------------------

export const ActionEvaluatedEventSchema = BaseEventSchema.extend({
  type: z.literal("action.evaluated"),
  action: z.string(),
  allowed: z.boolean(),
  reason: z.string().optional(),
  taint: TaintLevelSchema.optional(),
});

export const TaintElevatedEventSchema = BaseEventSchema.extend({
  type: z.literal("taint.elevated"),
  previousLevel: TaintLevelSchema,
  newLevel: TaintLevelSchema,
  source: z.string(),
});

export const SkillIntegrityViolationEventSchema = BaseEventSchema.extend({
  type: z.literal("skill.integrity_violation"),
  skillId: z.string(),
  violation: z.string(),
});

export const EgressSecretDetectedEventSchema = BaseEventSchema.extend({
  type: z.literal("egress.secret_detected"),
  patternName: z.string(),
  channel: z.string(),
  redacted: z.boolean(),
});

export const TaintClearedEventSchema = BaseEventSchema.extend({
  type: z.literal("taint.cleared"),
  previousLevel: TaintLevelSchema,
});

export const ApprovalRequestedEventSchema = BaseEventSchema.extend({
  type: z.literal("approval.requested"),
  requestId: z.string(),
  action: z.string(),
  reason: z.string(),
});

export const ApprovalResolvedEventSchema = BaseEventSchema.extend({
  type: z.literal("approval.resolved"),
  requestId: z.string(),
  outcome: z.enum(["approved", "denied", "timeout"]),
});

export const RuleTriggeredEventSchema = BaseEventSchema.extend({
  type: z.literal("rule.triggered"),
  ruleId: z.string(),
  action: z.string(),
  decision: z.string(),
});

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export const SecurityEventSchema = z.discriminatedUnion("type", [
  ActionEvaluatedEventSchema,
  TaintElevatedEventSchema,
  SkillIntegrityViolationEventSchema,
  EgressSecretDetectedEventSchema,
  TaintClearedEventSchema,
  ApprovalRequestedEventSchema,
  ApprovalResolvedEventSchema,
  RuleTriggeredEventSchema,
]);

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

// ---------------------------------------------------------------------------
// Per-type event types (for typed handlers)
// ---------------------------------------------------------------------------

export type ActionEvaluatedEvent = z.infer<typeof ActionEvaluatedEventSchema>;
export type TaintElevatedEvent = z.infer<typeof TaintElevatedEventSchema>;
export type SkillIntegrityViolationEvent = z.infer<typeof SkillIntegrityViolationEventSchema>;
export type EgressSecretDetectedEvent = z.infer<typeof EgressSecretDetectedEventSchema>;
export type TaintClearedEvent = z.infer<typeof TaintClearedEventSchema>;
export type ApprovalRequestedEvent = z.infer<typeof ApprovalRequestedEventSchema>;
export type ApprovalResolvedEvent = z.infer<typeof ApprovalResolvedEventSchema>;
export type RuleTriggeredEvent = z.infer<typeof RuleTriggeredEventSchema>;

// ---------------------------------------------------------------------------
// Type-safe handler map
// ---------------------------------------------------------------------------

export interface SecurityEventMap {
  "action.evaluated": ActionEvaluatedEvent;
  "taint.elevated": TaintElevatedEvent;
  "skill.integrity_violation": SkillIntegrityViolationEvent;
  "egress.secret_detected": EgressSecretDetectedEvent;
  "taint.cleared": TaintClearedEvent;
  "approval.requested": ApprovalRequestedEvent;
  "approval.resolved": ApprovalResolvedEvent;
  "rule.triggered": RuleTriggeredEvent;
}

export type SecurityEventType = keyof SecurityEventMap;
