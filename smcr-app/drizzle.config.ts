import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.warn("[drizzle] DATABASE_URL is not set. Commands like db:push will fail until you add it to .env");
}

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
});
