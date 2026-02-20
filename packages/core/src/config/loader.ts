import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { ZodType, ZodTypeDef } from "zod";
import {
  defaultChannelsConfig,
  defaultLearnedRulesConfig,
  defaultMainConfig,
  defaultSessionsConfig,
  defaultSkillsConfig,
} from "./defaults.js";
import { CONFIG_PATHS } from "./paths.js";
import {
  type ChannelsConfig,
  ChannelsConfigSchema,
  type LearnedRulesConfig,
  LearnedRulesConfigSchema,
  type LoadedConfig,
  type SecurityLayerConfig,
  SecurityLayerConfigSchema,
  type SessionsConfig,
  SessionsConfigSchema,
  type SkillsConfig,
  SkillsConfigSchema,
  SUPPORTED_VERSIONS,
} from "./types.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ConfigVersionError extends Error {
  constructor(
    public readonly file: string,
    public readonly version: unknown,
  ) {
    super(`Unsupported config version ${JSON.stringify(version)} in ${file}`);
    this.name = "ConfigVersionError";
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: unknown,
  ) {
    super(`Config validation failed for ${file}: ${JSON.stringify(issues)}`);
    this.name = "ConfigValidationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateVersion(raw: unknown, file: string, key: string): void {
  if (typeof raw !== "object" || raw === null || !("version" in raw)) {
    throw new ConfigValidationError(file, "Missing required field: version");
  }
  const version = (raw as Record<string, unknown>).version;
  const supported = SUPPORTED_VERSIONS[key];
  if (!supported || !supported.includes(version as number)) {
    throw new ConfigVersionError(file, version);
  }
}

async function loadAndParse<T>(
  filePath: string,
  key: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  fallback: () => T,
): Promise<T> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return fallback();
  }

  const raw = filePath.endsWith(".json") ? JSON.parse(content) : parseYaml(content);
  validateVersion(raw, filePath, key);

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ConfigValidationError(filePath, result.error.issues);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadConfig(paths = CONFIG_PATHS): Promise<LoadedConfig> {
  const [main, sessions, channels, skills, learnedRules] = await Promise.all([
    loadAndParse<SecurityLayerConfig>(
      paths.main,
      "main",
      SecurityLayerConfigSchema,
      defaultMainConfig,
    ),
    loadAndParse<SessionsConfig>(
      paths.sessions,
      "sessions",
      SessionsConfigSchema,
      defaultSessionsConfig,
    ),
    loadAndParse<ChannelsConfig>(
      paths.channels,
      "channels",
      ChannelsConfigSchema,
      defaultChannelsConfig,
    ),
    loadAndParse<SkillsConfig>(paths.skills, "skills", SkillsConfigSchema, defaultSkillsConfig),
    loadAndParse<LearnedRulesConfig>(
      paths.learnedRules,
      "learnedRules",
      LearnedRulesConfigSchema,
      defaultLearnedRulesConfig,
    ),
  ]);

  return { main, sessions, channels, skills, learnedRules };
}
