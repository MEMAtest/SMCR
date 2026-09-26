"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { WIZARD_STEPS, type StepValidation, type WizardStep } from "@/lib/workspace/health";
import { cx } from "@/components/ui";
import { stepHref, type StepStatus } from "./shared";

const STATUS_TEXT: Record<StepStatus, string> = {
  complete: "Complete",
  progress: "In progress",
  todo: "Not started",
};

function StepMarker({ index, status, active }: { index: number; status: StepStatus; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        status === "complete"
          ? "border-emerald bg-emerald/20 text-emerald"
          : active
            ? "border-emerald text-emerald"
            : status === "progress"
              ? "border-warning/70 text-warning"
              : "border-white/25 text-sand/60",
      )}
    >
      {status === "complete" ? <Check className="size-3.5" /> : index + 1}
    </span>
  );
}

export function StepNav({
  current,
  statuses,
  validations,
}: {
  current: WizardStep;
  statuses: Record<WizardStep, StepStatus>;
  validations: Record<WizardStep, StepValidation>;
}) {
  return (
    <nav aria-label="Setup steps">
      {/* Mobile / tablet: compact horizontal stepper */}
      <ol className="flex gap-1 lg:hidden">
        {WIZARD_STEPS.map((s, i) => {
          const active = s.id === current;
          const blockers = validations[s.id].blockers.length;
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <Link
                href={stepHref(s.id)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title} — ${STATUS_TEXT[statuses[s.id]]}${blockers ? `, ${blockers} blocker${blockers === 1 ? "" : "s"}` : ""}`}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center",
                  active ? "bg-emerald/10" : "hover:bg-white/5",
                )}
              >
                <StepMarker index={i} status={statuses[s.id]} active={active} />
                <span className={cx("w-full truncate text-[11px]", active ? "text-emerald" : "text-sand/70")}>{s.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Desktop: vertical list with status and blocker counts */}
      <ol className="hidden space-y-1 lg:block">
        {WIZARD_STEPS.map((s, i) => {
          const active = s.id === current;
          const blockers = validations[s.id].blockers.length;
          const status = statuses[s.id];
          return (
            <li key={s.id}>
              <Link
                href={stepHref(s.id)}
                aria-current={active ? "step" : undefined}
                className={cx(
                  "flex items-start gap-3 rounded-2xl border px-3 py-3 transition",
                  active ? "border-emerald/50 bg-emerald/10" : "border-transparent hover:border-white/10 hover:bg-white/5",
                )}
              >
                <StepMarker index={i} status={status} active={active} />
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-sm font-semibold", active ? "text-emerald" : "text-sand")}>{s.title}</span>
                  <span className="block text-xs text-sand/60">{s.description}</span>
                  <span className="mt-1 flex flex-wrap gap-x-2 text-xs">
                    <span className={status === "complete" ? "text-emerald" : status === "progress" ? "text-warning" : "text-sand/50"}>
                      {STATUS_TEXT[status]}
                    </span>
                    {blockers > 0 && status !== "todo" && (
                      <span className="text-danger">
                        {blockers} blocker{blockers === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
