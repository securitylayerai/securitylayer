import type { Config } from "drizzle-kit";

export default {
  out: "./drizzle",
  schema: "./src/lib/db/schema/index.ts",
  breakpoints: true,
  verbose: true,
  strict: true,
  dialect: "sqlite",
  casing: "snake_case",
} satisfies Config;
