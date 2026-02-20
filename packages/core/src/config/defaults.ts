import type {
  ChannelsConfig,
  LearnedRulesConfig,
  SecurityLayerConfig,
  SessionsConfig,
  SkillsConfig,
} from "./types";

export function defaultMainConfig(): SecurityLayerConfig {
  return {
    version: 1,
    log_level: "info",
    proxy: { port: 18790, upstream_port: 18789 },
    semantic: { enabled: false, model: "claude-haiku-4-5-20251001", timeout_ms: 500 },
  };
}

/**
 * Empty sessions config is fail-safe: unknown sessions are denied everything.
 * The `securitylayer init` CLI populates the first session on first run.
 */
export function defaultSessionsConfig(): SessionsConfig {
  return { version: 1, sessions: {} };
}

export function defaultChannelsConfig(): ChannelsConfig {
  return { version: 1, channels: {} };
}

export function defaultSkillsConfig(): SkillsConfig {
  return { version: 1, skills: {} };
}

export function defaultLearnedRulesConfig(): LearnedRulesConfig {
  return { version: 1, rules: [] };
}
