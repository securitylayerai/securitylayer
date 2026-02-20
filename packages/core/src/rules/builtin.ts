import type { Rule } from "./types";

/** Hardcoded structural rules for dangerous patterns. */
export const BUILTIN_RULES: Rule[] = [
  // Destructive operations
  {
    id: "destructive-rm-rf-root",
    description: "Prevent recursive deletion of root filesystem",
    match: {
      type: "pattern",
      value:
        /\brm\s+.*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/\s*$|rm\s+.*-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+\/\s*$|\brm\s+-rf\s+\/\b/,
    },
    decision: "DENY",
    reason: "Recursive deletion of root filesystem",
  },
  {
    id: "destructive-mkfs",
    description: "Prevent filesystem formatting",
    match: { type: "binary", value: "mkfs" },
    decision: "DENY",
    reason: "Filesystem formatting operation",
  },
  {
    id: "destructive-dd-device",
    description: "Prevent raw device writes",
    match: { type: "pattern", value: /\bdd\b.*\bof=\/dev\// },
    decision: "DENY",
    reason: "Raw device write via dd",
  },
  {
    id: "destructive-fork-bomb",
    description: "Prevent fork bomb patterns",
    match: { type: "pattern", value: /:\(\)\{.*\|.*\}|:\s*\(\)\s*\{[^}]*\|\s*:/ },
    decision: "DENY",
    reason: "Fork bomb pattern detected",
  },

  // Credential paths
  {
    id: "cred-ssh-private-key",
    description: "Prevent reading SSH private keys",
    match: { type: "path", value: "~/.ssh/id_" },
    decision: "DENY",
    reason: "Access to SSH private key",
  },
  {
    id: "cred-aws-credentials",
    description: "Prevent reading AWS credentials",
    match: { type: "path", value: "~/.aws/credentials" },
    decision: "DENY",
    reason: "Access to AWS credentials file",
  },
  {
    id: "cred-dotenv",
    description: "Prevent reading .env files",
    match: { type: "pattern", value: /\b(cat|less|more|head|tail|bat)\s+.*\.env\b/ },
    decision: "DENY",
    reason: "Access to .env file (likely contains secrets)",
  },

  // Exfiltration structures
  {
    id: "exfil-pipe-to-curl",
    description: "Prevent piping data to curl",
    match: { type: "pipe", value: "curl" },
    decision: "DENY",
    reason: "Data piped to curl (potential exfiltration)",
  },

  // RCE structures
  {
    id: "rce-curl-pipe-sh",
    description: "Prevent curl | sh patterns",
    match: { type: "pattern", value: /\bcurl\b.*\|\s*(ba)?sh\b/ },
    decision: "DENY",
    reason: "Remote code execution via curl | sh",
  },
  {
    id: "rce-wget-pipe-sh",
    description: "Prevent wget | bash patterns",
    match: { type: "pattern", value: /\bwget\b.*\|\s*(ba)?sh\b/ },
    decision: "DENY",
    reason: "Remote code execution via wget | bash",
  },
];
