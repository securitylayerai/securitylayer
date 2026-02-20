import { shannonEntropy } from "./entropy";
import type { EgressFinding } from "./types";

/** Known API key prefixes and their patterns. */
const API_KEY_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "anthropic", regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "openai", regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: "aws_access_key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "github_token", regex: /ghp_[A-Za-z0-9]{36}/g },
  { name: "github_oauth", regex: /gho_[A-Za-z0-9]{36}/g },
  { name: "slack_token", regex: /xoxb-[0-9]{10,}-[A-Za-z0-9-]+/g },
  { name: "slack_user", regex: /xoxp-[0-9]{10,}-[A-Za-z0-9-]+/g },
  { name: "stripe_live", regex: /sk_live_[A-Za-z0-9]{20,}/g },
  { name: "stripe_test", regex: /sk_test_[A-Za-z0-9]{20,}/g },
];

/** Detects known API key patterns. */
export function detectApiKeys(content: string): EgressFinding[] {
  const findings: EgressFinding[] = [];
  for (const { regex } of API_KEY_PATTERNS) {
    const globalRegex = new RegExp(regex.source, "g");
    for (const match of content.matchAll(globalRegex)) {
      findings.push({
        type: "api_key",
        confidence: 0.95,
        location: { start: match.index, end: match.index + match[0].length },
        redacted: `${match[0].slice(0, 8)}${"*".repeat(match[0].length - 8)}`,
      });
    }
  }
  return findings;
}

/** Detects PEM private key blocks. */
export function detectPemBlocks(content: string): EgressFinding[] {
  const findings: EgressFinding[] = [];
  const regex =
    /-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----/g;
  for (const match of content.matchAll(regex)) {
    findings.push({
      type: "pem_block",
      confidence: 0.99,
      location: { start: match.index, end: match.index + match[0].length },
      redacted: "-----BEGIN PRIVATE KEY-----[REDACTED]-----END PRIVATE KEY-----",
    });
  }
  return findings;
}

/** Detects high-entropy strings (potential secrets). */
export function detectHighEntropy(content: string): EgressFinding[] {
  const findings: EgressFinding[] = [];
  const tokens = content.split(/\s+/);
  let offset = 0;
  for (const token of tokens) {
    const idx = content.indexOf(token, offset);
    if (token.length > 20 && shannonEntropy(token) > 4.5) {
      if (!token.startsWith("http") && !token.startsWith("/") && !token.includes("..")) {
        findings.push({
          type: "high_entropy",
          confidence: 0.7,
          location: { start: idx, end: idx + token.length },
          redacted: `${token.slice(0, 4)}${"*".repeat(token.length - 4)}`,
        });
      }
    }
    offset = idx + token.length;
  }
  return findings;
}

/** Detects PII patterns (SSN, credit card). */
export function detectPII(content: string): EgressFinding[] {
  const findings: EgressFinding[] = [];

  // SSN pattern: XXX-XX-XXXX
  for (const match of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    findings.push({
      type: "pii",
      confidence: 0.85,
      location: { start: match.index, end: match.index + match[0].length },
      redacted: "***-**-****",
    });
  }

  // Credit card: 13-19 digit sequences (with optional dashes/spaces)
  for (const match of content.matchAll(/\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,7})\b/g)) {
    const digits = match[0].replace(/[-\s]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      findings.push({
        type: "pii",
        confidence: 0.9,
        location: { start: match.index, end: match.index + match[0].length },
        redacted: `****-****-****-${digits.slice(-4)}`,
      });
    }
  }

  return findings;
}

/** Luhn algorithm for credit card validation. */
function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number.parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/** Detects credential-like patterns (password=, Authorization:). */
export function detectCredentialPatterns(content: string): EgressFinding[] {
  const findings: EgressFinding[] = [];

  const patterns: RegExp[] = [
    /\b(password|passwd|pwd)\s*[=:]\s*\S+/gi,
    /\bAuthorization:\s*Bearer\s+\S+/gi,
    /\b(api[_-]?key|apikey)\s*[=:]\s*\S+/gi,
    /\b(secret[_-]?key|secret)\s*[=:]\s*\S+/gi,
    /\b(access[_-]?token)\s*[=:]\s*\S+/gi,
  ];

  for (const regex of patterns) {
    for (const match of content.matchAll(new RegExp(regex.source, "gi"))) {
      findings.push({
        type: "credential_pattern",
        confidence: 0.8,
        location: { start: match.index, end: match.index + match[0].length },
        redacted: match[0].replace(/[=:]\s*\S+/, "=[REDACTED]"),
      });
    }
  }

  return findings;
}
