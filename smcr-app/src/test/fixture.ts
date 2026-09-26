import { FIT_SECTIONS } from "@/lib/rules/fca-solo";
import { WorkspaceSchema, type Workspace } from "@/lib/workspace/schema";

/** A realistic Enhanced firm exercising every module. */
export function richWorkspace(): Workspace {
  const answers = (adverseIds: string[] = []) =>
    Object.fromEntries(
      FIT_SECTIONS.flatMap((s) =>
        s.questions.map((q) => {
          const adverse = adverseIds.includes(q.id);
          const clean = q.adverseAnswer === "yes" ? "no" : "yes";
          return [q.id, { answer: adverse ? q.adverseAnswer : clean, details: adverse ? "Disclosed and reviewed by compliance in 2025." : "", date: adverse ? "2019-04-01" : undefined, evidence: "" }];
        }),
      ),
    );

  return WorkspaceSchema.parse({
    firm: {
      name: "Harbour & Vale Asset Management Ltd",
      frn: "123456",
      sector: "asset_manager",
      holdsClientAssets: true,
      isAfm: true,
      aumGbpBn: 70,
      outsourcesInternalAudit: true,
    },
    people: [
      { id: "ceo", name: "Alex Morgan", email: "alex@example.com", jobTitle: "CEO", startDate: "2020-01-06", smfs: [{ smfId: "SMF1", status: "approved", approvedDate: "2020-03-01" }], criminalRecordCheckDate: "2019-12-01" },
      { id: "cfo", name: "Priya Shah", jobTitle: "CFO", smfs: [{ smfId: "SMF2", status: "temporary_cover", coverStartDate: "2026-08-01" }], criminalRecordCheckDate: "2026-07-15" },
      { id: "co", name: "Sam O'Neill", jobTitle: "Head of Compliance", smfs: [{ smfId: "SMF16", status: "approved" }, { smfId: "SMF17", status: "approved" }] },
      { id: "chair", name: "Jordan Lee", isNonExecutive: true, smfs: [{ smfId: "SMF9", status: "approved" }, { smfId: "SMF11", status: "approved" }] },
      { id: "adv", name: "Chris Taylor", jobTitle: "Portfolio manager", startDate: "2026-09-01", certificationFunctions: ["client_dealing", "manager_of_certified"] },
      { id: "gone", name: "Robin Old", status: "left", leftDate: "2026-09-20", smfs: [{ smfId: "SMF24", status: "approved" }] },
    ],
    responsibilities: {
      a: { ownerId: "ceo" },
      b: { ownerId: "co" },
      "b-1": { ownerId: "co", sharedWithIds: ["ceo"], notes: "CO owns training; CEO owns notifications." },
      c: { ownerId: "ceo" },
      d: { ownerId: "co" },
      z: { ownerId: "cfo" },
      za: { ownerId: "chair" },
      "enh-internal-audit": { ownerId: "chair" },
      "enh-business-model": { ownerId: "ceo" },
    },
    otherResponsibilities: [{ id: "o1", title: "Investment management", description: "Overall responsibility for portfolio management.", ownerId: "ceo", kind: "overall" }],
    fitness: {
      ceo: { answers: answers(["dismissal"]), assessor: "Sam O'Neill", assessedOn: "2025-06-01", outcome: "fit" },
      co: { answers: answers(), assessor: "Alex Morgan", assessedOn: "2026-01-10", outcome: "fit" },
      cfo: { answers: { criminal_conviction: { answer: "yes", details: "" } } },
    },
    sors: {
      ceo: {
        additionalText: "Responsible for the firm's overall strategy and for leading the executive committee.",
        reportingLine: "Board",
        status: "approved",
        approvedBy: "Jordan Lee",
        approvedOn: "2026-03-01",
        version: 2,
        history: [{ version: 1, date: "2026-03-01", summary: "Initial", snapshot: "old text" }],
        aiDraft: { text: "Accountable for [confirm scope] of the investment business.", generatedAt: "2026-09-20T10:00:00Z", model: "claude-opus-5", rationale: ["Specific"], gaps: ["Confirm scope"] },
      },
    },
    mrm: { governanceSummary: "Board with audit committee.", committees: [{ id: "c1", name: "Audit Committee", chairId: "chair", memberIds: ["ceo"] }] },
    certificates: [{ id: "cert1", personId: "adv", functionIds: ["client_dealing"], issuedOn: "2025-09-01", issuedBy: "Sam O'Neill" }],
    training: [{ id: "t1", personId: "ceo", topic: "senior_conduct_rules", completedOn: "2026-02-01" }],
    breaches: [
      { id: "b1", personId: "adv", ruleIds: ["IR2"], occurredOn: "2026-08-10", description: "Late client report", disciplinaryAction: true, disciplinaryActionOn: "2026-09-01", status: "confirmed" },
      { id: "b2", personId: "cfo", ruleIds: ["SC2", "IR1"], occurredOn: "2026-09-10", description: "Under investigation", nonFinancialMisconduct: true, status: "investigating" },
    ],
    references: [
      { id: "r1", personId: "adv", direction: "outgoing", counterparty: "Previous Bank plc", requestedOn: "2026-08-01", periodFrom: "2021-01-01", periodTo: "2026-08-01", status: "pending" },
      { id: "r2", direction: "incoming", subjectName: "Former Employee", counterparty: "Other Firm Ltd", requestedOn: "2026-09-01", status: "pending" },
      { id: "r3", personId: "cfo", direction: "outgoing", counterparty: "Old Co", requestedOn: "2026-06-01", completedOn: "2026-06-20", adverse: true, status: "received" },
    ],
    reasonableSteps: [{ id: "rs1", personId: "ceo", prId: "a", date: "2026-09-01", kind: "mi_review", summary: "Reviewed SMF approval tracker at ExCo." }],
    handovers: [{ id: "h1", fromPersonId: "gone", toPersonId: "cfo", date: "2026-09-20", notes: "Ops handover" }],
    obligationsDone: {},
    aiLog: [{ id: "l1", at: "2026-09-20T10:00:00Z", feature: "sor_draft", summary: "Drafted", model: "claude-opus-5" }],
  });
}
