"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WIZARD_STEPS, type WizardStep } from "@/lib/workspace/health";
import { getCategorisation } from "@/lib/workspace/derive";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { Callout, LoadingPanel, PageHeader } from "@/components/ui";
import { StepNav } from "./StepNav";
import { StepFooter } from "./StepFooter";
import { HealthSummary } from "./HealthSummary";
import { FirmStep } from "./FirmStep";
import { PeopleStep } from "./PeopleStep";
import { ResponsibilitiesStep } from "./ResponsibilitiesStep";
import { FitnessStep } from "./FitnessStep";
import { DocumentsStep } from "./DocumentsStep";
import { computeStepStatuses, isWizardStep, stepHref, STEP_IDS, useHealthIssues, useStepValidations } from "./shared";

export function BuilderWizard() {
  const hydrated = useHydrated();
  if (!hydrated) return <LoadingPanel />;
  return <Wizard />;
}

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();
  const issues = useHealthIssues(ws, today);
  const validations = useStepValidations(ws, today);
  const statuses = computeStepStatuses(validations);

  const param = params.get("step");
  const firstIncomplete = STEP_IDS.find((s) => statuses[s] !== "complete") ?? "documents";
  const step: WizardStep = isWizardStep(param) ? param : firstIncomplete;

  // Without ?step=, open the first incomplete step once and put it in the URL.
  useEffect(() => {
    if (!isWizardStep(param)) router.replace(stepHref(firstIncomplete), { scroll: false });
    // Only when the param is missing/invalid — not every time completion changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const meta = WIZARD_STEPS.find((s) => s.id === step)!;
  const index = STEP_IDS.indexOf(step);
  const categorisation = getCategorisation(ws);
  const blockedByScope = !!categorisation.outOfScope && step !== "firm";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Setup · step ${index + 1} of ${WIZARD_STEPS.length}`}
        title={meta.title}
        description={meta.description}
      />
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_18rem]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <StepNav current={step} statuses={statuses} validations={validations} />
        </div>
        <div className="min-w-0 space-y-6">
          {blockedByScope ? (
            <Callout tone="bad" title="Firm type is outside this tool's scope">
              {categorisation.reasons[0]} Change the scope answer in the Firm profile step if this is not right.
            </Callout>
          ) : (
            <>
              {step === "firm" && <FirmStep />}
              {step === "people" && <PeopleStep />}
              {step === "responsibilities" && <ResponsibilitiesStep />}
              {step === "fitness" && <FitnessStep />}
              {step === "documents" && <DocumentsStep />}
            </>
          )}
          <StepFooter step={step} validation={validations[step]} />
        </div>
        <div className="lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:sticky xl:top-32 xl:self-start">
          <HealthSummary issues={issues} category={categorisation.category} />
        </div>
      </div>
    </div>
  );
}
