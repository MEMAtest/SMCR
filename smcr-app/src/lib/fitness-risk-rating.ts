/**
 * Fitness & Propriety Risk Rating System
 *
 * Calculates risk levels for individuals based on their fitness questionnaire responses.
 * Risk levels: High (≥10 points), Medium (5-9 points), Low (1-4 points), Clear (0 points)
 */

export type FitnessResponses = Record<string, { response?: string; details?: string; date?: string }>;

export type RiskLevel = "Clear" | "Low" | "Medium" | "High";

export interface FlaggedQuestion {
  questionId: string;
  sectionRef: string;
  questionText: string;
  riskWeight: number;
  details?: string;
  date?: string;
}

export interface SectionRisk {
  sectionRef: string;
  sectionName: string;
  score: number;
  flaggedQuestions: FlaggedQuestion[];
}

export interface IndividualRiskAssessment {
  individualId: string;
  individualName: string;
  overallScore: number;
  riskLevel: RiskLevel;
  sectionBreakdown: SectionRisk[];
  allFlaggedQuestions: FlaggedQuestion[];
}

// Risk weights for each question
const RISK_WEIGHTS: Record<string, { weight: number; text: string }> = {
  // HIGH RISK (10 points) - FIT 2.1: Honesty, Integrity & Reputation
  criminal_convictions: {
    weight: 10,
    text: "Criminal convictions relating to dishonesty, fraud, or financial crime"
  },
  regulatory_investigations: {
    weight: 10,
    text: "Subject to regulatory investigations or disciplinary actions"
  },
  fiduciary_breach: {
    weight: 10,
    text: "Breach of fiduciary duty or trust"
  },
  director_disqualification: {
    weight: 10,
    text: "Disqualified from acting as director"
  },
  market_abuse: {
    weight: 10,
    text: "Market abuse, insider dealing, or manipulation"
  },
  money_laundering: {
    weight: 10,
    text: "Money laundering or terrorist financing"
  },
  fraud_misrepresentation: {
    weight: 10,
    text: "Fraud or misrepresentation"
  },
  overseas_sanctions: {
    weight: 10,
    text: "Overseas regulatory sanctions"
  },
  previous_refusal: {
    weight: 10,
    text: "Previously refused or restricted FCA/PRA approval"
  },

  // MEDIUM RISK (5 points) - FIT 2.3: Financial Soundness
  ccj_orders: {
    weight: 5,
    text: "County Court Judgments (CCJs)"
  },
  bankruptcy: {
    weight: 5,
    text: "Bankruptcy proceedings"
  },
  iva_dro: {
    weight: 5,
    text: "Individual Voluntary Arrangement or Debt Relief Order"
  },
  creditor_arrangements: {
    weight: 5,
    text: "Arrangements with creditors or debt management plans"
  },

  // MEDIUM RISK (5 points) - FIT 2.1: Civil/Professional issues
  civil_proceedings: {
    weight: 5,
    text: "Civil proceedings with adverse findings"
  },
  professional_sanctions: {
    weight: 5,
    text: "Professional body sanctions"
  },

  // LOW RISK (2 points)
  adverse_media: {
    weight: 2,
    text: "Adverse media reports"
  },
};

// Section definitions
const SECTIONS: Record<string, string> = {
  "FIT 2.1": "Honesty, Integrity & Reputation",
  "FIT 2.2": "Competence & Capability",
  "FIT 2.3": "Financial Soundness",
};

/**
 * Determines which section a question belongs to based on question ID
 */
function getQuestionSection(questionId: string): string {
  // FIT 2.1 questions
  const fit21Questions = [
    "criminal_convictions",
    "regulatory_investigations",
    "civil_proceedings",
    "fiduciary_breach",
    "director_disqualification",
    "market_abuse",
    "money_laundering",
    "fraud_misrepresentation",
    "professional_sanctions",
    "adverse_media",
    "overseas_sanctions",
    "previous_refusal",
  ];

  // FIT 2.2 questions
  const fit22Questions = [
    "relevant_qualifications",
    "professional_development",
    "role_understanding",
    "regulatory_knowledge",
    "time_commitment",
    "conflicts_of_interest",
    "previous_employment",
    "gaps_in_employment",
    "references_available",
    "language_proficiency",
  ];

  // FIT 2.3 questions
  const fit23Questions = [
    "ccj_orders",
    "bankruptcy",
    "iva_dro",
    "creditor_arrangements",
    "financial_difficulties",
    "guarantees_failed",
    "business_failures",
    "debt_recovery",
  ];

  if (fit21Questions.includes(questionId)) return "FIT 2.1";
  if (fit22Questions.includes(questionId)) return "FIT 2.2";
  if (fit23Questions.includes(questionId)) return "FIT 2.3";

  return "Unknown";
}

/**
 * Calculates risk level based on total score
 */
function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  if (score >= 1) return "Low";
  return "Clear";
}

/**
 * Calculates risk assessment for a single individual
 */
export function calculateIndividualRisk(
  individualId: string,
  individualName: string,
  responses: FitnessResponses
): IndividualRiskAssessment {
  const flaggedQuestions: FlaggedQuestion[] = [];
  const sectionScores: Record<string, { score: number; questions: FlaggedQuestion[] }> = {
    "FIT 2.1": { score: 0, questions: [] },
    "FIT 2.2": { score: 0, questions: [] },
    "FIT 2.3": { score: 0, questions: [] },
  };

  // Iterate through all responses
  Object.entries(responses).forEach(([questionId, response]) => {
    // Only count "yes" answers
    if (response?.response === "yes") {
      const riskInfo = RISK_WEIGHTS[questionId];

      // If this question has a risk weight
      if (riskInfo) {
        const section = getQuestionSection(questionId);

        const flagged: FlaggedQuestion = {
          questionId,
          sectionRef: section,
          questionText: riskInfo.text,
          riskWeight: riskInfo.weight,
          details: response.details,
          date: response.date,
        };

        flaggedQuestions.push(flagged);

        if (sectionScores[section]) {
          sectionScores[section].score += riskInfo.weight;
          sectionScores[section].questions.push(flagged);
        }
      }
    }
  });

  // Calculate overall score
  const overallScore = Object.values(sectionScores).reduce((sum, section) => sum + section.score, 0);

  // Build section breakdown
  const sectionBreakdown: SectionRisk[] = Object.entries(sectionScores).map(([ref, data]) => ({
    sectionRef: ref,
    sectionName: SECTIONS[ref] || ref,
    score: data.score,
    flaggedQuestions: data.questions,
  }));

  return {
    individualId,
    individualName,
    overallScore,
    riskLevel: calculateRiskLevel(overallScore),
    sectionBreakdown,
    allFlaggedQuestions: flaggedQuestions,
  };
}

/**
 * Calculates risk assessments for all individuals
 */
export function calculateAllRisks(
  individuals: Array<{ id: string; name: string }>,
  fitnessData: Record<string, FitnessResponses>
): IndividualRiskAssessment[] {
  return individuals.map((individual) => {
    const responses = fitnessData[individual.id] || {};
    return calculateIndividualRisk(individual.id, individual.name, responses);
  });
}

/**
 * Gets color class for risk level badge
 */
export function getRiskColorClass(level: RiskLevel): string {
  switch (level) {
    case "High":
      return "bg-red-500/10 text-red-500 border-red-500/30";
    case "Medium":
      return "bg-amber-500/10 text-amber-500 border-amber-500/30";
    case "Low":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    case "Clear":
      return "bg-emerald/10 text-emerald border-emerald/30";
  }
}

/**
 * Gets firm-wide risk summary
 */
export function getFirmRiskSummary(assessments: IndividualRiskAssessment[]): {
  total: number;
  high: number;
  medium: number;
  low: number;
  clear: number;
} {
  const summary = {
    total: assessments.length,
    high: 0,
    medium: 0,
    low: 0,
    clear: 0,
  };

  assessments.forEach((assessment) => {
    switch (assessment.riskLevel) {
      case "High":
        summary.high++;
        break;
      case "Medium":
        summary.medium++;
        break;
      case "Low":
        summary.low++;
        break;
      case "Clear":
        summary.clear++;
        break;
    }
  });

  return summary;
}
