/**
 * Splits a command string on `;`, `&&`, `||` while respecting quoting.
 * Returns the individual command strings.
 */
export function splitCommandChain(cmd: string): string[] {
  const commands: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (inSingle || inDouble) {
      current += ch;
      continue;
    }

    // Check for &&
    if (ch === "&" && cmd[i + 1] === "&") {
      if (current.trim()) commands.push(current.trim());
      current = "";
      i++; // skip second &
      continue;
    }

    // Check for ||
    if (ch === "|" && cmd[i + 1] === "|") {
      if (current.trim()) commands.push(current.trim());
      current = "";
      i++; // skip second |
      continue;
    }

    // Check for ;
    if (ch === ";") {
      if (current.trim()) commands.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) commands.push(current.trim());
  return commands;
}

/**
 * Extracts pipe stages from a command string.
 * Respects quoting so that `echo "a|b"` is not split.
 */
export function parsePipeChain(cmd: string): string[] {
  const stages: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (inSingle || inDouble) {
      current += ch;
      continue;
    }

    // Single pipe (not ||)
    if (ch === "|" && cmd[i + 1] !== "|") {
      if (current.trim()) stages.push(current.trim());
      current = "";
      continue;
    }

    // Skip || (chain operator, not pipe) — advance past both chars
    if (ch === "|" && cmd[i + 1] === "|") {
      current += "||";
      i++; // skip second |
      continue;
    }

    current += ch;
  }

  if (current.trim()) stages.push(current.trim());
  return stages;
}

/**
 * Detects if a command uses indirection techniques:
 * eval, $(), backticks, or process substitution.
 */
export function detectIndirection(cmd: string): boolean {
  // Check for eval
  if (/\beval\b/.test(cmd)) return true;
  // Check for command substitution $()
  if (/\$\(/.test(cmd)) return true;
  // Check for backtick substitution
  if (/`/.test(cmd)) return true;
  // Check for process substitution <() or >()
  if (/[<>]\(/.test(cmd)) return true;
  return false;
}
