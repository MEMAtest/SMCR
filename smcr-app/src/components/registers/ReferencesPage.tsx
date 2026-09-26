"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Inbox, Plus, Send } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  EmptyState,
  Field,
  LoadingPanel,
  PageHeader,
  Panel,
  SectionTitle,
  Select,
  TextArea,
  TextInput,
  cx,
  slugify,
} from "@/components/ui";
import { DEADLINES, DEADLINE_SOURCES } from "@/lib/rules/fca-solo";
import { addDays, addMonths, daysBetween, formatDate } from "@/lib/workspace/dates";
import { getPerson } from "@/lib/workspace/derive";
import { newId, type Reference, type Workspace } from "@/lib/workspace/schema";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { downloadCSV } from "./csv";
import { FlashMessage, PersonSelect, RegisterTable, Refs, optDate, sortByDateDesc, useFlash } from "./shared";

type Direction = Reference["direction"];
type Status = Reference["status"];

const STATUS_TONE: Record<Status, "warn" | "info" | "good"> = { pending: "warn", chased: "info", received: "good", sent: "good" };
const STATUS_LABEL: Record<Status, string> = { pending: "Pending", chased: "Chased", received: "Received", sent: "Sent" };
const RESPONSE_DAYS = DEADLINES.regulatoryReferenceResponseWeeks * 7;
const LOOKBACK_MONTHS = DEADLINES.regulatoryReferenceLookbackYears * 12;

function dueOn(r: Reference) {
  return addDays(r.requestedOn, RESPONSE_DAYS);
}

function isOpen(r: Reference) {
  return r.status === "pending" || r.status === "chased";
}

function subjectOf(ws: Workspace, r: Reference) {
  return getPerson(ws, r.personId)?.name ?? (r.subjectName || "Unnamed");
}

/* --------------------------- 6-year coverage check -------------------------- */

interface Coverage {
  from: string;
  to: string;
  coveredDays: number;
  windowDays: number;
  missingPeriods: number;
}

/** How much of the 6 years before the anchor date (start date / latest request) the references cover. */
function coverageFor(ws: Workspace, personId: string): Coverage | null {
  const refs = ws.references.filter((r) => r.direction === "outgoing" && r.personId === personId);
  if (!refs.length) return null;
  const person = getPerson(ws, personId);
  const latestRequest = refs.map((r) => r.requestedOn).sort().at(-1)!;
  const to = person?.startDate ?? latestRequest;
  const from = addMonths(to, -LOOKBACK_MONTHS);
  const intervals = refs
    .filter((r) => r.periodFrom && r.periodTo)
    .map((r) => [r.periodFrom! < from ? from : r.periodFrom!, r.periodTo! > to ? to : r.periodTo!] as const)
    .filter(([a, b]) => a <= b)
    .sort((a, b) => a[0].localeCompare(b[0]));
  let covered = 0;
  let curStart: string | null = null;
  let curEnd: string | null = null;
  for (const [a, b] of intervals) {
    if (curEnd && a <= addDays(curEnd, 1)) {
      if (b > curEnd) curEnd = b;
    } else {
      if (curStart && curEnd) covered += daysBetween(curStart, curEnd) + 1;
      curStart = a;
      curEnd = b;
    }
  }
  if (curStart && curEnd) covered += daysBetween(curStart, curEnd) + 1;
  return {
    from,
    to,
    coveredDays: covered,
    windowDays: daysBetween(from, to) + 1,
    missingPeriods: refs.filter((r) => !r.periodFrom || !r.periodTo).length,
  };
}

/* ---------------------------------- Form ---------------------------------- */

type Draft = Omit<Reference, "id"> & { id?: string };

function blank(direction: Direction, today: string): Draft {
  return {
    direction,
    personId: undefined,
    subjectName: "",
    counterparty: "",
    requestedOn: today,
    completedOn: undefined,
    periodFrom: undefined,
    periodTo: undefined,
    adverse: false,
    status: "pending",
    notes: "",
  };
}

function ReferenceForm({ initial, onClose, onFlash }: { initial: Draft; onClose: () => void; onFlash: (m: string) => void }) {
  const people = useWorkspace((s) => s.ws.people);
  const update = useWorkspace((s) => s.update);
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const outgoing = d.direction === "outgoing";
  const doneStatus: Status = outgoing ? "received" : "sent";

  const save = () => {
    if (!d.personId && !d.subjectName.trim()) return setError(outgoing ? "Select the candidate or enter their name." : "Select the person or enter their name.");
    if (!d.counterparty.trim()) return setError(outgoing ? "Enter the previous employer." : "Enter the requesting firm.");
    if (!d.requestedOn) return setError("Enter the date requested.");
    if (d.periodFrom && d.periodTo && d.periodFrom > d.periodTo) return setError("The period start must be before the end.");
    const person = people.find((p) => p.id === d.personId);
    const rec: Reference = {
      ...d,
      id: d.id ?? newId("ref"),
      subjectName: person?.name ?? d.subjectName.trim(),
      counterparty: d.counterparty.trim(),
      notes: d.notes.trim(),
      status: d.completedOn && isOpen(d as Reference) ? doneStatus : d.status,
    };
    if (!outgoing) rec.adverse = d.adverse;
    update((w) => {
      const i = w.references.findIndex((x) => x.id === rec.id);
      if (i >= 0) w.references[i] = rec;
      else w.references.push(rec);
    });
    onFlash(d.id ? "Reference updated." : "Reference added.");
    onClose();
  };

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-emerald/30 bg-midnight/40 p-4">
      <h3 className="text-xl">{d.id ? "Edit reference" : outgoing ? "Request a reference" : "Log an incoming request"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <PersonSelect
          label={outgoing ? "Candidate" : "Current or former employee"}
          value={d.personId}
          onChange={(v) => set("personId", v || undefined)}
          people={people}
          placeholder="Not in the people list"
        />
        {!d.personId && (
          <Field label="Name (if not in the people list)">
            <TextInput value={d.subjectName} onChange={(e) => set("subjectName", e.target.value)} />
          </Field>
        )}
        <Field label={outgoing ? "Previous employer" : "Requesting firm"}>
          <TextInput value={d.counterparty} onChange={(e) => set("counterparty", e.target.value)} />
        </Field>
        <Field label="Requested on">
          <TextInput type="date" value={d.requestedOn} onChange={(e) => set("requestedOn", e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={d.status} onChange={(e) => set("status", e.target.value as Status)}>
            <option value="pending">Pending</option>
            <option value="chased">Chased</option>
            <option value={doneStatus}>{STATUS_LABEL[doneStatus]}</option>
          </Select>
        </Field>
        <Field label={outgoing ? "Received on" : "Sent on"} hint={outgoing ? undefined : `Aim to respond by ${formatDate(addDays(d.requestedOn || "2000-01-01", RESPONSE_DAYS))}`}>
          <TextInput type="date" value={d.completedOn ?? ""} onChange={(e) => set("completedOn", optDate(e.target.value))} />
        </Field>
        {outgoing && (
          <>
            <Field label="Employment period covered — from">
              <TextInput type="date" value={d.periodFrom ?? ""} onChange={(e) => set("periodFrom", optDate(e.target.value))} />
            </Field>
            <Field label="Employment period covered — to">
              <TextInput type="date" value={d.periodTo ?? ""} onChange={(e) => set("periodTo", optDate(e.target.value))} />
            </Field>
          </>
        )}
      </div>
      <Checkbox
        label={outgoing ? "Reference contains adverse information" : "Reference discloses adverse information (breaches, disciplinary action)"}
        hint={outgoing ? "Must be reflected in the candidate's fitness and propriety assessment" : "Consider SYSC 22 disclosure requirements and whether a revised reference is needed later"}
        checked={d.adverse}
        onChange={(v) => set("adverse", v)}
      />
      <Field label="Notes">
        <TextArea value={d.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- Section --------------------------------- */

function ReferenceList({ direction, onFlash }: { direction: Direction; onFlash: (m: string) => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<"all" | "open">("all");
  const outgoing = direction === "outgoing";

  const all = useMemo(() => sortByDateDesc(ws.references.filter((r) => r.direction === direction), (r) => r.requestedOn), [ws.references, direction]);
  const rows = filter === "open" ? all.filter(isOpen) : all;
  const overdue = (r: Reference) => isOpen(r) && today > dueOn(r);

  const setStatus = (r: Reference, status: Status) =>
    update((w) => {
      const x = w.references.find((y) => y.id === r.id);
      if (!x) return;
      x.status = status;
      if (status === "received" || status === "sent") x.completedOn = x.completedOn ?? today;
    });

  const remove = (r: Reference) => {
    if (!window.confirm("Delete this reference record?")) return;
    update((w) => {
      w.references = w.references.filter((x) => x.id !== r.id);
    });
  };

  const exportCsv = () => {
    const headers = outgoing
      ? ["Candidate", "Previous employer", "Period from", "Period to", "Requested", "Due", "Received", "Status", "Adverse", "Notes"]
      : ["Subject", "Requesting firm", "Requested", "Due", "Sent", "Status", "Adverse disclosed", "Notes"];
    const out = all.map((r) =>
      outgoing
        ? [subjectOf(ws, r), r.counterparty, r.periodFrom ?? "", r.periodTo ?? "", r.requestedOn, dueOn(r), r.completedOn ?? "", STATUS_LABEL[r.status], r.adverse, r.notes]
        : [subjectOf(ws, r), r.counterparty, r.requestedOn, dueOn(r), r.completedOn ?? "", STATUS_LABEL[r.status], r.adverse, r.notes],
    );
    downloadCSV(`references-${direction}-${slugify(ws.firm.name)}-${today}`, headers, out);
  };

  const adverseOutgoing = outgoing ? all.filter((r) => r.adverse && r.personId) : [];
  const candidates = outgoing ? [...new Set(all.map((r) => r.personId).filter((x): x is string => !!x))] : [];

  return (
    <Panel>
      <SectionTitle
        title={outgoing ? "References we have requested" : "Requests from other firms"}
        description={
          outgoing
            ? `Before appointing an SMF or certified person (or a NED), request references from every regulated employer in the previous ${DEADLINES.regulatoryReferenceLookbackYears} years.`
            : `When another firm asks for a reference about a current or former employee, respond promptly — aim for ${DEADLINES.regulatoryReferenceResponseWeeks} weeks — using the SYSC 22 template.`
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setEditing(blank(direction, today))}>
              <Plus className="size-4" aria-hidden /> {outgoing ? "Request reference" : "Log request"}
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={all.length === 0}>
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
          </>
        }
      />
      {editing && <ReferenceForm key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} onFlash={onFlash} />}

      {adverseOutgoing.length > 0 && (
        <div className="mb-4 space-y-2">
          {adverseOutgoing.map((r) => (
            <Callout key={r.id} tone="warn" title={`Adverse reference for ${subjectOf(ws, r)}`}>
              The reference from {r.counterparty} contains adverse information. Record how you considered it in the fitness and propriety assessment.{" "}
              <Link href={`/builder?step=fitness&person=${r.personId}`} className="text-emerald underline underline-offset-2">
                Open F&amp;P assessment
              </Link>
            </Callout>
          ))}
        </div>
      )}

      {candidates.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm">
          {candidates.map((pid) => {
            const c = coverageFor(ws, pid);
            if (!c) return null;
            const gapDays = c.windowDays - c.coveredDays;
            const ok = gapDays <= 31 && c.missingPeriods === 0;
            return (
              <li key={pid} className={cx("flex flex-wrap items-center gap-2", ok ? "text-sand/70" : "text-warning")}>
                <Badge tone={ok ? "good" : "warn"}>{ok ? "6 years covered" : "Gap in coverage"}</Badge>
                <span>
                  {getPerson(ws, pid)?.name}: references cover {(c.coveredDays / 365.25).toFixed(1)} of {DEADLINES.regulatoryReferenceLookbackYears} years (
                  {formatDate(c.from)} – {formatDate(c.to)})
                  {c.missingPeriods ? ` · ${c.missingPeriods} reference(s) without a period recorded` : ""}
                  {!ok && gapDays > 31 ? " · record the reason for any gap (e.g. not employed, unregulated employer)" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon={outgoing ? <Send className="size-8" aria-hidden /> : <Inbox className="size-8" aria-hidden />}
          title={outgoing ? "No reference requests yet" : "No incoming requests logged"}
          description={outgoing ? "Log each reference you request so you can chase it and evidence the 6-year check." : "Log requests you receive so the response deadline appears in the calendar."}
        />
      ) : (
        <>
          <div className="mb-3 max-w-xs">
            <Field label="Show">
              <Select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "open")}>
                <option value="all">All</option>
                <option value="open">Outstanding only</option>
              </Select>
            </Field>
          </div>
          <RegisterTable
            caption={outgoing ? "Outgoing reference requests" : "Incoming reference requests"}
            rows={rows}
            rowKey={(r) => r.id}
            rowClassName={(r) => (overdue(r) ? "bg-danger/10" : undefined)}
            columns={[
              {
                header: outgoing ? "Candidate" : "Subject",
                cell: (r) => (
                  <span>
                    <span className="font-medium text-sand">{subjectOf(ws, r)}</span>
                    <span className="block text-xs text-sand/60">{r.counterparty}</span>
                  </span>
                ),
              },
              ...(outgoing
                ? [
                    {
                      header: "Period covered",
                      cell: (r: Reference) =>
                        r.periodFrom && r.periodTo ? (
                          `${formatDate(r.periodFrom)} – ${formatDate(r.periodTo)}`
                        ) : (
                          <span className="text-warning">Not recorded</span>
                        ),
                    },
                  ]
                : []),
              { header: "Requested", cell: (r) => formatDate(r.requestedOn) },
              {
                header: outgoing ? "Received" : "Due / sent",
                cell: (r) =>
                  r.completedOn ? (
                    formatDate(r.completedOn)
                  ) : (
                    <span className={overdue(r) ? "text-danger" : "text-sand/60"}>
                      {overdue(r) ? `Overdue — due ${formatDate(dueOn(r))}` : `Due ${formatDate(dueOn(r))}`}
                    </span>
                  ),
              },
              {
                header: "Status",
                cell: (r) => (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={overdue(r) ? "bad" : STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    {r.adverse && <Badge tone="warn">Adverse</Badge>}
                  </span>
                ),
              },
              {
                header: "Actions",
                hideLabelOnMobile: true,
                cell: (r) => (
                  <div className="flex flex-wrap gap-2">
                    {isOpen(r) && (
                      <Button size="sm" variant="primary" onClick={() => setStatus(r, outgoing ? "received" : "sent")}>
                        Mark {outgoing ? "received" : "sent"}
                      </Button>
                    )}
                    {r.status === "pending" && (
                      <Button size="sm" onClick={() => setStatus(r, "chased")}>
                        Mark chased
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          {rows.length === 0 && <p className="text-sm text-sand/60">Nothing outstanding.</p>}
        </>
      )}
    </Panel>
  );
}

export function ReferencesPage() {
  const hydrated = useHydrated();
  const [flash, setFlash] = useFlash();
  if (!hydrated) return <LoadingPanel />;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registers"
        title="Regulatory references"
        description={
          <>
            Firms must request references covering the previous {DEADLINES.regulatoryReferenceLookbackYears} years before appointing SMFs, certified staff
            and NEDs, and must give references when asked, disclosing relevant breaches and disciplinary action. Response deadlines feed the calendar.
            <Refs>{DEADLINE_SOURCES.regulatoryReference}</Refs>
          </>
        }
      />
      <FlashMessage message={flash} />
      <ReferenceList direction="outgoing" onFlash={setFlash} />
      <ReferenceList direction="incoming" onFlash={setFlash} />
    </div>
  );
}
