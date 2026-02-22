import type { LanguageModel } from "ai";
import type { SemanticConfig, SemanticProvider } from "@/config/types";

export const SUPPORTED_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "openai-compatible",
] as const satisfies readonly SemanticProvider[];

export const PROVIDER_DEFAULTS: Record<SemanticProvider, { model: string; apiKeyEnv: string }> = {
  anthropic: { model: "claude-haiku-4-5-20251001", apiKeyEnv: "ANTHROPIC_API_KEY" },
  openai: { model: "gpt-4o-mini", apiKeyEnv: "OPENAI_API_KEY" },
  google: { model: "gemini-2.0-flash", apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY" },
  xai: { model: "grok-2", apiKeyEnv: "XAI_API_KEY" },
  "openai-compatible": { model: "", apiKeyEnv: "" },
};

export function createModelFromConfig(config: SemanticConfig): LanguageModel {
  const apiKey = config.api_key_env ? process.env[config.api_key_env] : undefined;
  const model = config.model;

  switch (config.provider) {
    case "anthropic": {
      const { createAnthropic } =
        require("@ai-sdk/anthropic") as typeof import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey })(model);
    }
    case "openai": {
      const { createOpenAI } = require("@ai-sdk/openai") as typeof import("@ai-sdk/openai");
      return createOpenAI({ apiKey })(model);
    }
    case "google": {
      const { createGoogleGenerativeAI } =
        require("@ai-sdk/google") as typeof import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey })(model);
    }
    case "xai": {
      const { createXai } = require("@ai-sdk/xai") as typeof import("@ai-sdk/xai");
      return createXai({ apiKey })(model);
    }
    case "openai-compatible": {
      const { createOpenAI } = require("@ai-sdk/openai") as typeof import("@ai-sdk/openai");
      if (!config.base_url) {
        throw new Error("base_url is required for openai-compatible provider");
      }
      return createOpenAI({ apiKey, baseURL: config.base_url })(model);
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}
