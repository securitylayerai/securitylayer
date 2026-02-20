import { resolveActualBinary } from "./binary-resolver";
import { detectIndirection, parsePipeChain, splitCommandChain } from "./command-parser";
import { decodeAllLayers } from "./decoder";
import { extractPaths } from "./path-resolver";
import type { NormalizedExec } from "./types";

/**
 * Normalizes a raw command string into a structured representation.
 * Orchestrates chain splitting, pipe parsing, path resolution,
 * binary resolution, encoding detection, and indirection detection.
 */
export function normalizeExecAction(command: string): NormalizedExec {
  // Decode any obfuscation layers first
  const decoded = decodeAllLayers(command);

  // Split chained commands
  const chainedCommands = splitCommandChain(decoded);

  // Parse pipe chain from the first command
  const pipeStages = parsePipeChain(chainedCommands[0] ?? decoded);
  const pipeDestinations = pipeStages.length > 1 ? pipeStages.slice(1) : [];

  // Extract the binary and args from the first pipe stage
  const firstStage = pipeStages[0] ?? decoded;
  const parts = firstStage.trim().split(/\s+/);
  const rawBinary = parts[0] ?? "";
  const binary = resolveActualBinary(rawBinary);
  const args = parts.slice(1);

  // Extract file paths
  const paths = extractPaths(decoded);

  // Detect indirection
  const usesIndirection = detectIndirection(decoded);

  return {
    binary,
    args,
    paths,
    chainedCommands,
    pipeDestinations,
    usesIndirection,
    decodedCommand: decoded,
    raw: command,
  };
}
