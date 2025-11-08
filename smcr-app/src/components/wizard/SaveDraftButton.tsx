"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { useSmcrStore } from "@/stores/useSmcrStore";

export function SaveDraftButton() {
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const assignments = useSmcrStore((state) => state.responsibilityAssignments);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const responsibilityRefs = useMemo(
    () =>
      Object.entries(assignments)
        .filter(([, value]) => value)
        .map(([ref]) => ref),
    [assignments]
  );

  const disabled = !firmProfile.firmName || !firmProfile.firmType || status === "saving";

  const handleSave = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/firms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firmProfile, responsibilityRefs }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "" }));
        throw new Error(data.error || "Unable to save draft");
      }

      const data = await response.json();
      setStatus("success");
      setMessage(`Draft saved (#${data.id.slice(0, 8)})`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save draft");
    }
  };

  return (
    <div className="glass-panel p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">save state</p>
          <h3 className="text-2xl">Neon draft snapshot</h3>
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
        Stores the firm profile plus assigned responsibilities to Neon so you can resume work later.
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
        Save to Neon
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
