"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { WIZARD_STEPS, type StepValidation, type WizardStep } from "@/lib/workspace/health";
import { Button } from "@/components/ui";
import { IssueLink, stepHref } from "./shared";

export function StepFooter({ step, validation }: { step: WizardStep; validation: StepValidation }) {
  const router = useRouter();
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const prev = WIZARD_STEPS[index - 1];
  const next = WIZARD_STEPS[index + 1];
  const blocked = validation.blockers.length > 0;

  const go = (href: string) => {
    router.push(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="glass-panel space-y-4 p-5">
      {blocked && (
        <div id="step-blockers">
          <p className="text-sm font-semibold text-sand">
            Resolve {validation.blockers.length} blocker{validation.blockers.length === 1 ? "" : "s"} to continue
          </p>
          <ul className="-mx-2 mt-1 space-y-0.5">
            {validation.blockers.map((b) => (
              <li key={b.id}>
                <IssueLink issue={b} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sand/60">You can still move to any step using the step list.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {prev ? (
          <Button onClick={() => go(stepHref(prev.id))}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="primary" disabled={blocked} aria-describedby={blocked ? "step-blockers" : undefined} onClick={() => go(stepHref(next.id))}>
            Continue to {next.title}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => go("/workspace")}>
            Go to dashboard
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
