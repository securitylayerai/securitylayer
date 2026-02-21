import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR, CONFIG_PATHS } from "@securitylayer/core";
import type { CliArgs } from "@/index";
import { CLI_CONFIG_PATHS, configExists } from "@/shared";

export async function runStatus(_args: CliArgs): Promise<void> {
  console.log("SecurityLayer Status");
  console.log("═".repeat(40));

  // Config
  const hasConfig = configExists();
  console.log(
    `\nConfiguration: ${hasConfig ? "\x1b[32mloaded\x1b[0m" : "\x1b[31mnot found\x1b[0m"}`,
  );
  console.log(`  Config dir: ${CONFIG_DIR}`);

  if (!hasConfig) {
    console.log("\nRun `securitylayer init` to get started.");
    return;
  }

  // Config files
  const files = [
    { label: "Main config", path: CONFIG_PATHS.main },
    { label: "Sessions", path: CONFIG_PATHS.sessions },
    { label: "Channels", path: CONFIG_PATHS.channels },
    { label: "Skills", path: CONFIG_PATHS.skills },
    { label: "Learned rules", path: CONFIG_PATHS.learnedRules },
    { label: "AI tools", path: CLI_CONFIG_PATHS.callers },
    { label: "Projects", path: CLI_CONFIG_PATHS.projects },
  ];

  console.log("\nConfig files:");
  for (const f of files) {
    const exists = existsSync(f.path);
    console.log(`  ${f.label}: ${exists ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}`);
  }

  // Shield
  const shimDir = join(CONFIG_DIR, "bin");
  const shimDirExists = existsSync(shimDir);
  const pathIncludesShimDir = (process.env.PATH ?? "").split(":").includes(shimDir);
  const shieldActive = shimDirExists && pathIncludesShimDir;

  console.log(`\nShield: ${shieldActive ? "\x1b[32mactive\x1b[0m" : "\x1b[2minactive\x1b[0m"}`);

  // Claude Code hooks
  const hooksPath = join(process.env.HOME ?? "", ".claude", "hooks.json");
  let hooksInstalled = false;
  try {
    if (existsSync(hooksPath)) {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(hooksPath, "utf-8");
      hooksInstalled = content.includes("securitylayer hook");
    }
  } catch {
    // ignore
  }
  console.log(
    `Claude Code hooks: ${hooksInstalled ? "\x1b[32minstalled\x1b[0m" : "\x1b[2mnot installed\x1b[0m"}`,
  );

  // Session info
  try {
    const { loadConfig } = await import("@securitylayer/core");
    const config = await loadConfig();
    const sessions = config.sessions.sessions as Record<
      string,
      { capabilities: string[]; default_taint: string }
    >;
    const sessionIds = Object.keys(sessions);
    console.log(`\nSessions (${sessionIds.length}):`);
    for (const id of sessionIds) {
      const session = sessions[id];
      console.log(
        `  ${id}: ${session.capabilities.length} capabilities, taint=${session.default_taint}`,
      );
    }

    // Learning mode
    const main = config.main as Record<string, unknown>;
    if (main.mode === "learning") {
      const expires = main.learning_expires;
      console.log(`\n\x1b[33mLearning mode: ACTIVE\x1b[0m`);
      if (typeof expires === "string") {
        console.log(`  Expires: ${expires}`);
      }
    }
  } catch {
    // ignore config load errors in status
  }
}
