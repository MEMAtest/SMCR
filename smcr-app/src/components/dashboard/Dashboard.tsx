"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  Footprints,
  MessageSquare,
  Repeat,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { CATEGORY_LABELS, RULES_META } from "@/lib/rules/fca-solo";
import { certifiedPeople, fitnessStatus, getCategory, getWorkspacePRs, peopleNeedingFit, smfHolders } from "@/lib/workspace/derive";
import { addMonths, daysBetween, formatDate } from "@/lib/workspace/dates";
import { getHealthIssues, healthScore, type HealthIssue, type IssueArea } from "@/lib/workspace/health";
import { getObligations } from "@/lib/workspace/obligations";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { Badge, EmptyState, LoadingPanel, PageHeader, Panel, ProgressBar, SectionTitle, SeverityIcon, cx } from "@/components/ui";

const AREA_LABELS: Record<IssueArea, string> = {
  firm: "Firm profile",
  people: "Senior managers",
  responsibilities: "Responsibilities",
  fitness: "Fitness & propriety",
  documents: "Documents",
  certification: "Certification",
  conduct: "Conduct Rules",
  references: "Regulatory references",
  obligations: "Deadlines",
};

const SEVERITY_ORDER = { blocker: 0, warning: 1, info: 2 } as const;

const MODULES = [
  { href: "/builder", label: "Setup", description: "Firm profile, people, responsibilities, F&P", icon: Settings2 },
  { href: "/workspace/documents", label: "Documents", description: "SoRs, responsibilities map, board pack", icon: FileText },
  { href: "/workspace/certification", label: "Certification", description: "Annual certificates (SYSC 27)", icon: BadgeCheck },
  { href: "/workspace/conduct", label: "Conduct Rules", description: "Training, breaches, REP008", icon: ShieldAlert },
  { href: "/workspace/references", label: "References", description: "Regulatory references (SYSC 22)", icon: BookOpen },
  { href: "/workspace/reasonable-steps", label: "Reasonable steps", description: "Evidence log for senior managers", icon: Footprints },
  { href: "/workspace/handover", label: "Handover", description: "Handover records when SMFs change", icon: Repeat },
  { href: "/workspace/calendar", label: "Calendar", description: "Deadlines and .ics export", icon: CalendarDays },
  { href: "/workspace/assistant", label: "Assistant", description: "Ask questions about your workspace", icon: MessageSquare },
] as const;

export function Dashboard() {
  const hydrated = useHydrated();
  if (!hydrated) return <LoadingPanel />;
  return <DashboardContent />;
}

function DashboardContent() {
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();
  const issues = useMemo(() => getHealthIssues(ws, today), [ws, today]);
  const obligations = useMemo(() => getObligations(ws, today), [ws, today]);

  if (!ws.firm.name.trim() && ws.people.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Dashboard" title="Welcome to SM&CR Studio" />
        <EmptyState
          icon={<ClipboardList className="size-10" />}
          title="No firm set up yet"
          description="Start with the guided setup: firm profile and category, senior managers, prescribed responsibilities and F&P assessments. It takes about 20 minutes and is saved in this browser as you go."
          action={
            <Link href="/builder" className="inline-flex items-center gap-2 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-midnight hover:bg-emerald/90">
              Start setup
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        />
      </div>
    );
  }

  const category = getCategory(ws);
  const score = healthScore(issues);
  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  // Group issues by area, areas with blockers first.
  const groups = new Map<IssueArea, HealthIssue[]>();
  for (const i of issues) groups.set(i.area, [...(groups.get(i.area) ?? []), i]);
  const grouped = [...groups.entries()]
    .map(([area, list]) => ({ area, list: [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) }))
    .sort((a, b) => SEVERITY_ORDER[a.list[0].severity] - SEVERITY_ORDER[b.list[0].severity] || b.list.length - a.list.length);

  const upcoming = obligations.filter((o) => o.status !== "done").slice(0, 5);

  // Quick stats
  const holders = smfHolders(ws);
  const smfCount = holders.reduce((n, p) => n + p.smfs.length, 0);
  const prs = getWorkspacePRs(ws);
  const ownedPrs = prs.filter((pr) => holders.some((h) => h.id === ws.responsibilities[pr.id]?.ownerId)).length;
  const fitPeople = peopleNeedingFit(ws);
  const fitComplete = fitPeople.filter((p) => fitnessStatus(ws, p.id).complete).length;
  const certified = certifiedPeople(ws);
  const currentCerts = certified.filter((p) =>
    ws.certificates.some((c) => c.personId === p.id && c.outcome === "certified" && addMonths(c.issuedOn, 12) >= today),
  ).length;
  const openBreaches = ws.breaches.filter((b) => b.status === "investigating" || b.status === "confirmed").length;

  const scoreTone = score >= 80 ? "text-emerald" : score >= 50 ? "text-warning" : "text-danger";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={ws.firm.name || "Unnamed firm"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {category ? <Badge tone="plum">{CATEGORY_LABELS[category]} firm</Badge> : <Badge tone="warn">Category not set</Badge>}
            {ws.firm.frn && <span>FRN {ws.firm.frn}</span>}
            <span>
              Rules pack {RULES_META.id} · as of {formatDate(RULES_META.asOf)}
            </span>
          </span>
        }
        actions={
          <Link href="/builder" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-sand hover:border-emerald/60">
            <Settings2 className="size-4" aria-hidden />
            Edit setup
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Panel className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-sand/60">Health score</p>
          <p className={cx("font-display text-6xl", scoreTone)}>
            {score}
            <span className="text-2xl text-sand/50">/100</span>
          </p>
          <ProgressBar value={score} />
          <p className="text-sm text-sand/70">
            {blockers} blocker{blockers === 1 ? "" : "s"} · {warnings} warning{warnings === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-sand/50">A score of 100 means no gaps were found by the tool&apos;s checks — it is not a statement of compliance.</p>
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label="Senior managers" value={`${holders.length}`} detail={`${smfCount} SMF${smfCount === 1 ? "" : "s"} held`} href="/builder?step=people" />
          <Stat
            label="PR coverage"
            value={category === "limited" ? "N/A" : `${ownedPrs}/${prs.length}`}
            detail={category === "limited" ? "No PRs for Limited Scope firms" : "prescribed responsibilities owned"}
            tone={category === "limited" || ownedPrs === prs.length ? "good" : "bad"}
            href="/builder?step=responsibilities"
          />
          <Stat
            label="F&P assessments"
            value={`${fitComplete}/${fitPeople.length}`}
            detail="complete"
            tone={fitComplete === fitPeople.length ? "good" : "warn"}
            href="/builder?step=fitness"
          />
          <Stat
            label="Certified staff"
            value={`${currentCerts}/${certified.length}`}
            detail="with a current certificate"
            tone={currentCerts === certified.length ? "good" : "warn"}
            href="/workspace/certification"
          />
          <Stat label="Open breaches" value={`${openBreaches}`} detail="investigating or confirmed" tone={openBreaches ? "warn" : "good"} href="/workspace/conduct" />
          <Stat
            label="Overdue deadlines"
            value={`${obligations.filter((o) => o.status === "overdue").length}`}
            detail="see the calendar"
            tone={obligations.some((o) => o.status === "overdue") ? "bad" : "good"}
            href="/workspace/calendar"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <SectionTitle title="Issues" description="Grouped by area, blockers first. Each links to where you can fix it." />
          {grouped.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald">
              <SeverityIcon severity="ok" /> No gaps found by the current checks.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ area, list }) => (
                <section key={area} aria-labelledby={`area-${area}`}>
                  <h3 id={`area-${area}`} className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold text-sand">
                    {AREA_LABELS[area]}
                    <Badge tone={list[0].severity === "blocker" ? "bad" : list[0].severity === "warning" ? "warn" : "info"}>{list.length}</Badge>
                  </h3>
                  <ul className="-mx-2 space-y-0.5">
                    {list.map((i) => (
                      <li key={i.id}>
                        <Link href={i.href ?? "/workspace"} className="group flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-white/5">
                          <SeverityIcon severity={i.severity} className="mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sand group-hover:underline">{i.title}</span>
                            {i.detail && <span className="block text-xs text-sand/60">{i.detail}</span>}
                          </span>
                          {i.handbookRef && <span className="hidden shrink-0 text-xs text-sand/40 sm:inline">{i.handbookRef}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle
            title="Next 5 obligations"
            actions={
              <Link href="/workspace/calendar" className="text-sm text-emerald underline-offset-4 hover:underline">
                Full calendar
              </Link>
            }
          />
          {upcoming.length === 0 ? (
            <p className="text-sm text-sand/70">No upcoming obligations.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((o) => {
                const days = daysBetween(today, o.dueOn);
                return (
                  <li
                    key={o.key}
                    className={cx(
                      "rounded-2xl border px-3 py-2",
                      o.status === "overdue" ? "border-danger/50 bg-danger/10" : o.status === "due_soon" ? "border-warning/40 bg-warning/5" : "border-white/10",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-sand">{o.title}</p>
                      <Badge tone={o.status === "overdue" ? "bad" : o.status === "due_soon" ? "warn" : "neutral"}>
                        {o.status === "overdue" ? `Overdue ${-days}d` : days === 0 ? "Due today" : `Due in ${days}d`}
                      </Badge>
                    </div>
                    <p className="text-xs text-sand/60">
                      {formatDate(o.dueOn)} · {o.source}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <section aria-labelledby="modules-title">
        <h2 id="modules-title" className="mb-4 text-2xl">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="glass-panel group flex items-start gap-3 p-4 transition hover:border-emerald/50">
              <m.icon className="mt-0.5 size-5 shrink-0 text-emerald" aria-hidden />
              <span>
                <span className="block font-semibold text-sand group-hover:text-emerald">{m.label}</span>
                <span className="block text-sm text-sand/60">{m.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, detail, href, tone = "neutral" }: { label: string; value: string; detail: string; href: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <Link href={href} className="glass-panel block p-4 transition hover:border-emerald/50">
      <p className="text-xs uppercase tracking-[0.2em] text-sand/60">{label}</p>
      <p
        className={cx(
          "mt-1 font-display text-3xl",
          tone === "good" ? "text-emerald" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-danger" : "text-sand",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-sand/60">{detail}</p>
    </Link>
  );
}
