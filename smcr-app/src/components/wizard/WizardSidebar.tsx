"use client";

import { Check, Circle } from "lucide-react";
import { useSmcrStore } from "@/stores/useSmcrStore";

const statusStyles: Record<string, string> = {
  pending: "text-sand/60 border-white/10",
  active: "text-sand border-emerald/70 bg-white/5",
  done: "text-emerald border-emerald bg-emerald/10",
};

export function WizardSidebar() {
  const { steps, activeStep, setActiveStep } = useSmcrStore();

  return (
    <aside className="glass-panel p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald">smcr journey</p>
        <h2 className="mt-2 text-2xl">Responsibilities Navigator</h2>
        <p className="text-sm text-sand/70">
          Autosaves locally. Plug into Neon + MEMA services once API credentials are ready.
        </p>
      </div>
      <div className="space-y-4">
        {steps.map((step) => {
          const stateClass = statusStyles[step.status];
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`w-full text-left border rounded-2xl px-4 py-3 transition ${stateClass}`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5">
                  {step.status === "done" ? <Check className="size-4" /> : <Circle className="size-4" />}
                </span>
                <div>
                  <p className={`text-sm uppercase tracking-widest ${isActive ? "text-emerald" : "text-sand/70"}`}>
                    {step.title}
                  </p>
                  <p className="text-base text-sand">{step.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
