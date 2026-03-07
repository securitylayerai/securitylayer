import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { ChannelsConfig, RulePackMetadata, SessionsConfig, SkillsConfig } from "./types";

export type {
  ChannelsConfig,
  ChannelTemplate,
  RulePackMetadata,
  SessionsConfig,
  SessionTemplate,
  SkillsConfig,
  SkillTemplate,
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");

async function readYaml<T>(relativePath: string): Promise<T> {
  const filePath = resolve(PACKAGE_ROOT, relativePath);
  const content = await readFile(filePath, "utf-8");
  return parseYaml(content) as T;
}

export function getPackMetadata(): RulePackMetadata {
  return {
    name: "@securitylayerai/rules",
    version: "0.0.1",
    description: "Baseline security rules and capability templates for SecurityLayer",
    type: "rule-pack",
    ruleCount: 13,
  };
}

export async function loadBaselineRules(): Promise<string> {
  const filePath = resolve(PACKAGE_ROOT, "rules/baseline.yaml");
  return readFile(filePath, "utf-8");
}

export async function loadSessionTemplates(): Promise<SessionsConfig> {
  return readYaml<SessionsConfig>("capabilities/sessions.yaml");
}

export async function loadChannelDefaults(): Promise<ChannelsConfig> {
  return readYaml<ChannelsConfig>("capabilities/channels.yaml");
}

export async function loadSkillDefaults(): Promise<SkillsConfig> {
  return readYaml<SkillsConfig>("capabilities/skills-defaults.yaml");
}
