import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const firms = pgTable("firms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  firmType: text("firm_type").notNull(),
  smcrCategory: text("smcr_category"),
  isCassFirm: boolean("is_cass_firm").default(false).notNull(),
  optUp: boolean("opt_up").default(false).notNull(),
  jurisdictions: jsonb("jurisdictions").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const individuals = pgTable("individuals", {
  id: uuid("id").defaultRandom().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  smfRoles: jsonb("smf_roles").$type<string[]>().notNull(),
  email: text("email"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const responsibilities = pgTable("responsibilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  title: text("title").notNull(),
  status: text("status").default("pending").notNull(),
  ownerId: uuid("owner_id").references(() => individuals.id, { onDelete: "set null" }),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fitnessAssessments = pgTable("fitness_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  individualId: uuid("individual_id")
    .notNull()
    .references(() => individuals.id, { onDelete: "cascade" }),
  fitSection: text("fit_section").notNull(),
  response: text("response"),
  status: text("status").default("draft").notNull(),
  evidenceLinks: jsonb("evidence_links").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const certifications = pgTable("certifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  individualId: uuid("individual_id")
    .notNull()
    .references(() => individuals.id, { onDelete: "cascade" }),
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  status: text("status").default("draft").notNull(),
  documentUrl: text("document_url"),
});

export const firmsRelations = relations(firms, ({ many }) => ({
  individuals: many(individuals),
  responsibilities: many(responsibilities),
  certifications: many(certifications),
}));

export const individualsRelations = relations(individuals, ({ many, one }) => ({
  firm: one(firms, {
    fields: [individuals.firmId],
    references: [firms.id],
  }),
  responsibilities: many(responsibilities),
  fitnessAssessments: many(fitnessAssessments),
  certifications: many(certifications),
}));

export const responsibilitiesRelations = relations(responsibilities, ({ one }) => ({
  firm: one(firms, {
    fields: [responsibilities.firmId],
    references: [firms.id],
  }),
  owner: one(individuals, {
    fields: [responsibilities.ownerId],
    references: [individuals.id],
  }),
}));

export const fitnessAssessmentsRelations = relations(fitnessAssessments, ({ one }) => ({
  individual: one(individuals, {
    fields: [fitnessAssessments.individualId],
    references: [individuals.id],
  }),
}));

export const certificationsRelations = relations(certifications, ({ one }) => ({
  firm: one(firms, {
    fields: [certifications.firmId],
    references: [firms.id],
  }),
  individual: one(individuals, {
    fields: [certifications.individualId],
    references: [individuals.id],
  }),
}));

// NextAuth.js tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  role: text("role").default("user").notNull(), // 'user' or 'admin'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compoundKey: primaryKey({
    columns: [account.provider, account.providerAccountId],
  }),
}));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

// Auth relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
