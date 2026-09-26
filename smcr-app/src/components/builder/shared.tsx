"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, type MouseEvent, type ReactNode } from "react";
import { getHealthIssues, validateStep, WIZARD_STEPS, type HealthIssue, type StepValidation, type WizardStep } from "@/lib/workspace/health";
import type { Workspace } from "@/lib/workspace/schema";
import { SeverityIcon, cx } from "@/components/ui";

export const STEP_IDS = WIZARD_STEPS.map((s) => s.id);

export function isWizardStep(v: string | null): v is WizardStep {
  return !!v && (STEP_IDS as string[]).includes(v);
}

export function stepHref(step: WizardStep, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ step, ...extra });
  return `/builder?${params.toString()}`;
}

/** Memoised health issues for the whole workspace. */
export function useHealthIssues(ws: Workspace, today: string): HealthIssue[] {
  return useMemo(() => getHealthIssues(ws, today), [ws, today]);
}

export function useStepValidations(ws: Workspace, today: string): Record<WizardStep, StepValidation> {
  return useMemo(() => {
    const out = {} as Record<WizardStep, StepValidation>;
    for (const s of STEP_IDS) out[s] = validateStep(ws, s, today);
    return out;
  }, [ws, today]);
}

/**
 * DOM id of the form control that fixes an issue, where we can work it out.
 * Step components render these ids so blocker links can scroll straight to the fix.
 */
export function issueAnchor(issue: HealthIssue): string | undefined {
  const id = issue.id;
  if (id === "firm-name") return "firm-name";
  if (id === "firm-sector") return "firm-sector";
  if (id === "firm-frn") return "firm-frn";
  if (id === "firm-out-of-scope") return "firm-scope";
  if (id === "people-none" || id.startsWith("people-expected-")) return "people-add";
  if (id.startsWith("people-cat-")) return `person-${id.slice("people-cat-".length).split("-SMF")[0]}`;
  if (id.startsWith("pr-unowned-")) return `pr-${id.slice("pr-unowned-".length)}`;
  if (id.startsWith("pr-shared-")) return `pr-${id.slice("pr-shared-".length)}`;
  if (id === "overall-none") return "overall-responsibilities";
  if (id.startsWith("fit-incomplete-")) return "fit-sections";
  if (id.startsWith("fit-adverse-")) return "fit-sections";
  if (id.startsWith("fit-outcome-")) return "fit-signoff";
  return undefined;
}

function scrollToAnchor(anchor: string, attempt = 0) {
  const el = document.getElementById(anchor);
  if (!el) {
    if (attempt < 10) window.setTimeout(() => scrollToAnchor(anchor, attempt + 1), 80);
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.matches("input, select, textarea, button") ? el : el.querySelector<HTMLElement>("input, select, textarea, button");
  (focusable as HTMLElement | null)?.focus({ preventScroll: true });
}

/** Link to an issue's fix. Within the builder it navigates by step and scrolls to the control. */
export function IssueLink({ issue, className, children }: { issue: HealthIssue; className?: string; children?: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const href = issue.href ?? "/workspace";
  const anchor = issueAnchor(issue);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!href.startsWith("/builder") || !anchor) return;
    if (typeof window === "undefined" || window.location.pathname !== "/builder") return;
    e.preventDefault();
    const target = new URL(href, window.location.origin);
    const sameStep = target.searchParams.get("step") === params.get("step") && (target.searchParams.get("person") ?? params.get("person")) === params.get("person");
    if (!sameStep) router.push(`${target.pathname}${target.search}`, { scroll: false });
    scrollToAnchor(anchor);
  };

  return (
    <Link href={href} onClick={onClick} className={cx("group flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-white/5", className)}>
      <SeverityIcon severity={issue.severity} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block text-sand group-hover:underline">{children ?? issue.title}</span>
        {issue.detail && <span className="block text-xs text-sand/60">{issue.detail}</span>}
      </span>
    </Link>
  );
}

/** Numeric input value helpers (empty string ⇄ null). */
export function numberValue(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

export function parseNumber(v: string): number | null | "invalid" {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return n;
}

export function StatusDot({ status }: { status: StepStatus }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block size-2.5 shrink-0 rounded-full",
        status === "complete" ? "bg-emerald" : status === "progress" ? "bg-warning" : "border border-white/30",
      )}
    />
  );
}

export type StepStatus = "complete" | "progress" | "todo";

/**
 * A step counts as complete when it has no blockers AND it has either been
 * started or every earlier step is complete (so an empty workspace does not
 * show later steps as "complete" just because there is nothing to check yet).
 */
export function computeStepStatuses(validations: Record<WizardStep, StepValidation>): Record<WizardStep, StepStatus> {
  const out = {} as Record<WizardStep, StepStatus>;
  let previousComplete = true;
  for (const s of STEP_IDS) {
    const v = validations[s];
    const complete: boolean = v.complete && (v.started || previousComplete);
    out[s] = complete ? "complete" : v.started ? "progress" : "todo";
    previousComplete = previousComplete && complete;
  }
  return out;
}
