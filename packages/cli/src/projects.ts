import { writeFile } from "node:fs/promises";
import { stringify as toYaml } from "yaml";
import type { CliArgs } from "@/index";
import {
  CLI_CONFIG_PATHS,
  formatTaintLevel,
  loadConfigOrSuggestInit,
  loadProjectsConfig,
} from "@/shared";

export async function runProjectsList(_args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const config = await loadProjectsConfig();

  console.log("Project Trust Rules");
  console.log("═".repeat(50));

  if (config.trust_rules.length === 0) {
    console.log("\n(no trust rules configured)");
  } else {
    console.log();
    for (let i = 0; i < config.trust_rules.length; i++) {
      const rule = config.trust_rules[i];
      console.log(`  ${i + 1}. ${rule.path} → ${formatTaintLevel(rule.taint)}`);
    }
  }

  console.log(`\n  Default: ${formatTaintLevel(config.default)}`);
}

export async function runProjectsTrust(args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const pathArg = args._[2];
  const taint = ((args as Record<string, unknown>).taint as string | undefined) ?? "owner";

  if (!pathArg) {
    console.error("Usage: securitylayer projects trust <path> [--taint <level>]");
    process.exit(1);
  }

  const config = await loadProjectsConfig();

  // Remove existing rule for this path
  config.trust_rules = config.trust_rules.filter((r) => r.path !== pathArg);

  // Add new rule
  config.trust_rules.unshift({
    path: pathArg,
    taint: taint as "owner" | "trusted" | "untrusted" | "web" | "skill" | "memory",
  });

  await writeFile(CLI_CONFIG_PATHS.projects, toYaml(config), "utf-8");
  console.log(`Trusted: ${pathArg} → ${formatTaintLevel(taint)}`);
}

export async function runProjectsUntrust(args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const pathArg = args._[2];

  if (!pathArg) {
    console.error("Usage: securitylayer projects untrust <path>");
    process.exit(1);
  }

  const config = await loadProjectsConfig();
  const before = config.trust_rules.length;
  config.trust_rules = config.trust_rules.filter((r) => r.path !== pathArg);

  if (config.trust_rules.length === before) {
    console.log(`No trust rule found for: ${pathArg}`);
    return;
  }

  await writeFile(CLI_CONFIG_PATHS.projects, toYaml(config), "utf-8");
  console.log(`Removed trust rule for: ${pathArg}`);
  console.log(`This path will now use the default taint: ${formatTaintLevel(config.default)}`);
}
