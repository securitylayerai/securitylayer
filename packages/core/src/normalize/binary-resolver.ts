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

/**
 * Resolves common binary aliases to their canonical name.
 * Returns the input as-is if no alias is known.
 */
export function resolveActualBinary(name: string): string {
  // Strip path prefix if present (e.g., /usr/bin/rm → rm)
  const basename = name.includes("/") ? (name.split("/").pop() ?? name) : name;
  return BINARY_ALIASES[basename] ?? basename;
}
