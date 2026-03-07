import {
  createPipeline,
  type ExecutionContext,
  evaluateAction,
  loadConfig,
  type TaintLevel,
} from "@securitylayerai/core";
import type { CliArgs } from "@/index";
import { getProjectTaint, loadProjectsConfig } from "@/shared";

// ---------------------------------------------------------------------------
// Tool → capability mapping for Claude Code tools
// ---------------------------------------------------------------------------

const TOOL_CAPABILITY_MAP: Record<string, string> = {
  Bash: "exec",
  Write: "file.write",
  Edit: "file.write",
  NotebookEdit: "file.write",
  Read: "file.read",
  WebFetch: "web_fetch",
  Glob: "file.read",
  Grep: "file.read",
};

// ---------------------------------------------------------------------------
// Input parsing helpers
// ---------------------------------------------------------------------------

function parseToolInput(
  toolName: string,
  inputJson: string,
): { command?: string; path?: string; url?: string } {
  try {
    const input = JSON.parse(inputJson);
    switch (toolName) {
      case "Bash":
        return { command: input.command ?? input.cmd ?? "" };
      case "Write":
      case "Edit":
      case "NotebookEdit":
      case "Read":
      case "Glob":
      case "Grep":
        return { path: input.file_path ?? input.path ?? input.pattern ?? "" };
      case "WebFetch":
        return { url: input.url ?? "" };
      default:
        return {};
    }
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Hook handler
// ---------------------------------------------------------------------------

export async function runHook(args: CliArgs): Promise<void> {
  const toolName = args.tool;
  const isPost = args.post === true;

  if (!toolName) {
    console.error("securitylayer hook: --tool is required");
    process.exit(1);
  }

  if (isPost) {
    await handlePostToolUse(toolName, args.output);
    return;
  }

  await handlePreToolUse(toolName, args.input);
}

// ---------------------------------------------------------------------------
// PreToolUse — block dangerous actions
// ---------------------------------------------------------------------------

async function handlePreToolUse(toolName: string, inputJson?: string): Promise<void> {
  const capability = TOOL_CAPABILITY_MAP[toolName];
  if (!capability) {
    // Unknown tool — allow by default (fail open for unknown Claude Code tools)
    process.exit(0);
  }

  const parsed = inputJson ? parseToolInput(toolName, inputJson) : {};

  try {
    const config = await loadConfig();
    const pipeline = createPipeline(config);

    // Resolve session: use env var or default
    const sessionId = process.env.CLAUDE_CODE_SESSION ?? "claude-code";

    // Get project taint from cwd
    const projectsConfig = await loadProjectsConfig();
    const projectTaint = getProjectTaint(process.cwd(), projectsConfig);

    // Apply project taint to tracker
    if (projectTaint !== "owner") {
      pipeline.taintTracker.onContentIngested({
        content: `project:${process.cwd()}`,
        taint: projectTaint as typeof TaintLevel.OWNER,
        origin: { timestamp: Date.now() },
      });
    }

    const context: ExecutionContext = { sessionId };

    // Check if we're in learning mode
    const learningMode = isLearningMode(config.main as Record<string, unknown>);

    const result = await evaluateAction(capability, context, pipeline, parsed.command);

    if (learningMode) {
      // Learning mode: log but allow
      if (result.decision !== "ALLOW") {
        console.error(
          `[learn] Would have blocked: ${capability} → ${result.decision} (${result.layers.capability.reason ?? result.layers.rules?.reason ?? "policy"})`,
        );
      }
      process.exit(0);
    }

    if (result.decision === "ALLOW") {
      process.exit(0);
    }

    // DENY or REQUIRE_APPROVAL → block
    const reason =
      result.layers.capability.reason ??
      result.layers.rules?.reason ??
      result.layers.llm?.reasoning ??
      "Blocked by Security Layer policy";

    console.error(`Security Layer: ${result.decision} — ${reason}`);
    process.exit(2);
  } catch (err) {
    // Fail safe — block on unexpected error
    console.error(
      `Security Layer: error during check — blocking action (${err instanceof Error ? err.message : "unknown error"})`,
    );
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// PostToolUse — update taint tracking
// ---------------------------------------------------------------------------

async function handlePostToolUse(toolName: string, _outputJson?: string): Promise<void> {
  // PostToolUse always exits 0 — it's informational only
  try {
    if (toolName === "Read" || toolName === "Glob" || toolName === "Grep") {
      // File read from potentially untrusted project → could elevate taint
      // In a daemon model we'd update session taint; for cold-start CLI
      // this is a no-op since taint doesn't persist between invocations
    }

    if (toolName === "WebFetch") {
      // Web content fetched → in daemon model would elevate to WEB taint
      // Same cold-start limitation as above
    }
  } catch {
    // PostToolUse never fails
  }

  process.exit(0);
}

// ---------------------------------------------------------------------------
// Learning mode check
// ---------------------------------------------------------------------------

function isLearningMode(main: Record<string, unknown>): boolean {
  if (main.mode !== "learning") return false;

  const expires = main.learning_expires;
  if (typeof expires === "string") {
    const expiryDate = new Date(expires);
    if (expiryDate.getTime() < Date.now()) return false;
  }

  return true;
}
