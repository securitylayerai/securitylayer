#!/usr/bin/env bun

import { Glob } from "bun";
import { versionBump } from "bumpp";

const ROOT = import.meta.dir + "/..";
const patterns = ["package.json", "packages/*/package.json"];
const packages: string[] = [];
for (const pattern of patterns) {
  for await (const path of new Glob(pattern).scan({ cwd: ROOT })) {
    packages.push(path);
  }
}

console.log("Bumping versions in packages:", packages.join(", "), "\n");

await versionBump({
  files: packages,
  tag: true,
  push: true,
});

console.log("\n  The release workflow will now run on GitHub Actions.");
console.log("  Monitor at: https://github.com/securitylayerai/securitylayer/actions");
