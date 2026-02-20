import {
  detectApiKeys,
  detectCredentialPatterns,
  detectHighEntropy,
  detectPemBlocks,
  detectPII,
} from "./patterns.js";
import type { EgressScanResult } from "./types.js";

/**
 * Scans content for secrets, credentials, PII, and high-entropy strings.
 * Aggregates findings from all detectors.
 */
export function scanEgress(content: string): EgressScanResult {
  const findings = [
    ...detectApiKeys(content),
    ...detectPemBlocks(content),
    ...detectHighEntropy(content),
    ...detectPII(content),
    ...detectCredentialPatterns(content),
  ];

  return {
    clean: findings.length === 0,
    findings,
  };
}
