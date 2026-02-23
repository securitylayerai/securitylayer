import { existsSync } from "node:fs";
import { chmod, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR } from "@securitylayer/core";
import type { CliArgs } from "@/index";
import {
  configExists,
  detectShell,
  ensureConfigDir,
  getShellProfilePath,
  resolveRealBinary,
} from "@/shared";

const SHIM_DIR = join(CONFIG_DIR, "bin");
const SHIMMED_BINARIES = ["bash", "sh", "zsh", "python", "python3", "node", "ruby", "perl"];
const PATH_MARKER = "# SecurityLayer shell shim PATH";

// ---------------------------------------------------------------------------
// Shim template
// ---------------------------------------------------------------------------

function generateShim(binaryName: string, realPath: string): string {
  return `#!/bin/sh
# SecurityLayer shim for ${binaryName}
# Intercepts AI agent commands through SecurityLayer policy check

# Recursion guard
if [ -n "$SECURITYLAYER_CHECKING" ]; then
  exec "${realPath}" "$@"
fi

# Pass through interactive shells
case "$-" in
  *i*) exec "${realPath}" "$@" ;;
esac

# If no arguments, pass through
if [ $# -eq 0 ]; then
  exec "${realPath}" "$@"
fi

# Build command string for check
COMMAND="$*"

export SECURITYLAYER_CHECKING=1
RESULT=$(securitylayer check --tool exec --command "$COMMAND" --format json 2>/dev/null)
unset SECURITYLAYER_CHECKING

# Parse decision from JSON
DECISION=""
if command -v jq >/dev/null 2>&1; then
  DECISION=$(echo "$RESULT" | jq -r '.decision' 2>/dev/null)
elif command -v python3 >/dev/null 2>&1; then
  DECISION=$(echo "$RESULT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('decision',''))" 2>/dev/null)
else
  DECISION=$(echo "$RESULT" | grep -o '"decision":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

case "$DECISION" in
  ALLOW)
    exec "${realPath}" "$@"
    ;;
  DENY)
    echo "SecurityLayer: command blocked by policy" >&2
    exit 126
    ;;
  REQUIRE_APPROVAL)
    echo "SecurityLayer: command requires approval" >&2
    exit 126
    ;;
  *)
    # Fail safe — if we can't parse the result, block
    echo "SecurityLayer: unable to verify command safety, blocking" >&2
    exit 126
    ;;
esac
`;
}

// ---------------------------------------------------------------------------
// Shield enable
// ---------------------------------------------------------------------------

export async function runShieldEnable(_args: CliArgs): Promise<void> {
  if (!configExists()) {
    console.error("SecurityLayer is not configured. Run `securitylayer init` first.");
    process.exit(1);
  }

  await ensureConfigDir();

  let shimCount = 0;

  for (const binary of SHIMMED_BINARIES) {
    const realPath = await resolveRealBinary(binary);
    if (!realPath) continue;

    const shimPath = join(SHIM_DIR, binary);
    const shimContent = generateShim(binary, realPath);
    await writeFile(shimPath, shimContent, "utf-8");
    await chmod(shimPath, 0o755);
    shimCount++;
  }

  if (shimCount === 0) {
    console.error("No binaries found to shim.");
    process.exit(1);
  }

  // Add PATH to shell profile
  const shell = detectShell();
  const profilePath = getShellProfilePath(shell);
  await addPathToProfile(profilePath);

  console.log(`Shield enabled: ${shimCount} binaries shimmed.`);
  console.log(`Shim directory: ${SHIM_DIR}`);
  console.log(`Shell profile updated: ${profilePath}`);
  console.log(`\nRestart your shell or run: export PATH="${SHIM_DIR}:$PATH"`);
}

// ---------------------------------------------------------------------------
// Shield disable
// ---------------------------------------------------------------------------

export async function runShieldDisable(_args: CliArgs): Promise<void> {
  // Remove shim scripts
  if (existsSync(SHIM_DIR)) {
    for (const binary of SHIMMED_BINARIES) {
      const shimPath = join(SHIM_DIR, binary);
      try {
        await rm(shimPath);
      } catch {
        // ignore missing
      }
    }
  }

  // Remove PATH from shell profile
  const shell = detectShell();
  const profilePath = getShellProfilePath(shell);
  await removePathFromProfile(profilePath);

  console.log("Shield disabled. Shim scripts removed.");
  console.log(`Shell profile updated: ${profilePath}`);
  console.log("\nRestart your shell to apply changes.");
}

// ---------------------------------------------------------------------------
// Shield status
// ---------------------------------------------------------------------------

export async function runShieldStatus(_args: CliArgs): Promise<void> {
  const shimDirExists = existsSync(SHIM_DIR);
  const pathIncludesShimDir = (process.env.PATH ?? "").split(":").includes(SHIM_DIR);

  console.log("Shield Status");
  console.log("─".repeat(40));
  console.log(`Shim directory: ${shimDirExists ? "exists" : "not found"} (${SHIM_DIR})`);
  console.log(`PATH includes shim dir: ${pathIncludesShimDir ? "yes" : "no"}`);

  if (shimDirExists) {
    const shims: string[] = [];
    try {
      const entries = await readdir(SHIM_DIR);
      for (const entry of entries) {
        if (SHIMMED_BINARIES.includes(entry)) {
          shims.push(entry);
        }
      }
    } catch {
      // ignore
    }

    if (shims.length > 0) {
      console.log(`\nShimmed binaries (${shims.length}):`);
      for (const s of shims) {
        console.log(`  ${s}`);
      }
    } else {
      console.log("\nNo shimmed binaries found.");
    }
  }

  const active = shimDirExists && pathIncludesShimDir;
  console.log(`\nShield: ${active ? "\x1b[32mACTIVE\x1b[0m" : "\x1b[31mINACTIVE\x1b[0m"}`);
}

// ---------------------------------------------------------------------------
// Shell profile helpers
// ---------------------------------------------------------------------------

async function addPathToProfile(profilePath: string): Promise<void> {
  const exportLine = `\nexport PATH="${SHIM_DIR}:$PATH" ${PATH_MARKER}\n`;

  try {
    const content = await readFile(profilePath, "utf-8");
    if (content.includes(PATH_MARKER)) return; // already added
    await writeFile(profilePath, content + exportLine, "utf-8");
  } catch {
    // Profile doesn't exist — create it
    await writeFile(profilePath, exportLine, "utf-8");
  }
}

async function removePathFromProfile(profilePath: string): Promise<void> {
  try {
    const content = await readFile(profilePath, "utf-8");
    const filtered = content
      .split("\n")
      .filter((line) => !line.includes(PATH_MARKER))
      .join("\n");
    await writeFile(profilePath, filtered, "utf-8");
  } catch {
    // ignore
  }
}
