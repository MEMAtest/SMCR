import {
  categoriseFirm,
  FIT_SECTIONS,
  FIT_QUESTION_COUNT,
  getApplicablePRs,
  getApplicableSmfs,
  getPR,
  getSmf,
  isAdverse,
  prLabel,
  PRESCRIBED_RESPONSIBILITIES,
  type CategorisationResult,
  type FitQuestion,
  type PrescribedResponsibility,
  type SmcrCategory,
  type SmfDefinition,
} from "@/lib/rules/fca-solo";
import { addMonths } from "./dates";
import type { FitAnswerRecord, Person, Workspace } from "./schema";

export function getCategorisation(ws: Workspace): CategorisationResult {
  return categoriseFirm(ws.firm);
}

export function getCategory(ws: Workspace): SmcrCategory | null {
  return getCategorisation(ws).category;
}

export function getWorkspacePRs(ws: Workspace): PrescribedResponsibility[] {
  return getApplicablePRs({
    category: getCategory(ws),
    holdsClientAssets: ws.firm.holdsClientAssets,
    isAfm: ws.firm.isAfm,
    outsourcesInternalAudit: ws.firm.outsourcesInternalAudit,
  });
}

export function getWorkspaceSmfs(ws: Workspace): SmfDefinition[] {
  return getApplicableSmfs(getCategory(ws));
}

export function activePeople(ws: Workspace): Person[] {
  return ws.people.filter((p) => p.status === "active");
}

export function smfHolders(ws: Workspace): Person[] {
  return activePeople(ws).filter((p) => p.smfs.length > 0);
}

export function certifiedPeople(ws: Workspace): Person[] {
  return activePeople(ws).filter((p) => p.certificationFunctions.length > 0);
}

export function getPerson(ws: Workspace, id: string | undefined): Person | undefined {
  return id ? ws.people.find((p) => p.id === id) : undefined;
}

export function personSmfLabel(person: Person): string {
  return person.smfs.map((s) => s.smfId).join(", ");
}

export function personLabel(person: Person): string {
  const smfs = personSmfLabel(person);
  return smfs ? `${person.name} (${smfs})` : person.name;
}

/** PRs (applicable to the firm) whose owner or co-holder is this person. */
export function prsHeldBy(ws: Workspace, personId: string): { pr: PrescribedResponsibility; shared: boolean }[] {
  return getWorkspacePRs(ws)
    .map((pr) => {
      const alloc = ws.responsibilities[pr.id];
      if (!alloc) return null;
      if (alloc.ownerId === personId) return { pr, shared: alloc.sharedWithIds.length > 0 };
      if (alloc.sharedWithIds.includes(personId)) return { pr, shared: true };
      return null;
    })
    .filter((x): x is { pr: PrescribedResponsibility; shared: boolean } => x !== null);
}

/** Allocation warnings for a PR/person pair (guidance, not hard rules). */
export function allocationWarnings(ws: Workspace, pr: PrescribedResponsibility, person: Person | undefined): string[] {
  if (!person) return [];
  const warnings: string[] = [];
  const category = getCategory(ws);
  if (person.status !== "active") warnings.push(`${person.name} is marked as having left the firm.`);
  if (person.smfs.length === 0) {
    warnings.push(`${person.name} does not hold an SMF — prescribed responsibilities must be allocated to an SMF manager.`);
    return warnings;
  }
  const outOfCategory = person.smfs.filter((s) => {
    const def = getSmf(s.smfId);
    return def && category && !def.categories.includes(category);
  });
  if (outOfCategory.length) {
    warnings.push(`${outOfCategory.map((s) => s.smfId).join(", ")} does not apply to ${category} firms.`);
  }
  const isNed = person.isNonExecutive || person.smfs.every((s) => getSmf(s.smfId)?.kind === "non_executive");
  if (pr.nedExpected && !isNed) warnings.push(`${prLabel(pr)} is normally held by a non-executive.`);
  if (!pr.nedExpected && isNed && pr.categories.includes("core"))
    warnings.push(`${prLabel(pr)} is an executive responsibility; allocating it to a non-executive needs justification.`);
  return warnings;
}

/* ---------------------------- Fitness & propriety ---------------------------- */

export interface AdverseItem {
  sectionId: string;
  question: FitQuestion;
  record: FitAnswerRecord;
  explained: boolean;
}

export interface FitnessStatus {
  answered: number;
  total: number;
  adverse: AdverseItem[];
  unexplainedAdverse: number;
  missingDates: number;
  allAnswered: boolean;
  outcomeRecorded: boolean;
  /** Everything answered, adverse items explained, outcome + assessor recorded. */
  complete: boolean;
  nextDueOn?: string;
}

export function fitnessStatus(ws: Workspace, personId: string): FitnessStatus {
  const assessment = ws.fitness[personId];
  const answers = assessment?.answers ?? {};
  let answered = 0;
  let missingDates = 0;
  const adverse: AdverseItem[] = [];
  for (const section of FIT_SECTIONS) {
    for (const q of section.questions) {
      const rec = answers[q.id];
      if (!rec?.answer) continue;
      if (rec.answer === "na" && !q.allowNA) continue;
      answered++;
      if (isAdverse(q, rec.answer)) {
        const explained = rec.details.trim().length >= 10;
        adverse.push({ sectionId: section.id, question: q, record: rec, explained });
        if (q.askDate && !rec.date) missingDates++;
      }
    }
  }
  const unexplainedAdverse = adverse.filter((a) => !a.explained).length;
  const allAnswered = answered === FIT_QUESTION_COUNT;
  const outcomeRecorded = !!assessment?.outcome && !!assessment.assessor.trim() && !!assessment.assessedOn;
  return {
    answered,
    total: FIT_QUESTION_COUNT,
    adverse,
    unexplainedAdverse,
    missingDates,
    allAnswered,
    outcomeRecorded,
    complete: allAnswered && unexplainedAdverse === 0 && outcomeRecorded,
    nextDueOn: assessment?.assessedOn ? addMonths(assessment.assessedOn, 12) : undefined,
  };
}

/** People who need an F&P assessment: SMF holders and certified staff. */
export function peopleNeedingFit(ws: Workspace): Person[] {
  return activePeople(ws).filter((p) => p.smfs.length > 0 || p.certificationFunctions.length > 0);
}

/* ------------------------------- SoR model --------------------------------- */

export interface SorModel {
  person: Person;
  firmName: string;
  frn: string;
  category: SmcrCategory | null;
  smfs: { id: string; title: string; status: string }[];
  prescribed: { id: string; label: string; title: string; text: string; shared: boolean; sharedWith: string[]; notes: string }[];
  other: { title: string; description: string; kind: "overall" | "additional" }[];
  additionalText: string;
  reportingLine: string;
  committees: string;
  status: "draft" | "approved";
  version: number;
  approvedBy: string;
  approvedOn?: string;
}

export function buildSorModel(ws: Workspace, personId: string): SorModel | null {
  const person = getPerson(ws, personId);
  if (!person) return null;
  const sor = ws.sors[personId];
  const prescribed = prsHeldBy(ws, personId).map(({ pr, shared }) => {
    const alloc = ws.responsibilities[pr.id];
    const others = [alloc?.ownerId, ...(alloc?.sharedWithIds ?? [])]
      .filter((pid): pid is string => !!pid && pid !== personId)
      .map((pid) => getPerson(ws, pid)?.name ?? "Unknown");
    return { id: pr.id, label: prLabel(pr), title: pr.title, text: pr.text, shared, sharedWith: others, notes: alloc?.notes ?? "" };
  });
  return {
    person,
    firmName: ws.firm.name,
    frn: ws.firm.frn,
    category: getCategory(ws),
    smfs: person.smfs.map((s) => ({ id: s.smfId, title: getSmf(s.smfId)?.title ?? s.smfId, status: s.status })),
    prescribed,
    other: ws.otherResponsibilities
      .filter((o) => o.ownerId === personId)
      .map((o) => ({ title: o.title, description: o.description, kind: o.kind })),
    additionalText: sor?.additionalText ?? "",
    reportingLine: sor?.reportingLine ?? "",
    committees: sor?.committees ?? "",
    status: sor?.status ?? "draft",
    version: sor?.version ?? 1,
    approvedBy: sor?.approvedBy ?? "",
    approvedOn: sor?.approvedOn,
  };
}

/** Plain-text rendering of a SoR — used for version snapshots and diffs. */
export function sorToPlainText(model: SorModel): string {
  const lines = [
    `Statement of Responsibilities — ${model.person.name}`,
    `Firm: ${model.firmName}${model.frn ? ` (FRN ${model.frn})` : ""}`,
    `Senior management functions: ${model.smfs.map((s) => `${s.id} ${s.title}`).join("; ") || "None"}`,
    "",
    "Prescribed responsibilities:",
    ...(model.prescribed.length
      ? model.prescribed.map((p) => `- ${p.label} ${p.title}: ${p.text}${p.shared ? ` (shared with ${p.sharedWith.join(", ")})` : ""}`)
      : ["- None"]),
    "",
    "Other responsibilities:",
    ...(model.other.length ? model.other.map((o) => `- ${o.title}: ${o.description}`) : ["- None"]),
    "",
    "Additional information:",
    model.additionalText || "—",
    "",
    `Reporting line: ${model.reportingLine || "—"}`,
    `Committees: ${model.committees || "—"}`,
  ];
  return lines.join("\n");
}

export { PRESCRIBED_RESPONSIBILITIES, getPR, getSmf, prLabel };
