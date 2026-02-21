import { readFile, writeFile } from "node:fs/promises";
import { CONFIG_PATHS } from "@securitylayer/core";
import { parse as parseYaml, stringify as toYaml } from "yaml";
import type { CliArgs } from "@/index";
import { loadConfigOrSuggestInit } from "@/shared";

export async function runLearn(args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();

  const duration = args.duration ?? "7d";
  const expiryMs = parseDuration(duration);

  if (expiryMs === null) {
    console.error(`Invalid duration: ${duration}`);
    console.error("Examples: 1h, 12h, 1d, 7d, 30d");
    process.exit(1);
  }

  const expiryDate = new Date(Date.now() + expiryMs);

  // Read and update config.yaml
  const content = await readFile(CONFIG_PATHS.main, "utf-8");
  const config = parseYaml(content) as Record<string, unknown>;

  config.mode = "learning";
  config.learning_expires = expiryDate.toISOString();

  await writeFile(CONFIG_PATHS.main, toYaml(config), "utf-8");

  console.log("Learning Mode Enabled");
  console.log("═".repeat(40));
  console.log();
  console.log("SecurityLayer will now monitor all actions but allow everything.");
  console.log("Actions that would have been blocked are logged for review.");
  console.log();
  console.log(`Duration: ${duration}`);
  console.log(`Expires:  ${expiryDate.toLocaleString()}`);
  console.log();
  console.log("To disable: edit ~/.securitylayer/config.yaml and remove the 'mode' field.");
  console.log(
    "To view logs: check stderr output from `securitylayer hook` / `securitylayer check`.",
  );
}

function parseDuration(s: string): number | null {
  const match = s.match(/^(\d+)(h|d|m)$/);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}
