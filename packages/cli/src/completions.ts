import type { CliArgs } from "@/index";

const COMMANDS = [
  "init",
  "status",
  "capabilities",
  "taint",
  "policy",
  "learn",
  "completions",
  "shield",
  "setup",
  "hook",
  "check",
  "callers",
  "projects",
  "rules",
];

const SUBCOMMANDS: Record<string, string[]> = {
  capabilities: ["show"],
  taint: ["show", "clear"],
  policy: ["check"],
  shield: ["enable", "disable", "status"],
  setup: ["claude-code", "cursor"],
  callers: ["list", "profile"],
  projects: ["list", "trust", "untrust"],
  rules: ["list", "revoke", "clear"],
};

export async function runCompletions(args: CliArgs): Promise<void> {
  const shell = args._[1] ?? "bash";

  switch (shell) {
    case "bash":
      outputBashCompletions();
      break;
    case "zsh":
      outputZshCompletions();
      break;
    case "fish":
      outputFishCompletions();
      break;
    default:
      console.error(`Unsupported shell: ${shell}`);
      console.error("Supported shells: bash, zsh, fish");
      process.exit(1);
  }
}

function outputBashCompletions(): void {
  const script = `# securitylayer bash completions
_securitylayer_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="${COMMANDS.join(" ")}"

  case "\${prev}" in
    securitylayer|sl)
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      return 0
      ;;
${Object.entries(SUBCOMMANDS)
  .map(
    ([cmd, subs]) =>
      `    ${cmd})
      COMPREPLY=( $(compgen -W "${subs.join(" ")}" -- "\${cur}") )
      return 0
      ;;`,
  )
  .join("\n")}
  esac
}
complete -F _securitylayer_completions securitylayer
complete -F _securitylayer_completions sl
`;
  console.log(script);
}

function outputZshCompletions(): void {
  const script = `#compdef securitylayer sl
# securitylayer zsh completions

_securitylayer() {
  local -a commands
  commands=(
${COMMANDS.map((c) => `    '${c}:${getCommandDescription(c)}'`).join("\n")}
  )

  _arguments -C \\
    '1:command:->command' \\
    '2:subcommand:->subcommand' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    subcommand)
      case $words[2] in
${Object.entries(SUBCOMMANDS)
  .map(
    ([cmd, subs]) =>
      `        ${cmd})
          local -a subcmds
          subcmds=(${subs.map((s) => `'${s}'`).join(" ")})
          _describe 'subcommand' subcmds
          ;;`,
  )
  .join("\n")}
      esac
      ;;
  esac
}

_securitylayer
`;
  console.log(script);
}

function outputFishCompletions(): void {
  const lines = ["# securitylayer fish completions", ""];

  for (const bin of ["securitylayer", "sl"]) {
    for (const cmd of COMMANDS) {
      lines.push(
        `complete -c ${bin} -n '__fish_use_subcommand' -a '${cmd}' -d '${getCommandDescription(cmd)}'`,
      );
    }

    for (const [cmd, subs] of Object.entries(SUBCOMMANDS)) {
      for (const sub of subs) {
        lines.push(`complete -c ${bin} -n '__fish_seen_subcommand_from ${cmd}' -a '${sub}'`);
      }
    }

    lines.push("");
  }

  console.log(lines.join("\n"));
}

function getCommandDescription(cmd: string): string {
  const descriptions: Record<string, string> = {
    init: "Interactive guided setup",
    status: "Show status dashboard",
    capabilities: "Manage capabilities",
    taint: "Show/clear taint levels",
    policy: "Policy simulation",
    learn: "Learning/monitor mode",
    completions: "Shell completions",
    shield: "Shell shim protection",
    setup: "AI tool integration setup",
    hook: "Hook handler",
    check: "Standalone check",
    callers: "AI tool caller profiles",
    projects: "Project trust management",
    rules: "Learned rules management",
  };
  return descriptions[cmd] ?? cmd;
}
