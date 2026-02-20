export type { CapabilityStore, ExecutionContext } from "./gate";
export { checkCapability } from "./gate";
export { buildCapabilityStore } from "./loader";
export {
  type CapabilitySet,
  createCapabilitySet,
  intersectCapabilities,
  parseCapabilityString,
} from "./set";
export type { BaseCapability, CapabilityResult, ParsedCapability } from "./types";
export { actionToCapability, BASE_CAPABILITIES, isBaseCapability } from "./types";
