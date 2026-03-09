import {
  buildCapabilityStore,
  createEventBus,
  createNoOpJudge,
  createTaintTracker,
  type LoadedConfig,
  type PipelineDeps,
} from "@securitylayerai/core";

export function makeTestConfig(overrides?: Partial<LoadedConfig>): LoadedConfig {
  return {
    main: {
      version: 1,
      log_level: "info",
      proxy: { port: 18790, upstream_port: 18789 },
      semantic: {
        enabled: false,
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        api_key_env: "ANTHROPIC_API_KEY",
        timeout_ms: 500,
        base_url: null,
      },
      ...overrides?.main,
    },
    sessions: {
      version: 1,
      sessions: {
        test: {
          capabilities: [
            "exec",
            "file.read",
            "file.write",
            "channel.send",
            "web_fetch",
            "browser",
            "memory.read.trusted",
            "memory.write",
          ],
          default_taint: "owner",
        },
      },
      ...overrides?.sessions,
    },
    channels: {
      version: 1,
      channels: {},
      ...overrides?.channels,
    },
    skills: {
      version: 1,
      skills: {},
      ...overrides?.skills,
    },
    learnedRules: {
      version: 1,
      rules: [],
      ...overrides?.learnedRules,
    },
  };
}

export function makeTestDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  const bus = overrides?.eventBus ?? createEventBus();
  const config = makeTestConfig();

  return {
    capabilityStore: overrides?.capabilityStore ?? buildCapabilityStore(config),
    taintTracker: overrides?.taintTracker ?? createTaintTracker(bus),
    judge: overrides?.judge ?? createNoOpJudge(),
    eventBus: bus,
    sessionHistory: overrides?.sessionHistory ?? [],
    ...overrides,
  };
}
