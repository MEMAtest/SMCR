import { create } from "zustand";
import {
  DEFAULT_STEPS,
  PRESCRIBED_RESPONSIBILITIES,
  getApplicablePRs,
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

export interface GroupEntity {
  id: string;
  name: string;
  type: "parent" | "subsidiary" | "associate";
  linkedFirmId?: string;
  linkedProjectId?: string;
  linkedProjectName?: string;
  parentId?: string;
  ownershipPercent?: number;
  country?: string;
  regulatoryStatus?: string;
}

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
  groupEntities: GroupEntity[];

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

  // Actions - group entities
  addGroupEntity: (entity: Omit<GroupEntity, "id">) => void;
  updateGroupEntity: (id: string, updates: Partial<GroupEntity>) => void;
  removeGroupEntity: (id: string) => void;
  linkEntityToFirm: (entityId: string, firmId: string) => void;

  // Actions - validation
  validateStep: (stepId: JourneyStepKey) => ReturnType<typeof getStepValidation>;
  updateStepStatuses: () => void;

  // Actions - persistence
  setDraftId: (id: string) => void;
  loadDraft: (data: Partial<SmcrState>) => void;
};

const VALID_ENTITY_TYPES = new Set(["parent", "subsidiary", "associate"]);

function isValidGroupEntity(value: unknown): value is GroupEntity {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.type === "string" &&
    VALID_ENTITY_TYPES.has(obj.type) &&
    (obj.parentId === undefined || typeof obj.parentId === "string") &&
    (obj.ownershipPercent === undefined || typeof obj.ownershipPercent === "number") &&
    (obj.linkedFirmId === undefined || typeof obj.linkedFirmId === "string") &&
    (obj.linkedProjectId === undefined || typeof obj.linkedProjectId === "string") &&
    (obj.linkedProjectName === undefined || typeof obj.linkedProjectName === "string") &&
    (obj.country === undefined || typeof obj.country === "string") &&
    (obj.regulatoryStatus === undefined || typeof obj.regulatoryStatus === "string")
  );
}

function loadGroupEntities(): GroupEntity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("smcr-group-entities");
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidGroupEntity);
  } catch {
    return [];
  }
}

function persistGroupEntities(entities: GroupEntity[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("smcr-group-entities", JSON.stringify(entities));
  } catch (e) {
    console.error("Failed to persist group entities:", e);
  }
}

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
  groupEntities: loadGroupEntities(),

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
    const state = get();
    const assignments = state.responsibilityAssignments;
    const { firmType, smcrCategory, isCASSFirm } = state.firmProfile;

    // Get only applicable PRs based on firm profile
    const applicablePRs = firmType && smcrCategory
      ? getApplicablePRs(firmType, smcrCategory, isCASSFirm || false)
      : PRESCRIBED_RESPONSIBILITIES;

    const total = applicablePRs.length;
    if (!total) return 0;

    // Count only applicable PRs that are assigned
    const complete = applicablePRs.filter((pr) => assignments[pr.ref]).length;
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

  // Group entity actions
  addGroupEntity: (input) => {
    const entity: GroupEntity = { ...input, id: `ge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
    set((state) => {
      // Validate parentId exists if provided
      if (entity.parentId && !state.groupEntities.some((e) => e.id === entity.parentId)) {
        return { groupEntities: state.groupEntities };
      }
      const next = [...state.groupEntities, entity];
      persistGroupEntities(next);
      return { groupEntities: next };
    });
  },

  updateGroupEntity: (id, updates) => {
    set((state) => {
      // Prevent circular parent references; normalize empty string to undefined
      if (updates.parentId !== undefined) {
        if (updates.parentId === "") {
          updates = { ...updates, parentId: undefined };
        } else {
          if (updates.parentId === id) {
            return { groupEntities: state.groupEntities };
          }
          const wouldCycle = (targetId: string): boolean => {
            if (targetId === id) return true;
            const parent = state.groupEntities.find((e) => e.id === targetId);
            if (!parent || !parent.parentId) return false;
            return wouldCycle(parent.parentId);
          };
          if (wouldCycle(updates.parentId)) {
            return { groupEntities: state.groupEntities };
          }
        }
      }
      const next = state.groupEntities.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );
      persistGroupEntities(next);
      return { groupEntities: next };
    });
  },

  removeGroupEntity: (id) => {
    set((state) => {
      const removed = state.groupEntities.find((e) => e.id === id);
      const reparentedParentId = removed?.parentId ?? undefined;
      // Reparent children of the deleted entity to its parent (or make them root)
      const next = state.groupEntities
        .filter((e) => e.id !== id)
        .map((e) =>
          e.parentId === id ? { ...e, parentId: reparentedParentId } : e
        );
      persistGroupEntities(next);
      return { groupEntities: next };
    });
  },

  linkEntityToFirm: (entityId, firmId) => {
    set((state) => {
      const next = state.groupEntities.map((e) =>
        e.id === entityId ? { ...e, linkedFirmId: firmId } : e
      );
      persistGroupEntities(next);
      return { groupEntities: next };
    });
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
