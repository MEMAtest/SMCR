"use client";

import { useMemo, useEffect } from "react";
import { getApplicablePRs } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { Info, ShieldCheck, ShieldAlert } from "lucide-react";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";

export function ResponsibilitiesPreview() {
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const assignments = useSmcrStore((state) => state.responsibilityAssignments);
  const setAssignment = useSmcrStore((state) => state.setResponsibilityAssignment);

  // Get applicable PRs based on firm profile
  const applicablePRs = useMemo(() => {
    if (!firmProfile.firmType || !firmProfile.smcrCategory) {
      return [];
    }
    return getApplicablePRs(
      firmProfile.firmType,
      firmProfile.smcrCategory,
      firmProfile.isCASSFirm ?? false
    );
  }, [firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm]);

  const mandatoryPRs = useMemo(() => applicablePRs.filter((pr) => pr.mandatory), [applicablePRs]);
  const optionalPRs = useMemo(() => applicablePRs.filter((pr) => !pr.mandatory), [applicablePRs]);

  // Auto-check mandatory PRs when they first appear
  useEffect(() => {
    mandatoryPRs.forEach((pr) => {
      if (!assignments[pr.ref]) {
        setAssignment(pr.ref, true);
      }
    });
  }, [mandatoryPRs, assignments, setAssignment]);

  const assignedCount = useMemo(
    () => applicablePRs.filter((pr) => assignments[pr.ref]).length,
    [applicablePRs, assignments]
  );
  const requiredCount = mandatoryPRs.length;

  if (applicablePRs.length === 0) {
    return (
      <div className="glass-panel p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 02</p>
          <h3 className="text-2xl">Prescribed Responsibilities</h3>
        </div>
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-8 text-center">
          <ShieldAlert className="size-12 text-warning mx-auto mb-3" />
          <p className="text-sm text-warning">Please complete the firm profile first</p>
          <p className="text-xs text-sand/60 mt-1">
            We need your firm type and SMCR category to show relevant responsibilities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 02</p>
          <h3 className="text-2xl">Prescribed Responsibilities</h3>
        </div>
        <div className="rounded-full bg-emerald/10 px-4 py-2 text-sm text-emerald">
          {assignedCount} of {applicablePRs.length} selected
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-emerald" />
          <p className="text-sand/80">
            <span className="font-semibold text-emerald">{requiredCount} mandatory</span> · {optionalPRs.length}{" "}
            optional
          </p>
        </div>
      </div>

      {mandatoryPRs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-emerald flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Required Responsibilities
          </h4>
          {mandatoryPRs.map((item) => (
            <label
              key={item.ref}
              className="flex items-start gap-3 rounded-2xl border border-emerald/20 bg-emerald/5 p-4 text-left cursor-not-allowed"
            >
              <input
                type="checkbox"
                checked={true}
                disabled
                className="mt-1 size-5 rounded border-white/30 bg-emerald/20"
              />
              <div className="flex-1">
                <div className="flex items-start gap-2 mb-1">
                  <p className="font-semibold text-sand flex-1">
                    PR {item.ref} · {item.text}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-emerald/20 px-2 py-0.5 text-xs font-semibold text-emerald flex-shrink-0">
                    Required
                  </span>
                </div>
                <p className="text-xs text-sand/60 mt-1">{item.description}</p>
              </div>
              <Info className="size-4 text-sand/40 flex-shrink-0 mt-1" />
            </label>
          ))}
        </div>
      )}

      {optionalPRs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-sand/80 flex items-center gap-2">
            <ShieldAlert className="size-4" />
            Optional Responsibilities
          </h4>
          {optionalPRs.map((item) => (
            <label
              key={item.ref}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left cursor-pointer hover:border-white/20 transition"
            >
              <input
                type="checkbox"
                checked={assignments[item.ref] ?? false}
                onChange={(e) => setAssignment(item.ref, e.target.checked)}
                className="mt-1 size-5 rounded border-white/30 bg-midnight"
              />
              <div className="flex-1">
                <div className="flex items-start gap-2 mb-1">
                  <p className="font-semibold text-sand flex-1">
                    PR {item.ref} · {item.text}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-sand/70 flex-shrink-0">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-sand/60 mt-1">{item.description}</p>
                {item.cassOnly && (
                  <p className="text-xs text-plumAccent mt-1">CASS firms only</p>
                )}
              </div>
              <Info className="size-4 text-sand/40 flex-shrink-0 mt-1" />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
