export type { CapabilityStore, ExecutionContext } from "./gate.js";
export { checkCapability } from "./gate.js";
export { buildCapabilityStore } from "./loader.js";
export { CapabilitySet, parseCapabilityString } from "./set.js";
export type { BaseCapability, CapabilityResult, ParsedCapability } from "./types.js";
export { actionToCapability, BASE_CAPABILITIES, isBaseCapability } from "./types.js";
