#!/usr/bin/env bun

import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BunPlugin } from "bun";

const CLI_PKG = join(import.meta.dir, "..", "packages", "cli");
const CORE_PKG = join(import.meta.dir, "..", "packages", "core");
const ENTRYPOINT = join(CLI_PKG, "bin", "securitylayer.ts");
const OUT_DIR = join(CLI_PKG, "bin-dist");

// Resolve @/* path aliases used across CLI and core packages.
// When the importer is inside core, resolve @/* to core/src/*.
// Otherwise (CLI or bin), resolve @/* to cli/src/* first, then core/src/*.
const pathAliasPlugin: BunPlugin = {
  name: "path-alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const rest = args.path.slice(2); // strip "@/"
      const exts = ["", ".ts", ".tsx", "/index.ts"];

      const isFromCore = args.importer.includes("/packages/core/");
      const searchDirs = isFromCore
        ? [join(CORE_PKG, "src")]
        : [join(CLI_PKG, "src"), join(CORE_PKG, "src")];

      for (const dir of searchDirs) {
        for (const ext of exts) {
          const candidate = join(dir, rest + ext);
          if (existsSync(candidate)) {
            return { path: candidate };
          }
        }
      }

      return undefined;
    });
  },
};

const ALL_TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
  "linux-x64-musl": "bun-linux-x64-musl",
  "win-x64": "bun-windows-x64",
} as const;

type TargetName = keyof typeof ALL_TARGETS;


const targets = Object.keys(ALL_TARGETS) as TargetName[];

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

console.log(`Building CLI binaries → ${OUT_DIR}\n`);
console.log(`Targets: ${targets.join(", ")}\n`);

const results: string[] = [];

for (const name of targets) {
  try {
    const outfile = await build(name);
    results.push(outfile);
  } catch (err) {
    console.error(`\n✗ ${name}: ${err}`);
    process.exit(1);
  }
}

console.log(`\n✓ Built ${results.length} binaries:\n`);
for (const r of results) {
  console.log(`  ${r}`);
}


async function build(name: TargetName): Promise<string> {
  const bunTarget = ALL_TARGETS[name];
  const ext = name === "win-x64" ? ".exe" : "";
  const outfile = join(OUT_DIR, `securitylayer-${name}${ext}`);

  console.log(`  → ${name} (${bunTarget})`);

  try {
    const result = await Bun.build({
      entrypoints: [ENTRYPOINT],
      plugins: [pathAliasPlugin],
      compile: {
        target: bunTarget,
        outfile,
      },
    });

    if (!result.success) {
      console.error(`\nBuild failed for ${name}:\n`);
      for (const log of result.logs) {
        console.error(`  ${log.message}`);
      }
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`\nBuild failed for ${name}:\n`);
    if (err.errors) {
      for (const e of err.errors) {
        console.error(`  ${e}`);
      }
    } else {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }

  return outfile;
}
