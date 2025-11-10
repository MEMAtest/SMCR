"use client";

import { useSmcrStore } from "@/stores/useSmcrStore";
import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";
import { Network, CheckCircle2, AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";

export function ResponsibilityMatrix() {
  const individuals = useSmcrStore((state) => state.individuals);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const setResponsibilityOwner = useSmcrStore((state) => state.setResponsibilityOwner);

  // Filter to only show assigned responsibilities
  const assignedResponsibilities = useMemo(
    () => PRESCRIBED_RESPONSIBILITIES.filter((pr) => responsibilityAssignments[pr.ref]),
    [responsibilityAssignments]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = assignedResponsibilities.length;
    // Only count owners for currently assigned responsibilities
    const owned = assignedResponsibilities.filter((pr) => responsibilityOwners[pr.ref]).length;
    const unassigned = total - owned;

    return { total, owned, unassigned };
  }, [assignedResponsibilities, responsibilityOwners]);

  const getOwnerName = (ref: string) => {
    const ownerId = responsibilityOwners[ref];
    if (!ownerId) return null;
    const owner = individuals.find((ind) => ind.id === ownerId);
    return owner?.name;
  };

  const handleAssignOwner = (ref: string, individualId: string) => {
    setResponsibilityOwner(ref, individualId);
  };

  if (assignedResponsibilities.length === 0) {
    return (
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald">assignment matrix</p>
            <h3 className="text-2xl">Responsibility Ownership</h3>
          </div>
          <Network className="size-8 text-emerald" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-sand/50">Select prescribed responsibilities in the checklist above to assign owners</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">assignment matrix</p>
          <h3 className="text-2xl">Responsibility Ownership</h3>
        </div>
        <Network className="size-8 text-emerald" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          <p className="text-2xl font-semibold text-sand">{stats.total}</p>
          <p className="text-xs text-sand/70">Total assigned</p>
        </div>
        <div className="rounded-2xl border border-emerald/40 bg-emerald/5 px-4 py-3 text-center">
          <p className="text-2xl font-semibold text-emerald">{stats.owned}</p>
          <p className="text-xs text-sand/70">With owner</p>
        </div>
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-center">
          <p className="text-2xl font-semibold text-warning">{stats.unassigned}</p>
          <p className="text-xs text-sand/70">Unassigned</p>
        </div>
      </div>

      {individuals.length === 0 ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-sm text-warning">Add SMF individuals above to assign responsibility ownership</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignedResponsibilities.map((responsibility) => {
            const currentOwner = responsibilityOwners[responsibility.ref];
            const ownerName = getOwnerName(responsibility.ref);

            return (
              <div
                key={responsibility.ref}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm font-semibold">
                    {responsibility.ref}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-sand">{responsibility.text}</p>
                    {currentOwner && ownerName && (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald/40 bg-emerald/10 px-3 py-1">
                        <CheckCircle2 className="size-4 text-emerald" />
                        <span className="text-sm text-emerald">{ownerName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {individuals.map((individual) => {
                    const isSelected = currentOwner === individual.id;
                    return (
                      <button
                        key={individual.id}
                        type="button"
                        onClick={() => handleAssignOwner(responsibility.ref, individual.id)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          isSelected
                            ? "bg-emerald text-midnight"
                            : "border border-white/20 text-sand hover:bg-white/5"
                        }`}
                      >
                        {individual.name}
                      </button>
                    );
                  })}
                  {currentOwner && (
                    <button
                      type="button"
                      onClick={() => handleAssignOwner(responsibility.ref, "")}
                      className="rounded-full border border-warning/30 px-4 py-2 text-sm text-warning hover:bg-warning/5 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stats.unassigned > 0 && individuals.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="size-5 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">
            {stats.unassigned} responsibility/responsibilities still need an assigned owner
          </p>
        </div>
      )}

      <WizardNavigation currentStep="responsibilities" showErrors />
    </div>
  );
}
