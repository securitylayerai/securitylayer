import type { CliArgs } from "@/index";
import { formatTaintLevel, loadCallersConfig, loadConfigOrSuggestInit } from "@/shared";

export async function runCallersList(_args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const config = await loadCallersConfig();

  console.log("Known AI Tool Callers");
  console.log("═".repeat(50));

  const callers = Object.entries(config.callers);
  if (callers.length === 0) {
    console.log("\n(no callers configured)");
    return;
  }

  for (const [id, caller] of callers) {
    console.log(`\n  \x1b[1m${caller.display_name}\x1b[0m (${id})`);
    console.log(`    Default taint: ${formatTaintLevel(caller.default_taint)}`);
    console.log(
      `    Capabilities:  ${caller.capabilities.length > 0 ? caller.capabilities.join(", ") : "(none)"}`,
    );

    if (caller.detection.env_vars.length > 0) {
      console.log(`    Env detection:  ${caller.detection.env_vars.join(", ")}`);
    }
    if (caller.detection.process_names.length > 0) {
      console.log(`    Process names:  ${caller.detection.process_names.join(", ")}`);
    }
  }
}

export async function runCallersProfile(args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const name = args._[2];

  if (!name) {
    console.error("Usage: securitylayer callers profile <name>");
    process.exit(1);
  }

  const config = await loadCallersConfig();
  const caller = config.callers[name];

  if (!caller) {
    console.error(`Unknown caller: ${name}`);
    console.error(`Known callers: ${Object.keys(config.callers).join(", ")}`);
    process.exit(1);
  }

  console.log(`Caller Profile: ${caller.display_name}`);
  console.log("═".repeat(40));
  console.log(`  ID:             ${caller.name}`);
  console.log(`  Display name:   ${caller.display_name}`);
  console.log(`  Default taint:  ${formatTaintLevel(caller.default_taint)}`);
  console.log();
  console.log("  Capabilities:");
  if (caller.capabilities.length === 0) {
    console.log("    (none)");
  } else {
    for (const cap of caller.capabilities) {
      console.log(`    ${cap}`);
    }
  }
  console.log();
  console.log("  Detection:");
  console.log(
    `    Env vars:       ${caller.detection.env_vars.length > 0 ? caller.detection.env_vars.join(", ") : "(none)"}`,
  );
  console.log(
    `    Process names:  ${caller.detection.process_names.length > 0 ? caller.detection.process_names.join(", ") : "(none)"}`,
  );
}
