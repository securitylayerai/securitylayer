import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { accounts, users } from "./seed/user";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle({ client, schema, casing: "snake_case" });

async function seed() {
  console.log("Seeding database...\n");

  // Users
  console.log("Seeding users...");
  await db.insert(schema.user).values(users).onConflictDoNothing();
  console.log(`  ${users.length} users seeded`);

  // Accounts (credential login)
  console.log("Seeding accounts...");
  await db.insert(schema.account).values(accounts).onConflictDoNothing();
  console.log(`  ${accounts.length} accounts seeded`);

  console.log("\nSeed complete.");
  console.log("\nTest credentials:");
  console.log("  admin@securitylayer.ai / password123");
  console.log("  user@securitylayer.ai  / password123");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
