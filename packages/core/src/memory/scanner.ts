import type { TaintLevel } from "../taint/index";
import { tagProvenance } from "./provenance";
import type { MemoryEntry } from "./types";

interface RawEntry {
  content: string;
  source?: TaintLevel;
  channel?: string;
  sender?: string;
  sessionId?: string;
}

/**
 * Scans raw memory entries and assigns provenance to each.
 * Unknown source defaults to "memory" taint level.
 */
export function scanMemoryEntries(entries: unknown[]): MemoryEntry[] {
  return entries
    .filter((e): e is RawEntry => typeof e === "object" && e !== null && "content" in e)
    .map((raw) => {
      const source = raw.source ?? ("memory" as TaintLevel);
      return tagProvenance(raw.content, source, {
        channel: raw.channel,
        sender: raw.sender,
        sessionId: raw.sessionId,
      });
    });
}
