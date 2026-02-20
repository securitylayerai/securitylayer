import { createHash } from "node:crypto";

/** Returns the hex-encoded SHA-256 hash of the given content. */
export function hashSHA256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
