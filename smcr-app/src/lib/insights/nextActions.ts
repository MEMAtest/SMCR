import { FIT_SECTIONS, getApplicablePRs, getFirmRegime, type JourneyStepKey } from "../smcr-data";
import type { FirmProfile, Individual, FitnessResponse } from "../validation";
import { buildSuggestedResponsibilityRefSet } from "./responsibilitySuggestions";

export type NextActionSeverity = "blocker" | "warning" | "info";

export type NextAction = {
  id: string;
  severity: NextActionSeverity;
  title: string;
  detail: string;
  ctaStep?: JourneyStepKey;
};

function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural ?? `${singular}s`;
}

function countFitQuestions(): number {
  return FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);
}

function countAnsweredFitnessResponses(fitnessResponses: FitnessResponse[]): number {
  // Only count responses that actually have a chosen value.
  return fitnessResponses.filter((r) => r.response && r.response.trim().length > 0).length;
}

export function buildNextActions(input: {
  firmProfile: FirmProfile;
  individuals: Individual[];
  responsibilityAssignments: Record<string, boolean>;
  responsibilityOwners: Record<string, string>;
  responsibilityEvidence?: Record<string, string>;
  fitnessResponses: FitnessResponse[];
}): NextAction[] {
  const actions: NextAction[] = [];
  const {
    firmProfile,
    individuals,
    responsibilityAssignments,
    responsibilityOwners,
    responsibilityEvidence,
    fitnessResponses,
  } = input;

  if (!firmProfile.firmName?.trim()) {
    actions.push({
      id: "firm-name",
      severity: "blocker",
      title: "Add firm name",
      detail: "Set a firm name so exports and board packs are clearly labeled.",
      ctaStep: "firm",
    });
  }

  if (!firmProfile.firmType) {
    actions.push({
      id: "firm-type",
      severity: "blocker",
      title: "Select firm type",
      detail: "Choose your regulatory perimeter so the builder can load the right responsibilities.",
      ctaStep: "firm",
    });
    return actions;
  }

  const regime = getFirmRegime(firmProfile.firmType);

  if (regime === "SMCR" && !firmProfile.smcrCategory) {
    actions.push({
      id: "smcr-category",
      severity: "blocker",
      title: "Select SMCR category",
      detail: "Choose Limited/Core/Enhanced to determine your applicable responsibilities and roles.",
      ctaStep: "firm",
    });
  }

  if (regime === "PSD" && !firmProfile.smcrCategory) {
    actions.push({
      id: "payments-category",
      severity: "warning",
      title: "Select Payments category",
      detail: "Set SPI/API/AISP/AEMI/SEMI for reporting clarity and consistent drafts.",
      ctaStep: "firm",
    });
  }

  if (individuals.length === 0) {
    actions.push({
      id: "individuals",
      severity: "blocker",
      title: "Add individuals",
      detail: "Add at least one individual so responsibilities can be owned.",
      ctaStep: "responsibilities",
    });
  }

  const applicableResponsibilities =
    regime === "PSD" || firmProfile.smcrCategory
      ? getApplicablePRs(
          firmProfile.firmType,
          firmProfile.smcrCategory,
          firmProfile.isCASSFirm ?? false
        )
      : [];

  if (applicableResponsibilities.length > 0) {
    const applicableRefs = applicableResponsibilities.map((r) => r.ref);
    const applicableSet = new Set(applicableRefs);

    const selectedApplicable = applicableRefs.filter((ref) => responsibilityAssignments[ref]);
    const missingOwners = selectedApplicable.filter((ref) => !responsibilityOwners[ref]);

    if (selectedApplicable.length === 0) {
      actions.push({
        id: "select-responsibilities",
        severity: "blocker",
        title: "Select responsibilities",
        detail: "Select at least one responsibility to begin ownership mapping.",
        ctaStep: "responsibilities",
      });
    } else if (missingOwners.length > 0 && individuals.length > 0) {
      actions.push({
        id: "assign-owners",
        severity: "blocker",
        title: "Assign responsibility owners",
        detail: `${missingOwners.length} selected ${pluralize(missingOwners.length, "responsibility")} still need an owner.`,
        ctaStep: "responsibilities",
      });
    }

    const allSelectedRefs = Object.entries(responsibilityAssignments)
      .filter(([, value]) => value)
      .map(([ref]) => ref);
    const orphaned = allSelectedRefs.filter((ref) => !applicableSet.has(ref));

    if (orphaned.length > 0) {
      actions.push({
        id: "orphaned",
        severity: "warning",
        title: "Clean up non-applicable responsibilities",
        detail: `${orphaned.length} selected ${pluralize(orphaned.length, "responsibility")} no longer match the current firm profile.`,
        ctaStep: "responsibilities",
      });
    }

    const missingOptional = applicableResponsibilities.filter(
      (r) => !r.mandatory && !responsibilityAssignments[r.ref]
    ).length;

    if (missingOptional > 0) {
      const suggestedSet = buildSuggestedResponsibilityRefSet(individuals);
      const missingOptionalItems = applicableResponsibilities.filter(
        (r) => !r.mandatory && !responsibilityAssignments[r.ref]
      );
      const recommendedMissing = missingOptionalItems.filter((r) => suggestedSet.has(r.ref));

      const formatResp = (r: { ref: string; description?: string; text: string }) => {
        const refLabel = regime === "PSD" ? r.ref : `PR ${r.ref}`;
        return `${refLabel}: ${(r.description || r.text).trim()}`;
      };

      const highlight = (recommendedMissing.length > 0 ? recommendedMissing : missingOptionalItems)
        .slice(0, 2)
        .map(formatResp)
        .join(" | ");

      actions.push({
        id: "optional-coverage",
        severity: "info",
        title: "Optional coverage",
        detail:
          recommendedMissing.length > 0
            ? `${missingOptional} optional ${pluralize(missingOptional, "responsibility")} are not selected. Suggested based on selected roles: ${highlight}.`
            : `${missingOptional} optional ${pluralize(missingOptional, "responsibility")} are not selected. Consider: ${highlight}.`,
        ctaStep: "responsibilities",
      });
    }

    // Evidence for responsibilities (optional but improves defensibility).
    const evidenceByRef = responsibilityEvidence ?? {};
    const selectedApplicableWithOwners = selectedApplicable.filter((ref) => responsibilityOwners[ref]);
    const mandatoryRefSet = new Set(applicableResponsibilities.filter((r) => r.mandatory).map((r) => r.ref));

    const missingMandatoryEvidence = applicableResponsibilities
      .filter((r) => r.mandatory && responsibilityAssignments[r.ref])
      .filter((r) => !(evidenceByRef[r.ref] || "").trim());

    if (missingMandatoryEvidence.length > 0) {
      const list = missingMandatoryEvidence
        .slice(0, 3)
        .map((r) => (regime === "PSD" ? r.ref : `PR ${r.ref}`))
        .join(", ");
      actions.push({
        id: "evidence-mandatory",
        severity: "warning",
        title: "Add evidence for mandatory responsibilities",
        detail: `${missingMandatoryEvidence.length} mandatory ${pluralize(missingMandatoryEvidence.length, "responsibility")} have no evidence reference yet (${list}${missingMandatoryEvidence.length > 3 ? ", …" : ""}).`,
        ctaStep: "responsibilities",
      });
    }

    const missingAssignedEvidence = selectedApplicableWithOwners.filter(
      (ref) => !(evidenceByRef[ref] || "").trim() && !mandatoryRefSet.has(ref)
    );
    if (missingAssignedEvidence.length > 0) {
      actions.push({
        id: "evidence-assigned",
        severity: "info",
        title: "Capture evidence for assigned responsibilities",
        detail: `${missingAssignedEvidence.length} assigned ${pluralize(missingAssignedEvidence.length, "responsibility")} are missing evidence links/references.`,
        ctaStep: "responsibilities",
      });
    }
  }

  const fitQuestionsPerIndividual = countFitQuestions();
  if (individuals.length > 0 && fitQuestionsPerIndividual > 0) {
    const expected = individuals.length * fitQuestionsPerIndividual;
    const answered = countAnsweredFitnessResponses(fitnessResponses);
    const outstanding = Math.max(0, expected - answered);

    if (answered === 0) {
      actions.push({
        id: "fit-start",
        severity: "blocker",
        title: "Start FIT assessments",
        detail: `Complete FIT 2.1 to 2.3 for ${individuals.length} ${pluralize(individuals.length, "individual")}.`,
        ctaStep: "fitness",
      });
    } else if (outstanding > 0) {
      actions.push({
        id: "fit-complete",
        severity: "blocker",
        title: "Complete FIT assessments",
        detail: `${outstanding} FIT ${pluralize(outstanding, "question")} remaining across ${individuals.length} ${pluralize(individuals.length, "individual")}.`,
        ctaStep: "fitness",
      });
    }
  }

  // Evidence for FIT responses (recommended).
  const answeredFitness = fitnessResponses.filter((r) => r.response && r.response.trim().length > 0);
  if (answeredFitness.length > 0) {
    const missingEvidence = answeredFitness.filter((r) => !(r.evidence || "").trim());
    const missingYesEvidence = answeredFitness.filter((r) => r.response === "yes" && !(r.evidence || "").trim());

    if (missingYesEvidence.length > 0) {
      actions.push({
        id: "fit-evidence-yes",
        severity: "warning",
        title: "Add evidence for FIT 'yes' answers",
        detail: `${missingYesEvidence.length} FIT ${pluralize(missingYesEvidence.length, "answer")} marked "yes" are missing an evidence link/reference.`,
        ctaStep: "fitness",
      });
    } else if (missingEvidence.length > 0) {
      actions.push({
        id: "fit-evidence",
        severity: "info",
        title: "Add evidence for FIT responses",
        detail: `${missingEvidence.length} FIT ${pluralize(missingEvidence.length, "answer")} are missing an evidence link/reference.`,
        ctaStep: "fitness",
      });
    }
  }

  const severityOrder: Record<NextActionSeverity, number> = {
    blocker: 0,
    warning: 1,
    info: 2,
  };

  actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return actions;
}
