import { z } from "zod";
import { TaintLevelSchema } from "../taint/index.js";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const VersionedSchema = z.object({
  version: z.number().int().positive(),
});

/**
 * Capability string: `base_capability` or `base_capability:taint_level`.
 * Examples: `exec`, `exec:trusted`, `file.read`, `channel.send.external:owner`
 */
export const CapabilityStringSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_.]*(?::[a-z]+)?$/,
    "Capability must be lowercase dot-separated, optionally followed by :taint_level",
  );

// ---------------------------------------------------------------------------
// Main config  (~/.securitylayer/config.yaml)
// ---------------------------------------------------------------------------

export const SecurityLayerConfigSchema = VersionedSchema.extend({
  log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  proxy: z
    .object({
      port: z.number().int().positive().default(18790),
      upstream_port: z.number().int().positive().default(18789),
    })
    .default({}),
  semantic: z
    .object({
      enabled: z.boolean().default(false),
      model: z.string().default("claude-sonnet-4-5-20250929"),
      timeout_ms: z.number().int().positive().default(500),
    })
    .default({}),
});

export type SecurityLayerConfig = z.infer<typeof SecurityLayerConfigSchema>;

// ---------------------------------------------------------------------------
// Sessions  (~/.securitylayer/capabilities/sessions.yaml)
// ---------------------------------------------------------------------------

export const SessionsConfigSchema = VersionedSchema.extend({
  sessions: z.record(
    z.string(),
    z.object({
      capabilities: z.array(CapabilityStringSchema).default([]),
      default_taint: TaintLevelSchema.default("owner"),
    }),
  ),
});

export type SessionsConfig = z.infer<typeof SessionsConfigSchema>;

// ---------------------------------------------------------------------------
// Channels  (~/.securitylayer/capabilities/channels.yaml)
// ---------------------------------------------------------------------------

export const ChannelsConfigSchema = VersionedSchema.extend({
  channels: z.record(
    z.string(),
    z.object({
      max_capabilities: z.union([z.literal("ALL"), z.array(CapabilityStringSchema)]),
    }),
  ),
});

export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;

// ---------------------------------------------------------------------------
// Skills  (~/.securitylayer/capabilities/skills.yaml)
// ---------------------------------------------------------------------------

export const SkillsConfigSchema = VersionedSchema.extend({
  skills: z.record(
    z.string(),
    z.object({
      capabilities: z.array(CapabilityStringSchema).default([]),
    }),
  ),
});

export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;

// ---------------------------------------------------------------------------
// Learned rules  (~/.securitylayer/learned-rules.json)
// ---------------------------------------------------------------------------

export const LearnedRuleSchema = z.object({
  pattern: z.string(),
  capability: CapabilityStringSchema,
  created_at: z.string().datetime(),
  session_id: z.string().optional(),
});

export const LearnedRulesConfigSchema = VersionedSchema.extend({
  rules: z.array(LearnedRuleSchema).default([]),
});

export type LearnedRulesConfig = z.infer<typeof LearnedRulesConfigSchema>;

// ---------------------------------------------------------------------------
// Loaded config aggregate
// ---------------------------------------------------------------------------

export interface LoadedConfig {
  main: SecurityLayerConfig;
  sessions: SessionsConfig;
  channels: ChannelsConfig;
  skills: SkillsConfig;
  learnedRules: LearnedRulesConfig;
}

/** Supported schema versions per config file. */
export const SUPPORTED_VERSIONS: Record<string, number[]> = {
  main: [1],
  sessions: [1],
  channels: [1],
  skills: [1],
  learnedRules: [1],
};
