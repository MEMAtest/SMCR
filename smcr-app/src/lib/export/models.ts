import { CATEGORY_LABELS, FIT_SECTIONS, getSmf, prLabel, RULES_META } from "@/lib/rules/fca-solo";
import {
  activePeople,
  buildSorModel,
  fitnessStatus,
  getCategorisation,
  getPerson,
  getWorkspacePRs,
  peopleNeedingFit,
  smfHolders,
  sorToPlainText,
  type SorModel,
} from "@/lib/workspace/derive";
import { getHealthIssues, type HealthIssue } from "@/lib/workspace/health";
import { getObligations, type Obligation } from "@/lib/workspace/obligations";
import type { Sor, Workspace } from "@/lib/workspace/schema";
import { slugify } from "@/components/ui";
import { fitOutcomeLabel, smfStatusLabel } from "./csv";

/* -------------------------------- Filenames -------------------------------- */

export function exportFilename(firmName: string, kind: string, today: string, ext: string): string {
  return `${slugify(firmName)}-${slugify(kind)}-${today}.${ext}`;
}

/** Common metadata printed in every PDF header/footer. */
export interface DocMeta {
  firmName: string;
  title: string;
  generatedOn: string;
  rulesId: string;
}

export function docMeta(ws: Workspace, title: string, today: string): DocMeta {
  return { firmName: ws.firm.name || "Unnamed firm", title, generatedOn: today, rulesId: RULES_META.id };
}

/* ------------------------------ SoR versioning ------------------------------ */

export type SorHistoryEntry = Sor["history"][number];

export interface SorVersionState {
  model: SorModel;
  text: string;
  lastApproved?: SorHistoryEntry;
  /** Approved only if the stored status is approved AND nothing changed since the snapshot. */
  effectiveStatus: "draft" | "approved";
  changedSinceApproval: boolean;
  /** Version number the current text represents. */
  displayVersion: number;
}

export function sorVersionState(ws: Workspace, personId: string): SorVersionState | null {
  const model = buildSorModel(ws, personId);
  if (!model) return null;
  const sor = ws.sors[personId];
  const text = sorToPlainText(model);
  const history = sor?.history ?? [];
  const lastApproved = history.length ? history[history.length - 1] : undefined;
  const changedSinceApproval = !!lastApproved && lastApproved.snapshot !== text;
  const effectiveStatus = sor?.status === "approved" && !changedSinceApproval ? "approved" : "draft";
  const displayVersion =
    effectiveStatus === "approved" && lastApproved
      ? lastApproved.version
      : lastApproved
        ? Math.max(model.version, lastApproved.version + 1)
        : model.version;
  return { model, text, lastApproved, effectiveStatus, changedSinceApproval, displayVersion };
}

/* ----------------------------------- MRM ----------------------------------- */

export interface MrmModel {
  enhanced: boolean;
  categoryLabel: string;
  governanceSummary: string;
  reportingLines: string;
  lastReviewedOn?: string;
  approvedBy: string;
  committees: { name: string; purpose: string; chair: string; members: string[] }[];
  prs: { label: string; title: string; verify: boolean; owner: string; ownerSmfs: string; sharedWith: string[]; notes: string }[];
  overall: { title: string; description: string; holder: string }[];
  smfs: { id: string; title: string; holders: { name: string; status: string }[] }[];
}

export function buildMrmModel(ws: Workspace): MrmModel {
  const cat = getCategorisation(ws).category;
  const name = (id: string | undefined) => getPerson(ws, id)?.name ?? "Unallocated";
  const smfMap = new Map<string, { name: string; status: string }[]>();
  for (const p of activePeople(ws)) {
    for (const s of p.smfs) {
      const list = smfMap.get(s.smfId) ?? [];
      list.push({ name: p.name, status: smfStatusLabel(s.status) });
      smfMap.set(s.smfId, list);
    }
  }
  const smfOrder = (id: string) => Number(id.replace(/\D/g, "")) || 999;
  return {
    enhanced: cat === "enhanced",
    categoryLabel: cat ? CATEGORY_LABELS[cat] : "Not categorised",
    governanceSummary: ws.mrm.governanceSummary,
    reportingLines: ws.mrm.reportingLines,
    lastReviewedOn: ws.mrm.lastReviewedOn,
    approvedBy: ws.mrm.approvedBy,
    committees: ws.mrm.committees.map((c) => ({
      name: c.name || "Unnamed committee",
      purpose: c.purpose,
      chair: c.chairId ? name(c.chairId) : "—",
      members: c.memberIds.map((id) => name(id)),
    })),
    prs: getWorkspacePRs(ws).map((pr) => {
      const alloc = ws.responsibilities[pr.id];
      const owner = getPerson(ws, alloc?.ownerId);
      return {
        label: prLabel(pr),
        title: pr.title,
        verify: !!pr.verify || !pr.letterConfirmed,
        owner: owner?.name ?? "Unallocated",
        ownerSmfs: owner?.smfs.map((s) => s.smfId).join(", ") ?? "",
        sharedWith: (alloc?.sharedWithIds ?? []).map((id) => name(id)),
        notes: alloc?.notes ?? "",
      };
    }),
    overall: ws.otherResponsibilities
      .filter((o) => o.kind === "overall")
      .map((o) => ({ title: o.title, description: o.description, holder: o.ownerId ? name(o.ownerId) : "Unallocated" })),
    smfs: [...smfMap.entries()]
      .sort((a, b) => smfOrder(a[0]) - smfOrder(b[0]))
      .map(([id, holders]) => ({ id, title: getSmf(id)?.title ?? id, holders })),
  };
}

/* -------------------------------- Board pack -------------------------------- */

export interface BoardFitRow {
  personId: string;
  name: string;
  role: string;
  answered: number;
  total: number;
  disclosures: number;
  unexplained: number;
  outcome: string;
  assessedOn?: string;
  nextDueOn?: string;
  details?: { section: string; question: string; answer: string; date?: string; details: string }[];
}

export interface BoardPackModel {
  firmName: string;
  frn: string;
  categoryLabel: string;
  categoryReasons: string[];
  rulesId: string;
  roster: { name: string; jobTitle: string; smfs: { id: string; title: string; status: string; approved: boolean }[]; sorStatus: "draft" | "approved"; sorVersion: number }[];
  prs: MrmModel["prs"];
  fit: BoardFitRow[];
  issues: HealthIssue[];
  issueCounts: { blocker: number; warning: number; info: number };
  obligations: Obligation[];
  includeDisclosures: boolean;
}

export function buildBoardPackModel(ws: Workspace, today: string, includeDisclosures: boolean): BoardPackModel {
  const cat = getCategorisation(ws);
  const issues = getHealthIssues(ws, today);
  const sectionTitle = new Map<string, string>(FIT_SECTIONS.map((s) => [s.id, `${s.handbookRef} ${s.title}`]));
  return {
    firmName: ws.firm.name || "Unnamed firm",
    frn: ws.firm.frn,
    categoryLabel: cat.category ? CATEGORY_LABELS[cat.category] : "Not categorised",
    categoryReasons: cat.reasons,
    rulesId: RULES_META.id,
    roster: smfHolders(ws).map((p) => {
      const st = sorVersionState(ws, p.id);
      return {
        name: p.name,
        jobTitle: p.jobTitle,
        smfs: p.smfs.map((s) => ({ id: s.smfId, title: getSmf(s.smfId)?.title ?? s.smfId, status: smfStatusLabel(s.status), approved: s.status === "approved" })),
        sorStatus: st?.effectiveStatus ?? "draft",
        sorVersion: st?.displayVersion ?? 1,
      };
    }),
    prs: buildMrmModel(ws).prs,
    fit: peopleNeedingFit(ws).map((p) => {
      const st = fitnessStatus(ws, p.id);
      const a = ws.fitness[p.id];
      return {
        personId: p.id,
        name: p.name,
        role: p.smfs.length ? p.smfs.map((s) => s.smfId).join(", ") : "Certified staff",
        answered: st.answered,
        total: st.total,
        disclosures: st.adverse.length,
        unexplained: st.unexplainedAdverse,
        outcome: fitOutcomeLabel(a?.outcome),
        assessedOn: a?.assessedOn,
        nextDueOn: st.nextDueOn,
        details: includeDisclosures
          ? st.adverse.map((ad) => ({
              section: sectionTitle.get(ad.sectionId) ?? ad.sectionId,
              question: ad.question.text,
              answer: ad.record.answer === "yes" ? "Yes" : ad.record.answer === "no" ? "No" : "N/A",
              date: ad.record.date,
              details: ad.record.details,
            }))
          : undefined,
      };
    }),
    issues: issues.filter((i) => i.severity !== "info"),
    issueCounts: {
      blocker: issues.filter((i) => i.severity === "blocker").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
    },
    obligations: getObligations(ws, today)
      .filter((o) => o.status !== "done")
      .slice(0, 12),
    includeDisclosures,
  };
}
