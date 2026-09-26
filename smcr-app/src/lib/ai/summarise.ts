/**
 * Builds the data-minimised payloads sent to the AI routes. Runs on the client.
 *
 * - Ask / gap review: NO names of individuals and NO fitness & propriety
 *   answers. People are referred to by role only (e.g. "SMF16 holder").
 *   F&P, conduct and reference matters are aggregated to counts.
 * - SoR draft: the SoR content for one person (as it would appear on the SoR),
 *   never their F&P answers.
 */
import { CATEGORY_LABELS, FIRM_SECTORS, LIMITED_SCOPE_BASES, getPR, prLabel } from "@/lib/rules/fca-solo";
import {
  activePeople,
  certifiedPeople,
  getCategorisation,
  getWorkspacePRs,
  smfHolders,
  type SorModel,
} from "@/lib/workspace/derive";
import { getHealthIssues, type HealthIssue } from "@/lib/workspace/health";
import { getObligations } from "@/lib/workspace/obligations";
import type { Person, Workspace } from "@/lib/workspace/schema";
import { MAX_CONTEXT_CHARS, type GapReviewRequest, type SorDraftRequest } from "./schemas";

/* -------------------------------- Helpers -------------------------------- */

/** Role-only label for a person — never their name. */
export function roleLabel(p: Person | undefined): string {
  if (!p) return "unassigned";
  if (p.smfs.length) return `${p.smfs.map((s) => s.smfId).join("/")} holder${p.status === "left" ? " (left)" : ""}`;
  if (p.certificationFunctions.length) return "certified staff member";
  return "staff member";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace every person's name in free text with their role label. */
export function redactNames(text: string, people: Person[]): string {
  let out = text;
  // Longest names first so "Jo Smith" is replaced before "Jo".
  const sorted = [...people].filter((p) => p.name.trim().length >= 2).sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    // Whole-word match so a short name such as "Al" does not alter "Allocate".
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(p.name.trim())}(?![\\p{L}\\p{N}])`, "giu"), `[${roleLabel(p)}]`);
  }
  return out;
}

function firmLines(ws: Workspace): string[] {
  const cat = getCategorisation(ws);
  const f = ws.firm;
  const flags = [
    f.holdsClientAssets ? "holds client money / custody assets" : "no client assets",
    f.isCassLarge ? "CASS large" : "",
    f.isAfm ? "authorised fund manager" : "",
    f.subjectToMlr ? "subject to the Money Laundering Regulations" : "not subject to the MLRs",
    f.outsourcesInternalAudit ? "outsources internal audit" : "",
    f.optUpToEnhanced ? "opted up to Enhanced" : "",
  ].filter(Boolean);
  return [
    `Sector: ${f.sector ? FIRM_SECTORS[f.sector].label : "not set"}`,
    `Legal form: ${f.legalForm}`,
    `SM&CR category: ${cat.category ? CATEGORY_LABELS[cat.category] : cat.outOfScope ? `outside this tool's scope (${cat.outOfScope})` : "not determined"}`,
    `Category reasons: ${cat.reasons.join("; ")}`,
    ...(f.limitedScopeBasis !== "none" ? [`Limited scope basis: ${LIMITED_SCOPE_BASES[f.limitedScopeBasis]}`] : []),
    `Flags: ${flags.join("; ")}`,
  ];
}

/* ------------------------------ Ask context ------------------------------ */

/** Compact, name-free workspace summary sent with Ask questions. */
export function buildAskContext(ws: Workspace, today: string): string {
  const people = activePeople(ws);
  const holders = smfHolders(ws);
  const prs = getWorkspacePRs(ws);
  const issues = getHealthIssues(ws, today);
  const obligations = getObligations(ws, today);

  const smfCounts = new Map<string, { n: number; statuses: string[] }>();
  for (const p of holders)
    for (const s of p.smfs) {
      const e = smfCounts.get(s.smfId) ?? { n: 0, statuses: [] };
      e.n++;
      e.statuses.push(s.status);
      smfCounts.set(s.smfId, e);
    }

  const prLines = prs.map((pr) => {
    const alloc = ws.responsibilities[pr.id];
    const owner = alloc?.ownerId ? ws.people.find((p) => p.id === alloc.ownerId) : undefined;
    const shared = (alloc?.sharedWithIds ?? []).map((id) => roleLabel(ws.people.find((p) => p.id === id)));
    return `- [PR:${pr.id}] ${prLabel(pr)} ${pr.title}`.trimEnd() +
      `: ${owner ? roleLabel(owner) : "UNALLOCATED"}${shared.length ? ` (shared with ${shared.join(", ")})` : ""}`;
  });

  const stale = Object.entries(ws.responsibilities)
    .filter(([id, a]) => a.ownerId && !prs.some((p) => p.id === id))
    .map(([id]) => getPR(id))
    .filter((p) => !!p)
    .map((p) => prLabel(p!));

  const count = (pred: (i: HealthIssue) => boolean) => issues.filter(pred).length;
  const areas = Array.from(new Set(issues.map((i) => i.area)));
  const oblCount = (s: string) => obligations.filter((o) => o.status === s).length;
  const oblAreas = Array.from(new Set(obligations.filter((o) => o.status === "overdue" || o.status === "due_soon").map((o) => o.area)));

  const lines = [
    "<workspace_summary>",
    ...firmLines(ws),
    `People: ${people.length} active; ${holders.length} SMF holders; ${certifiedPeople(ws).length} certified staff; ${people.filter((p) => p.conductRulesStaff).length} Conduct Rules staff; ${ws.people.length - people.length} leavers recorded`,
    `SMFs held: ${
      Array.from(smfCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
        .map(([id, e]) => `${id} x${e.n} (${e.statuses.join(", ")})`)
        .join("; ") || "none"
    }`,
    `Applicable prescribed responsibilities (${prs.length}) and holders by role:`,
    ...(prLines.length ? prLines : ["- none apply"]),
    ...(stale.length ? [`Allocations recorded for PRs that no longer apply: ${stale.join(", ")}`] : []),
    `Other/overall responsibilities recorded: ${ws.otherResponsibilities.filter((o) => o.kind === "overall").length} overall, ${ws.otherResponsibilities.filter((o) => o.kind === "additional").length} additional`,
    `SoRs: ${Object.values(ws.sors).filter((s) => s.status === "approved").length} approved of ${holders.length} SMF holders`,
    `Health check: ${count((i) => i.severity === "blocker")} blockers, ${count((i) => i.severity === "warning")} warnings, ${count((i) => i.severity === "info")} notes${areas.length ? ` (areas: ${areas.join(", ")})` : ""}`,
    `Obligations: ${oblCount("overdue")} overdue, ${oblCount("due_soon")} due within 30 days, ${oblCount("upcoming")} upcoming, ${oblCount("done")} done${oblAreas.length ? ` (overdue/due soon areas: ${oblAreas.join(", ")})` : ""}`,
    `Records: ${ws.certificates.length} certificates, ${ws.training.length} training records, ${ws.breaches.length} conduct breach records, ${ws.references.length} regulatory references, ${ws.handovers.length} handovers`,
    "</workspace_summary>",
  ];
  const text = lines.join("\n");
  return text.length > MAX_CONTEXT_CHARS ? text.slice(0, MAX_CONTEXT_CHARS - 30) + "\n…(truncated)\n</workspace_summary>" : text;
}

/* ------------------------------ Gap review ------------------------------- */

const AGGREGATED_PREFIXES: { prefix: string; title: (n: number) => string; area: HealthIssue["area"] }[] = [
  { prefix: "fit-incomplete-", title: (n) => `${n} F&P assessment(s) not fully completed`, area: "fitness" },
  { prefix: "fit-adverse-", title: (n) => `${n} F&P assessment(s) with matters needing an explanation`, area: "fitness" },
  { prefix: "fit-review-", title: (n) => `${n} F&P assessment(s) with disclosures for compliance review`, area: "fitness" },
  { prefix: "fit-outcome-", title: (n) => `${n} F&P assessment(s) without a recorded outcome, assessor or date`, area: "fitness" },
  { prefix: "fit-crc-", title: (n) => `${n} proposed SMF(s) with no criminal records check date recorded`, area: "fitness" },
  { prefix: "breach-open-", title: (n) => `${n} open conduct investigation(s)`, area: "conduct" },
  { prefix: "ref-adverse-", title: (n) => `${n} adverse regulatory reference(s) to consider`, area: "references" },
];

/** Name-free health issues + obligations summary for the gap review. */
export function buildGapReviewInput(ws: Workspace, today: string): GapReviewRequest {
  const issues = getHealthIssues(ws, today);
  const out: GapReviewRequest["issues"] = [];
  const aggregated = new Map<string, { n: number; severity: HealthIssue["severity"] }>();
  const rank = { blocker: 0, warning: 1, info: 2 } as const;

  for (const i of issues) {
    // Obligations are summarised separately below.
    if (i.area === "obligations") continue;
    const agg = AGGREGATED_PREFIXES.find((a) => i.id.startsWith(a.prefix));
    if (agg) {
      const e = aggregated.get(agg.prefix) ?? { n: 0, severity: i.severity };
      e.n++;
      if (rank[i.severity] < rank[e.severity]) e.severity = i.severity;
      aggregated.set(agg.prefix, e);
      continue;
    }
    out.push({
      area: i.area,
      severity: i.severity,
      title: redactNames(i.title, ws.people).slice(0, 300),
      ...(i.detail ? { detail: redactNames(i.detail, ws.people).slice(0, 500) } : {}),
      ...(i.handbookRef ? { handbookRef: i.handbookRef.slice(0, 120) } : {}),
    });
  }
  for (const a of AGGREGATED_PREFIXES) {
    const e = aggregated.get(a.prefix);
    if (e) out.push({ area: a.area, severity: e.severity, title: a.title(e.n) });
  }
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const obligations = getObligations(ws, today);
  const counts = { overdue: 0, due_soon: 0, upcoming: 0, done: 0 };
  for (const o of obligations) counts[o.status]++;
  const items = obligations
    .filter((o): o is typeof o & { status: "overdue" | "due_soon" | "upcoming" } => o.status !== "done")
    .slice(0, 40)
    .map((o) => ({
      title: redactNames(o.title, ws.people).slice(0, 300),
      dueOn: o.dueOn,
      status: o.status,
      area: o.area,
      source: o.source.slice(0, 120),
    }));

  return {
    firm: firmLines(ws).join("\n").slice(0, 2000),
    issues: out.slice(0, 80),
    obligations: { counts, items },
  };
}

/* ------------------------------- SoR draft ------------------------------- */

/** SoR content for one person (no F&P data). */
export function buildSorDraftInput(ws: Workspace, model: SorModel): SorDraftRequest {
  return {
    person: { name: model.person.name.slice(0, 200), jobTitle: model.person.jobTitle.slice(0, 200), isNonExecutive: model.person.isNonExecutive },
    firm: { category: model.category, sector: ws.firm.sector, legalForm: ws.firm.legalForm },
    smfs: model.smfs.slice(0, 20).map((s) => ({ id: s.id.slice(0, 20), title: s.title.slice(0, 200), status: s.status.slice(0, 40) })),
    prescribed: model.prescribed.slice(0, 20).map((p) => ({
      id: p.id,
      label: p.label.slice(0, 200),
      title: p.title.slice(0, 200),
      text: p.text.slice(0, 2000),
      shared: p.shared,
      sharedWith: p.sharedWith.slice(0, 10).map((n) => n.slice(0, 200)),
      notes: p.notes.slice(0, 2000),
    })),
    other: model.other.slice(0, 30).map((o) => ({ title: o.title.slice(0, 200), description: o.description.slice(0, 2000), kind: o.kind })),
    additionalText: model.additionalText.slice(0, 8000),
    reportingLine: model.reportingLine.slice(0, 500),
    committees: model.committees.slice(0, 1000),
  };
}
