import type { TaintLevel } from "../taint/index.js";
import { hashSHA256 } from "../utils/crypto.js";
import type { MemoryEntry } from "./types.js";

/**
 * Tags content with provenance metadata and a SHA-256 integrity hash.
 */
export function tagProvenance(
  content: string,
  source: TaintLevel,
  meta?: { channel?: string; sender?: string; sessionId?: string },
): MemoryEntry {
  return {
    content,
    provenance: {
      source,
      channel: meta?.channel,
      sender: meta?.sender,
      sessionId: meta?.sessionId,
      timestamp: new Date().toISOString(),
      hash: hashSHA256(content),
    },
  };
}
