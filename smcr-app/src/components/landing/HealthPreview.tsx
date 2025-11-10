"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, Users, Shield, CheckSquare } from "lucide-react";
import { loadDraft, type DraftData } from "@/lib/services/draftService";

export function HealthPreview() {
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for recent draft ID
    const storedDraftId = localStorage.getItem("smcr_current_draft_id");
    if (storedDraftId) {
      setDraftId(storedDraftId);
      loadDraft(storedDraftId).then((result) => {
        if (result.success && result.data) {
          setDraftData(result.data);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  // Calculate stats from draft data
  const stats = draftData
    ? {
        assignedCount: Object.values(draftData.responsibilityAssignments).filter(Boolean).length,
        totalResponsibilities: Object.keys(draftData.responsibilityAssignments).length,
        ownedCount: Object.entries(draftData.responsibilityOwners).length,
        individualsCount: draftData.individuals.length,
        fitnessCompletionPct:
          draftData.individuals.length > 0
            ? Math.round(
                (draftData.fitnessResponses.filter((r) => r.response.trim().length > 0).length /
                  (draftData.individuals.length * 6)) *
                  100
              )
            : 0,
      }
    : null;

  const coverageScore = stats
    ? stats.assignedCount > 0
      ? Math.round((stats.ownedCount / stats.assignedCount) * 100)
      : 0
    : null;

  if (loading) {
    return (
      <div className="glass-panel gradient-border p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 blur-3xl bg-plumAccent/40" />
        <div className="relative z-10 flex items-center justify-center min-h-[400px]">
          <p className="text-sand/70">Loading draft preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel gradient-border p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 blur-3xl bg-plumAccent/40" />
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <Image
            src="/mema-mark.svg"
            alt="MEMA"
            width={64}
            height={64}
            className="rounded-full border border-emerald/40"
          />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cloud/70">MEMA insight</p>
            <p className="text-2xl font-semibold">SMCR Health Preview</p>
          </div>
        </div>

        {draftData ? (
          <>
            <div className="space-y-4 mb-6">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm text-cloud/80">Coverage score</p>
                <p className="text-4xl font-semibold text-emerald">{coverageScore}%</p>
                <p className="text-xs text-sand/70">
                  {stats!.ownedCount} of {stats!.assignedCount} responsibilities assigned
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm text-cloud/80">Fitness assessment</p>
                <p className="text-2xl font-semibold">{stats!.fitnessCompletionPct}% complete</p>
                <p className="text-xs text-sand/70">
                  {stats!.individualsCount} individual{stats!.individualsCount !== 1 ? "s" : ""} tracked
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm text-cloud/80">Firm profile</p>
                <p className="text-lg font-semibold">{draftData.firmProfile.firmName || "Unnamed firm"}</p>
                <p className="text-xs text-sand/70">{draftData.firmProfile.firmType || "Type not set"}</p>
              </div>
            </div>
            <Link
              href={`/builder?draftId=${draftId}`}
              className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-emerald/90 px-6 py-3 text-midnight font-semibold transition hover:bg-emerald"
            >
              <FileText className="size-4" />
              Continue Draft
              <ArrowRight className="size-4" />
            </Link>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4 flex items-start gap-3">
                <CheckSquare className="size-5 text-emerald flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sand">Map prescribed responsibilities</p>
                  <p className="text-xs text-sand/70">Assign 45+ SMCR responsibilities to senior managers</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4 flex items-start gap-3">
                <Users className="size-5 text-emerald flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sand">Assess SMF fitness & propriety</p>
                  <p className="text-xs text-sand/70">Complete FCA FIT assessments for all SMF individuals</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4 flex items-start gap-3">
                <FileText className="size-5 text-emerald flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sand">Generate board reports & exports</p>
                  <p className="text-xs text-sand/70">Export PDF reports and CSV data for regulatory filing</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4 flex items-start gap-3">
                <Shield className="size-5 text-emerald flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sand">Track compliance status</p>
                  <p className="text-xs text-sand/70">Monitor progress with real-time coverage metrics</p>
                </div>
              </div>
            </div>
            <Link
              href="/builder"
              className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-emerald/90 px-6 py-3 text-midnight font-semibold transition hover:bg-emerald"
            >
              Launch SMCR Builder
              <ArrowRight className="size-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
