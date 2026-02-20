export interface EgressFinding {
  type: "api_key" | "pem_block" | "high_entropy" | "pii" | "credential_pattern";
  confidence: number;
  location: { start: number; end: number };
  redacted: string;
}

export interface EgressScanResult {
  clean: boolean;
  findings: EgressFinding[];
}
