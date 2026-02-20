import { hashSHA256 } from "../utils/crypto";
import type { MemoryEntry } from "./types";

/** Verifies a memory entry's integrity by recomputing its hash. */
export function verifyIntegrity(entry: MemoryEntry): boolean {
  const computed = hashSHA256(entry.content);
  return computed === entry.provenance.hash;
}
