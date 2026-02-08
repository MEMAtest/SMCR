import { FIT_SECTIONS, getApplicablePRs, getFirmRegime, type JourneyStepKey, type FirmTypeKey } from "./smcr-data";

/**
 * Validation utilities for SMCR wizard steps.
 * Each step has completion criteria based on stored data.
 */

export type FirmProfile = {
  firmName?: string;
  firmType?: FirmTypeKey;
  smcrCategory?: string;
  jurisdictions?: string[];
  isCASSFirm?: boolean;
  optUp?: boolean;
};

export type Individual = {
  id: string;
  name: string;
  smfRoles: string[]; // Array of SMF roles (e.g., ["SMF1", "SMF3", "SMF16"])
  email?: string;
  roleTitle?: string; // e.g. "Head of Compliance"
  department?: string; // e.g. "Compliance", "Risk", "Board"
  managerId?: string; // ID of the manager individual (for reporting lines)
};

export type FitnessResponse = {
  sectionId: string;
  questionId: string;
  response: "yes" | "no" | "n/a" | string; // Yes/No/N/A or legacy text
  details?: string; // Conditional follow-up text
  date?: string; // Conditional date field
  evidence?: string; // Evidence links/attachments
};

export type ValidationResult = {
  isValid: boolean;
  isPartial: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validates Step 01: Firm Profile
 * Required: firm name, firm type
 * Optional: SMCR category, CASS designation
 */
export function validateFirmProfile(profile: FirmProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!profile.firmName?.trim()) {
    errors.push("Firm name is required");
  }

  if (!profile.firmType) {
    errors.push("Firm type must be selected");
  }

  if (profile.firmType) {
    const regime = getFirmRegime(profile.firmType);
    if (!profile.smcrCategory) {
      if (regime === "SMCR") {
        errors.push("SMCR category must be selected");
      } else {
        warnings.push("Payments category not specified");
      }
    }
  }

  const isValid = errors.length === 0 && !!profile.firmName && !!profile.firmType;
  const isPartial = !isValid && (!!profile.firmName || !!profile.firmType);

  return { isValid, isPartial, errors, warnings };
}

/**
 * Validates Step 02: Prescribed Responsibilities
 * Required: At least one responsibility assigned to an individual
 * Ideal: All mandatory responsibilities assigned
 */
export function validateResponsibilities(
  firmProfile: FirmProfile,
  assignments: Record<string, boolean>,
  individuals: Individual[],
  responsibilityOwners?: Record<string, string> // responsibility ref -> individual id
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!firmProfile.firmType) {
    errors.push("Complete the firm profile to load applicable responsibilities");
    return { isValid: false, isPartial: false, errors, warnings };
  }

  const regime = getFirmRegime(firmProfile.firmType);
  if (regime === "SMCR" && !firmProfile.smcrCategory) {
    errors.push("Select an SMCR category to load applicable responsibilities");
    return { isValid: false, isPartial: false, errors, warnings };
  }

  const applicablePRs = getApplicablePRs(
    firmProfile.firmType,
    firmProfile.smcrCategory,
    firmProfile.isCASSFirm ?? false
  );

  const applicableRefs = applicablePRs.map((pr) => pr.ref);
  const applicableSet = new Set(applicableRefs);
  const assignedRefs = applicableRefs.filter((ref) => assignments[ref]);
  const assignedCount = assignedRefs.length;
  const totalCount = applicableRefs.length;

  if (assignedCount === 0) {
    errors.push("At least one prescribed responsibility must be selected");
  }

  // Require individuals before proceeding
  if (individuals.length === 0) {
    errors.push("Add at least one SMF individual to assign responsibilities");
  }

  // Mandatory responsibilities must be selected (should be auto-checked in the UI, but validate defensively)
  const missingMandatory = applicablePRs.filter((pr) => pr.mandatory && !assignments[pr.ref]).length;
  if (missingMandatory > 0) {
    const plural = missingMandatory === 1 ? "mandatory responsibility is" : "mandatory responsibilities are";
    errors.push(`${missingMandatory} ${plural} not selected`);
  }

  // Check if responsibilities are assigned to individuals
  if (responsibilityOwners && individuals.length > 0) {
    // Count only owners for currently assigned responsibilities
    const ownedCount = assignedRefs.filter((ref) => responsibilityOwners[ref]).length;
    const unassignedCount = assignedCount - ownedCount;

    if (unassignedCount > 0) {
      const plural = unassignedCount === 1 ? 'responsibility needs' : 'responsibilities need';
      errors.push(`${unassignedCount} ${plural} an assigned owner`);
    }
  }

  // Warn if selections exist that are not applicable to the current firm profile
  const orphanedSelections = Object.entries(assignments)
    .filter(([, value]) => value)
    .map(([ref]) => ref)
    .filter((ref) => !applicableSet.has(ref));
  if (orphanedSelections.length > 0) {
    const plural = orphanedSelections.length === 1 ? "selection" : "selections";
    warnings.push(`${orphanedSelections.length} responsibility ${plural} do not match the current firm profile`);
  }

  const isValid = errors.length === 0 && assignedCount > 0;
  const isPartial = assignedCount > 0 && assignedCount < totalCount;

  return { isValid, isPartial, errors, warnings };
}

/**
 * Validates Step 03: Fitness & Propriety
 * Required: FIT assessment responses for all added individuals
 * Ideal: Evidence links provided for each response
 */
export function validateFitnessAssessment(
  individuals: Individual[],
  fitnessResponses: FitnessResponse[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (individuals.length === 0) {
    errors.push("Add at least one SMF individual to assess");
    return { isValid: false, isPartial: false, errors, warnings };
  }

  const totalQuestionsPerIndividual = FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);
  const answeredCount = fitnessResponses.filter((r) => r.response && r.response.trim().length > 0).length;
  const expectedMinimum = individuals.length * totalQuestionsPerIndividual;

  if (answeredCount === 0) {
    errors.push("No fitness assessment responses recorded");
  } else if (answeredCount < expectedMinimum) {
    errors.push(`${expectedMinimum - answeredCount} assessment questions remain incomplete`);
  }

  const responsesWithEvidence = fitnessResponses.filter((r) => r.evidence?.trim()).length;
  if (responsesWithEvidence === 0 && answeredCount > 0) {
    warnings.push("Consider adding evidence links to strengthen your assessment");
  }

  const isValid = errors.length === 0 && answeredCount >= expectedMinimum;
  const isPartial = answeredCount > 0 && answeredCount < expectedMinimum;

  return { isValid, isPartial, errors, warnings };
}

/**
 * Validates Step 04: Reports & Submission
 * Required: Previous steps complete
 * Ideal: All data validated and ready for export
 */
export function validateReportsReadiness(
  firmValid: boolean,
  responsibilitiesValid: boolean,
  fitnessValid: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!firmValid) {
    errors.push("Complete firm profile before generating reports");
  }

  if (!responsibilitiesValid) {
    errors.push("Assign all prescribed responsibilities before generating reports");
  }

  if (!fitnessValid) {
    warnings.push("Fitness assessment incomplete - reports may lack detail");
  }

  const isValid = firmValid && responsibilitiesValid;
  const isPartial = firmValid || responsibilitiesValid;

  return { isValid, isPartial, errors, warnings };
}

/**
 * Gets validation status for a specific step
 */
export function getStepValidation(
  stepId: JourneyStepKey,
  data: {
    firmProfile: FirmProfile;
    responsibilityAssignments: Record<string, boolean>;
    individuals: Individual[];
    fitnessResponses: FitnessResponse[];
    responsibilityOwners?: Record<string, string>;
  }
): ValidationResult {
  switch (stepId) {
    case "firm":
      return validateFirmProfile(data.firmProfile);
    case "responsibilities":
      return validateResponsibilities(
        data.firmProfile,
        data.responsibilityAssignments,
        data.individuals,
        data.responsibilityOwners
      );
    case "fitness":
      return validateFitnessAssessment(data.individuals, data.fitnessResponses);
    case "reports": {
      const firmResult = validateFirmProfile(data.firmProfile);
      const respResult = validateResponsibilities(
        data.firmProfile,
        data.responsibilityAssignments,
        data.individuals,
        data.responsibilityOwners
      );
      const fitResult = validateFitnessAssessment(data.individuals, data.fitnessResponses);
      return validateReportsReadiness(firmResult.isValid, respResult.isValid, fitResult.isValid);
    }
    default:
      return { isValid: false, isPartial: false, errors: [], warnings: [] };
  }
}

/**
 * Determines step status based on validation
 */
export function getStepStatus(
  stepId: JourneyStepKey,
  activeStep: JourneyStepKey,
  validation: ValidationResult
): "pending" | "active" | "done" | "partial" {
  if (stepId === activeStep) {
    return "active";
  }

  if (validation.isValid) {
    return "done";
  }

  if (validation.isPartial) {
    return "partial";
  }

  return "pending";
}
