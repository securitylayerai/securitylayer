// securitylayer — command router

import { runCallersList, runCallersProfile } from "@/callers";
import { runCapabilitiesShow } from "@/capabilities";
import { runCheck } from "@/check";
import { runCompletions } from "@/completions";
import { runHook } from "@/hook";
import { runInit } from "@/init";
import { runLearn } from "@/learn";
import { runPolicyCheck } from "@/policy-check";
import { runProjectsList, runProjectsTrust, runProjectsUntrust } from "@/projects";
import { runRulesClear, runRulesList, runRulesRevoke } from "@/rules";
import { runSetupClaudeCode, runSetupCursor } from "@/setup";
import { runShieldDisable, runShieldEnable, runShieldStatus } from "@/shield";
import { runStatus } from "@/status";
import { runTaintClear, runTaintShow } from "@/taint";

export interface CliArgs {
  _: string[];
  help?: boolean;
  version?: boolean;
  tool?: string;
  input?: string;
  output?: string;
  command?: string;
  caller?: string;
  format?: string;
  duration?: string;
  session?: string;
  post?: boolean;
  [key: string]: unknown;
}

const VERSION = "0.0.1";

const HELP_TEXT = `
securitylayer (sl) — agent security platform

Usage: securitylayer <command> [subcommand] [flags]
       sl <command> [subcommand] [flags]

Commands:
  init                    Interactive guided setup
  status                  Show security status dashboard
  capabilities show       Display capability grants
  taint show              Show taint levels
  taint clear             Clear taint state
  policy check "<cmd>"    Dry-run policy check
  learn                   Enable learning/monitor mode
  completions <shell>     Output shell completions
  shield enable           Enable shell shim protection
  shield disable          Disable shell shim protection
  shield status           Show shield status
  setup claude-code       Install Claude Code hooks
  setup cursor            Setup Cursor integration
  hook <agent>            Hook handler (used by integrations)
  check                   Standalone check (used by shell shims)
  callers list            List known AI tool callers
  callers profile <name>  Show caller profile
  projects list           List project trust rules
  projects trust <path>   Trust a project path
  projects untrust <path> Remove trust for a project path
  rules list              List learned rules
  rules revoke <id>       Revoke a learned rule
  rules clear             Clear all learned rules

Flags:
  -h, --help              Show help
  -v, --version           Show version
`.trim();

export async function runMain(args: CliArgs): Promise<void> {
  if (args.version) {
    console.log(VERSION);
    return;
  }

  const command = args._[0];
  const subcommand = args._[1];

  if (args.help || !command) {
    console.log(HELP_TEXT);
    if (!command && !args.help) process.exit(1);
    return;
  }

  switch (command) {
    case "init":
      return runInit(args);

    case "status":
      return runStatus(args);

    case "capabilities":
      if (subcommand === "show" || !subcommand) return runCapabilitiesShow(args);
      break;

    case "taint":
      if (subcommand === "show" || !subcommand) return runTaintShow(args);
      if (subcommand === "clear") return runTaintClear(args);
      break;

    case "policy":
      if (subcommand === "check") return runPolicyCheck(args);
      break;

    case "learn":
      return runLearn(args);

    case "completions":
      return runCompletions(args);

    case "shield":
      if (subcommand === "enable") return runShieldEnable(args);
      if (subcommand === "disable") return runShieldDisable(args);
      if (subcommand === "status" || !subcommand) return runShieldStatus(args);
      break;

    case "setup":
      if (subcommand === "claude-code") return runSetupClaudeCode(args);
      if (subcommand === "cursor") return runSetupCursor(args);
      break;

    case "hook":
      return runHook(args);

    case "check":
      return runCheck(args);

    case "callers":
      if (subcommand === "list" || !subcommand) return runCallersList(args);
      if (subcommand === "profile") return runCallersProfile(args);
      break;

    case "projects":
      if (subcommand === "list" || !subcommand) return runProjectsList(args);
      if (subcommand === "trust") return runProjectsTrust(args);
      if (subcommand === "untrust") return runProjectsUntrust(args);
      break;

    case "rules":
      if (subcommand === "list" || !subcommand) return runRulesList(args);
      if (subcommand === "revoke") return runRulesRevoke(args);
      if (subcommand === "clear") return runRulesClear(args);
      break;
  }

  console.error(`Unknown command: ${command}${subcommand ? ` ${subcommand}` : ""}`);
  console.log(HELP_TEXT);
  process.exit(1);
}
