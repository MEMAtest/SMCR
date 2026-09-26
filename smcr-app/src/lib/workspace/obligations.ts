import { DEADLINES, DEADLINE_SOURCES, getSmf } from "@/lib/rules/fca-solo";
import { addBusinessDays, addDays, addMonths, daysBetween, toISODate } from "./dates";
import { activePeople, certifiedPeople, getCategory, getPerson, peopleNeedingFit } from "./derive";
import type { Workspace } from "./schema";

export type ObligationStatus = "overdue" | "due_soon" | "upcoming" | "done";

export interface Obligation {
  /** Stable key — used to mark done in workspace.obligationsDone. */
  key: string;
  title: string;
  detail?: string;
  dueOn: string;
  personId?: string;
  area: "approvals" | "fitness" | "certification" | "conduct" | "references" | "documents" | "reporting";
  source: string;
  status: ObligationStatus;
  doneOn?: string;
}

const DUE_SOON_DAYS = 30;

function nextOccurrence(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4));
  const candidate = toISODate(new Date(Date.UTC(year, month - 1, day)));
  return candidate >= today ? candidate : toISODate(new Date(Date.UTC(year + 1, month - 1, day)));
}

export function getObligations(ws: Workspace, today: string): Obligation[] {
  const out: Omit<Obligation, "status">[] = [];
  const push = (o: Omit<Obligation, "status">) => out.push(o);

  // --- SMF approvals ---
  for (const p of activePeople(ws)) {
    for (const s of p.smfs) {
      const smf = `${s.smfId} ${getSmf(s.smfId)?.title ?? ""}`.trim();
      if (s.status === "temporary_cover" && s.coverStartDate) {
        push({
          key: `smf-submit-${p.id}-${s.smfId}-${s.coverStartDate}`,
          title: `Submit Form A for ${p.name} (${smf})`,
          detail: `Temporary cover started ${s.coverStartDate}. Under PS26/6 the application must be submitted within ${DEADLINES.temporaryCoverWeeks} weeks.`,
          dueOn: addDays(s.coverStartDate, DEADLINES.temporaryCoverWeeks * 7),
          personId: p.id,
          area: "approvals",
          source: DEADLINE_SOURCES.temporaryCover,
        });
      }
      if (s.status === "application_submitted" && s.applicationSubmittedDate) {
        push({
          key: `smf-decision-${p.id}-${s.smfId}-${s.applicationSubmittedDate}`,
          title: `FCA decision expected: ${p.name} (${smf})`,
          detail: `Statutory period is ${DEADLINES.fcaDecisionMonthsComplete} months for a complete application (${DEADLINES.fcaDecisionMonthsIncomplete} if incomplete). Chase if no decision.`,
          dueOn: addMonths(s.applicationSubmittedDate, DEADLINES.fcaDecisionMonthsComplete),
          personId: p.id,
          area: "approvals",
          source: "FSMA s61",
        });
      }
      if ((s.status === "proposed" || s.status === "temporary_cover") && p.criminalRecordCheckDate) {
        push({
          key: `crc-expiry-${p.id}-${p.criminalRecordCheckDate}`,
          title: `Criminal records check expires for ${p.name}`,
          detail: `Checks are valid for ${DEADLINES.criminalRecordCheckValidityMonths} months (PS26/6). Submit the application before this date or obtain a new check.`,
          dueOn: addMonths(p.criminalRecordCheckDate, DEADLINES.criminalRecordCheckValidityMonths),
          personId: p.id,
          area: "approvals",
          source: DEADLINE_SOURCES.criminalRecordCheck,
        });
      }
    }
  }

  // --- Leavers: Form C and Directory ---
  for (const p of ws.people.filter((p) => p.status === "left" && p.leftDate)) {
    if (p.smfs.length)
      push({
        key: `formc-${p.id}-${p.leftDate}`,
        title: `Submit Form C for ${p.name}`,
        detail: `Notify the FCA within ${DEADLINES.formCBusinessDays} business days of an SMF ceasing to perform the function.`,
        dueOn: addBusinessDays(p.leftDate!, DEADLINES.formCBusinessDays),
        personId: p.id,
        area: "approvals",
        source: DEADLINE_SOURCES.formC,
      });
    if (p.certificationFunctions.length)
      push({
        key: `directory-leave-${p.id}-${p.leftDate}`,
        title: `Update FCA Directory: ${p.name} has left`,
        dueOn: addBusinessDays(p.leftDate!, DEADLINES.directoryUpdateWorkingDays),
        personId: p.id,
        area: "certification",
        source: DEADLINE_SOURCES.directory,
      });
  }

  // --- Annual F&P ---
  for (const p of peopleNeedingFit(ws)) {
    const assessedOn = ws.fitness[p.id]?.assessedOn;
    push({
      key: `fit-annual-${p.id}-${assessedOn ?? "initial"}`,
      title: assessedOn ? `Annual F&P re-assessment: ${p.name}` : `Complete F&P assessment: ${p.name}`,
      dueOn: assessedOn ? addMonths(assessedOn, DEADLINES.annualAssessmentMonths) : p.startDate ?? today,
      personId: p.id,
      area: "fitness",
      source: DEADLINE_SOURCES.annualAssessment,
    });
  }

  // --- Certification ---
  for (const p of certifiedPeople(ws)) {
    const latest = ws.certificates
      .filter((c) => c.personId === p.id && c.outcome === "certified")
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0];
    push({
      key: `cert-${p.id}-${latest?.issuedOn ?? "initial"}`,
      title: latest ? `Re-certify ${p.name}` : `Issue certificate to ${p.name}`,
      detail: "Certificates must be renewed at least every 12 months.",
      dueOn: latest ? addMonths(latest.issuedOn, DEADLINES.annualAssessmentMonths) : p.startDate ?? today,
      personId: p.id,
      area: "certification",
      source: "SYSC 27",
    });
    if (p.startDate)
      push({
        key: `directory-join-${p.id}-${p.startDate}`,
        title: `Add ${p.name} to the FCA Directory`,
        dueOn: addBusinessDays(p.startDate, DEADLINES.directoryUpdateWorkingDays),
        personId: p.id,
        area: "certification",
        source: DEADLINE_SOURCES.directory,
      });
  }

  // --- Conduct Rules training ---
  for (const p of activePeople(ws).filter((p) => p.conductRulesStaff)) {
    const trained = ws.training.some((t) => t.personId === p.id && (t.topic === "conduct_rules" || t.topic === "senior_conduct_rules"));
    if (!trained)
      push({
        key: `training-${p.id}`,
        title: `Conduct Rules training for ${p.name}`,
        detail: "Staff must be notified of the Conduct Rules that apply to them and trained on them.",
        dueOn: p.startDate ?? today,
        personId: p.id,
        area: "conduct",
        source: "COCON 2.3; SYSC 24 PR (b-1)",
      });
  }

  // --- Conduct breaches ---
  for (const b of ws.breaches) {
    const person = getPerson(ws, b.personId);
    if (!person) continue;
    if (b.disciplinaryAction && b.disciplinaryActionOn && person.smfs.length)
      push({
        key: `breach-formd-${b.id}`,
        title: `Notify FCA of SMF disciplinary action: ${person.name}`,
        detail: `Senior manager Conduct Rule breaches resulting in disciplinary action must be notified within ${DEADLINES.smfConductBreachBusinessDays} business days (Form D).`,
        dueOn: addBusinessDays(b.disciplinaryActionOn, DEADLINES.smfConductBreachBusinessDays),
        personId: person.id,
        area: "conduct",
        source: DEADLINE_SOURCES.smfConductBreach,
      });
  }
  if (activePeople(ws).some((p) => p.conductRulesStaff)) {
    const due = nextOccurrence(today, DEADLINES.rep008Due.month, DEADLINES.rep008Due.day);
    const confirmed = ws.breaches.filter((b) => b.status === "confirmed" && b.disciplinaryAction).length;
    push({
      key: `rep008-${due.slice(0, 4)}`,
      title: "Submit annual Conduct Rules breach report (REP008)",
      detail: `Covers non-SMF staff breaches that led to disciplinary action. ${confirmed} confirmed breach(es) with disciplinary action recorded. Nil returns are required.`,
      dueOn: due,
      area: "reporting",
      source: DEADLINE_SOURCES.rep008,
    });
  }

  // --- Regulatory references ---
  for (const r of ws.references.filter((r) => r.status === "pending" || r.status === "chased")) {
    const who = getPerson(ws, r.personId)?.name ?? r.subjectName;
    push({
      key: `ref-${r.id}`,
      title: r.direction === "incoming" ? `Provide regulatory reference for ${who} to ${r.counterparty}` : `Chase regulatory reference for ${who} from ${r.counterparty}`,
      detail: `Aim to respond within ${DEADLINES.regulatoryReferenceResponseWeeks} weeks; references cover the previous ${DEADLINES.regulatoryReferenceLookbackYears} years.`,
      dueOn: addDays(r.requestedOn, DEADLINES.regulatoryReferenceResponseWeeks * 7),
      personId: r.personId,
      area: "references",
      source: DEADLINE_SOURCES.regulatoryReference,
    });
  }

  // --- Documents ---
  const approvals = Object.values(ws.sors).map((s) => s.approvedOn).filter((d): d is string => !!d).sort();
  if (approvals.length) {
    const latest = approvals[approvals.length - 1];
    push({
      key: `sor-batch-${latest}`,
      title: "Review SoRs and submit any batched changes to the FCA",
      detail: `Under PS26/6 revised SoRs can be submitted in batches at least every ${DEADLINES.sorBatchMonths} months.`,
      dueOn: addMonths(latest, DEADLINES.sorBatchMonths),
      area: "documents",
      source: DEADLINE_SOURCES.sorBatch,
    });
  }
  if (getCategory(ws) === "enhanced") {
    push({
      key: `mrm-review-${ws.mrm.lastReviewedOn ?? "initial"}`,
      title: "Review the management responsibilities map",
      dueOn: ws.mrm.lastReviewedOn ? addMonths(ws.mrm.lastReviewedOn, 12) : today,
      area: "documents",
      source: "SYSC 25",
    });
  }

  return out
    .map((o) => {
      const doneOn = ws.obligationsDone[o.key];
      const days = daysBetween(today, o.dueOn);
      const status: ObligationStatus = doneOn ? "done" : days < 0 ? "overdue" : days <= DUE_SOON_DAYS ? "due_soon" : "upcoming";
      return { ...o, status, doneOn };
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** RFC 5545 calendar export (all-day events). */
export function obligationsToICS(obligations: Obligation[], firmName: string): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MEMA//SMCR Studio//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(`SM&CR – ${firmName || "Firm"}`)}`];
  for (const o of obligations.filter((o) => o.status !== "done")) {
    const start = o.dueOn.replace(/-/g, "");
    const end = addDays(o.dueOn, 1).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${o.key}@smcr.mema`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${esc(o.title)}`,
      `DESCRIPTION:${esc(`${o.detail ?? ""}\nSource: ${o.source}`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(o.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
