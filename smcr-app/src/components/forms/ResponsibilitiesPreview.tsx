"use client";

import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { Info } from "lucide-react";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";

export function ResponsibilitiesPreview() {
  const assignments = useSmcrStore((state) => state.responsibilityAssignments);
  const setAssignment = useSmcrStore((state) => state.setResponsibilityAssignment);
  const coverage = useSmcrStore((state) => state.getResponsibilityCoverage());

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 02</p>
          <h3 className="text-2xl">Prescribed responsibilities draft</h3>
        </div>
        <div className="rounded-full bg-emerald/10 px-4 py-2 text-sm text-emerald">{coverage}% mapped</div>
      </div>
      <div className="space-y-3">
        {PRESCRIBED_RESPONSIBILITIES.map((item) => (
          <label
            key={item.ref}
            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
          >
            <input
              type="checkbox"
              checked={assignments[item.ref] ?? false}
              onChange={(e) => setAssignment(item.ref, e.target.checked)}
              className="mt-1 size-5 rounded border-white/30 bg-midnight"
            />
            <div>
              <p className="font-semibold text-sand">
                {item.ref} {item.text}
              </p>
              <p className="text-xs text-sand/60">Applicable category: {item.cat}</p>
            </div>
            <Info className="size-4 text-sand/40" />
          </label>
        ))}
      </div>

      <WizardNavigation currentStep="responsibilities" showErrors />
    </div>
  );
}
