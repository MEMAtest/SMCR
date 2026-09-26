import { CATEGORY_LABELS, EXPECTED_SMFS, getSmf, prLabel } from "@/lib/rules/fca-solo";
import {
  activePeople,
  allocationWarnings,
  buildSorModel,
  certifiedPeople,
  fitnessStatus,
  getCategorisation,
  getPerson,
  getWorkspacePRs,
  peopleNeedingFit,
  smfHolders,
} from "./derive";
import { getObligations } from "./obligations";
import type { Workspace } from "./schema";

export type IssueSeverity = "blocker" | "warning" | "info";
export type IssueArea =
  | "firm"
  | "people"
  | "responsibilities"
  | "fitness"
  | "documents"
  | "certification"
  | "conduct"
  | "references"
  | "obligations";

export interface HealthIssue {
  id: string;
  severity: IssueSeverity;
  area: IssueArea;
  title: string;
  detail?: string;
  /** In-app link to fix it. */
  href?: string;
  handbookRef?: string;
}

export type WizardStep = "firm" | "people" | "responsibilities" | "fitness" | "documents";

export const WIZARD_STEPS: { id: WizardStep; title: string; description: string }[] = [
  { id: "firm", title: "Firm profile", description: "Scope and SM&CR category" },
  { id: "people", title: "Senior managers", description: "SMFs and certified staff" },
  { id: "responsibilities", title: "Responsibilities", description: "Allocate prescribed responsibilities" },
  { id: "fitness", title: "Fitness & propriety", description: "FIT assessments" },
  { id: "documents", title: "Documents", description: "SoRs, map and board pack" },
];

const STEP_AREAS: Record<WizardStep, IssueArea[]> = {
  firm: ["firm"],
  people: ["people"],
  responsibilities: ["responsibilities"],
  fitness: ["fitness"],
  documents: ["documents"],
};

function firmIssues(ws: Workspace): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const cat = getCategorisation(ws);
  if (!ws.firm.name.trim()) issues.push({ id: "firm-name", severity: "blocker", area: "firm", title: "Enter the firm name", href: "/builder?step=firm" });
  if (cat.outOfScope)
    issues.push({ id: "firm-out-of-scope", severity: "blocker", area: "firm", title: "Firm type is outside this tool's scope", detail: cat.reasons[0], href: "/builder?step=firm" });
  else if (!ws.firm.sector)
    issues.push({ id: "firm-sector", severity: "blocker", area: "firm", title: "Choose the firm's sector", href: "/builder?step=firm" });
  if (ws.firm.frn && !/^\d{6,7}$/.test(ws.firm.frn.trim()))
    issues.push({ id: "firm-frn", severity: "warning", area: "firm", title: "FRN should be 6 or 7 digits", href: "/builder?step=firm" });
  return issues;
}

function peopleIssues(ws: Workspace): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const category = getCategorisation(ws).category;
  const holders = smfHolders(ws);
  if (holders.length === 0)
    issues.push({ id: "people-none", severity: "blocker", area: "people", title: "Add at least one senior manager (SMF holder)", href: "/builder?step=people" });
  if (category) {
    const held = new Set(holders.flatMap((p) => p.smfs.map((s) => s.smfId)));
    for (const exp of EXPECTED_SMFS[category]) {
      if (exp.id === "SMF17" && !ws.firm.subjectToMlr) continue;
      if (!held.has(exp.id))
        issues.push({
          id: `people-expected-${exp.id}`,
          severity: "warning",
          area: "people",
          title: `No ${exp.id} ${getSmf(exp.id)?.title ?? ""} allocated`,
          detail: `Expected ${exp.condition}.`,
          href: "/builder?step=people",
          handbookRef: "SUP 10C",
        });
    }
    for (const p of holders) {
      for (const s of p.smfs) {
        const def = getSmf(s.smfId);
        if (def && !def.categories.includes(category))
          issues.push({ id: `people-cat-${p.id}-${s.smfId}`, severity: "blocker", area: "people", title: `${s.smfId} does not apply to ${CATEGORY_LABELS[category]} firms`, detail: `${p.name} is recorded as ${s.smfId}.`, href: "/builder?step=people" });
      }
    }
  }
  return issues;
}

function responsibilityIssues(ws: Workspace): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const prs = getWorkspacePRs(ws);
  const category = getCategorisation(ws).category;
  if (category === "limited") return issues;
  for (const pr of prs) {
    const alloc = ws.responsibilities[pr.id];
    const owner = getPerson(ws, alloc?.ownerId);
    if (!owner) {
      issues.push({ id: `pr-unowned-${pr.id}`, severity: "blocker", area: "responsibilities", title: `${prLabel(pr)} ${pr.title} has no owner`, href: "/builder?step=responsibilities", handbookRef: pr.handbookRef });
      continue;
    }
    for (const [i, w] of allocationWarnings(ws, pr, owner).entries())
      issues.push({ id: `pr-warn-${pr.id}-${i}`, severity: owner.smfs.length === 0 || owner.status !== "active" ? "blocker" : "warning", area: "responsibilities", title: w, href: "/builder?step=responsibilities" });
    if (alloc && alloc.sharedWithIds.length > 0 && alloc.notes.trim().length < 10)
      issues.push({ id: `pr-shared-${pr.id}`, severity: "warning", area: "responsibilities", title: `${prLabel(pr)} is shared — explain how it is split`, detail: "FG19/2 expects shared responsibilities to be justified and each holder's role clear.", href: "/builder?step=responsibilities" });
  }
  // Concentration: one person holding most PRs
  const counts = new Map<string, number>();
  for (const pr of prs) {
    const o = ws.responsibilities[pr.id]?.ownerId;
    if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
  }
  for (const [pid, n] of counts) {
    if (prs.length >= 5 && n / prs.length > 0.6)
      issues.push({ id: `pr-concentration-${pid}`, severity: "info", area: "responsibilities", title: `${getPerson(ws, pid)?.name ?? "One person"} holds ${n} of ${prs.length} PRs`, detail: "Check this is realistic for their time and capacity.", href: "/builder?step=responsibilities" });
  }
  if (category === "enhanced" && ws.otherResponsibilities.filter((o) => o.kind === "overall").length === 0)
    issues.push({ id: "overall-none", severity: "warning", area: "responsibilities", title: "No overall responsibilities recorded", detail: "Enhanced firms must allocate overall responsibility for every activity, business area and management function.", href: "/builder?step=responsibilities", handbookRef: "SYSC 26" });
  return issues;
}

function fitnessIssues(ws: Workspace): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const p of peopleNeedingFit(ws)) {
    const st = fitnessStatus(ws, p.id);
    const href = `/builder?step=fitness&person=${p.id}`;
    if (!st.allAnswered)
      issues.push({ id: `fit-incomplete-${p.id}`, severity: "blocker", area: "fitness", title: `${p.name}: ${st.total - st.answered} F&P questions unanswered`, href });
    if (st.unexplainedAdverse > 0)
      issues.push({ id: `fit-adverse-${p.id}`, severity: "blocker", area: "fitness", title: `${p.name}: ${st.unexplainedAdverse} potential concern(s) need an explanation`, href, handbookRef: "FIT 2" });
    if (st.adverse.length > 0 && st.unexplainedAdverse === 0)
      issues.push({ id: `fit-review-${p.id}`, severity: "info", area: "fitness", title: `${p.name}: ${st.adverse.length} disclosure(s) for compliance review`, href });
    if (st.allAnswered && !st.outcomeRecorded)
      issues.push({ id: `fit-outcome-${p.id}`, severity: "blocker", area: "fitness", title: `${p.name}: record the assessment outcome, assessor and date`, href });
    if (p.smfs.some((s) => s.status !== "approved") && !p.criminalRecordCheckDate)
      issues.push({ id: `fit-crc-${p.id}`, severity: "warning", area: "fitness", title: `${p.name}: no criminal records check date recorded`, detail: "Required for SMF applications; valid for 6 months (PS26/6).", href: "/builder?step=people" });
  }
  return issues;
}

function documentIssues(ws: Workspace): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const category = getCategorisation(ws).category;
  for (const p of smfHolders(ws)) {
    const model = buildSorModel(ws, p.id);
    if (!model) continue;
    const href = `/workspace/documents?person=${p.id}`;
    if (category !== "limited" && model.prescribed.length === 0 && model.other.length === 0 && !model.additionalText.trim())
      issues.push({ id: `sor-empty-${p.id}`, severity: "warning", area: "documents", title: `${p.name}'s Statement of Responsibilities is empty`, detail: "FG19/2: SoRs must be specific and self-contained.", href });
    if (ws.sors[p.id]?.status !== "approved")
      issues.push({ id: `sor-draft-${p.id}`, severity: "info", area: "documents", title: `${p.name}'s SoR is not yet approved`, href });
    if (ws.sors[p.id]?.aiDraft && !ws.sors[p.id]?.aiDraft?.acceptedBy)
      issues.push({ id: `sor-ai-${p.id}`, severity: "info", area: "documents", title: `${p.name}: AI draft awaiting human review`, href });
  }
  if (category === "enhanced" && !ws.mrm.governanceSummary.trim())
    issues.push({ id: "mrm-empty", severity: "warning", area: "documents", title: "Management responsibilities map has no governance summary", href: "/workspace/documents?tab=mrm", handbookRef: "SYSC 25" });
  return issues;
}

function ongoingIssues(ws: Workspace, today: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const p of certifiedPeople(ws)) {
    if (!ws.certificates.some((c) => c.personId === p.id))
      issues.push({ id: `cert-none-${p.id}`, severity: "warning", area: "certification", title: `${p.name} performs a certification function but has no certificate`, href: "/workspace/certification", handbookRef: "SYSC 27" });
  }
  const untrained = activePeople(ws).filter((p) => p.conductRulesStaff && !ws.training.some((t) => t.personId === p.id && (t.topic === "conduct_rules" || t.topic === "senior_conduct_rules")));
  if (untrained.length)
    issues.push({ id: "conduct-untrained", severity: "warning", area: "conduct", title: `${untrained.length} Conduct Rules staff without recorded training`, href: "/workspace/conduct", handbookRef: "COCON 2.3" });
  for (const b of ws.breaches.filter((b) => b.status === "investigating"))
    issues.push({ id: `breach-open-${b.id}`, severity: "info", area: "conduct", title: `Open conduct investigation: ${getPerson(ws, b.personId)?.name ?? "unknown"}`, href: "/workspace/conduct" });
  for (const r of ws.references.filter((r) => r.direction === "outgoing" && r.adverse))
    issues.push({ id: `ref-adverse-${r.id}`, severity: "warning", area: "references", title: `Adverse regulatory reference for ${getPerson(ws, r.personId)?.name ?? r.subjectName}`, detail: "Consider in the F&P assessment.", href: "/workspace/references" });
  for (const o of getObligations(ws, today)) {
    if (o.status === "overdue")
      issues.push({ id: `obl-${o.key}`, severity: "blocker", area: "obligations", title: `Overdue: ${o.title}`, detail: o.detail, href: "/workspace/calendar" });
    else if (o.status === "due_soon")
      issues.push({ id: `obl-${o.key}`, severity: "warning", area: "obligations", title: `Due ${o.dueOn}: ${o.title}`, detail: o.detail, href: "/workspace/calendar" });
  }
  return issues;
}

export function getHealthIssues(ws: Workspace, today: string): HealthIssue[] {
  return [
    ...firmIssues(ws),
    ...peopleIssues(ws),
    ...responsibilityIssues(ws),
    ...fitnessIssues(ws),
    ...documentIssues(ws),
    ...ongoingIssues(ws, today),
  ];
}

export interface StepValidation {
  complete: boolean;
  started: boolean;
  blockers: HealthIssue[];
  warnings: HealthIssue[];
}

export function validateStep(ws: Workspace, step: WizardStep, today: string): StepValidation {
  const areas = STEP_AREAS[step];
  const issues = getHealthIssues(ws, today).filter((i) => areas.includes(i.area));
  const blockers = issues.filter((i) => i.severity === "blocker");
  const warnings = issues.filter((i) => i.severity === "warning");
  const started =
    step === "firm"
      ? !!ws.firm.name || !!ws.firm.sector
      : step === "people"
        ? ws.people.length > 0
        : step === "responsibilities"
          ? Object.values(ws.responsibilities).some((r) => r.ownerId)
          : step === "fitness"
            ? Object.keys(ws.fitness).length > 0
            : Object.keys(ws.sors).length > 0;
  return { complete: blockers.length === 0 && (step !== "people" || smfHolders(ws).length > 0), started, blockers, warnings };
}

/** 0–100 score: share of checks passed, weighting blockers heavier than warnings. */
export function healthScore(issues: HealthIssue[]): number {
  const penalty = issues.reduce((n, i) => n + (i.severity === "blocker" ? 8 : i.severity === "warning" ? 3 : 0), 0);
  return Math.max(0, 100 - penalty);
}
