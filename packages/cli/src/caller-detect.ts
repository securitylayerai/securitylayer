export type CallerName = "claude-code" | "cursor" | "aider" | "copilot" | "unknown";

const ENV_HEURISTICS: Array<{ env: string; caller: CallerName }> = [
  { env: "CLAUDE_CODE_SESSION", caller: "claude-code" },
  { env: "CURSOR_SESSION_ID", caller: "cursor" },
  { env: "AIDER_SESSION", caller: "aider" },
];

const PROCESS_PATTERNS: Array<{ pattern: string; caller: CallerName }> = [
  { pattern: "claude", caller: "claude-code" },
  { pattern: "cursor", caller: "cursor" },
  { pattern: "aider", caller: "aider" },
  { pattern: "copilot", caller: "copilot" },
];

async function getProcessName(pid: number): Promise<string | null> {
  try {
    const proc = Bun.spawn(["ps", "-o", "comm=", "-p", String(pid)], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    return text.trim() || null;
  } catch {
    return null;
  }
}

export async function detectCaller(): Promise<CallerName> {
  // 1. Explicit env var
  const explicit = process.env.SECURITYLAYER_CALLER;
  if (explicit && isValidCaller(explicit)) {
    return explicit as CallerName;
  }

  // 2. Env heuristics
  for (const { env, caller } of ENV_HEURISTICS) {
    if (process.env[env]) return caller;
  }

  // 3. Parent process name
  const ppid = process.ppid;
  if (ppid) {
    const parentName = await getProcessName(ppid);
    if (parentName) {
      const match = matchProcessName(parentName);
      if (match) return match;
    }

    // 4. Grandparent process walk
    try {
      const proc = Bun.spawn(["ps", "-o", "ppid=", "-p", String(ppid)], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const text = await new Response(proc.stdout).text();
      await proc.exited;
      const gpid = Number.parseInt(text.trim(), 10);
      if (gpid > 1) {
        const gpName = await getProcessName(gpid);
        if (gpName) {
          const gpMatch = matchProcessName(gpName);
          if (gpMatch) return gpMatch;
        }
      }
    } catch {
      // ignore
    }
  }

  return "unknown";
}

function matchProcessName(name: string): CallerName | null {
  const lower = name.toLowerCase();
  for (const { pattern, caller } of PROCESS_PATTERNS) {
    if (lower.includes(pattern)) return caller;
  }
  return null;
}

function isValidCaller(s: string): boolean {
  return ["claude-code", "cursor", "aider", "copilot", "unknown"].includes(s);
}
