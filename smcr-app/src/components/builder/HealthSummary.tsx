"use client";

import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/rules/fca-solo";
import { healthScore, type HealthIssue } from "@/lib/workspace/health";
import type { SmcrCategory } from "@/lib/rules/fca-solo";
import { Badge, ProgressBar } from "@/components/ui";
import { IssueLink } from "./shared";

export function scoreTone(score: number): "good" | "warn" | "bad" {
  return score >= 80 ? "good" : score >= 50 ? "warn" : "bad";
}

/** Live health summary shown beside (desktop) or below (mobile) the wizard step. */
export function HealthSummary({ issues, category }: { issues: HealthIssue[]; category: SmcrCategory | null }) {
  const score = healthScore(issues);
  const blockers = issues.filter((i) => i.severity === "blocker");
  const warnings = issues.filter((i) => i.severity === "warning");
  const tone = scoreTone(score);

  return (
    <aside aria-label="Workspace health" className="glass-panel space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sand/60">Health</p>
          <p className={`font-display text-4xl ${tone === "good" ? "text-emerald" : tone === "warn" ? "text-warning" : "text-danger"}`}>
            {score}
            <span className="text-lg text-sand/50">/100</span>
          </p>
        </div>
        {category ? <Badge tone="plum">{CATEGORY_LABELS[category]}</Badge> : <Badge>No category yet</Badge>}
      </div>
      <ProgressBar value={score} />
      <p className="text-xs text-sand/60">
        {blockers.length} blocker{blockers.length === 1 ? "" : "s"} · {warnings.length} warning{warnings.length === 1 ? "" : "s"}
      </p>
      {blockers.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-semibold text-sand">Top blockers</p>
          <ul className="-mx-2 space-y-0.5">
            {blockers.slice(0, 5).map((i) => (
              <li key={i.id}>
                <IssueLink issue={i} />
              </li>
            ))}
          </ul>
          {blockers.length > 5 && <p className="mt-1 text-xs text-sand/60">and {blockers.length - 5} more</p>}
        </div>
      ) : (
        <p className="text-sm text-emerald">No blockers found.</p>
      )}
      <Link href="/workspace" className="inline-block text-sm text-emerald underline-offset-4 hover:underline">
        Open dashboard
      </Link>
    </aside>
  );
}
