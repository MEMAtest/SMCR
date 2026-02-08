import assert from "node:assert/strict";

import {
  getApplicablePRs,
  getApplicableSMFs,
  getFirmRegime,
  FIT_SECTIONS,
  type FirmTypeKey,
  getSuggestedPRsForSMF,
} from "../src/lib/smcr-data";
import { buildNextActions } from "../src/lib/insights/nextActions";
import { buildOwnerSuggestions } from "../src/lib/insights/responsibilitySuggestions";
import { validateFitnessAssessment } from "../src/lib/validation";

type TestFn = () => void;

function test(name: string, fn: TestFn) {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log(`✓ ${name}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`✗ ${name}`);
    throw err;
  }
}

function refs<T extends { ref: string }>(items: T[]): string[] {
  return items.map((i) => i.ref);
}

function hasRef(refsList: string[], ref: string): boolean {
  return refsList.includes(ref);
}

test("Firm regime: Payments -> PSD", () => {
  assert.equal(getFirmRegime("Payments"), "PSD");
});

test("Firm regime: Bank -> SMCR", () => {
  assert.equal(getFirmRegime("Bank"), "SMCR");
});

test("Payments roles: only PSD-* roles are returned", () => {
  const roles = getApplicableSMFs("Payments", undefined);
  const roleRefs = refs(roles);
  assert.ok(roleRefs.length > 0, "Expected at least one PSD role");

  // Must include the PSD role set
  for (const expected of ["PSD-CEO", "PSD-FIN", "PSD-COMP", "PSD-MLRO", "PSD-SAFE", "PSD-OPS"]) {
    assert.ok(hasRef(roleRefs, expected), `Missing PSD role: ${expected}`);
  }

  // Must not include SMF roles
  assert.ok(!roleRefs.some((r) => r.startsWith("SMF")), "Expected no SMF roles for Payments");
});

test("Payments responsibilities: only P* responsibilities are returned", () => {
  const responsibilities = getApplicablePRs("Payments", undefined, false);
  const prRefs = refs(responsibilities);
  assert.ok(prRefs.length > 0, "Expected at least one PSD responsibility");

  for (const expected of ["P1", "P2", "P3"]) {
    assert.ok(hasRef(prRefs, expected), `Missing mandatory PSD responsibility: ${expected}`);
  }

  assert.ok(!prRefs.some((r) => ["A", "B", "C", "D"].includes(r)), "Expected no SMCR PRs for Payments");
});

test("Payments role mapping: PSD-MLRO suggests P3", () => {
  const suggested = getSuggestedPRsForSMF("PSD-MLRO");
  assert.ok(suggested.includes("P3"), "Expected PSD-MLRO -> P3 mapping");
});

test("Owner suggestions: PSD P3 suggested to PSD-MLRO holder", () => {
  const suggestions = buildOwnerSuggestions({
    assignedResponsibilities: [
      {
        ref: "P3",
        text: "Responsibility for financial crime controls (AML/CTF, fraud, sanctions)",
        mandatory: true,
      },
    ],
    individuals: [
      {
        id: "i-mlro",
        name: "MLRO Person",
        smfRoles: ["PSD-MLRO - Money Laundering Reporting Officer (MLRO)"],
      },
    ],
    responsibilityOwners: {},
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.ref, "P3");
  assert.equal(suggestions[0]!.suggestedOwnerId, "i-mlro");
});

test("Investment Core responsibilities: includes A/B/D and excludes C (enhanced) and P1 (PSD)", () => {
  const responsibilities = getApplicablePRs("Investment", "core", false);
  const prRefs = refs(responsibilities);

  for (const expected of ["A", "B", "D"]) {
    assert.ok(hasRef(prRefs, expected), `Missing SMCR responsibility: ${expected}`);
  }

  assert.ok(!hasRef(prRefs, "C"), "Core should not include enhanced responsibility C");
  assert.ok(!hasRef(prRefs, "P1"), "SMCR firm should not include PSD responsibility P1");
});

test("Investment Enhanced responsibilities: includes C", () => {
  const responsibilities = getApplicablePRs("Investment", "enhanced", false);
  const prRefs = refs(responsibilities);
  assert.ok(hasRef(prRefs, "C"), "Enhanced should include responsibility C");
});

test("SMCR roles: Payments PSD roles do not appear in SMCR firm mappings", () => {
  const firmTypes: FirmTypeKey[] = ["Bank", "Investment", "Insurance"];
  for (const firmType of firmTypes) {
    const roles = getApplicableSMFs(firmType, "core");
    const roleRefs = refs(roles);
    assert.ok(!roleRefs.some((r) => r.startsWith("PSD-")), `Unexpected PSD roles for ${firmType}`);
  }
});

test("Next actions: missing firm type returns a blocker", () => {
  const actions = buildNextActions({
    firmProfile: { firmName: "Test Firm" },
    individuals: [],
    responsibilityAssignments: {},
    responsibilityOwners: {},
    responsibilityEvidence: {},
    fitnessResponses: [],
  });

  assert.ok(actions.some((a) => a.id === "firm-type" && a.severity === "blocker"));
});

test("Next actions: missing FIT answers is a blocker", () => {
  const actions = buildNextActions({
    firmProfile: { firmName: "Test Firm", firmType: "Investment", smcrCategory: "core", isCASSFirm: false },
    individuals: [{ id: "i-1", name: "A. Person", smfRoles: ["SMF1"] }],
    responsibilityAssignments: { A: true },
    responsibilityOwners: { A: "i-1" },
    responsibilityEvidence: {},
    fitnessResponses: [],
  });

  assert.ok(actions.some((a) => a.id === "fit-start" && a.severity === "blocker"));
});

test("Fitness validation: requires answers for all FIT questions per individual", () => {
  const individualId = "i-1";
  const individual = { id: individualId, name: "A. Person", smfRoles: ["SMF1"] };

  const allResponses = FIT_SECTIONS.flatMap((section) =>
    section.questions.map((q) => ({
      sectionId: section.id,
      questionId: `${individualId}::${section.id}::${q.id}`,
      response: "yes",
    }))
  );

  const full = validateFitnessAssessment([individual], allResponses);
  assert.equal(full.isValid, true);

  const partial = validateFitnessAssessment([individual], allResponses.slice(0, 1));
  assert.equal(partial.isValid, false);
  assert.ok(partial.errors.some((e) => e.includes("assessment questions remain incomplete")));
});

// eslint-disable-next-line no-console
console.log("All mapping logic tests passed.");
