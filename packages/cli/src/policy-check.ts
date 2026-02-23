import {
  createPipeline,
  type ExecutionContext,
  evaluateAction,
  type TaintLevel,
} from "@securitylayer/core";
import type { CliArgs } from "@/index";
import {
  formatDecision,
  formatTaintLevel,
  getProjectTaint,
  loadConfigOrSuggestInit,
  loadProjectsConfig,
} from "@/shared";

export async function runPolicyCheck(args: CliArgs): Promise<void> {
  const command = args._[2] ?? args.command;

  if (!command) {
    console.error('Usage: securitylayer policy check "<command>"');
    console.error('Example: securitylayer policy check "rm -rf /"');
    process.exit(1);
  }

  const sessionId = args.session ?? "claude-code";
  const config = await loadConfigOrSuggestInit();
  const pipeline = createPipeline(config);

  // Apply project taint
  const projectsConfig = await loadProjectsConfig();
  const projectTaint = getProjectTaint(process.cwd(), projectsConfig);

  if (projectTaint !== "owner") {
    pipeline.taintTracker.onContentIngested({
      content: `project:${process.cwd()}`,
      taint: projectTaint as typeof TaintLevel.OWNER,
      origin: { timestamp: Date.now() },
    });
  }

  const context: ExecutionContext = { sessionId };

  console.log("Policy Check");
  console.log("═".repeat(50));
  console.log(`Command:  ${command}`);
  console.log(`Session:  ${sessionId}`);
  console.log(`Taint:    ${formatTaintLevel(projectTaint)}`);
  console.log(`CWD:      ${process.cwd()}`);
  console.log("─".repeat(50));

  const result = await evaluateAction("exec", context, pipeline, command);

  // Layer results
  console.log("\nLayer Results:");

  // Capability gate
  const cap = result.layers.capability;
  console.log(
    `  Capability gate: ${cap.allowed ? "\x1b[32mPASS\x1b[0m" : `\x1b[31mDENY\x1b[0m — ${cap.reason}`}`,
  );

  // Rules
  if (result.layers.rules) {
    const r = result.layers.rules;
    if (r.matched) {
      console.log(`  Rules:           ${formatDecision(r.decision)} — ${r.reason} [${r.rule?.id}]`);
    } else {
      console.log("  Rules:           \x1b[2mno match\x1b[0m");
    }
  }

  // LLM
  if (result.layers.llm) {
    const l = result.layers.llm;
    console.log(
      `  LLM judge:       ${l.decision} (confidence: ${l.confidence.toFixed(2)}) — ${l.reasoning}`,
    );
  } else {
    console.log(
      `  LLM judge:       \x1b[2m${result.degraded ? "unavailable (degraded mode)" : "skipped"}\x1b[0m`,
    );
  }

  // Risk score
  if (result.layers.riskScore) {
    const rs = result.layers.riskScore;
    console.log(
      `  Risk score:      ${rs.score.toFixed(2)} (tool=${rs.weights.tool.toFixed(1)}, blast=${rs.weights.blast.toFixed(1)}, taint=${rs.weights.taint.toFixed(1)})`,
    );
  }

  // Timing
  console.log("\nTiming:");
  console.log(`  Total:      ${result.timing.total.toFixed(1)}ms`);
  if (result.timing.capability !== undefined)
    console.log(`  Capability: ${result.timing.capability.toFixed(1)}ms`);
  if (result.timing.rules !== undefined)
    console.log(`  Rules:      ${result.timing.rules.toFixed(1)}ms`);
  if (result.timing.llm !== undefined)
    console.log(`  LLM:        ${result.timing.llm.toFixed(1)}ms`);

  // Final decision
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Decision: ${formatDecision(result.decision)}`);

  if (result.decision !== "ALLOW") {
    const reason =
      result.layers.capability.reason ??
      result.layers.rules?.reason ??
      result.layers.llm?.reasoning ??
      "Policy restriction";
    console.log(`Reason:   ${reason}`);
  }
}
