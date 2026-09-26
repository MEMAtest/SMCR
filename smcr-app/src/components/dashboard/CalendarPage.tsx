"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Download, List, RotateCcw, Check } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Field,
  LoadingPanel,
  PageHeader,
  Panel,
  SectionTitle,
  Segmented,
  Select,
  VerifyBadge,
  cx,
  downloadFile,
  slugify,
} from "@/components/ui";
import { RULES_META } from "@/lib/rules/fca-solo";
import { daysBetween, formatDate } from "@/lib/workspace/dates";
import { getPerson } from "@/lib/workspace/derive";
import { getObligations, obligationsToICS, type Obligation, type ObligationStatus } from "@/lib/workspace/obligations";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { downloadCSV } from "@/components/registers/csv";

type Area = Obligation["area"];

const AREA_LABELS: Record<Area, string> = {
  approvals: "SMF approvals",
  fitness: "Fitness & propriety",
  certification: "Certification",
  conduct: "Conduct Rules",
  references: "References",
  documents: "Documents",
  reporting: "Reporting",
};

const AREA_LINKS: Record<Area, string> = {
  approvals: "/builder?step=people",
  fitness: "/builder?step=fitness",
  certification: "/workspace/certification",
  conduct: "/workspace/conduct",
  references: "/workspace/references",
  documents: "/workspace/documents",
  reporting: "/workspace/conduct?tab=breaches",
};

const GROUPS: { status: ObligationStatus; title: string; tone: "bad" | "warn" | "info" | "good" }[] = [
  { status: "overdue", title: "Overdue", tone: "bad" },
  { status: "due_soon", title: "Due in the next 30 days", tone: "warn" },
  { status: "upcoming", title: "Upcoming", tone: "info" },
  { status: "done", title: "Done", tone: "good" },
];

const DOT: Record<ObligationStatus, string> = {
  overdue: "bg-danger",
  due_soon: "bg-warning",
  upcoming: "bg-cloud",
  done: "bg-emerald",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");

function relative(today: string, due: string): string {
  const d = daysBetween(today, due);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d < 0 ? `${-d} days ago` : `in ${d} days`;
}

function ObligationItem({ o, today }: { o: Obligation; today: string }) {
  const markDone = useWorkspace((s) => s.markObligationDone);
  const person = useWorkspace((s) => getPerson(s.ws, o.personId));
  const verify = o.source.toLowerCase().includes("verify");
  return (
    <li className={cx("rounded-2xl border px-4 py-3", o.status === "overdue" ? "border-danger/40 bg-danger/5" : "border-white/10 bg-white/5", o.status === "done" && "opacity-70")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className={cx("font-medium text-sand", o.status === "done" && "line-through decoration-sand/40")}>{o.title}</p>
          {o.detail && <p className="text-sm text-sand/70">{o.detail}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-sand/60">
            <span className={cx("font-medium", o.status === "overdue" ? "text-danger" : o.status === "due_soon" ? "text-warning" : "text-sand/80")}>
              Due {formatDate(o.dueOn)} ({relative(today, o.dueOn)})
            </span>
            <Link href={AREA_LINKS[o.area]} className="hover:text-emerald">
              <Badge>{AREA_LABELS[o.area]}</Badge>
            </Link>
            <span>Source: {o.source}</span>
            {verify && <VerifyBadge />}
            {person && <span>· {person.name}</span>}
            {o.doneOn && <span>· Done {formatDate(o.doneOn)}</span>}
          </div>
        </div>
        <div className="shrink-0">
          {o.status === "done" ? (
            <Button size="sm" variant="ghost" onClick={() => markDone(o.key, false)}>
              <RotateCcw className="size-4" aria-hidden /> Undo
            </Button>
          ) : (
            <Button size="sm" onClick={() => markDone(o.key, true)}>
              <Check className="size-4" aria-hidden /> Mark done
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function MonthGrid({ items, today, month, setMonth }: { items: Obligation[]; today: string; month: string; setMonth: (m: string) => void }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<string, Obligation[]>();
  for (const o of items) if (o.dueOn.startsWith(month)) byDay.set(o.dueOn, [...(byDay.get(o.dueOn) ?? []), o]);
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    setSelectedDay(null);
  };
  const label = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const dayItems = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <div className="text-center">
          <p className="font-display text-xl" aria-live="polite">
            {label}
          </p>
          {month !== today.slice(0, 7) && (
            <button type="button" className="text-xs text-emerald underline underline-offset-2" onClick={() => setMonth(today.slice(0, 7))}>
              Back to this month
            </button>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-sand/50" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`x${i}`} className="min-h-14 sm:min-h-24" />;
          const list = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              aria-pressed={day === selectedDay}
              aria-label={`${formatDate(day)}: ${list.length} item${list.length === 1 ? "" : "s"} due`}
              className={cx(
                "flex min-h-14 min-w-0 flex-col items-stretch gap-1 rounded-lg border p-1 text-left transition sm:min-h-24 sm:p-1.5",
                day === selectedDay ? "border-emerald bg-emerald/10" : "border-white/10 bg-white/5 hover:border-white/30",
              )}
            >
              <span className={cx("text-xs", isToday ? "inline-flex size-5 items-center justify-center rounded-full bg-emerald font-semibold text-midnight" : "text-sand/70")}>
                {Number(day.slice(8))}
              </span>
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {list.slice(0, 4).map((o) => (
                  <span key={o.key} className={cx("size-1.5 rounded-full", DOT[o.status])} />
                ))}
              </span>
              <span className="hidden min-w-0 space-y-0.5 sm:block">
                {list.slice(0, 2).map((o) => (
                  <span key={o.key} className="flex min-w-0 items-center gap-1 text-[11px] leading-tight text-sand/80">
                    <span className={cx("size-1.5 shrink-0 rounded-full", DOT[o.status])} />
                    <span className="truncate">{o.title}</span>
                  </span>
                ))}
                {list.length > 2 && <span className="block text-[11px] text-sand/50">+{list.length - 2} more</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-sand/60">
        {GROUPS.map((g) => (
          <span key={g.status} className="inline-flex items-center gap-1">
            <span className={cx("size-2 rounded-full", DOT[g.status])} /> {g.title}
          </span>
        ))}
      </div>
      {selectedDay && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{formatDate(selectedDay)}</p>
          {dayItems.length === 0 ? (
            <p className="text-sm text-sand/60">Nothing due on this day.</p>
          ) : (
            <ul className="space-y-2">
              {dayItems.map((o) => (
                <ObligationItem key={o.key} o={o} today={today} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CalendarPage() {
  const hydrated = useHydrated();
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();
  const [view, setView] = useState<"list" | "month">("list");
  const [area, setArea] = useState<"" | Area>("");
  const [personId, setPersonId] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));

  const all = useMemo(() => getObligations(ws, today), [ws, today]);
  const filtered = all.filter((o) => (!area || o.area === area) && (!personId || o.personId === personId));
  const peopleInList = ws.people.filter((p) => all.some((o) => o.personId === p.id));
  const counts = Object.fromEntries(GROUPS.map((g) => [g.status, filtered.filter((o) => o.status === g.status).length])) as Record<ObligationStatus, number>;

  if (!hydrated) return <LoadingPanel />;

  const downloadIcs = () => downloadFile(obligationsToICS(filtered, ws.firm.name), `smcr-obligations-${slugify(ws.firm.name)}.ics`, "text/calendar;charset=utf-8");
  const downloadCsv = () =>
    downloadCSV(
      `smcr-obligations-${slugify(ws.firm.name)}-${today}`,
      ["Due", "Status", "Title", "Detail", "Area", "Person", "Source", "Done on"],
      filtered.map((o) => [o.dueOn, o.status.replace("_", " "), o.title, o.detail ?? "", AREA_LABELS[o.area], getPerson(ws, o.personId)?.name ?? "", o.source, o.doneOn ?? ""]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Obligations calendar"
        description={
          <>
            Deadlines are generated from the information in this workspace — for example certificate dates, temporary cover start dates, leavers and
            reference requests — so keep the registers up to date. Rule-based deadlines come from rules pack {RULES_META.id} (as of {formatDate(RULES_META.asOf)}).
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={downloadIcs} disabled={filtered.every((o) => o.status === "done")}>
              <Download className="size-4" aria-hidden /> Download .ics
            </Button>
            <Button onClick={downloadCsv} disabled={filtered.length === 0}>
              <Download className="size-4" aria-hidden /> CSV
            </Button>
          </>
        }
      />

      <Callout title="Add reminders to your calendar">
        The .ics file imports into Outlook, Google Calendar or Apple Calendar as all-day events with a 7-day reminder. It is a snapshot: download it again
        after making changes. Business-day deadlines do not account for UK bank holidays.
      </Callout>

      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="space-y-1 lg:col-span-2">
            <p className="text-sm text-sand/80">View</p>
            <Segmented
              name="calendar-view"
              ariaLabel="Calendar view"
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: "List" },
                { value: "month", label: "Month" },
              ]}
            />
          </div>
          <Field label="Area">
            <Select value={area} onChange={(e) => setArea(e.target.value as "" | Area)}>
              <option value="">All areas</option>
              {(Object.keys(AREA_LABELS) as Area[]).map((a) => (
                <option key={a} value={a}>
                  {AREA_LABELS[a]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Person">
            <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Everyone</option>
              {peopleInList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <Badge key={g.status} tone={counts[g.status] ? g.tone : "neutral"}>
              {g.title}: {counts[g.status]}
            </Badge>
          ))}
        </div>
      </Panel>

      {all.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CalendarDays className="size-8" aria-hidden />}
            title="No obligations yet"
            description="Add people, SMFs and certification functions in the builder and the recurring deadlines will appear here."
            action={
              <Link href="/builder?step=people" className="text-sm text-emerald underline underline-offset-2">
                Go to the builder
              </Link>
            }
          />
        </Panel>
      ) : view === "month" ? (
        <Panel>
          <MonthGrid items={filtered} today={today} month={month} setMonth={setMonth} />
        </Panel>
      ) : (
        GROUPS.map((g) => {
          const list = filtered.filter((o) => o.status === g.status);
          if (g.status === "done") {
            if (!list.length) return null;
            return (
              <Panel key={g.status}>
                <SectionTitle
                  title={`${g.title} (${list.length})`}
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                      <List className="size-4" aria-hidden /> {showDone ? "Hide" : "Show"}
                    </Button>
                  }
                />
                {showDone && (
                  <ul className="space-y-2">
                    {list.map((o) => (
                      <ObligationItem key={o.key} o={o} today={today} />
                    ))}
                  </ul>
                )}
              </Panel>
            );
          }
          return (
            <Panel key={g.status}>
              <SectionTitle title={`${g.title} (${list.length})`} />
              {list.length === 0 ? (
                <p className="text-sm text-sand/60">{g.status === "overdue" ? "Nothing overdue." : "Nothing in this period."}</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((o) => (
                    <ObligationItem key={o.key} o={o} today={today} />
                  ))}
                </ul>
              )}
            </Panel>
          );
        })
      )}
    </div>
  );
}
