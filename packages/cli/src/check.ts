import {
  createPipeline,
  type ExecutionContext,
  evaluateAction,
  loadConfig,
  type TaintLevel,
} from "@securitylayer/core";
import { detectCaller } from "@/caller-detect";
import type { CliArgs } from "@/index";
import { formatDecision, getProjectTaint, loadCallersConfig, loadProjectsConfig } from "@/shared";

export async function runCheck(args: CliArgs): Promise<void> {
  const toolType = args.tool ?? "exec";
  const command = args.command ?? args._[1];
  const format = args.format ?? "text";
  const callerName = args.caller;

  if (!command) {
    console.error("securitylayer check: --command is required");
    process.exit(1);
  }

  try {
    const config = await loadConfig();
    const pipeline = createPipeline(config);

    // Detect or use provided caller
    const caller = callerName ?? (await detectCaller());

    // Load caller profile for session capabilities
    const callersConfig = await loadCallersConfig();
    const callerProfile = callersConfig.callers[caller];

    // Session ID: use caller name as session, or fall back to default
    const sessionId = caller !== "unknown" ? caller : "default";

    // Get project taint from cwd
    const projectsConfig = await loadProjectsConfig();
    const projectTaint = getProjectTaint(process.cwd(), projectsConfig);

    // Apply project taint
    if (projectTaint !== "owner") {
      pipeline.taintTracker.onContentIngested({
        content: `project:${process.cwd()}`,
        taint: projectTaint as typeof TaintLevel.OWNER,
        origin: { timestamp: Date.now() },
      });
    }

    // If caller has a custom default taint, apply it
    if (callerProfile && callerProfile.default_taint !== "owner") {
      pipeline.taintTracker.onContentIngested({
        content: `caller:${caller}`,
        taint: callerProfile.default_taint as typeof TaintLevel.OWNER,
        origin: { timestamp: Date.now() },
      });
    }

    const context: ExecutionContext = { sessionId };

    // Check learning mode
    const main = config.main as Record<string, unknown>;
    const learningMode =
      main.mode === "learning" &&
      (typeof main.learning_expires !== "string" ||
        new Date(main.learning_expires).getTime() >= Date.now());

    const result = await evaluateAction(toolType, context, pipeline, command);

    if (learningMode && result.decision !== "ALLOW") {
      // Learning mode: log but allow
      if (format === "json") {
        console.log(
          JSON.stringify({
            decision: "ALLOW",
            original_decision: result.decision,
            learning_mode: true,
            reason: result.layers.capability.reason ?? result.layers.rules?.reason ?? "policy",
            timing: result.timing,
          }),
        );
      } else {
        console.error(`[learn] Would have blocked: ${command} → ${result.decision}`);
      }
      process.exit(0);
    }

    const reason =
      result.layers.capability.reason ??
      result.layers.rules?.reason ??
      result.layers.llm?.reasoning ??
      "Allowed by policy";

    if (format === "json") {
      console.log(
        JSON.stringify({
          decision: result.decision,
          reason,
          caller,
          taint: result.layers.taint,
          timing: result.timing,
        }),
      );
    } else {
      console.log(`${formatDecision(result.decision)} — ${reason}`);
    }

    switch (result.decision) {
      case "ALLOW":
        process.exit(0);
        break;
      case "DENY":
        process.exit(1);
        break;
      case "REQUIRE_APPROVAL":
        process.exit(2);
        break;
    }
  } catch (err) {
    // Fail safe — block on unexpected error
    const msg = err instanceof Error ? err.message : "unknown error";
    if (format === "json") {
      console.log(JSON.stringify({ decision: "DENY", reason: `Error: ${msg}` }));
    } else {
      console.error(`SecurityLayer: error — ${msg}`);
    }
    process.exit(1);
  }
}
