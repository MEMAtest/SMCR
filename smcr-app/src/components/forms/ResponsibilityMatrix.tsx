"use client";

import { useSmcrStore } from "@/stores/useSmcrStore";
import { getApplicablePRs, getFirmRegime } from "@/lib/smcr-data";
import { Network, CheckCircle2, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";
import { buildOwnerSuggestions } from "@/lib/insights/responsibilitySuggestions";

export function ResponsibilityMatrix() {
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const individuals = useSmcrStore((state) => state.individuals);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const setResponsibilityOwner = useSmcrStore((state) => state.setResponsibilityOwner);
  const setResponsibilityOwners = useSmcrStore((state) => state.setResponsibilityOwners);
  const responsibilityEvidence = useSmcrStore((state) => state.responsibilityEvidence);
  const setResponsibilityEvidence = useSmcrStore((state) => state.setResponsibilityEvidence);
  const setResponsibilityAssignments = useSmcrStore((state) => state.setResponsibilityAssignments);
  const setResponsibilityEvidenceMap = useSmcrStore((state) => state.setResponsibilityEvidenceMap);

  const [suggestionNotice, setSuggestionNotice] = useState<string>("");

  const regime = firmProfile.firmType ? getFirmRegime(firmProfile.firmType) : "SMCR";
  const prefixLabel = regime === "PSD" ? "PSD" : "PR";

  const applicableResponsibilities = useMemo(() => {
    if (!firmProfile.firmType) return [];
    return getApplicablePRs(
      firmProfile.firmType,
      firmProfile.smcrCategory,
      firmProfile.isCASSFirm ?? false
    );
  }, [firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm]);

  const applicableRefs = useMemo(
    () => new Set(applicableResponsibilities.map((r) => r.ref)),
    [applicableResponsibilities]
  );

  // Filter to only show assigned responsibilities (prefer applicable ones; orphaned selections shown separately)
  const assignedResponsibilities = useMemo(() => {
    return applicableResponsibilities.filter((pr) => responsibilityAssignments[pr.ref]);
  }, [applicableResponsibilities, responsibilityAssignments]);

  const orphanedResponsibilities = useMemo(() => {
    const selected = Object.entries(responsibilityAssignments)
      .filter(([, value]) => value)
      .map(([ref]) => ref);
    return selected.filter((ref) => !applicableRefs.has(ref));
  }, [responsibilityAssignments, applicableRefs]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = assignedResponsibilities.length;
    // Only count owners for currently assigned responsibilities
    const owned = assignedResponsibilities.filter((pr) => responsibilityOwners[pr.ref]).length;
    const unassigned = total - owned;

    return { total, owned, unassigned };
  }, [assignedResponsibilities, responsibilityOwners]);

  const ownerSuggestions = useMemo(() => {
    return buildOwnerSuggestions({
      assignedResponsibilities,
      individuals,
      responsibilityOwners,
    });
  }, [assignedResponsibilities, individuals, responsibilityOwners]);

  const handleApplySuggestions = () => {
    setSuggestionNotice("");
    if (ownerSuggestions.length === 0) {
      setSuggestionNotice("No suggestions available yet.");
      return;
    }

    const nextOwners = { ...responsibilityOwners };
    let applied = 0;

    for (const suggestion of ownerSuggestions) {
      if (nextOwners[suggestion.ref]) continue;
      nextOwners[suggestion.ref] = suggestion.suggestedOwnerId;
      applied++;
    }

    setResponsibilityOwners(nextOwners);
    setSuggestionNotice(applied > 0 ? `Applied ${applied} suggestion${applied === 1 ? "" : "s"}.` : "Nothing to apply.");
  };

  const handleClearOrphanedSelections = () => {
    if (orphanedResponsibilities.length === 0) return;

    const nextAssignments = { ...responsibilityAssignments };
    const nextOwners = { ...responsibilityOwners };
    const nextEvidence = { ...responsibilityEvidence };

    for (const ref of orphanedResponsibilities) {
      nextAssignments[ref] = false;
      delete nextOwners[ref];
      delete nextEvidence[ref];
    }

    setResponsibilityAssignments(nextAssignments);
    setResponsibilityOwners(nextOwners);
    setResponsibilityEvidenceMap(nextEvidence);
  };

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
          <p className="text-sm text-sand/50">
            Select responsibilities in the checklist above to assign owners
          </p>
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
          <p className="text-xs text-sand/70">Assigned</p>
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

      {ownerSuggestions.length > 0 && (
        <div className="rounded-2xl border border-emerald/20 bg-emerald/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald">Suggested owners</p>
              <p className="text-xs text-sand/60">
                Based on selected roles, the tool can suggest who should own each {prefixLabel}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplySuggestions}
              className="shrink-0 rounded-full bg-emerald/90 text-midnight px-4 py-2 text-xs font-semibold hover:bg-emerald transition"
            >
              Apply suggestions
            </button>
          </div>

          <div className="space-y-2">
            {ownerSuggestions.slice(0, 6).map((s) => (
              <div key={s.ref} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-sm text-sand">
                  <span className="font-semibold text-emerald">{prefixLabel} {s.ref}</span>{" "}
                  <span className="text-sand/60">suggested owner:</span>{" "}
                  <span className="font-semibold">{s.suggestedOwnerName}</span>
                </p>
                <p className="text-xs text-sand/60 mt-0.5">
                  Reason: {s.reasons.join(", ")}
                </p>
              </div>
            ))}
            {ownerSuggestions.length > 6 && (
              <p className="text-xs text-sand/60">Showing 6 of {ownerSuggestions.length} suggestions.</p>
            )}
          </div>

          {suggestionNotice && <p className="text-xs text-emerald">{suggestionNotice}</p>}
        </div>
      )}

      {orphanedResponsibilities.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warning">Non-applicable selections</p>
              <p className="text-xs text-sand/60 mt-1">
                {orphanedResponsibilities.length} selected {orphanedResponsibilities.length === 1 ? "responsibility" : "responsibilities"} no longer match the current firm profile.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearOrphanedSelections}
              className="shrink-0 rounded-full border border-warning/30 px-4 py-2 text-xs font-semibold text-warning hover:bg-warning/5 transition"
            >
              Clear selections
            </button>
          </div>
        </div>
      )}

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

                <div className="space-y-2">
                  <label className="block text-xs text-sand/60">
                    Evidence link / document reference (optional)
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sm text-sand focus:border-emerald focus:outline-none"
                      placeholder="https://... or document reference"
                      value={responsibilityEvidence[responsibility.ref] || ""}
                      onChange={(e) => setResponsibilityEvidence(responsibility.ref, e.target.value)}
                    />
                  </label>
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
            {stats.unassigned} {stats.unassigned === 1 ? "responsibility still needs" : "responsibilities still need"} an assigned owner
          </p>
        </div>
      )}

      <WizardNavigation currentStep="responsibilities" showErrors />
    </div>
  );
}
