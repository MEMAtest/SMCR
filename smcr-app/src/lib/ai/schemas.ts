/**
 * Request / response contracts for the AI routes. Shared by client and server.
 *
 * Output schemas (the `*OutputSchema` ones) are sent to Claude as structured
 * output formats, so they deliberately avoid length constraints (not all JSON
 * Schema keywords are supported); the server clamps sizes after parsing.
 */
import { z } from "zod";
import type { IssueArea } from "@/lib/workspace/health";

export const MAX_QUESTION_CHARS = 2000;
export const MAX_CONTEXT_CHARS = 20_000;
/** Raw body cap before JSON parsing (defence in depth). */
export const MAX_BODY_CHARS = 60_000;

const s = (max: number) => z.string().max(max);

/* ------------------------------- SoR draft ------------------------------- */

export const SorDraftRequestSchema = z.object({
  person: z.object({
    name: s(200),
    jobTitle: s(200).default(""),
    isNonExecutive: z.boolean().default(false),
  }),
  firm: z.object({
    category: z.enum(["limited", "core", "enhanced"]).nullable(),
    sector: s(80).nullable().default(null),
    legalForm: s(40).default("company"),
  }),
  smfs: z.array(z.object({ id: s(20), title: s(200), status: s(40) })).max(20),
  prescribed: z
    .array(
      z.object({
        id: s(80),
        label: s(200),
        title: s(200),
        text: s(2000),
        shared: z.boolean(),
        sharedWith: z.array(s(200)).max(10),
        notes: s(2000),
      }),
    )
    .max(20),
  other: z.array(z.object({ title: s(200), description: s(2000), kind: z.enum(["overall", "additional"]) })).max(30),
  additionalText: s(8000),
  reportingLine: s(500),
  committees: s(1000),
});
export type SorDraftRequest = z.infer<typeof SorDraftRequestSchema>;

export const SorDraftOutputSchema = z.object({
  draft: z.string().describe("Proposed wording for the 'additional responsibilities / scope' section of the SoR, UK English."),
  rationale: z.array(z.string()).describe("Short bullet points explaining the drafting choices."),
  gaps: z.array(z.string()).describe("Specific points the human reviewer must confirm or supply."),
});
export type SorDraftOutput = z.infer<typeof SorDraftOutputSchema>;

/* ---------------------------------- Ask ---------------------------------- */

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3, "Ask a question of at least a few words").max(MAX_QUESTION_CHARS),
  context: z.string().max(MAX_CONTEXT_CHARS),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskOutputSchema = z.object({
  answer: z.string().describe("Plain-English answer in UK English. Cite source IDs inline in square brackets."),
  citations: z
    .array(z.object({ sourceId: z.string().describe("A source ID from the rules pack, e.g. PR:b-1"), note: z.string() }))
    .describe("Every rules-pack entry relied on."),
  confidence: z.enum(["high", "medium", "low"]),
  outOfScope: z.boolean().describe("True if the rules pack does not cover the question."),
  followUps: z.array(z.string()).describe("Up to three short follow-up questions the user might ask next."),
});
export type AskOutput = z.infer<typeof AskOutputSchema>;

/* ------------------------------ Gap review ------------------------------- */

export const ISSUE_AREAS = [
  "firm",
  "people",
  "responsibilities",
  "fitness",
  "documents",
  "certification",
  "conduct",
  "references",
  "obligations",
] as const satisfies readonly IssueArea[];

export const GapReviewRequestSchema = z.object({
  firm: s(2000),
  issues: z
    .array(
      z.object({
        area: z.enum(ISSUE_AREAS),
        severity: z.enum(["blocker", "warning", "info"]),
        title: s(300),
        detail: s(500).optional(),
        handbookRef: s(120).optional(),
      }),
    )
    .max(80),
  obligations: z.object({
    counts: z.object({ overdue: z.number().int().min(0), due_soon: z.number().int().min(0), upcoming: z.number().int().min(0), done: z.number().int().min(0) }),
    items: z
      .array(z.object({ title: s(300), dueOn: s(20), status: z.enum(["overdue", "due_soon", "upcoming"]), area: s(40), source: s(120) }))
      .max(40),
  }),
});
export type GapReviewRequest = z.infer<typeof GapReviewRequestSchema>;

export const GapReviewOutputSchema = z.object({
  summary: z.string().describe("Two or three sentences summarising the overall position, without stating the firm is compliant."),
  actions: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      sourceIds: z.array(z.string()).describe("Rules pack source IDs supporting this action."),
      priority: z.enum(["now", "next", "later"]),
      area: z.enum([...ISSUE_AREAS, "general"]).describe("The workspace area this action belongs to."),
    }),
  ),
});
export type GapReviewOutput = z.infer<typeof GapReviewOutputSchema>;

/* ------------------------------ Responses -------------------------------- */

export type SorDraftResponse = SorDraftOutput & { model: string };
export type AskResponse = AskOutput & { model: string; unverifiedCitations: number };
export type GapReviewResponse = GapReviewOutput & { model: string; unverifiedCitations: number };

export type AiErrorCode =
  | "ai_not_configured"
  | "ai_auth_failed"
  | "rate_limited"
  | "upstream_rate_limited"
  | "invalid_request"
  | "too_large"
  | "refused"
  | "truncated"
  | "bad_output"
  | "upstream_error"
  | "network"
  | "server_error";

export interface AiErrorBody {
  error: string;
  code: AiErrorCode;
  model?: string;
}
