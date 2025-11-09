import { create } from "zustand";
import {
  DEFAULT_STEPS,
  PRESCRIBED_RESPONSIBILITIES,
  type FirmTypeKey,
  type JourneyStepKey,
} from "@/lib/smcr-data";
import {
  type FirmProfile,
  type Individual,
  type FitnessResponse,
  getStepValidation,
  getStepStatus,
} from "@/lib/validation";

type SmcrState = {
  // Core data
  steps: typeof DEFAULT_STEPS;
  activeStep: JourneyStepKey;
  firmProfile: FirmProfile;
  responsibilityAssignments: Record<string, boolean>;
  responsibilityOwners: Record<string, string>; // responsibility ref -> individual id
  individuals: Individual[];
  fitnessResponses: FitnessResponse[];
  draftId?: string; // ID of the saved draft

  // Actions - navigation
  setActiveStep: (step: JourneyStepKey) => void;
  markStepDone: (step: JourneyStepKey) => void;

  // Actions - firm profile
  updateFirmProfile: (updates: Partial<FirmProfile>) => void;

  // Actions - responsibilities
  setResponsibilityAssignment: (ref: string, value: boolean) => void;
  setResponsibilityAssignments: (assignments: Record<string, boolean>) => void;
  setResponsibilityOwner: (ref: string, individualId: string) => void;
  setResponsibilityOwners: (owners: Record<string, string>) => void;
  getResponsibilityCoverage: () => number;

  // Actions - individuals
  addIndividual: (individual: Individual) => void;
  updateIndividual: (id: string, updates: Partial<Individual>) => void;
  removeIndividual: (id: string) => void;
  setIndividuals: (individuals: Individual[]) => void;

  // Actions - fitness
  setFitnessResponse: (response: FitnessResponse) => void;
  removeFitnessResponse: (sectionId: string, questionId: string) => void;
  setFitnessResponses: (responses: FitnessResponse[]) => void;

  // Actions - validation
  validateStep: (stepId: JourneyStepKey) => ReturnType<typeof getStepValidation>;
  updateStepStatuses: () => void;

  // Actions - persistence
  setDraftId: (id: string) => void;
  loadDraft: (data: Partial<SmcrState>) => void;
};

const defaultAssignments = PRESCRIBED_RESPONSIBILITIES.reduce<Record<string, boolean>>((acc, item) => {
  acc[item.ref] = false; // All unchecked by default
  return acc;
}, {});

export const useSmcrStore = create<SmcrState>((set, get) => ({
  // Initial state
  steps: DEFAULT_STEPS,
  activeStep: "firm",
  firmProfile: {
    jurisdictions: ["UK"],
  },
  responsibilityAssignments: defaultAssignments,
  responsibilityOwners: {},
  individuals: [],
  fitnessResponses: [],
  draftId: undefined,

  // Navigation actions
  setActiveStep: (step) => {
    set({ activeStep: step });
    get().updateStepStatuses();
  },

  markStepDone: (step) =>
    set((state) => ({
      steps: state.steps.map((item) =>
        item.id === step ? { ...item, status: "done" } : item
      ) as typeof DEFAULT_STEPS,
    })),

  // Firm profile actions
  updateFirmProfile: (updates) => {
    set((state) => ({
      firmProfile: { ...state.firmProfile, ...updates },
    }));
    get().updateStepStatuses();
  },

  // Responsibility actions
  setResponsibilityAssignment: (ref, value) => {
    set((state) => ({
      responsibilityAssignments: { ...state.responsibilityAssignments, [ref]: value },
    }));
    get().updateStepStatuses();
  },

  setResponsibilityAssignments: (assignments) => {
    set({ responsibilityAssignments: assignments });
    get().updateStepStatuses();
  },

  setResponsibilityOwner: (ref, individualId) => {
    set((state) => ({
      responsibilityOwners: { ...state.responsibilityOwners, [ref]: individualId },
    }));
    get().updateStepStatuses();
  },

  setResponsibilityOwners: (owners) => {
    set({ responsibilityOwners: owners });
    get().updateStepStatuses();
  },

  getResponsibilityCoverage: () => {
    const assignments = get().responsibilityAssignments;
    const total = PRESCRIBED_RESPONSIBILITIES.length;
    if (!total) return 0;
    const complete = Object.values(assignments).filter(Boolean).length;
    return Math.round((complete / total) * 100);
  },

  // Individual actions
  addIndividual: (individual) => {
    set((state) => ({
      individuals: [...state.individuals, individual],
    }));
    get().updateStepStatuses();
  },

  updateIndividual: (id, updates) => {
    set((state) => ({
      individuals: state.individuals.map((ind) => (ind.id === id ? { ...ind, ...updates } : ind)),
    }));
    get().updateStepStatuses();
  },

  removeIndividual: (id) => {
    set((state) => ({
      individuals: state.individuals.filter((ind) => ind.id !== id),
      // Clean up related data
      responsibilityOwners: Object.fromEntries(
        Object.entries(state.responsibilityOwners).filter(([, ownerId]) => ownerId !== id)
      ),
      // New format: questionId is "individualId::sectionId::questionIndex"
      fitnessResponses: state.fitnessResponses.filter((resp) => {
        const individualId = resp.questionId.split("::")[0];
        return individualId !== id;
      }),
    }));
    get().updateStepStatuses();
  },

  setIndividuals: (individuals) => {
    set({ individuals });
    get().updateStepStatuses();
  },

  // Fitness actions
  setFitnessResponse: (response) => {
    set((state) => {
      const existing = state.fitnessResponses.findIndex(
        (r) => r.sectionId === response.sectionId && r.questionId === response.questionId
      );

      if (existing !== -1) {
        const updated = [...state.fitnessResponses];
        updated[existing] = response;
        return { fitnessResponses: updated };
      } else {
        return { fitnessResponses: [...state.fitnessResponses, response] };
      }
    });
    get().updateStepStatuses();
  },

  removeFitnessResponse: (sectionId, questionId) => {
    set((state) => ({
      fitnessResponses: state.fitnessResponses.filter(
        (r) => r.sectionId !== sectionId || r.questionId !== questionId
      ),
    }));
    get().updateStepStatuses();
  },

  setFitnessResponses: (responses) => {
    set({ fitnessResponses: responses });
    get().updateStepStatuses();
  },

  // Validation actions
  validateStep: (stepId) => {
    const state = get();
    return getStepValidation(stepId, {
      firmProfile: state.firmProfile,
      responsibilityAssignments: state.responsibilityAssignments,
      individuals: state.individuals,
      fitnessResponses: state.fitnessResponses,
      responsibilityOwners: state.responsibilityOwners,
    });
  },

  updateStepStatuses: () => {
    const state = get();
    const updatedSteps = state.steps.map((step) => {
      const validation = state.validateStep(step.id);
      const status = getStepStatus(step.id, state.activeStep, validation);
      return { ...step, status };
    });
    set({ steps: updatedSteps as typeof DEFAULT_STEPS });
  },

  // Persistence actions
  setDraftId: (id) => set({ draftId: id }),

  loadDraft: (data) => {
    set((state) => ({
      ...state,
      ...data,
    }));
    get().updateStepStatuses();
  },
}));
