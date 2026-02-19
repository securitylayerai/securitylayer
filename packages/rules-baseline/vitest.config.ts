import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "rules-baseline",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
