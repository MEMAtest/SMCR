import { relations, sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
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
  smfRole: text("smf_role").notNull(),
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
