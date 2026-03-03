import { createServerOnlyFn } from "@tanstack/react-start";
import { env as cloudflareEnv } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/lib/db/schema";

const getDatabase = createServerOnlyFn(() =>
  drizzle(cloudflareEnv.SECURITYLAYER_DB, {
    schema,
    casing: "snake_case",
  }),
);

export const db = getDatabase();
