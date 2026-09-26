"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/rules/fca-solo";
import { fitnessStatus, getCategory, getWorkspacePRs, peopleNeedingFit, smfHolders } from "@/lib/workspace/derive";
import { getHealthIssues, healthScore } from "@/lib/workspace/health";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";

const ctaClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald/90 px-6 py-3 font-semibold text-midnight transition hover:bg-emerald";

/** Reads the workspace saved in this browser and shows a snapshot of it. */
export function HealthPreview() {
  const hydrated = useHydrated();
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();

  const summary = useMemo(() => {
    if (!hydrated) return null;
    const hasWorkspace = !!ws.firm.name.trim() || ws.people.length > 0;
    if (!hasWorkspace) return { hasWorkspace } as const;
    const category = getCategory(ws);
    const prs = getWorkspacePRs(ws);
    const holders = smfHolders(ws);
    const owned = prs.filter((pr) => holders.some((h) => h.id === ws.responsibilities[pr.id]?.ownerId)).length;
    const fitPeople = peopleNeedingFit(ws);
    const fitDone = fitPeople.filter((p) => fitnessStatus(ws, p.id).complete).length;
    return {
      hasWorkspace,
      category,
      score: healthScore(getHealthIssues(ws, today)),
      owned,
      prCount: prs.length,
      fitDone,
      fitCount: fitPeople.length,
    } as const;
  }, [hydrated, ws, today]);

  return (
    <div className="glass-panel gradient-border relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-0 bg-plumAccent/40 opacity-30 blur-3xl" aria-hidden />
      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-4">
          <Image src="/mema-mark.svg" alt="" width={64} height={64} className="rounded-full border border-emerald/40" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cloud/70">Saved in this browser</p>
            <p className="text-2xl font-semibold">SM&amp;CR health preview</p>
          </div>
        </div>

        {!summary ? (
          <div className="min-h-[260px] animate-pulse rounded-2xl bg-white/5" aria-busy="true" aria-label="Loading preview" />
        ) : !summary.hasWorkspace ? (
          <>
            <div className="mb-6 space-y-4">
              <Tile label="Firm" value="—" detail="No workspace in this browser yet" muted />
              <Tile label="Health score" value="—" detail="Checks run as you complete setup" muted />
              <Tile label="Category" value="—" detail="Worked out from a few scope questions" muted />
            </div>
            <Link href="/builder" className={ctaClass}>
              Start setup
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </>
        ) : (
          <>
            <div className="mb-6 space-y-4">
              <Tile
                label="Firm"
                value={ws.firm.name || "Unnamed firm"}
                detail={summary.category ? `${CATEGORY_LABELS[summary.category]} firm` : "Category not set yet"}
              />
              <Tile
                label="Health score"
                value={`${summary.score}/100`}
                detail="Based on the tool's checks — not a statement of compliance"
                highlight={summary.score >= 80}
              />
              <Tile
                label="Progress"
                value={summary.category === "limited" ? `${summary.fitDone}/${summary.fitCount} F&P` : `${summary.owned}/${summary.prCount} PRs owned`}
                detail={summary.category === "limited" ? "assessments complete" : `${summary.fitDone}/${summary.fitCount} F&P assessments complete`}
              />
            </div>
            <Link href="/workspace" className={ctaClass}>
              Continue
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, detail, muted, highlight }: { label: string; value: string; detail: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
      <p className="text-sm text-cloud/80">{label}</p>
      <p className={`break-words text-2xl font-semibold ${muted ? "text-sand/40" : highlight ? "text-emerald" : "text-sand"}`}>{value}</p>
      <p className="text-xs text-sand/70">{detail}</p>
    </div>
  );
}
