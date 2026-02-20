import { hashSHA256 } from "../utils/crypto.js";

/** Computes a SHA-256 hash of skill content for integrity verification. */
export function computeSkillHash(content: string): string {
  return hashSHA256(content);
}

/** Verifies skill integrity by comparing expected and actual hashes. */
export function verifySkillIntegrity(expectedHash: string, actualContent: string): boolean {
  return computeSkillHash(actualContent) === expectedHash;
}
