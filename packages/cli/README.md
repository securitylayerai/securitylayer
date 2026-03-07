# securitylayer

Command-line interface for Security Layer. Provides policy enforcement, shell shim protection, AI tool integration hooks, and configuration management.

## Installation

```bash
bun install securitylayer
```

The CLI binary is available as `securitylayer` or the shorthand `sl`:

```bash
securitylayer --help
sl --help              # same thing
```

## Quick Start

```bash
# Interactive guided setup
sl init

# Check security status
securitylayer status

# Install Claude Code hooks
securitylayer setup claude-code

# Enable shell shim protection (all AI tools)
securitylayer shield enable
```

## Commands

### `securitylayer init`

Interactive guided setup wizard. Creates all configuration files in `~/.securitylayer/`.

Prompts for:
- Session name (default: `claude-code`)
- Capability grants (exec, file.read, file.write, web_fetch, etc.)
- Default taint level (owner, trusted, untrusted)
- LLM semantic judge (optional — supports Anthropic, OpenAI, Google, xAI, OpenAI-compatible)

After config creation, offers to install Claude Code hooks and enable shield protection.

**Files created:**
- `~/.securitylayer/config.yaml` — Main configuration
- `~/.securitylayer/capabilities/sessions.yaml` — Session capability grants
- `~/.securitylayer/capabilities/channels.yaml` — Channel restrictions
- `~/.securitylayer/capabilities/skills.yaml` — Skill definitions
- `~/.securitylayer/ai-tools.yaml` — AI tool caller profiles
- `~/.securitylayer/projects.yaml` — Project trust rules
- `~/.securitylayer/learned-rules.json` — Learned allow rules

---

### `securitylayer status`

Displays a dashboard showing the current security posture:

- Configuration status and file existence
- Shield (shell shim) active/inactive
- Claude Code hooks installed/not installed
- Session list with capabilities and taint levels
- Learning mode status (if active)

---

### `securitylayer check`

Standalone policy check used by shell shims and scripts. Evaluates a command against the full policy pipeline (capability gate, rules, taint, LLM judge).

```bash
securitylayer check --command "git status"
securitylayer check --command "rm -rf /" --format json
securitylayer check --command "curl api.example.com" --caller cursor
```

| Flag | Description | Default |
|------|-------------|---------|
| `--command <cmd>` | Command to evaluate (or pass as positional arg) | required |
| `--format <fmt>` | Output format: `text` or `json` | `text` |
| `--caller <name>` | Override caller detection | auto-detected |
| `--tool <type>` | Capability type to check | `exec` |

**Exit codes:**

| Code | Decision |
|------|----------|
| `0` | ALLOW |
| `1` | DENY |
| `2` | REQUIRE_APPROVAL |

**JSON output:**

```json
{
  "decision": "ALLOW",
  "reason": "Allowed by policy",
  "caller": "claude-code",
  "taint": "untrusted",
  "timing": { "total": 1.2, "capability": 0.5 }
}
```

In **learning mode**, blocked actions are allowed with `learning_mode: true` and the original decision preserved as `original_decision`.

---

### `securitylayer hook`

Hook handler for AI tool integrations (Claude Code, etc.). Called automatically by installed hooks — not typically invoked manually.

```bash
# PreToolUse — blocks dangerous actions (exit 0 = allow, exit 2 = block)
securitylayer hook claude-code --tool Bash --input "$TOOL_INPUT"

# PostToolUse — informational taint tracking (always exits 0)
securitylayer hook claude-code --tool Read --post --output "$TOOL_OUTPUT"
```

| Flag | Description | Default |
|------|-------------|---------|
| `--tool <name>` | Tool name (Bash, Write, Edit, Read, etc.) | required |
| `--input <json>` | Tool input JSON (PreToolUse) | — |
| `--output <json>` | Tool output JSON (PostToolUse) | — |
| `--post` | PostToolUse mode | `false` |

**Tool capability mapping:**

| Tool | Capability |
|------|-----------|
| Bash | `exec` |
| Write, Edit, NotebookEdit | `file.write` |
| Read, Glob, Grep | `file.read` |
| WebFetch | `web_fetch` |

Unknown tools are allowed by default (fail open).

---

### `securitylayer policy check`

Dry-run policy simulation with detailed layer-by-layer output. Useful for debugging and understanding how policies evaluate.

```bash
securitylayer policy check "rm -rf /"
securitylayer policy check "git push" --session my-session
```

| Flag | Description | Default |
|------|-------------|---------|
| `--command <cmd>` | Command to evaluate (or pass as positional arg) | required |
| `--session <id>` | Session ID for capability lookup | `claude-code` |

**Output includes:**
- Capability gate result (PASS/DENY)
- Rules engine match
- LLM judge decision with confidence score
- Risk score breakdown (tool, blast radius, taint weights)
- Per-layer timing

---

### `securitylayer learn`

Enables learning/monitor mode. All actions are allowed but blocked actions are logged for review.

```bash
securitylayer learn
securitylayer learn --duration 24h
securitylayer learn --duration 30m
```

| Flag | Description | Default |
|------|-------------|---------|
| `--duration <dur>` | How long learning mode stays active | `7d` |

**Duration format:** `<number><unit>` where unit is `m` (minutes), `h` (hours), or `d` (days).

Examples: `30m`, `1h`, `12h`, `1d`, `7d`, `30d`

To disable: edit `~/.securitylayer/config.yaml` and remove the `mode` field.

---

### `securitylayer capabilities show`

Displays all capability grants across sessions, channels, and skills.

```bash
securitylayer capabilities show
securitylayer capabilities  # 'show' is the default subcommand
```

Shows:
- Sessions with granted capabilities and default taint levels
- Taint-qualified capabilities (e.g., `exec:trusted` requires trusted taint or better)
- Channel capability restrictions
- Skill capability grants

---

### `securitylayer taint show`

Displays taint configuration and the current working directory's taint level.

```bash
securitylayer taint show
securitylayer taint  # 'show' is the default subcommand
```

### `securitylayer taint clear`

Informational in CLI mode — session taint resets each invocation. Persistent taint clearing requires the proxy daemon (v1+).

```bash
securitylayer taint clear
```

---

### `securitylayer shield enable`

Creates shell shim scripts that intercept all commands executed by AI tools. Provides universal protection regardless of which AI tool is used.

```bash
securitylayer shield enable
```

**Shimmed binaries:** `bash`, `sh`, `zsh`, `python`, `python3`, `node`, `ruby`, `perl`

Shims are installed to `~/.securitylayer/bin/` and the directory is prepended to `PATH` in your shell profile. Each shim:

1. Passes through interactive shells and no-arg invocations
2. Calls `securitylayer check` for policy evaluation
3. Blocks commands that violate policy (exit 126)
4. Includes recursion guard to prevent infinite loops

### `securitylayer shield disable`

Removes shim scripts and cleans up the PATH modification from your shell profile.

```bash
securitylayer shield disable
```

### `securitylayer shield status`

Shows whether the shield is active, which binaries are shimmed, and whether PATH is configured.

```bash
securitylayer shield status
securitylayer shield  # 'status' is the default subcommand
```

---

### `securitylayer setup claude-code`

Installs Security Layer as Claude Code hooks in `~/.claude/hooks.json`.

```bash
securitylayer setup claude-code
```

**Hooks installed:**

| Hook Type | Tools |
|-----------|-------|
| PreToolUse | Bash, Write, Edit, WebFetch, NotebookEdit |
| PostToolUse | Bash, Read, WebFetch |

Setup is idempotent — existing Security Layer hooks are replaced, other hooks are preserved.

### `securitylayer setup cursor`

Displays instructions for Cursor integration. Since Cursor doesn't support native hooks, recommends using `securitylayer shield enable` for universal protection.

```bash
securitylayer setup cursor
```

---

### `securitylayer callers list`

Lists all known AI tool caller profiles with their detection methods and default taint levels.

```bash
securitylayer callers list
securitylayer callers  # 'list' is the default subcommand
```

### `securitylayer callers profile <name>`

Shows detailed profile for a specific caller.

```bash
securitylayer callers profile claude-code
securitylayer callers profile cursor
```

**Supported callers:** `claude-code`, `cursor`, `aider`, `copilot`

**Caller detection priority:**
1. `SECURITYLAYER_CALLER` env var (explicit override)
2. Environment heuristics (`CLAUDE_CODE_SESSION`, `CURSOR_SESSION_ID`, `AIDER_SESSION`)
3. Parent process name matching
4. Grandparent process name matching
5. Falls back to `unknown`

---

### `securitylayer projects list`

Lists project trust rules with their taint levels.

```bash
securitylayer projects list
securitylayer projects  # 'list' is the default subcommand
```

### `securitylayer projects trust <path>`

Adds or updates a trust rule for a project path. Rules use glob patterns.

```bash
securitylayer projects trust "~/Dev/Personal/**"
securitylayer projects trust "~/Dev/Work/**" --taint trusted
securitylayer projects trust "/tmp/**" --taint web
```

| Flag | Description | Default |
|------|-------------|---------|
| `--taint <level>` | Taint level for this path | `owner` |

**Taint levels:** `owner`, `trusted`, `untrusted`, `web`, `skill`, `memory`

If a rule already exists for the path, it is replaced.

### `securitylayer projects untrust <path>`

Removes a trust rule. The path reverts to the default taint level.

```bash
securitylayer projects untrust "/tmp/**"
```

---

### `securitylayer rules list`

Lists all learned allow rules with their patterns, capabilities, creation timestamps, and session IDs.

```bash
securitylayer rules list
securitylayer rules  # 'list' is the default subcommand
```

### `securitylayer rules revoke <number>`

Revokes a learned rule by its 1-indexed number (as shown in `rules list`).

```bash
securitylayer rules revoke 1
securitylayer rules revoke 3
```

### `securitylayer rules clear`

Removes all learned rules.

```bash
securitylayer rules clear
```

---

### `securitylayer completions <shell>`

Outputs shell completion scripts. Supports `bash`, `zsh`, and `fish`. Completions are registered for both `securitylayer` and the `sl` alias.

```bash
# Bash
sl completions bash >> ~/.bashrc

# Zsh
sl completions zsh >> ~/.zshrc

# Fish
sl completions fish > ~/.config/fish/completions/securitylayer.fish
```

---

## Testing

```bash
bun run test        # correct — runs Vitest
```

Do **not** use `bun test` — that invokes Bun's built-in test runner, which does not resolve the `@/` path aliases or Vitest APIs used by this package.

## Alias

The CLI is available as both `securitylayer` and `sl`. They are identical — use whichever you prefer:

```bash
securitylayer status
sl status              # equivalent
```

## Global Flags

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show help text |
| `-v`, `--version` | Show version |

## Configuration

All configuration lives in `~/.securitylayer/`:

```
~/.securitylayer/
  config.yaml              # Main config (log level, proxy, semantic judge)
  capabilities/
    sessions.yaml          # Session capability grants
    channels.yaml          # Channel restrictions
    skills.yaml            # Skill definitions
  ai-tools.yaml            # AI tool caller profiles
  projects.yaml            # Project trust rules
  learned-rules.json       # Learned allow rules
  bin/                     # Shell shim scripts (when shield is enabled)
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success / ALLOW |
| `1` | Error / DENY |
| `2` | REQUIRE_APPROVAL (hook/check) |
