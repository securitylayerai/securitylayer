export { resolveActualBinary } from "./binary-resolver.js";
export { detectIndirection, parsePipeChain, splitCommandChain } from "./command-parser.js";
export { decodeAllLayers } from "./decoder.js";
export { normalizeExecAction } from "./normalizer.js";
export { extractPaths, resolveCanonicalPath } from "./path-resolver.js";
export type { NormalizedExec } from "./types.js";
