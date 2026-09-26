import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Workspace } from "@/lib/workspace/schema";

/**
 * One row per firm workspace. The whole workspace is stored as a single JSONB
 * document so each save is one atomic statement (no partial writes and no
 * client/server ID mapping). There is no login: a workspace is reachable only
 * by its unguessable UUID, and there is deliberately no "list all" endpoint.
 */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  firmName: text("firm_name").notNull().default(""),
  rulesVersion: text("rules_version").notNull(),
  data: jsonb("data").$type<Workspace>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
