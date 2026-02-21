import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as toYaml } from "yaml";
import {
  CONFIG_DIR,
  BASE_CAPABILITIES,
  PROVIDER_DEFAULTS,
  type SemanticProvider,
} from "@securitylayer/core";
import * as p from "@clack/prompts";
import type { CliArgs } from "@/index";
import {
  configExists,
  ensureConfigDir,
  defaultCallersConfig,
  defaultProjectsConfig,
  CLI_CONFIG_PATHS,
  detectShell,
} from "@/shared";

export async function runInit(args: CliArgs): Promise<void> {
  p.intro("SecurityLayer — Setup");

  if (configExists()) {
    const overwrite = await p.confirm({
      message: "SecurityLayer is already configured. Overwrite?",
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.outro("Setup cancelled.");
      return;
    }
  }

  // Session name
  const sessionName = await p.text({
    message: "Session name for your primary AI agent:",
    placeholder: "claude-code",
    defaultValue: "claude-code",
    validate: (v: string | undefined) => {
      if (!v || !v.trim()) return "Session name is required";
      if (!/^[a-z0-9-]+$/.test(v)) return "Lowercase alphanumeric and hyphens only";
    },
  });
  if (p.isCancel(sessionName)) return;

  // Select capabilities
  const capOptions = BASE_CAPABILITIES.map((cap) => ({
    value: cap,
    label: cap,
    hint: getCapHint(cap),
  }));

  const selectedCaps = await p.multiselect({
    message: "Select capabilities to grant this session:",
    options: capOptions,
    initialValues: ["exec", "file.read", "file.write", "web_fetch"],
    required: true,
  });
  if (p.isCancel(selectedCaps)) return;

  // Default taint
  const defaultTaint = await p.select({
    message: "Default taint level for this session:",
    options: [
      { value: "owner", label: "OWNER — fully trusted" },
      { value: "trusted", label: "TRUSTED — trusted external" },
      { value: "untrusted", label: "UNTRUSTED — unknown source" },
    ],
  });
  if (p.isCancel(defaultTaint)) return;

  // Semantic judge
  const enableSemantic = await p.confirm({
    message: "Enable LLM semantic judge?",
    initialValue: false,
  });
  if (p.isCancel(enableSemantic)) return;

  let semanticProvider: SemanticProvider = "anthropic";
  let semanticModel = PROVIDER_DEFAULTS.anthropic.model;
  let semanticApiKeyEnv = PROVIDER_DEFAULTS.anthropic.apiKeyEnv;
  let semanticBaseUrl: string | null = null;

  if (enableSemantic) {
    const provider = await p.select({
      message: "Select LLM provider:",
      options: [
        { value: "anthropic", label: "Anthropic (Claude)" },
        { value: "openai", label: "OpenAI (GPT)" },
        { value: "google", label: "Google (Gemini)" },
        { value: "xai", label: "xAI (Grok)" },
        { value: "openai-compatible", label: "OpenAI-Compatible (DeepSeek, Kimi, etc.)" },
      ],
    });
    if (p.isCancel(provider)) return;
    semanticProvider = provider as SemanticProvider;

    const defaults = PROVIDER_DEFAULTS[semanticProvider];

    const model = await p.text({
      message: "Model name:",
      placeholder: defaults.model,
      defaultValue: defaults.model,
    });
    if (p.isCancel(model)) return;
    semanticModel = model;

    const apiKeyEnv = await p.text({
      message: "Environment variable for API key:",
      placeholder: defaults.apiKeyEnv,
      defaultValue: defaults.apiKeyEnv,
      validate: (v: string | undefined) => {
        if (!v || !v.trim()) return "Environment variable name is required";
      },
    });
    if (p.isCancel(apiKeyEnv)) return;
    semanticApiKeyEnv = apiKeyEnv;

    if (semanticProvider === "openai-compatible") {
      const baseUrl = await p.text({
        message: "Base URL for the API:",
        placeholder: "https://api.deepseek.com/v1",
        validate: (v: string | undefined) => {
          if (!v || !v.trim()) return "Base URL is required for OpenAI-compatible providers";
        },
      });
      if (p.isCancel(baseUrl)) return;
      semanticBaseUrl = baseUrl;
    }
  }

  // Detect AI tools
  const detectedTools: string[] = [];
  if (process.env.CLAUDE_CODE_SESSION || existsDir(join(homeDir(), ".claude"))) {
    detectedTools.push("claude-code");
  }

  const spinner = p.spinner();
  spinner.start("Creating configuration...");

  await ensureConfigDir();

  // Write config.yaml
  const semanticConfig: Record<string, unknown> = {
    enabled: enableSemantic,
    provider: semanticProvider,
    model: semanticModel,
    api_key_env: semanticApiKeyEnv,
    timeout_ms: 500,
  };
  if (semanticBaseUrl) {
    semanticConfig.base_url = semanticBaseUrl;
  }
  const mainConfig = {
    version: 1,
    log_level: "info",
    proxy: { port: 18790, upstream_port: 18789 },
    semantic: semanticConfig,
  };
  await writeFile(
    join(CONFIG_DIR, "config.yaml"),
    toYaml(mainConfig),
    "utf-8",
  );

  // Write sessions.yaml
  const sessionsConfig = {
    version: 1,
    sessions: {
      [sessionName as string]: {
        capabilities: selectedCaps as string[],
        default_taint: defaultTaint as string,
      },
    },
  };
  await writeFile(
    join(CONFIG_DIR, "capabilities", "sessions.yaml"),
    toYaml(sessionsConfig),
    "utf-8",
  );

  // Write channels.yaml
  await writeFile(
    join(CONFIG_DIR, "capabilities", "channels.yaml"),
    toYaml({ version: 1, channels: {} }),
    "utf-8",
  );

  // Write skills.yaml
  await writeFile(
    join(CONFIG_DIR, "capabilities", "skills.yaml"),
    toYaml({ version: 1, skills: {} }),
    "utf-8",
  );

  // Write ai-tools.yaml
  await writeFile(
    CLI_CONFIG_PATHS.callers,
    toYaml(defaultCallersConfig()),
    "utf-8",
  );

  // Write projects.yaml
  await writeFile(
    CLI_CONFIG_PATHS.projects,
    toYaml(defaultProjectsConfig()),
    "utf-8",
  );

  // Write learned-rules.json
  await writeFile(
    join(CONFIG_DIR, "learned-rules.json"),
    JSON.stringify({ version: 1, rules: [] }, null, 2),
    "utf-8",
  );

  spinner.stop("Configuration created.");

  // Offer to setup detected AI tools
  if (detectedTools.includes("claude-code")) {
    const setupClaude = await p.confirm({
      message: "Claude Code detected. Install SecurityLayer hooks?",
      initialValue: true,
    });
    if (!p.isCancel(setupClaude) && setupClaude) {
      const { runSetupClaudeCode } = await import("@/setup");
      await runSetupClaudeCode(args);
    }
  }

  // Offer shield setup
  const enableShield = await p.confirm({
    message: "Enable shell shim protection (protects all AI tools)?",
    initialValue: false,
  });
  if (!p.isCancel(enableShield) && enableShield) {
    const { runShieldEnable } = await import("@/shield");
    await runShieldEnable(args);
  }

  p.outro("SecurityLayer is ready.");
}

function getCapHint(cap: string): string {
  const hints: Record<string, string> = {
    exec: "run shell commands",
    "exec.elevated": "run as root/sudo",
    "file.read": "read files",
    "file.write": "write/edit files",
    browser: "browse the web",
    "browser.login": "login to websites",
    "channel.send": "send messages",
    "channel.send.external": "send to external services",
    "cron.create": "create scheduled jobs",
    "skill.install": "install skills/plugins",
    "memory.read.all_zones": "read all memory zones",
    "memory.read.trusted": "read trusted memory",
    "memory.write": "write to memory",
    web_fetch: "fetch web content",
    "node.invoke": "invoke node/functions",
  };
  return hints[cap] ?? "";
}

function homeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "/";
}

function existsDir(p: string): boolean {
  try {
    const { statSync } = require("node:fs");
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
