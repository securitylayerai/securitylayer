import { describe, expect, it } from "vitest";
import { shannonEntropy } from "../../src/egress/entropy.js";
import {
  detectApiKeys,
  detectCredentialPatterns,
  detectHighEntropy,
  detectPemBlocks,
  detectPII,
} from "../../src/egress/patterns.js";
import { scanEgress } from "../../src/egress/scanner.js";

describe("detectApiKeys", () => {
  it("detects Anthropic key prefix", () => {
    const findings = detectApiKeys("key is sk-ant-abcdefghijklmnopqrstuvwxyz");
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("api_key");
  });

  it("detects AWS key prefix", () => {
    const findings = detectApiKeys("aws key AKIAIOSFODNN7EXAMPLE");
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("api_key");
  });

  it("detects GitHub token prefix", () => {
    const findings = detectApiKeys("token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij");
    expect(findings).toHaveLength(1);
  });

  it("detects Slack token prefix", () => {
    const findings = detectApiKeys("slack xoxb-1234567890-abcdefghijklmnop");
    expect(findings).toHaveLength(1);
  });
});

describe("detectPemBlocks", () => {
  it("detects PEM private key block", () => {
    const pem = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7
-----END PRIVATE KEY-----`;
    const findings = detectPemBlocks(pem);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("pem_block");
    expect(findings[0].confidence).toBe(0.99);
  });

  it("detects RSA private key block", () => {
    const pem = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2Z3qX2BTLS4e
-----END RSA PRIVATE KEY-----`;
    const findings = detectPemBlocks(pem);
    expect(findings).toHaveLength(1);
  });
});

describe("shannonEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(shannonEntropy("")).toBe(0);
  });

  it("returns 0 for single repeated character", () => {
    expect(shannonEntropy("aaaaaaa")).toBe(0);
  });

  it("returns high entropy for random-looking string", () => {
    expect(shannonEntropy("aB3$xK9!mZ2@qW5")).toBeGreaterThan(3.5);
  });
});

describe("detectHighEntropy", () => {
  it("detects high-entropy string >20 chars", () => {
    const secret = "aB3xK9mZ2qW5pR7tY0uI4oP6lJhGfDsAz";
    const findings = detectHighEntropy(`token: ${secret}`);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].type).toBe("high_entropy");
  });

  it("does NOT flag normal prose", () => {
    const prose = "The quick brown fox jumps over the lazy dog and runs away quickly.";
    const findings = detectHighEntropy(prose);
    expect(findings).toHaveLength(0);
  });
});

describe("detectPII", () => {
  it("detects SSN pattern", () => {
    const findings = detectPII("ssn: 123-45-6789");
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("pii");
  });

  it("detects Luhn-valid credit card number", () => {
    // 4532015112830366 is a valid Luhn number
    const findings = detectPII("card: 4532-0151-1283-0366");
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("pii");
  });
});

describe("detectCredentialPatterns", () => {
  it("detects password=secret123", () => {
    const findings = detectCredentialPatterns("config password=secret123 done");
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].type).toBe("credential_pattern");
  });

  it("detects Authorization: Bearer token", () => {
    const findings = detectCredentialPatterns("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9");
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe("scanEgress", () => {
  it("clean content returns clean result", () => {
    const result = scanEgress("Hello, this is normal text.");
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects multiple findings in one scan", () => {
    const content = `
      API key: sk-ant-abcdefghijklmnopqrstuvwxyz
      SSN: 123-45-6789
      password=hunter2
    `;
    const result = scanEgress(content);
    expect(result.clean).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
  });
});
