import { z } from "zod";
import { RULES_META } from "@/lib/rules/fca-solo";

/**
 * The whole firm workspace is one JSON document. It is persisted in the
 * browser (localStorage) and, optionally, to Postgres as a single JSONB row,
 * so saves are atomic and there is no client/server ID mapping.
 *
 * Every field has a default so older or partial documents still parse.
 */

const isoDate = z.string().max(40);
const text = (max = 4000) => z.string().max(max);
const id = z.string().min(1).max(80);

export const SECTORS = [
  "investment",
  "asset_manager",
  "financial_adviser",
  "insurance_intermediary",
  "mortgage",
  "consumer_credit",
  "other_fca",
] as const;

export const FirmSchema = z.object({
  name: text(200).default(""),
  frn: text(20).default(""),
  legalForm: z.enum(["company", "partnership", "llp", "sole_trader", "other"]).default("company"),
  sector: z.enum(SECTORS).nullable().default(null),
  outOfScope: z.enum(["dual_regulated", "payments_emoney"]).nullable().default(null),
  limitedScopeBasis: z
    .enum(["none", "limited_permission_consumer_credit", "insurance_ancillary", "not_for_profit_debt_advice", "other_limited"])
    .default("none"),
  holdsClientAssets: z.boolean().default(false),
  isCassLarge: z.boolean().default(false),
  isAfm: z.boolean().default(false),
  subjectToMlr: z.boolean().default(true),
  outsourcesInternalAudit: z.boolean().default(false),
  aumGbpBn: z.number().min(0).nullable().default(null),
  intermediaryRevenueGbpM: z.number().min(0).nullable().default(null),
  consumerCreditRevenueGbpM: z.number().min(0).nullable().default(null),
  mortgagesOutstanding: z.number().min(0).nullable().default(null),
  isSignificantIfprFirm: z.boolean().default(false),
  optUpToEnhanced: z.boolean().default(false),
});

export const SmfHoldingSchema = z.object({
  smfId: id,
  status: z.enum(["proposed", "temporary_cover", "application_submitted", "approved"]).default("proposed"),
  coverStartDate: isoDate.optional(),
  applicationSubmittedDate: isoDate.optional(),
  approvedDate: isoDate.optional(),
});

export const PersonSchema = z.object({
  id,
  name: text(200),
  email: text(200).default(""),
  jobTitle: text(200).default(""),
  isNonExecutive: z.boolean().default(false),
  startDate: isoDate.optional(),
  status: z.enum(["active", "left"]).default("active"),
  leftDate: isoDate.optional(),
  smfs: z.array(SmfHoldingSchema).default([]),
  certificationFunctions: z.array(id).default([]),
  /** Conduct Rules staff = everyone except ancillary staff. */
  conductRulesStaff: z.boolean().default(true),
  criminalRecordCheckDate: isoDate.optional(),
  creditCheckDate: isoDate.optional(),
});

export const ResponsibilityAllocationSchema = z.object({
  ownerId: id.optional(),
  /** Shared PRs must be genuinely shared and explained (FG19/2). */
  sharedWithIds: z.array(id).default([]),
  notes: text(2000).default(""),
});

export const OtherResponsibilitySchema = z.object({
  id,
  title: text(200),
  description: text(2000).default(""),
  ownerId: id.optional(),
  /** "overall" = SYSC 26 overall responsibility (Enhanced); "additional" = other SoR item. */
  kind: z.enum(["overall", "additional"]).default("additional"),
});

export const FitAnswerSchema = z.object({
  answer: z.enum(["yes", "no", "na"]).optional(),
  details: text(4000).default(""),
  date: isoDate.optional(),
  evidence: text(1000).default(""),
});

export const FitAssessmentSchema = z.object({
  answers: z.record(z.string(), FitAnswerSchema).default({}),
  assessor: text(200).default(""),
  assessedOn: isoDate.optional(),
  outcome: z.enum(["fit", "fit_with_conditions", "not_fit"]).optional(),
  conditions: text(2000).default(""),
});

export const SorSchema = z.object({
  /** Free text for responsibilities beyond PRs (FG19/2: specific, self-contained). */
  additionalText: text(8000).default(""),
  reportingLine: text(500).default(""),
  committees: text(1000).default(""),
  status: z.enum(["draft", "approved"]).default("draft"),
  approvedBy: text(200).default(""),
  approvedOn: isoDate.optional(),
  version: z.number().int().min(1).default(1),
  history: z
    .array(z.object({ version: z.number().int(), date: isoDate, summary: text(500), snapshot: text(20000).default("") }))
    .default([]),
  /** Latest AI draft awaiting human review. */
  aiDraft: z
    .object({
      text: text(8000),
      generatedAt: isoDate,
      model: text(80),
      rationale: z.array(text(1000)).max(20).default([]),
      gaps: z.array(text(1000)).max(20).default([]),
      acceptedBy: text(200).optional(),
      acceptedOn: isoDate.optional(),
    })
    .optional(),
});

export const MrmSchema = z.object({
  governanceSummary: text(8000).default(""),
  reportingLines: text(4000).default(""),
  committees: z
    .array(z.object({ id, name: text(200), chairId: id.optional(), memberIds: z.array(id).default([]), purpose: text(1000).default("") }))
    .default([]),
  lastReviewedOn: isoDate.optional(),
  approvedBy: text(200).default(""),
});

export const CertificateSchema = z.object({
  id,
  personId: id,
  functionIds: z.array(id).default([]),
  issuedOn: isoDate,
  issuedBy: text(200).default(""),
  outcome: z.enum(["certified", "not_certified"]).default("certified"),
  notes: text(2000).default(""),
});

export const TrainingRecordSchema = z.object({
  id,
  personId: id,
  topic: z.enum(["conduct_rules", "senior_conduct_rules", "consumer_duty", "financial_crime", "other"]),
  completedOn: isoDate,
  notes: text(1000).default(""),
});

export const BreachSchema = z.object({
  id,
  personId: id,
  ruleIds: z.array(id).default([]),
  occurredOn: isoDate,
  identifiedOn: isoDate.optional(),
  description: text(4000).default(""),
  nonFinancialMisconduct: z.boolean().default(false),
  disciplinaryAction: z.boolean().default(false),
  disciplinaryActionOn: isoDate.optional(),
  status: z.enum(["investigating", "confirmed", "not_a_breach", "closed"]).default("investigating"),
  notifiedOn: isoDate.optional(),
  notes: text(2000).default(""),
});

export const ReferenceSchema = z.object({
  id,
  personId: id.optional(),
  /** outgoing = we requested a reference; incoming = another firm asked us for one. */
  direction: z.enum(["outgoing", "incoming"]),
  subjectName: text(200).default(""),
  counterparty: text(200),
  requestedOn: isoDate,
  completedOn: isoDate.optional(),
  periodFrom: isoDate.optional(),
  periodTo: isoDate.optional(),
  adverse: z.boolean().default(false),
  status: z.enum(["pending", "received", "sent", "chased"]).default("pending"),
  notes: text(2000).default(""),
});

export const ReasonableStepSchema = z.object({
  id,
  personId: id,
  prId: z.string().max(80).optional(),
  date: isoDate,
  kind: z.enum(["mi_review", "challenge", "escalation", "meeting", "policy_review", "delegation_oversight", "training", "other"]),
  summary: text(4000),
  evidence: text(1000).default(""),
});

export const HandoverSchema = z.object({
  id,
  fromPersonId: id,
  toPersonId: id.optional(),
  date: isoDate,
  prIds: z.array(z.string().max(80)).default([]),
  notes: text(8000).default(""),
  status: z.enum(["draft", "completed"]).default("draft"),
});

export const AiLogEntrySchema = z.object({
  id,
  at: isoDate,
  feature: z.enum(["sor_draft", "ask", "gap_review"]),
  summary: text(500),
  model: text(80),
  acceptedBy: text(200).optional(),
});

export const WorkspaceSchema = z.object({
  schemaVersion: z.literal(2).default(2),
  rulesVersion: z.string().default(RULES_META.id),
  firm: FirmSchema.default(FirmSchema.parse({})),
  people: z.array(PersonSchema).default([]),
  responsibilities: z.record(z.string(), ResponsibilityAllocationSchema).default({}),
  otherResponsibilities: z.array(OtherResponsibilitySchema).default([]),
  fitness: z.record(z.string(), FitAssessmentSchema).default({}),
  sors: z.record(z.string(), SorSchema).default({}),
  mrm: MrmSchema.default(MrmSchema.parse({})),
  certificates: z.array(CertificateSchema).default([]),
  training: z.array(TrainingRecordSchema).default([]),
  breaches: z.array(BreachSchema).default([]),
  references: z.array(ReferenceSchema).default([]),
  reasonableSteps: z.array(ReasonableStepSchema).default([]),
  handovers: z.array(HandoverSchema).default([]),
  /** obligation key -> ISO date marked done */
  obligationsDone: z.record(z.string(), isoDate).default({}),
  aiLog: z.array(AiLogEntrySchema).default([]),
  updatedAt: isoDate.optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Firm = z.infer<typeof FirmSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type SmfHolding = z.infer<typeof SmfHoldingSchema>;
export type ResponsibilityAllocation = z.infer<typeof ResponsibilityAllocationSchema>;
export type OtherResponsibility = z.infer<typeof OtherResponsibilitySchema>;
export type FitAnswerRecord = z.infer<typeof FitAnswerSchema>;
export type FitAssessment = z.infer<typeof FitAssessmentSchema>;
export type Sor = z.infer<typeof SorSchema>;
export type Mrm = z.infer<typeof MrmSchema>;
export type Certificate = z.infer<typeof CertificateSchema>;
export type TrainingRecord = z.infer<typeof TrainingRecordSchema>;
export type Breach = z.infer<typeof BreachSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type ReasonableStep = z.infer<typeof ReasonableStepSchema>;
export type Handover = z.infer<typeof HandoverSchema>;
export type AiLogEntry = z.infer<typeof AiLogEntrySchema>;

export function emptyWorkspace(): Workspace {
  return WorkspaceSchema.parse({});
}

export function emptySor(): Sor {
  return SorSchema.parse({});
}

export function emptyFitAssessment(): FitAssessment {
  return FitAssessmentSchema.parse({});
}

export function newId(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
