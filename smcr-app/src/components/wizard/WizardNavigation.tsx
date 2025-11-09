"use client";

import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { useSmcrStore } from "@/stores/useSmcrStore";
import type { JourneyStepKey } from "@/lib/smcr-data";

interface WizardNavigationProps {
  currentStep: JourneyStepKey;
  showErrors?: boolean;
}

export function WizardNavigation({ currentStep, showErrors = false }: WizardNavigationProps) {
  const { steps, activeStep, setActiveStep, validateStep } = useSmcrStore();

  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const prevStep = currentIndex > 0 ? steps[currentIndex - 1] : null;
  const nextStep = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;

  const validation = validateStep(currentStep);
  const canProceed = validation.isValid;

  return (
    <div className="space-y-4">
      {showErrors && !validation.isValid && validation.errors.length > 0 && (
        <div className="rounded-2xl border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning mb-2">Please complete the following:</p>
              <ul className="space-y-1 text-sm text-sand/90">
                {validation.errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-warning">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {prevStep ? (
          <button
            onClick={() => setActiveStep(prevStep.id)}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sand/80 transition hover:border-emerald/50 hover:text-sand"
          >
            <ArrowLeft className="size-4" />
            Previous
          </button>
        ) : (
          <div />
        )}

        {nextStep && (
          <button
            onClick={() => setActiveStep(nextStep.id)}
            disabled={!canProceed}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition ${
              canProceed
                ? "bg-emerald/90 text-midnight hover:bg-emerald hover:-translate-y-0.5"
                : "bg-white/10 text-sand/40 cursor-not-allowed"
            }`}
          >
            {canProceed ? "Next" : "Complete this step"}
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
