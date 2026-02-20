import { eventBus } from "@/events/bus";
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
 * Aggregates findings from all detectors and emits events for each finding.
 */
export function scanEgress(content: string): EgressScanResult {
  const findings = [
    ...detectApiKeys(content),
    ...detectPemBlocks(content),
    ...detectHighEntropy(content),
    ...detectPII(content),
    ...detectCredentialPatterns(content),
  ];

  for (const finding of findings) {
    eventBus.emit({
      type: "egress.secret_detected",
      patternName: finding.type,
      channel: "egress_scan",
      redacted: true,
    });
  }

  return {
    clean: findings.length === 0,
    findings,
  };
}
