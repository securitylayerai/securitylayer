import { buildCapabilityStore } from "@/capabilities/loader";
import type { LoadedConfig } from "@/config/types";
import { createDefaultLLMJudge, createNoOpJudge } from "@/semantic/judge";
import { createTaintTracker } from "@/taint/tracker";
import type { PipelineDeps } from "./types";

export function createPipeline(config: LoadedConfig): PipelineDeps {
  const capabilityStore = buildCapabilityStore(config);
  const taintTracker = createTaintTracker();
  const judge = config.main.semantic.enabled
    ? createDefaultLLMJudge(config.main.semantic)
    : createNoOpJudge();

  return {
    capabilityStore,
    taintTracker,
    judge,
    extraRules: [],
    learnedRules: config.learnedRules,
  };
}
