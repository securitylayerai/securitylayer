export interface RulePackMetadata {
  name: string;
  version: string;
  description: string;
  type: "rule-pack";
  ruleCount: number;
}

export interface SessionTemplate {
  description: string;
  default_taint: string;
  capabilities: string[];
}

export interface ChannelTemplate {
  description: string;
  max_capabilities: string[] | "ALL";
}

export interface SkillTemplate {
  description: string;
  capabilities: string[];
}

export interface SessionsConfig {
  version: number;
  sessions: Record<string, SessionTemplate>;
}

export interface ChannelsConfig {
  version: number;
  channels: Record<string, ChannelTemplate>;
}

export interface SkillsConfig {
  version: number;
  skills: Record<string, SkillTemplate>;
}
