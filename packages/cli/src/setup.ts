import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CliArgs } from "@/index";

// ---------------------------------------------------------------------------
// Claude Code hooks setup
// ---------------------------------------------------------------------------

const CLAUDE_DIR = join(homedir(), ".claude");
const HOOKS_PATH = join(CLAUDE_DIR, "hooks.json");

const PRE_TOOL_USE_TOOLS = ["Bash", "Write", "Edit", "WebFetch", "NotebookEdit"];
const POST_TOOL_USE_TOOLS = ["Bash", "Read", "WebFetch"];

function buildHookCommand(toolName: string, isPost: boolean): string {
  if (isPost) {
    return `securitylayer hook claude-code --tool ${toolName} --post --output "$TOOL_OUTPUT"`;
  }
  return `securitylayer hook claude-code --tool ${toolName} --input "$TOOL_INPUT"`;
}

export async function runSetupClaudeCode(_args: CliArgs): Promise<void> {
  // Check for Claude Code directory
  if (!existsSync(CLAUDE_DIR)) {
    console.log("Claude Code directory not found (~/.claude/).");
    console.log("Install Claude Code first, then re-run this command.");
    return;
  }

  // Load existing hooks
  let existingHooks: Record<string, unknown> = {};
  try {
    const content = await readFile(HOOKS_PATH, "utf-8");
    existingHooks = JSON.parse(content);
  } catch {
    // No existing hooks file
  }

  // Build Security Layer hooks
  const hooks = existingHooks as Record<string, Array<Record<string, unknown>>>;

  // Ensure hook arrays exist
  if (!Array.isArray(hooks.PreToolUse)) hooks.PreToolUse = [];
  if (!Array.isArray(hooks.PostToolUse)) hooks.PostToolUse = [];

  // Remove existing Security Layer hooks (for idempotent setup)
  hooks.PreToolUse = hooks.PreToolUse.filter(
    (h) => !(typeof h.command === "string" && h.command.includes("securitylayer hook")),
  );
  hooks.PostToolUse = hooks.PostToolUse.filter(
    (h) => !(typeof h.command === "string" && h.command.includes("securitylayer hook")),
  );

  // Add PreToolUse hooks
  for (const tool of PRE_TOOL_USE_TOOLS) {
    hooks.PreToolUse.push({
      matcher: tool,
      command: buildHookCommand(tool, false),
    });
  }

  // Add PostToolUse hooks
  for (const tool of POST_TOOL_USE_TOOLS) {
    hooks.PostToolUse.push({
      matcher: tool,
      command: buildHookCommand(tool, true),
    });
  }

  await writeFile(HOOKS_PATH, JSON.stringify(hooks, null, 2), "utf-8");

  console.log("Claude Code hooks installed.");
  console.log(`Hooks file: ${HOOKS_PATH}`);
  console.log(
    `\nPreToolUse hooks (${PRE_TOOL_USE_TOOLS.length}): ${PRE_TOOL_USE_TOOLS.join(", ")}`,
  );
  console.log(
    `PostToolUse hooks (${POST_TOOL_USE_TOOLS.length}): ${POST_TOOL_USE_TOOLS.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
// Cursor setup
// ---------------------------------------------------------------------------

export async function runSetupCursor(_args: CliArgs): Promise<void> {
  console.log("Cursor Integration Setup");
  console.log("─".repeat(40));
  console.log();
  console.log("Cursor doesn't support native hooks yet.");
  console.log("Use Security Layer Shield for universal protection:");
  console.log();
  console.log("  securitylayer shield enable");
  console.log();
  console.log("This intercepts all shell commands Cursor executes,");
  console.log("providing the same protection as native hooks.");
  console.log();
  console.log("A dedicated Cursor/VS Code extension is planned for v1.");
}
