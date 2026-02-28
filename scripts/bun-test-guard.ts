import { execSync } from "node:child_process";

console.log("Redirecting to Vitest (`bun run test`)...\n");
execSync("bun run test", { stdio: "inherit" });
process.exit(0);
