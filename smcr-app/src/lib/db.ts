import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle> | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env before invoking the data layer.");
  }

  if (!global.__db) {
    const client = neon(connectionString);
    global.__db = drizzle(client, { schema });
  }

  return global.__db;
}

// Export a singleton instance for NextAuth adapter
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const client = neon(connectionString);
export const db = drizzle(client, { schema });
