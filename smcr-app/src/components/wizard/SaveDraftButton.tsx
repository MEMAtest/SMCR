"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { saveDraft } from "@/lib/services/draftService";

export function SaveDraftButton() {
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const responsibilityEvidence = useSmcrStore((state) => state.responsibilityEvidence);
  const individuals = useSmcrStore((state) => state.individuals);
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const draftId = useSmcrStore((state) => state.draftId);
  const setDraftId = useSmcrStore((state) => state.setDraftId);

  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const disabled = !firmProfile.firmName || !firmProfile.firmType || status === "saving";

  const handleSave = async () => {
    setStatus("saving");
    setMessage("");

    const result = await saveDraft(
      {
        firmProfile,
        responsibilityAssignments,
        responsibilityOwners,
        responsibilityEvidence,
        individuals,
        fitnessResponses,
      },
      draftId
    );

    if (result.success && result.draftId) {
      setStatus("success");
      setMessage(`Draft saved (#${result.draftId.slice(0, 8)})`);
      if (!draftId) {
        setDraftId(result.draftId);
      }
      try {
        localStorage.setItem("smcr_current_draft_id", result.draftId);
      } catch {}
    } else {
      setStatus("error");
      setMessage(result.error || "Unable to save draft");
    }
  };

  return (
    <div className="glass-panel p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">save state</p>
          <h3 className="text-2xl">Save draft snapshot</h3>
        </div>
        {status === "success" ? (
          <CheckCircle2 className="size-6 text-emerald" />
        ) : status === "error" ? (
          <ShieldAlert className="size-6 text-warning" />
        ) : (
          <Save className="size-6 text-sand/70" />
        )}
      </div>
      <p className="text-sm text-sand/70">
        Stores the firm profile plus assigned responsibilities to secure draft storage for later access.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={handleSave}
        className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition ${
          disabled ? "bg-white/10 text-sand/40 cursor-not-allowed" : "bg-emerald/90 text-midnight hover:bg-emerald"
        }`}
      >
        {status === "saving" && <Loader2 className="size-4 animate-spin" />}
        Save Draft
      </button>
      {message && (
        <p
          className={`text-sm ${
            status === "error" ? "text-warning" : "text-emerald"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
