import type { UlimitConfig } from "./types.js";

/** Default ulimit values for sandboxed execution. */
export const DEFAULT_ULIMITS: UlimitConfig = {
  cpu: 30, // 30 seconds
  mem: 512 * 1024 * 1024, // 512 MB
  fileSize: 100 * 1024 * 1024, // 100 MB
  openFiles: 256,
  procs: 64,
};

/**
 * Generates shell ulimit flags from a config.
 * Returns an array of ulimit commands to prepend.
 */
export function buildUlimitArgs(config: UlimitConfig): string[] {
  return [
    `ulimit -t ${config.cpu}`,
    `ulimit -v ${Math.floor(config.mem / 1024)}`, // ulimit -v is in KB
    `ulimit -f ${Math.floor(config.fileSize / 512)}`, // ulimit -f is in 512-byte blocks
    `ulimit -n ${config.openFiles}`,
    `ulimit -u ${config.procs}`,
  ];
}
