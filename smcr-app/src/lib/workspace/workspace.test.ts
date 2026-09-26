import { describe, expect, it } from "vitest";
import { categoriseFirm, FIT_QUESTION_COUNT, FIT_SECTIONS, getApplicablePRs, PRESCRIBED_RESPONSIBILITIES } from "@/lib/rules/fca-solo";
import { addBusinessDays, addMonths } from "./dates";
import { fitnessStatus, getWorkspacePRs, prsHeldBy } from "./derive";
import { getHealthIssues, validateStep } from "./health";
import { getObligations, obligationsToICS } from "./obligations";
import { emptyWorkspace, PersonSchema, WorkspaceSchema, type Workspace } from "./schema";

const TODAY = "2026-09-26";

function coreFirm(): Workspace {
  const ws = emptyWorkspace();
  ws.firm.name = "Acme Advisers Ltd";
  ws.firm.sector = "financial_adviser";
  return ws;
}

function person(id: string, smfs: string[], extra: Partial<Workspace["people"][number]> = {}) {
  return PersonSchema.parse({ id, name: `Person ${id}`, smfs: smfs.map((smfId) => ({ smfId, status: "approved" })), ...extra });
}

describe("categorisation", () => {
  it("defaults to core", () => {
    expect(categoriseFirm({}).category).toBe("core");
  });
  it("is enhanced above the PS26/6 thresholds but not below", () => {
    expect(categoriseFirm({ aumGbpBn: 64.9 }).category).toBe("core");
    expect(categoriseFirm({ aumGbpBn: 65 }).category).toBe("enhanced");
    expect(categoriseFirm({ intermediaryRevenueGbpM: 45 }).category).toBe("enhanced");
    expect(categoriseFirm({ consumerCreditRevenueGbpM: 130 }).category).toBe("enhanced");
    expect(categoriseFirm({ isCassLarge: true }).category).toBe("enhanced");
  });
  it("enhanced thresholds beat limited scope; opt-up works", () => {
    expect(categoriseFirm({ limitedScopeBasis: "insurance_ancillary" }).category).toBe("limited");
    expect(categoriseFirm({ limitedScopeBasis: "insurance_ancillary", optUpToEnhanced: true }).category).toBe("enhanced");
  });
  it("marks dual-regulated and payments-only firms out of scope", () => {
    expect(categoriseFirm({ outOfScope: "dual_regulated" }).category).toBeNull();
    expect(categoriseFirm({ outOfScope: "payments_emoney" }).outOfScope).toBe("payments_emoney");
  });
});

describe("prescribed responsibilities", () => {
  it("limited scope firms have none", () => {
    expect(getApplicablePRs({ category: "limited", holdsClientAssets: true })).toEqual([]);
  });
  it("core firms get a, b, b-1, d — plus z only with client assets and za only for AFMs", () => {
    const ids = (ctx: Parameters<typeof getApplicablePRs>[0]) => getApplicablePRs(ctx).map((p) => p.id);
    expect(ids({ category: "core" })).toEqual(["a", "b", "b-1", "d"]);
    expect(ids({ category: "core", holdsClientAssets: true })).toContain("z");
    expect(ids({ category: "core", isAfm: true })).toContain("za");
  });
  it("enhanced firms get the enhanced-only PRs", () => {
    const ids = getApplicablePRs({ category: "enhanced" }).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["a", "b", "b-1", "c", "d", "enh-business-model"]));
    expect(ids).not.toContain("enh-outsourced-ia");
  });
  it("every unconfirmed letter is flagged for verification", () => {
    for (const pr of PRESCRIBED_RESPONSIBILITIES) if (!pr.letterConfirmed) expect(pr.verify).toBe(true);
  });
  it("ignores stale allocations after the category changes", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    ws.responsibilities["enh-business-model"] = { ownerId: "p1", sharedWithIds: [], notes: "" };
    expect(getWorkspacePRs(ws).map((p) => p.id)).not.toContain("enh-business-model");
    expect(prsHeldBy(ws, "p1")).toEqual([]);
  });
});

describe("responsibilities step validation", () => {
  it("blocks until every applicable PR has an SMF owner", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]), person("p2", ["SMF16", "SMF17"]));
    expect(validateStep(ws, "responsibilities", TODAY).complete).toBe(false);
    for (const id of ["a", "b", "b-1"]) ws.responsibilities[id] = { ownerId: "p1", sharedWithIds: [], notes: "" };
    ws.responsibilities.d = { ownerId: "p2", sharedWithIds: [], notes: "" };
    expect(validateStep(ws, "responsibilities", TODAY).complete).toBe(true);
  });
  it("blocks PRs allocated to someone without an SMF", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]), person("staff", []));
    for (const pr of getWorkspacePRs(ws)) ws.responsibilities[pr.id] = { ownerId: "staff", sharedWithIds: [], notes: "" };
    const v = validateStep(ws, "responsibilities", TODAY);
    expect(v.complete).toBe(false);
    expect(v.blockers.some((b) => b.title.includes("does not hold an SMF"))).toBe(true);
  });
});

describe("fitness & propriety", () => {
  function answerAll(ws: Workspace, personId: string, choose: (adverse: "yes" | "no") => "yes" | "no") {
    ws.fitness[personId] = { answers: {}, assessor: "", conditions: "" };
    for (const s of FIT_SECTIONS)
      for (const q of s.questions) ws.fitness[personId].answers[q.id] = { answer: choose(q.adverseAnswer), details: "", evidence: "" };
  }

  it("counts all questions per person, not a fixed 3", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    ws.fitness.p1 = { answers: { criminal_conviction: { answer: "no", details: "", evidence: "" } }, assessor: "", conditions: "" };
    const st = fitnessStatus(ws, "p1");
    expect(st.total).toBe(FIT_QUESTION_COUNT);
    expect(st.answered).toBe(1);
    expect(st.complete).toBe(false);
  });

  it("treats 'yes' to a conviction question as adverse and requires an explanation", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    answerAll(ws, "p1", (adverse) => (adverse === "yes" ? "no" : "yes")); // all clean
    ws.fitness.p1.answers.criminal_conviction.answer = "yes";
    Object.assign(ws.fitness.p1, { assessor: "CO", assessedOn: TODAY, outcome: "fit" });
    let st = fitnessStatus(ws, "p1");
    expect(st.adverse.map((a) => a.question.id)).toEqual(["criminal_conviction"]);
    expect(st.unexplainedAdverse).toBe(1);
    expect(st.complete).toBe(false);
    ws.fitness.p1.answers.criminal_conviction.details = "Spent motoring offence 2009, disclosed on DBS certificate.";
    st = fitnessStatus(ws, "p1");
    expect(st.unexplainedAdverse).toBe(0);
    expect(st.complete).toBe(true);
  });

  it("treats 'no' to a positively worded question as adverse", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    answerAll(ws, "p1", (adverse) => (adverse === "yes" ? "no" : "yes"));
    ws.fitness.p1.answers.time_commitment.answer = "no";
    expect(fitnessStatus(ws, "p1").adverse.map((a) => a.question.id)).toEqual(["time_commitment"]);
  });

  it("does not count N/A where it is not allowed", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    ws.fitness.p1 = { answers: { criminal_conviction: { answer: "na", details: "", evidence: "" } }, assessor: "", conditions: "" };
    expect(fitnessStatus(ws, "p1").answered).toBe(0);
  });
});

describe("obligations", () => {
  it("computes the PS26/6 12-week submission deadline for temporary cover", () => {
    const ws = coreFirm();
    ws.people.push(PersonSchema.parse({ id: "p1", name: "Cover", smfs: [{ smfId: "SMF16", status: "temporary_cover", coverStartDate: "2026-09-01" }] }));
    const o = getObligations(ws, TODAY).find((x) => x.key.startsWith("smf-submit-p1"));
    expect(o?.dueOn).toBe("2026-11-24");
    expect(o?.status).toBe("upcoming");
  });

  it("requires Form D within 7 business days of SMF disciplinary action", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF3"]));
    ws.breaches.push({ id: "b1", personId: "p1", ruleIds: ["SC2"], occurredOn: "2026-09-01", description: "", nonFinancialMisconduct: false, disciplinaryAction: true, disciplinaryActionOn: "2026-09-18", status: "confirmed", notes: "" });
    const o = getObligations(ws, TODAY).find((x) => x.key === "breach-formd-b1");
    expect(o?.dueOn).toBe(addBusinessDays("2026-09-18", 7));
    expect(o?.dueOn).toBe("2026-09-29");
    expect(o?.status).toBe("due_soon");
  });

  it("flags expired annual F&P and certification as overdue and respects 'done'", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"], { certificationFunctions: ["client_dealing"] }));
    ws.fitness.p1 = { answers: {}, assessor: "CO", assessedOn: "2025-06-01", outcome: "fit", conditions: "" };
    ws.certificates.push({ id: "c1", personId: "p1", functionIds: ["client_dealing"], issuedOn: "2025-06-01", issuedBy: "CO", outcome: "certified", notes: "" });
    const obs = getObligations(ws, TODAY);
    const fit = obs.find((o) => o.key.startsWith("fit-annual-p1"))!;
    expect(fit.dueOn).toBe(addMonths("2025-06-01", 12));
    expect(fit.status).toBe("overdue");
    ws.obligationsDone[fit.key] = TODAY;
    expect(getObligations(ws, TODAY).find((o) => o.key === fit.key)?.status).toBe("done");
    expect(getHealthIssues(ws, TODAY).some((i) => i.id === `obl-${fit.key}`)).toBe(false);
  });

  it("schedules the next REP008 on 31 October", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    expect(getObligations(ws, TODAY).find((o) => o.key.startsWith("rep008"))?.dueOn).toBe("2026-10-31");
    expect(getObligations(ws, "2026-11-01").find((o) => o.key.startsWith("rep008"))?.dueOn).toBe("2027-10-31");
  });

  it("exports a valid iCalendar file", () => {
    const ws = coreFirm();
    ws.people.push(person("p1", ["SMF1"]));
    const ics = obligationsToICS(getObligations(ws, TODAY), "Acme, Ltd");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:SM&CR – Acme\\, Ltd");
    expect(ics.split("BEGIN:VEVENT").length).toBeGreaterThan(1);
  });
});

describe("schema", () => {
  it("fills defaults for partial and empty documents", () => {
    const ws = WorkspaceSchema.parse({ firm: { name: "X" } });
    expect(ws.firm.sector).toBeNull();
    expect(ws.people).toEqual([]);
  });
  it("rejects oversized fields", () => {
    expect(WorkspaceSchema.safeParse({ firm: { name: "x".repeat(500) } }).success).toBe(false);
  });
});
