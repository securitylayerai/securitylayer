import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  CapabilityStringSchema,
  CONFIG_DIR,
  CONFIG_PATHS,
  createPipeline,
  type LoadedConfig,
  loadConfig,
  type PipelineDeps,
  TaintLevelSchema,
} from "@securitylayer/core";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config existence checks
// ---------------------------------------------------------------------------

export function configExists(): boolean {
  return existsSync(CONFIG_PATHS.main);
}

export async function ensureConfigDir(): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(CONFIG_DIR, "capabilities"), { recursive: true });
  await mkdir(join(CONFIG_DIR, "taint"), { recursive: true });
  await mkdir(join(CONFIG_DIR, "bin"), { recursive: true });
}

// ---------------------------------------------------------------------------
// Config loading with user-friendly error
// ---------------------------------------------------------------------------

export async function loadConfigOrSuggestInit(): Promise<LoadedConfig> {
  if (!configExists()) {
    console.error("Security Layer is not configured. Run `securitylayer init` to get started.");
    process.exit(1);
  }
  return loadConfig();
}

export async function createPipelineFromConfig(): Promise<{
  config: LoadedConfig;
  pipeline: PipelineDeps;
}> {
  const config = await loadConfigOrSuggestInit();
  const pipeline = createPipeline(config);
  return { config, pipeline };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const COLORS = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
} as const;

export function formatDecision(d: string): string {
  switch (d) {
    case "ALLOW":
      return `${COLORS.green}ALLOW${COLORS.reset}`;
    case "DENY":
      return `${COLORS.red}DENY${COLORS.reset}`;
    case "REQUIRE_APPROVAL":
      return `${COLORS.yellow}REQUIRE_APPROVAL${COLORS.reset}`;
    default:
      return d;
  }
}

export function formatTaintLevel(t: string): string {
  switch (t) {
    case "owner":
      return `${COLORS.green}OWNER${COLORS.reset}`;
    case "trusted":
      return `${COLORS.blue}TRUSTED${COLORS.reset}`;
    case "untrusted":
      return `${COLORS.yellow}UNTRUSTED${COLORS.reset}`;
    case "web":
      return `${COLORS.magenta}WEB_CONTENT${COLORS.reset}`;
    case "skill":
      return `${COLORS.cyan}SKILL_GENERATED${COLORS.reset}`;
    case "memory":
      return `${COLORS.red}MEMORY_REPLAY${COLORS.reset}`;
    default:
      return t;
  }
}

// ---------------------------------------------------------------------------
// Binary resolution (skip shim dir in PATH)
// ---------------------------------------------------------------------------

export async function resolveRealBinary(name: string): Promise<string | null> {
  const shimDir = join(CONFIG_DIR, "bin");
  const pathDirs = (process.env.PATH ?? "").split(":");

  for (const dir of pathDirs) {
    if (dir === shimDir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Project taint
// ---------------------------------------------------------------------------

export function getProjectTaint(
  cwd: string,
  projectsConfig: z.infer<typeof ProjectsConfigSchema>,
): string {
  const home = homedir();
  const normalizedCwd = resolve(cwd);

  for (const rule of projectsConfig.trust_rules) {
    const pattern = rule.path.replace(/^~/, home);
    const normalizedPattern = resolve(pattern.replace(/\/\*\*$/, ""));

    if (normalizedCwd === normalizedPattern || normalizedCwd.startsWith(`${normalizedPattern}/`)) {
      return rule.taint;
    }
  }
  return projectsConfig.default;
}

// ---------------------------------------------------------------------------
// Shell detection
// ---------------------------------------------------------------------------

export function detectShell(): string {
  return process.env.SHELL?.split("/").pop() ?? "bash";
}

export function getShellProfilePath(shell: string): string {
  const home = homedir();
  switch (shell) {
    case "zsh":
      return join(home, ".zshrc");
    case "fish":
      return join(home, ".config", "fish", "config.fish");
    default:
      return join(home, ".bashrc");
  }
}

// ---------------------------------------------------------------------------
// CLI-owned config schemas
// ---------------------------------------------------------------------------

export const CallerProfileSchema = z.object({
  name: z.string(),
  display_name: z.string(),
  capabilities: z.array(CapabilityStringSchema).default([]),
  default_taint: TaintLevelSchema.default("untrusted"),
  detection: z
    .object({
      env_vars: z.array(z.string()).default([]),
      process_names: z.array(z.string()).default([]),
    })
    .default({}),
});

export const CallersConfigSchema = z.object({
  version: z.literal(1),
  callers: z.record(z.string(), CallerProfileSchema),
});

export type CallersConfig = z.infer<typeof CallersConfigSchema>;

const TrustRuleSchema = z.object({
  path: z.string(),
  taint: TaintLevelSchema,
});

export const ProjectsConfigSchema = z.object({
  version: z.literal(1),
  trust_rules: z.array(TrustRuleSchema).default([]),
  default: TaintLevelSchema.default("untrusted"),
});

export type ProjectsConfig = z.infer<typeof ProjectsConfigSchema>;

// ---------------------------------------------------------------------------
// Config file paths for CLI-owned configs
// ---------------------------------------------------------------------------

export const CLI_CONFIG_PATHS = {
  callers: join(CONFIG_DIR, "capabilities", "ai-tools.yaml"),
  projects: join(CONFIG_DIR, "taint", "projects.yaml"),
} as const;

// ---------------------------------------------------------------------------
// Load CLI-owned configs
// ---------------------------------------------------------------------------

export async function loadCallersConfig(): Promise<CallersConfig> {
  const { readFile } = await import("node:fs/promises");
  const { parse: parseYaml } = await import("yaml");

  try {
    const content = await readFile(CLI_CONFIG_PATHS.callers, "utf-8");
    const raw = parseYaml(content);
    return CallersConfigSchema.parse(raw);
  } catch {
    return defaultCallersConfig();
  }
}

export async function loadProjectsConfig(): Promise<ProjectsConfig> {
  const { readFile } = await import("node:fs/promises");
  const { parse: parseYaml } = await import("yaml");

  try {
    const content = await readFile(CLI_CONFIG_PATHS.projects, "utf-8");
    const raw = parseYaml(content);
    return ProjectsConfigSchema.parse(raw);
  } catch {
    return defaultProjectsConfig();
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function defaultCallersConfig(): CallersConfig {
  return {
    version: 1,
    callers: {
      "claude-code": {
        name: "claude-code",
        display_name: "Claude Code",
        capabilities: ["exec", "file.read", "file.write", "web_fetch"],
        default_taint: "trusted",
        detection: {
          env_vars: ["CLAUDE_CODE_SESSION"],
          process_names: ["claude"],
        },
      },
      cursor: {
        name: "cursor",
        display_name: "Cursor",
        capabilities: ["exec", "file.read", "file.write", "web_fetch"],
        default_taint: "trusted",
        detection: {
          env_vars: ["CURSOR_SESSION_ID"],
          process_names: ["cursor"],
        },
      },
      aider: {
        name: "aider",
        display_name: "Aider",
        capabilities: ["exec", "file.read", "file.write"],
        default_taint: "untrusted",
        detection: {
          env_vars: ["AIDER_SESSION"],
          process_names: ["aider"],
        },
      },
      copilot: {
        name: "copilot",
        display_name: "GitHub Copilot",
        capabilities: ["file.read", "file.write"],
        default_taint: "untrusted",
        detection: {
          env_vars: [],
          process_names: ["copilot"],
        },
      },
    },
  };
}

export function defaultProjectsConfig(): ProjectsConfig {
  return {
    version: 1,
    trust_rules: [
      { path: "~/Dev/Personal/**", taint: "owner" },
      { path: "~/Dev/Work/**", taint: "trusted" },
      { path: "/tmp/**", taint: "web" },
      { path: "~/Downloads/**", taint: "web" },
    ],
    default: "untrusted",
  };
}
