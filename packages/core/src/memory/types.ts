import type { TaintLevel } from "../taint/index.js";

export interface MemoryProvenance {
  source: TaintLevel;
  channel?: string;
  sender?: string;
  timestamp: string;
  sessionId?: string;
  hash: string;
}

export interface MemoryEntry {
  content: string;
  provenance: MemoryProvenance;
}
