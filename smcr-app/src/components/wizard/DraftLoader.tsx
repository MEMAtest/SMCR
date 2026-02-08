"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { loadDraft } from "@/lib/services/draftService";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export function DraftLoader() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const { setDraftId, updateFirmProfile, setResponsibilityAssignments, setResponsibilityOwners, setResponsibilityEvidenceMap, setIndividuals, setFitnessResponses } =
    useSmcrStore();

  useEffect(() => {
    // Check for draft ID in URL params or localStorage
    const draftIdFromUrl = searchParams.get("draftId");
    const draftIdFromStorage = localStorage.getItem("smcr_current_draft_id");
    const draftId = draftIdFromUrl || draftIdFromStorage;

    if (!draftId) {
      return;
    }

    // Don't reload if we've already loaded this draft
    const currentDraftId = useSmcrStore.getState().draftId;
    if (currentDraftId === draftId) {
      return;
    }

    setStatus("loading");
    setMessage("Loading draft...");

    loadDraft(draftId)
      .then((result) => {
        if (result.success && result.data) {
          // Hydrate the store with loaded data
          setDraftId(draftId);
          updateFirmProfile(result.data.firmProfile);
          setResponsibilityAssignments(result.data.responsibilityAssignments);
          setResponsibilityOwners(result.data.responsibilityOwners);
          setResponsibilityEvidenceMap(result.data.responsibilityEvidence || {});
          setIndividuals(result.data.individuals);
          setFitnessResponses(result.data.fitnessResponses);

          // Store draft ID in localStorage for future sessions
          localStorage.setItem("smcr_current_draft_id", draftId);

          setStatus("success");
          setMessage(`Draft loaded: ${result.data.firmProfile.firmName || "Unnamed firm"}`);

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setStatus("idle");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(result.error || "Failed to load draft");
        }
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Network error");
      });
  }, [searchParams, setDraftId, updateFirmProfile, setResponsibilityAssignments, setResponsibilityOwners, setResponsibilityEvidenceMap, setIndividuals, setFitnessResponses]);

  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 rounded-2xl border px-6 py-4 shadow-lg transition-all ${
        status === "loading"
          ? "border-emerald/50 bg-emerald/10"
          : status === "success"
          ? "border-emerald bg-emerald/20"
          : "border-red-500/50 bg-red-500/10"
      }`}
    >
      <div className="flex items-center gap-3">
        {status === "loading" && <Loader2 className="size-5 animate-spin text-emerald" />}
        {status === "success" && <CheckCircle className="size-5 text-emerald" />}
        {status === "error" && <AlertCircle className="size-5 text-red-400" />}
        <p className="text-sm font-medium text-sand">{message}</p>
      </div>
    </div>
  );
}
