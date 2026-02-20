import { existsSync, readlinkSync } from "node:fs";
import { basename, resolve } from "node:path";

/** Common binary aliases mapped to canonical names. */
const BINARY_ALIASES: Record<string, string> = {
  ggrep: "grep",
  gsed: "sed",
  gawk: "awk",
  gfind: "find",
  gmake: "make",
  python3: "python",
  "python3.11": "python",
  "python3.12": "python",
  "python3.13": "python",
  nodejs: "node",
  pip3: "pip",
};

const COMMON_PATH_DIRS = ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

/**
 * Resolves common binary aliases to their canonical name.
 * Follows symlinks and checks common PATH directories.
 */
export function resolveActualBinary(name: string): string {
  const baseName = name.includes("/") ? (name.split("/").pop() ?? name) : name;
  const aliased = BINARY_ALIASES[baseName] ?? baseName;

  // If given an absolute path, try to follow symlinks
  if (name.startsWith("/")) {
    try {
      const target = readlinkSync(name);
      const targetBase = basename(target);
      return BINARY_ALIASES[targetBase] ?? targetBase;
    } catch {
      // Not a symlink or doesn't exist, use basename
    }
  }

  // Try to resolve from common PATH dirs
  for (const dir of COMMON_PATH_DIRS) {
    const fullPath = resolve(dir, aliased);
    if (existsSync(fullPath)) {
      try {
        const target = readlinkSync(fullPath);
        const targetBase = basename(target);
        return BINARY_ALIASES[targetBase] ?? targetBase;
      } catch {
        // Not a symlink, the resolved name is canonical
      }
      break;
    }
  }

  return aliased;
}
