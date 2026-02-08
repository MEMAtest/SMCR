import { FIT_SECTIONS, getApplicablePRs } from "../smcr-data";
import { calculateAllRisks, getFirmRiskSummary } from "../fitness-risk-rating";
import type { FirmProfile, Individual, FitnessResponse } from "../validation";

export type BoardReadinessComponent = {
  label: string;
  percent: number;
  points: number;
  maxPoints: number;
  detail: string;
};

export type BoardReadinessBreakdown = {
  score: number;
  maxScore: number;
  label: "Not started" | "In progress" | "Board-ready";
  components: {
    mandatoryOwnership: BoardReadinessComponent;
    fitCompletion: BoardReadinessComponent;
    evidenceCompleteness: BoardReadinessComponent;
    riskFlags: BoardReadinessComponent;
  };
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundPercent(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100);
}

function safeRatio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return clamp(numerator / denominator, 0, 1);
}

function countFitQuestions(): number {
  return FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);
}

function buildFitnessData(fitnessResponses: FitnessResponse[]): Record<string, Record<string, any>> {
  const fitnessData: Record<string, Record<string, any>> = {};

  for (const response of fitnessResponses) {
    const parts = response.questionId.split("::");
    if (parts.length !== 3) continue;
    const [individualId, , questionId] = parts;
    if (!fitnessData[individualId]) fitnessData[individualId] = {};
    fitnessData[individualId][questionId] = {
      response: response.response,
      details: response.details,
      date: response.date,
    };
  }

  return fitnessData;
}

export function calculateBoardReadiness(input: {
  firmProfile: FirmProfile;
  individuals: Individual[];
  responsibilityAssignments: Record<string, boolean>;
  responsibilityOwners: Record<string, string>;
  responsibilityEvidence: Record<string, string>;
  fitnessResponses: FitnessResponse[];
}): BoardReadinessBreakdown {
  const {
    firmProfile,
    individuals,
    responsibilityAssignments,
    responsibilityOwners,
    responsibilityEvidence,
    fitnessResponses,
  } = input;

  const MAX_SCORE = 100;

  const applicableResponsibilities = firmProfile.firmType
    ? getApplicablePRs(
        firmProfile.firmType,
        firmProfile.smcrCategory,
        firmProfile.isCASSFirm ?? false
      )
    : [];

  const mandatory = applicableResponsibilities.filter((r) => r.mandatory);
  const mandatoryOwned = mandatory.filter(
    (r) => responsibilityAssignments[r.ref] && !!responsibilityOwners[r.ref]
  ).length;

  const mandatoryPercent = mandatory.length > 0 ? roundPercent(safeRatio(mandatoryOwned, mandatory.length)) : 0;
  const mandatoryMaxPoints = 40;
  const mandatoryPoints = Math.round((mandatoryPercent / 100) * mandatoryMaxPoints);

  const fitQuestionsPerIndividual = countFitQuestions();
  const expectedFit = individuals.length * fitQuestionsPerIndividual;
  const answeredFit = fitnessResponses.filter((r) => r.response && r.response.trim().length > 0).length;
  const fitPercent = expectedFit > 0 ? roundPercent(safeRatio(answeredFit, expectedFit)) : 0;
  const fitMaxPoints = 30;
  const fitPoints = Math.round((fitPercent / 100) * fitMaxPoints);

  const selectedApplicableRefs = applicableResponsibilities
    .filter((r) => responsibilityAssignments[r.ref])
    .map((r) => r.ref);
  const respEvidenceProvided = selectedApplicableRefs.filter(
    (ref) => (responsibilityEvidence[ref] || "").trim().length > 0
  ).length;
  const respEvidencePercent = selectedApplicableRefs.length > 0
    ? roundPercent(safeRatio(respEvidenceProvided, selectedApplicableRefs.length))
    : 0;

  const answeredFitness = fitnessResponses.filter((r) => r.response && r.response.trim().length > 0);
  const fitnessEvidenceProvided = answeredFitness.filter((r) => (r.evidence || "").trim().length > 0).length;
  const fitnessEvidencePercent = answeredFitness.length > 0
    ? roundPercent(safeRatio(fitnessEvidenceProvided, answeredFitness.length))
    : 0;

  const evidencePercent = (() => {
    const parts: number[] = [];
    if (selectedApplicableRefs.length > 0) parts.push(respEvidencePercent);
    if (answeredFitness.length > 0) parts.push(fitnessEvidencePercent);
    if (parts.length === 0) return 0;
    return Math.round(parts.reduce((sum, p) => sum + p, 0) / parts.length);
  })();

  const evidenceMaxPoints = 20;
  const evidencePoints = Math.round((evidencePercent / 100) * evidenceMaxPoints);

  const riskMaxPoints = 10;
  const canScoreRisk = individuals.length > 0 && answeredFit > 0;

  const riskSummary = canScoreRisk
    ? getFirmRiskSummary(calculateAllRisks(individuals, buildFitnessData(fitnessResponses)))
    : { total: 0, high: 0, medium: 0, low: 0, clear: 0 };

  const riskPoints = (() => {
    if (!canScoreRisk) return 0;
    const riskPenalty = clamp(riskSummary.high * 5 + riskSummary.medium * 2, 0, riskMaxPoints);
    return Math.max(0, riskMaxPoints - riskPenalty);
  })();

  const riskPercent = canScoreRisk ? Math.round((riskPoints / riskMaxPoints) * 100) : 0;

  const score = clamp(mandatoryPoints + fitPoints + evidencePoints + riskPoints, 0, MAX_SCORE);

  const label: BoardReadinessBreakdown["label"] =
    score >= 85 && mandatoryPercent === 100 && fitPercent === 100 && riskSummary.high === 0
      ? "Board-ready"
      : score === 0
        ? "Not started"
        : "In progress";

  return {
    score,
    maxScore: MAX_SCORE,
    label,
    components: {
      mandatoryOwnership: {
        label: "Mandatory ownership",
        percent: mandatoryPercent,
        points: mandatoryPoints,
        maxPoints: mandatoryMaxPoints,
        detail:
          mandatory.length === 0
            ? "No mandatory responsibilities detected for this profile."
            : `${mandatoryOwned}/${mandatory.length} mandatory responsibilities owned.`,
      },
      fitCompletion: {
        label: "FIT completion",
        percent: fitPercent,
        points: fitPoints,
        maxPoints: fitMaxPoints,
        detail:
          expectedFit === 0
            ? "No FIT questions expected yet."
            : `${answeredFit}/${expectedFit} FIT answers recorded.`,
      },
      evidenceCompleteness: {
        label: "Evidence completeness",
        percent: evidencePercent,
        points: evidencePoints,
        maxPoints: evidenceMaxPoints,
        detail: [
          selectedApplicableRefs.length > 0
            ? `Responsibilities: ${respEvidenceProvided}/${selectedApplicableRefs.length}`
            : "Responsibilities: –",
          answeredFitness.length > 0 ? `FIT: ${fitnessEvidenceProvided}/${answeredFitness.length}` : "FIT: –",
        ].join(" · "),
      },
      riskFlags: {
        label: "Risk flags",
        percent: riskPercent,
        points: riskPoints,
        maxPoints: riskMaxPoints,
        detail: canScoreRisk
          ? `High ${riskSummary.high} · Medium ${riskSummary.medium} · Low ${riskSummary.low} · Clear ${riskSummary.clear}`
          : "Risk scoring not available until FIT answers are recorded.",
      },
    },
  };
}
