import type { CliArgs } from "@/index";
import { formatTaintLevel, loadConfigOrSuggestInit, loadProjectsConfig } from "@/shared";

export async function runTaintShow(_args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const projectsConfig = await loadProjectsConfig();

  console.log("Taint Configuration");
  console.log("═".repeat(40));

  // Project trust rules
  console.log("\nProject Trust Rules:");
  if (projectsConfig.trust_rules.length === 0) {
    console.log("  (no rules configured)");
  } else {
    for (const rule of projectsConfig.trust_rules) {
      console.log(`  ${rule.path} → ${formatTaintLevel(rule.taint)}`);
    }
  }
  console.log(`\n  Default: ${formatTaintLevel(projectsConfig.default)}`);

  // Current working directory taint
  const { getProjectTaint } = await import("@/shared");
  const cwdTaint = getProjectTaint(process.cwd(), projectsConfig);
  console.log(`\nCurrent directory taint: ${formatTaintLevel(cwdTaint)}`);
  console.log(`  (${process.cwd()})`);

  // Session taint info
  console.log("\nNote: Session taint is runtime state. In CLI mode (no daemon),");
  console.log("taint resets each invocation. Use `securitylayer hook` or the");
  console.log("proxy for persistent taint tracking.");
}

export async function runTaintClear(_args: CliArgs): Promise<void> {
  console.log("Taint Clear");
  console.log("─".repeat(40));
  console.log();
  console.log("In CLI mode (no daemon), session taint resets each invocation.");
  console.log("Taint clearing is only meaningful for the proxy daemon (v1+).");
  console.log();
  console.log("To change project trust levels, use:");
  console.log("  securitylayer projects trust <path> --taint <level>");
  console.log("  securitylayer projects untrust <path>");
}
