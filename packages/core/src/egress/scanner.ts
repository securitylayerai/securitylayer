import {
  detectApiKeys,
  detectCredentialPatterns,
  detectHighEntropy,
  detectPemBlocks,
  detectPII,
} from "./patterns";
import type { EgressScanResult } from "./types";

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
