import { buildCapabilityStore } from "@/capabilities/loader";
import type { LoadedConfig } from "@/config/types";
import { DefaultLLMJudge, NoOpJudge } from "@/semantic/judge";
import { SessionTaintTracker } from "@/taint/tracker";
import type { PipelineDeps } from "./types";

export function createPipeline(config: LoadedConfig): PipelineDeps {
  const capabilityStore = buildCapabilityStore(config);
  const taintTracker = new SessionTaintTracker();
  const judge = config.main.semantic.enabled
    ? new DefaultLLMJudge(
        process.env.ANTHROPIC_API_KEY,
        config.main.semantic.model,
        config.main.semantic.timeout_ms,
      )
    : new NoOpJudge();

  return {
    capabilityStore,
    taintTracker,
    judge,
    extraRules: [],
    learnedRules: config.learnedRules,
  };
}
