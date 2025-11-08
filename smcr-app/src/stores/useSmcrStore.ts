import { create } from "zustand";
import {
  DEFAULT_STEPS,
  PRESCRIBED_RESPONSIBILITIES,
  type FirmTypeKey,
  type JourneyStepKey,
} from "@/lib/smcr-data";

type FirmProfile = {
  firmName?: string;
  firmType?: FirmTypeKey;
  smcrCategory?: string;
  jurisdictions?: string[];
  isCASSFirm?: boolean;
  optUp?: boolean;
};

type SmcrState = {
  steps: typeof DEFAULT_STEPS;
  activeStep: JourneyStepKey;
  firmProfile: FirmProfile;
  responsibilityAssignments: Record<string, boolean>;
  setActiveStep: (step: JourneyStepKey) => void;
  markStepDone: (step: JourneyStepKey) => void;
  updateFirmProfile: (updates: Partial<FirmProfile>) => void;
  setResponsibilityAssignment: (ref: string, value: boolean) => void;
  getResponsibilityCoverage: () => number;
};

const defaultAssignments = PRESCRIBED_RESPONSIBILITIES.reduce<Record<string, boolean>>((acc, item, index) => {
  acc[item.ref] = index < 2;
  return acc;
}, {});

export const useSmcrStore = create<SmcrState>((set, get) => ({
  steps: DEFAULT_STEPS,
  activeStep: "firm",
  firmProfile: {
    jurisdictions: ["UK"],
  },
  responsibilityAssignments: defaultAssignments,
  setActiveStep: (step) => set({ activeStep: step }),
  markStepDone: (step) =>
    set((state) => ({
      steps: state.steps.map((item) =>
        item.id === step ? { ...item, status: "done" } : item
      ) as typeof DEFAULT_STEPS,
    })),
  updateFirmProfile: (updates) =>
    set((state) => ({
      firmProfile: { ...state.firmProfile, ...updates },
    })),
  setResponsibilityAssignment: (ref, value) =>
    set((state) => ({
      responsibilityAssignments: { ...state.responsibilityAssignments, [ref]: value },
    })),
  getResponsibilityCoverage: () => {
    const assignments = get().responsibilityAssignments;
    const total = PRESCRIBED_RESPONSIBILITIES.length;
    if (!total) return 0;
    const complete = Object.values(assignments).filter(Boolean).length;
    return Math.round((complete / total) * 100);
  },
}));
