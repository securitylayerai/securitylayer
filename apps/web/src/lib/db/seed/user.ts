import { randomBytes, scryptSync } from "node:crypto";
import type { InferInsertModel } from "drizzle-orm";
import type { account, user } from "../schema";

type NewUser = InferInsertModel<typeof user>;
type NewAccount = InferInsertModel<typeof account>;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${hash}:${salt}`;
}

function createId(): string {
  return randomBytes(16).toString("hex");
}

const TEST_PASSWORD = "password123";

const users: NewUser[] = [
  {
    id: createId(),
    name: "Admin User",
    email: "admin@securitylayer.ai",
    emailVerified: true,
  },
  {
    id: createId(),
    name: "Test User",
    email: "user@securitylayer.ai",
    emailVerified: true,
  },
];

const hashedPassword = hashPassword(TEST_PASSWORD);

const accounts: NewAccount[] = users.map((u) => ({
  id: createId(),
  accountId: u.id,
  providerId: "credential",
  userId: u.id,
  password: hashedPassword,
}));

export { users, accounts };
