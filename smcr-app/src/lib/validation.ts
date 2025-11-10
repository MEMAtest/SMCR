import type { JourneyStepKey, FirmTypeKey } from "./smcr-data";

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
  smfRole: string;
  email?: string;
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

  if (!profile.smcrCategory) {
    warnings.push("SMCR category not specified");
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
  assignments: Record<string, boolean>,
  individuals: Individual[],
  responsibilityOwners?: Record<string, string> // responsibility ref -> individual id
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const totalCount = Object.keys(assignments).length;

  if (assignedCount === 0) {
    errors.push("At least one prescribed responsibility must be selected");
  }

  // Require individuals before proceeding
  if (individuals.length === 0) {
    errors.push("Add at least one SMF individual to assign responsibilities");
  }

  // Check if responsibilities are assigned to individuals
  if (responsibilityOwners && individuals.length > 0) {
    // Count only owners for currently assigned responsibilities
    const assignedRefs = Object.entries(assignments)
      .filter(([, value]) => value)
      .map(([ref]) => ref);

    const ownedCount = assignedRefs.filter((ref) => responsibilityOwners[ref]).length;
    const unassignedCount = assignedCount - ownedCount;

    if (unassignedCount > 0) {
      const plural = unassignedCount === 1 ? 'responsibility needs' : 'responsibilities need';
      errors.push(`${unassignedCount} ${plural} an assigned owner`);
    }
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

  const responseCount = fitnessResponses.length;
  const expectedMinimum = individuals.length * 3; // Assume 3 key FIT sections

  if (responseCount === 0) {
    errors.push("No fitness assessment responses recorded");
  } else if (responseCount < expectedMinimum) {
    warnings.push(`${expectedMinimum - responseCount} assessment questions remain incomplete`);
  }

  const responsesWithEvidence = fitnessResponses.filter((r) => r.evidence?.trim()).length;
  if (responsesWithEvidence === 0 && responseCount > 0) {
    warnings.push("Consider adding evidence links to strengthen your assessment");
  }

  const isValid = errors.length === 0 && responseCount >= expectedMinimum;
  const isPartial = responseCount > 0 && responseCount < expectedMinimum;

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
        data.responsibilityAssignments,
        data.individuals,
        data.responsibilityOwners
      );
    case "fitness":
      return validateFitnessAssessment(data.individuals, data.fitnessResponses);
    case "reports": {
      const firmResult = validateFirmProfile(data.firmProfile);
      const respResult = validateResponsibilities(
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
