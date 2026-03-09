import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, "../core");

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [
        path.resolve(__dirname, "tsconfig.json"),
        path.resolve(coreDir, "tsconfig.json"),
      ],
    }),
  ],
  test: {
    name: "sdk",
    globals: true,
    passWithNoTests: false,
    include: ["test/**/*.test.ts"],
  },
});
