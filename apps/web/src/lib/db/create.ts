import postgres from "postgres";

if (process.env.NODE_ENV === "production") {
  console.error("db:create is not allowed in production.");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const dbName = url.pathname.slice(1);

// Connect to the default 'postgres' database to create the target database
url.pathname = "/postgres";
const client = postgres(url.toString());

async function createDatabase() {
  const existing = await client`
    SELECT 1 FROM pg_database WHERE datname = ${dbName}
  `;

  if (existing.length > 0) {
    console.log(`Database "${dbName}" already exists.`);
  } else {
    await client.unsafe(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created.`);
  }
}

createDatabase()
  .catch((error) => {
    console.error("Failed to create database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
