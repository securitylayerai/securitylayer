import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "adapters",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
