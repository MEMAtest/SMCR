"use client";

import { useState, useMemo } from "react";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { UserPlus, Trash2, Users, Info } from "lucide-react";
import type { Individual } from "@/lib/validation";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";
import { getApplicableSMFs } from "@/lib/smcr-data";

export function SmfRoster() {
  const individuals = useSmcrStore((state) => state.individuals);
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const addIndividual = useSmcrStore((state) => state.addIndividual);
  const updateIndividual = useSmcrStore((state) => state.updateIndividual);
  const removeIndividual = useSmcrStore((state) => state.removeIndividual);

  // Get applicable SMF roles based on firm profile
  const applicableSmfs = useMemo(() => {
    if (!firmProfile.firmType || !firmProfile.smcrCategory) {
      return [];
    }
    return getApplicableSMFs(firmProfile.firmType, firmProfile.smcrCategory);
  }, [firmProfile.firmType, firmProfile.smcrCategory]);

  const [isAdding, setIsAdding] = useState(false);
  const [newIndividual, setNewIndividual] = useState({
    name: "",
    smfRole: "",
    email: "",
  });

  const handleAdd = () => {
    if (!newIndividual.name.trim() || !newIndividual.smfRole.trim()) {
      return;
    }

    const individual: Individual = {
      id: `ind-${Date.now()}`,
      name: newIndividual.name.trim(),
      smfRole: newIndividual.smfRole.trim(),
      email: newIndividual.email.trim() || undefined,
    };

    addIndividual(individual);
    setNewIndividual({ name: "", smfRole: "", email: "" });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setNewIndividual({ name: "", smfRole: "", email: "" });
    setIsAdding(false);
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">smf roster</p>
          <h3 className="text-2xl">Senior Manager Functions</h3>
        </div>
        <Users className="size-8 text-emerald" />
      </div>
      <p className="text-sm text-sand/70">
        Add individuals who will hold SMF roles and own prescribed responsibilities.
      </p>

      <div className="space-y-3">
        {individuals.map((individual) => (
          <div
            key={individual.id}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="text-base font-semibold text-sand">{individual.name}</p>
              <p className="text-sm text-sand/70">{individual.smfRole}</p>
              {individual.email && <p className="text-xs text-sand/50">{individual.email}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeIndividual(individual.id)}
              className="text-warning hover:text-warning/80 transition"
              aria-label={`Remove ${individual.name}`}
            >
              <Trash2 className="size-5" />
            </button>
          </div>
        ))}

        {individuals.length === 0 && !isAdding && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
            <p className="text-sm text-sand/50">No SMF individuals added yet</p>
          </div>
        )}
      </div>

      {isAdding ? (
        <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-4 space-y-3">
          <div>
            <label className="block text-sm text-sand/80 mb-2">
              Name *
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sand focus:border-emerald focus:outline-none"
                placeholder="e.g., Jane Smith"
                value={newIndividual.name}
                onChange={(e) => setNewIndividual({ ...newIndividual, name: e.target.value })}
                autoFocus
              />
            </label>
          </div>
          <div>
            <label className="block text-sm text-sand/80 mb-2">
              SMF Role *
              <select
                className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sand focus:border-emerald focus:outline-none"
                value={newIndividual.smfRole}
                onChange={(e) => setNewIndividual({ ...newIndividual, smfRole: e.target.value })}
              >
                <option value="" className="bg-midnight text-sand/50">
                  Select SMF role...
                </option>
                {applicableSmfs.length === 0 ? (
                  <option value="" disabled className="bg-midnight text-sand/50">
                    Complete firm profile first
                  </option>
                ) : (
                  applicableSmfs.map((smf) => (
                    <option key={smf.ref} value={`${smf.ref} - ${smf.label}`} className="bg-midnight text-sand">
                      {smf.ref} - {smf.label}
                    </option>
                  ))
                )}
              </select>
              {applicableSmfs.length > 0 && newIndividual.smfRole && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 p-2">
                  <Info className="size-4 text-emerald flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-sand/70">
                    {applicableSmfs.find((s) => newIndividual.smfRole.startsWith(s.ref))?.description}
                  </p>
                </div>
              )}
            </label>
          </div>
          <div>
            <label className="block text-sm text-sand/80 mb-2">
              Email (optional)
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sand focus:border-emerald focus:outline-none"
                placeholder="jane.smith@example.com"
                value={newIndividual.email}
                onChange={(e) => setNewIndividual({ ...newIndividual, email: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 rounded-full bg-emerald/90 text-midnight px-4 py-2 font-semibold hover:bg-emerald transition"
            >
              Add Individual
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-full border border-white/20 text-sand px-4 py-2 hover:bg-white/5 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sand hover:bg-white/5 transition"
        >
          <UserPlus className="size-5" />
          Add SMF Individual
        </button>
      )}

      <WizardNavigation currentStep="responsibilities" showErrors />
    </div>
  );
}
