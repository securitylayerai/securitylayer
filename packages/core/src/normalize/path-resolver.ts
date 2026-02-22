import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Expands `~`, `$HOME`, common env vars, resolves `..`, and returns an absolute path.
 */
export function resolveCanonicalPath(p: string): string {
  let expanded = p;

  // Expand ~ at the start
  if (expanded.startsWith("~/") || expanded === "~") {
    expanded = expanded.replace(/^~/, homedir());
  }

  // Expand $HOME
  expanded = expanded.replace(/\$HOME/g, homedir());

  // Expand other common env vars
  expanded = expanded.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_match, name) => {
    return process.env[name] ?? `$${name}`;
  });

  return resolve(expanded);
}

/**
 * Extracts file paths from command arguments.
 * Looks for arguments that look like file paths (contain `/` or start with `.` or `~`).
 */
export function extractPaths(cmd: string): string[] {
  const paths: string[] = [];

  // Tokenize respecting quotes
  const tokens = tokenize(cmd);

  // Capture binary path itself if absolute
  const firstToken = tokens[0];
  if (firstToken?.includes("/")) {
    paths.push(resolveCanonicalPath(firstToken));
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Skip flags
    if (token.startsWith("-")) continue;
    // Skip binary (first token) — already handled above
    if (i === 0) continue;

    if (
      token.includes("/") ||
      token.startsWith(".") ||
      token.startsWith("~") ||
      token.startsWith("$HOME")
    ) {
      paths.push(resolveCanonicalPath(token));
    }
  }

  return paths;
}

function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const ch of cmd) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === " " && !inSingle && !inDouble) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}
