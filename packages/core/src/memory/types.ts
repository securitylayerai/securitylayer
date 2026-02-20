import type { TaintLevel } from "@/taint/index";

export interface MemoryProvenance {
  source: TaintLevel;
  channel?: string;
  sender?: string;
  timestamp: number;
  sessionId?: string;
  hash: string;
}

export interface MemoryEntry {
  content: string;
  provenance: MemoryProvenance;
}
