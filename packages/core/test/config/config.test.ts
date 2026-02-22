import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as yamlStringify } from "yaml";
import {
  defaultChannelsConfig,
  defaultLearnedRulesConfig,
  defaultMainConfig,
  defaultSessionsConfig,
  defaultSkillsConfig,
} from "@/config/defaults";
import { ConfigValidationError, ConfigVersionError, loadConfig } from "@/config/loader";
import {
  CapabilityStringSchema,
  ChannelsConfigSchema,
  LearnedRulesConfigSchema,
  SecurityLayerConfigSchema,
  SemanticConfigSchema,
  SemanticProviderSchema,
  SessionsConfigSchema,
  SkillsConfigSchema,
} from "@/config/types";

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("config schemas", () => {
  it("parses a valid main config", () => {
    const result = SecurityLayerConfigSchema.safeParse({
      version: 1,
      log_level: "debug",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for optional fields", () => {
    const result = SecurityLayerConfigSchema.parse({ version: 1 });
    expect(result.log_level).toBe("info");
    expect(result.proxy.port).toBe(18790);
    expect(result.semantic.enabled).toBe(false);
    expect(result.semantic.provider).toBe("anthropic");
    expect(result.semantic.api_key_env).toBe("ANTHROPIC_API_KEY");
    expect(result.semantic.base_url).toBeNull();
  });

  it("parses valid sessions config", () => {
    const result = SessionsConfigSchema.safeParse({
      version: 1,
      sessions: {
        "claude-code": {
          capabilities: ["exec", "file.read", "file.write"],
          default_taint: "owner",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("parses valid channels config with ALL", () => {
    const result = ChannelsConfigSchema.safeParse({
      version: 1,
      channels: {
        local: { max_capabilities: "ALL" },
        slack: { max_capabilities: ["channel.send"] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("parses valid skills config", () => {
    const result = SkillsConfigSchema.safeParse({
      version: 1,
      skills: {
        "code-review": { capabilities: ["file.read", "channel.send"] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("parses valid learned rules config", () => {
    const result = LearnedRulesConfigSchema.safeParse({
      version: 1,
      rules: [
        {
          pattern: "git status",
          capability: "exec",
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid field types", () => {
    const result = SecurityLayerConfigSchema.safeParse({
      version: 1,
      log_level: "verbose", // invalid enum
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Semantic config schema
// ---------------------------------------------------------------------------

describe("SemanticConfigSchema", () => {
  it("accepts all valid providers", () => {
    for (const provider of ["anthropic", "openai", "google", "xai", "openai-compatible"]) {
      const result = SemanticProviderSchema.safeParse(provider);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid provider", () => {
    const result = SemanticProviderSchema.safeParse("deepseek");
    expect(result.success).toBe(false);
  });

  it("accepts full semantic config with all fields", () => {
    const result = SemanticConfigSchema.safeParse({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key_env: "OPENAI_API_KEY",
      timeout_ms: 1000,
      base_url: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts openai-compatible with base_url", () => {
    const result = SemanticConfigSchema.safeParse({
      enabled: true,
      provider: "openai-compatible",
      model: "deepseek-chat",
      api_key_env: "DEEPSEEK_API_KEY",
      timeout_ms: 500,
      base_url: "https://api.deepseek.com/v1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base_url).toBe("https://api.deepseek.com/v1");
    }
  });

  it("defaults base_url to null", () => {
    const result = SemanticConfigSchema.parse({});
    expect(result.base_url).toBeNull();
  });

  it("parses semantic config within main config", () => {
    const result = SecurityLayerConfigSchema.parse({
      version: 1,
      semantic: {
        enabled: true,
        provider: "google",
        model: "gemini-2.0-flash",
        api_key_env: "GOOGLE_GENERATIVE_AI_API_KEY",
      },
    });
    expect(result.semantic.provider).toBe("google");
    expect(result.semantic.model).toBe("gemini-2.0-flash");
    expect(result.semantic.api_key_env).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
  });
});

// ---------------------------------------------------------------------------
// Capability string validation
// ---------------------------------------------------------------------------

describe("CapabilityStringSchema", () => {
  it("accepts bare capability", () => {
    expect(CapabilityStringSchema.safeParse("exec").success).toBe(true);
  });

  it("accepts dotted capability", () => {
    expect(CapabilityStringSchema.safeParse("file.read").success).toBe(true);
  });

  it("accepts taint-qualified capability", () => {
    expect(CapabilityStringSchema.safeParse("exec:trusted").success).toBe(true);
  });

  it("accepts deep dotted with taint", () => {
    expect(CapabilityStringSchema.safeParse("channel.send.external:owner").success).toBe(true);
  });

  it("rejects uppercase", () => {
    expect(CapabilityStringSchema.safeParse("Exec").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(CapabilityStringSchema.safeParse("").success).toBe(false);
  });

  it("rejects double colon", () => {
    expect(CapabilityStringSchema.safeParse("exec:trusted:extra").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default generators
// ---------------------------------------------------------------------------

describe("default config generators", () => {
  it("defaultMainConfig is schema-valid", () => {
    const result = SecurityLayerConfigSchema.safeParse(defaultMainConfig());
    expect(result.success).toBe(true);
  });

  it("defaultSessionsConfig is schema-valid", () => {
    const result = SessionsConfigSchema.safeParse(defaultSessionsConfig());
    expect(result.success).toBe(true);
  });

  it("defaultChannelsConfig is schema-valid", () => {
    const result = ChannelsConfigSchema.safeParse(defaultChannelsConfig());
    expect(result.success).toBe(true);
  });

  it("defaultSkillsConfig is schema-valid", () => {
    const result = SkillsConfigSchema.safeParse(defaultSkillsConfig());
    expect(result.success).toBe(true);
  });

  it("defaultLearnedRulesConfig is schema-valid", () => {
    const result = LearnedRulesConfigSchema.safeParse(defaultLearnedRulesConfig());
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  let tempDir: string;
  let paths: {
    main: string;
    sessions: string;
    channels: string;
    skills: string;
    learnedRules: string;
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sl-config-test-"));
    await mkdir(join(tempDir, "capabilities"), { recursive: true });
    paths = {
      main: join(tempDir, "config.yaml"),
      sessions: join(tempDir, "capabilities", "sessions.yaml"),
      channels: join(tempDir, "capabilities", "channels.yaml"),
      skills: join(tempDir, "capabilities", "skills.yaml"),
      learnedRules: join(tempDir, "learned-rules.json"),
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when files do not exist", async () => {
    const config = await loadConfig(paths);
    expect(config.main.version).toBe(1);
    expect(config.main.log_level).toBe("info");
    expect(config.sessions.sessions).toEqual({});
    expect(config.channels.channels).toEqual({});
    expect(config.skills.skills).toEqual({});
    expect(config.learnedRules.rules).toEqual([]);
  });

  it("parses valid YAML files", async () => {
    await writeFile(paths.main, yamlStringify({ version: 1, log_level: "debug" }));
    await writeFile(
      paths.sessions,
      yamlStringify({
        version: 1,
        sessions: {
          test: { capabilities: ["exec", "file.read"], default_taint: "owner" },
        },
      }),
    );
    await writeFile(paths.channels, yamlStringify({ version: 1, channels: {} }));
    await writeFile(paths.skills, yamlStringify({ version: 1, skills: {} }));
    await writeFile(paths.learnedRules, JSON.stringify({ version: 1, rules: [] }));

    const config = await loadConfig(paths);
    expect(config.main.log_level).toBe("debug");
    expect(config.sessions.sessions.test.capabilities).toEqual(["exec", "file.read"]);
  });

  it("throws ConfigVersionError for unsupported version", async () => {
    await writeFile(paths.main, yamlStringify({ version: 99 }));
    await expect(loadConfig(paths)).rejects.toThrow(ConfigVersionError);
  });

  it("throws ConfigValidationError for missing version", async () => {
    await writeFile(paths.main, yamlStringify({ log_level: "info" }));
    await expect(loadConfig(paths)).rejects.toThrow(ConfigValidationError);
  });

  it("throws ConfigValidationError for invalid field types", async () => {
    await writeFile(paths.main, yamlStringify({ version: 1, log_level: "verbose" }));
    await expect(loadConfig(paths)).rejects.toThrow(ConfigValidationError);
  });
});
