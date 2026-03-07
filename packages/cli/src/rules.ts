import { readFile, writeFile } from "node:fs/promises";
import { CONFIG_PATHS } from "@securitylayerai/core";
import type { CliArgs } from "@/index";
import { loadConfigOrSuggestInit } from "@/shared";

interface LearnedRule {
  pattern: string;
  capability: string;
  created_at: string;
  session_id?: string;
}

interface LearnedRulesFile {
  version: number;
  rules: LearnedRule[];
}

async function loadLearnedRules(): Promise<LearnedRulesFile> {
  try {
    const content = await readFile(CONFIG_PATHS.learnedRules, "utf-8");
    return JSON.parse(content) as LearnedRulesFile;
  } catch {
    return { version: 1, rules: [] };
  }
}

async function saveLearnedRules(data: LearnedRulesFile): Promise<void> {
  await writeFile(CONFIG_PATHS.learnedRules, JSON.stringify(data, null, 2), "utf-8");
}

export async function runRulesList(_args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const data = await loadLearnedRules();

  console.log("Learned Rules");
  console.log("═".repeat(50));

  if (data.rules.length === 0) {
    console.log("\n(no learned rules)");
    console.log('Rules are created when you approve actions with "Approve & Remember".');
    return;
  }

  console.log();
  for (let i = 0; i < data.rules.length; i++) {
    const rule = data.rules[i];
    const session = rule.session_id ? ` [${rule.session_id}]` : "";
    console.log(`  ${i + 1}. \x1b[1m${rule.pattern}\x1b[0m`);
    console.log(`     Capability: ${rule.capability}${session}`);
    console.log(`     Created:    ${rule.created_at}`);
  }

  console.log(`\nTotal: ${data.rules.length} rule(s)`);
}

export async function runRulesRevoke(args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const idArg = args._[2];

  if (!idArg) {
    console.error("Usage: securitylayer rules revoke <number>");
    console.error("Use `securitylayer rules list` to see rule numbers.");
    process.exit(1);
    return;
  }

  const index = Number.parseInt(idArg, 10) - 1; // User-facing is 1-indexed
  const data = await loadLearnedRules();

  if (Number.isNaN(index) || index < 0 || index >= data.rules.length) {
    console.error(`Invalid rule number: ${idArg}. Valid range: 1-${data.rules.length}`);
    process.exit(1);
    return;
  }

  const removed = data.rules.splice(index, 1)[0];
  await saveLearnedRules(data);

  console.log(`Revoked rule: ${removed.pattern} (${removed.capability})`);
}

export async function runRulesClear(_args: CliArgs): Promise<void> {
  await loadConfigOrSuggestInit();
  const data = await loadLearnedRules();
  const count = data.rules.length;

  if (count === 0) {
    console.log("No learned rules to clear.");
    return;
  }

  data.rules = [];
  await saveLearnedRules(data);

  console.log(`Cleared ${count} learned rule(s).`);
}
