"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, GraduationCap, Plus, ScrollText } from "lucide-react";
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
  Segmented,
  Select,
  TextArea,
  TextInput,
  VerifyBadge,
  cx,
  slugify,
} from "@/components/ui";
import { CONDUCT_RULES, DEADLINES, DEADLINE_SOURCES, NON_FINANCIAL_MISCONDUCT_NOTE } from "@/lib/rules/fca-solo";
import { addBusinessDays, addDays, daysBetween, formatDate } from "@/lib/workspace/dates";
import { activePeople, getPerson, personLabel } from "@/lib/workspace/derive";
import { getObligations } from "@/lib/workspace/obligations";
import { newId, type Breach, type Person, type TrainingRecord, type Workspace } from "@/lib/workspace/schema";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { downloadCSV } from "./csv";
import { FlashMessage, PersonSelect, RegisterTable, Refs, optDate, sortByDateDesc, useFlash } from "./shared";

type Tab = "rules" | "training" | "breaches";
type Topic = TrainingRecord["topic"];

const TOPIC_LABELS: Record<Topic, string> = {
  conduct_rules: "Conduct Rules (individual)",
  senior_conduct_rules: "Senior Manager Conduct Rules",
  consumer_duty: "Consumer Duty",
  financial_crime: "Financial crime",
  other: "Other",
};

const BREACH_STATUS: Record<Breach["status"], { label: string; tone: "warn" | "bad" | "neutral" | "good" }> = {
  investigating: { label: "Investigating", tone: "warn" },
  confirmed: { label: "Confirmed breach", tone: "bad" },
  not_a_breach: { label: "Not a breach", tone: "neutral" },
  closed: { label: "Closed", tone: "good" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/* ------------------------------ Reporting logic ----------------------------- */

/** REP008 reporting period (1 Sep – 31 Aug by default) that contains `iso`. */
function rep008PeriodFor(iso: string): { start: string; end: string } {
  const { month, day } = DEADLINES.rep008PeriodEnd;
  const year = Number(iso.slice(0, 4));
  const endThisYear = `${year}-${pad(month)}-${pad(day)}`;
  const end = iso <= endThisYear ? endThisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
  const prevEnd = `${Number(end.slice(0, 4)) - 1}-${pad(month)}-${pad(day)}`;
  return { start: addDays(prevEnd, 1), end };
}

function isSmf(p: Person | undefined) {
  return !!p && p.smfs.length > 0;
}

function breachReportable(b: Breach) {
  return b.disciplinaryAction && b.status !== "not_a_breach";
}

/** Date used to place a breach in a REP008 period. */
function breachPeriodDate(b: Breach) {
  return b.disciplinaryActionOn ?? b.identifiedOn ?? b.occurredOn;
}

interface Route {
  kind: "formD" | "rep008" | "record" | "none";
  label: string;
  detail: string;
  dueOn?: string;
  overdue?: boolean;
}

function breachRoute(b: Breach, person: Person | undefined, today: string): Route {
  if (b.status === "not_a_breach") return { kind: "none", label: "No report", detail: "Assessed as not a breach — keep the record and rationale." };
  if (!b.disciplinaryAction)
    return { kind: "record", label: "Record only", detail: "No disciplinary action — not reportable to the FCA, but keep on the internal log." };
  if (isSmf(person)) {
    if (!b.disciplinaryActionOn)
      return { kind: "formD", label: "Form D", detail: "SMF disciplinary action — enter the date of the disciplinary action to calculate the Form D deadline." };
    const dueOn = addBusinessDays(b.disciplinaryActionOn, DEADLINES.smfConductBreachBusinessDays);
    return {
      kind: "formD",
      label: "Form D",
      detail: b.notifiedOn
        ? `Notified ${formatDate(b.notifiedOn)} (due ${formatDate(dueOn)}).`
        : `Notify the FCA within ${DEADLINES.smfConductBreachBusinessDays} business days of the disciplinary action — due ${formatDate(dueOn)}.`,
      dueOn,
      overdue: !b.notifiedOn && today > dueOn,
    };
  }
  const period = rep008PeriodFor(breachPeriodDate(b));
  return {
    kind: "rep008",
    label: "REP008",
    detail: `Include in the annual REP008 return for ${formatDate(period.start)} – ${formatDate(period.end)}.`,
  };
}

/* ------------------------------- Rules tab --------------------------------- */

function RulesReference() {
  const individual = CONDUCT_RULES.filter((r) => r.tier === "individual");
  const senior = CONDUCT_RULES.filter((r) => r.tier === "senior");
  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle title="Individual Conduct Rules" description="Apply to all Conduct Rules staff — everyone except ancillary staff (COCON 1.1, COCON 2.1)." />
        <ul className="space-y-2">
          {individual.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <Badge tone="info">{r.id.replace("IR", "Rule ")}</Badge>
              <span className="text-sand/90">{r.text}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <SectionTitle title="Senior Manager Conduct Rules" description="Apply additionally to SMF holders (COCON 2.2). SC4 can also apply to certain other staff." />
        <ul className="space-y-2">
          {senior.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <Badge tone="plum">{r.id}</Badge>
              <span className="text-sand/90">{r.text}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Callout tone="info" title="Non-financial misconduct">
        {NON_FINANCIAL_MISCONDUCT_NOTE}
      </Callout>
    </div>
  );
}

/* ------------------------------ Training tab -------------------------------- */

function trainingFor(ws: Workspace, personId: string) {
  return sortByDateDesc(
    ws.training.filter((t) => t.personId === personId),
    (t) => t.completedOn,
  );
}

function TrainingSection({ onFlash }: { onFlash: (m: string) => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const staff = useMemo(() => activePeople(ws).filter((p) => p.conductRulesStaff), [ws]);
  const ancillary = activePeople(ws).filter((p) => !p.conductRulesStaff);

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic>("conduct_rules");
  const [completedOn, setCompletedOn] = useState(today);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const rows = staff.map((p) => {
    const recs = trainingFor(ws, p.id);
    const crt = recs.find((t) => t.topic === "conduct_rules");
    const senior = recs.find((t) => t.topic === "senior_conduct_rules");
    const smf = p.smfs.length > 0;
    const status: { label: string; tone: "good" | "warn" | "bad" } = smf
      ? senior
        ? { label: "Complete", tone: "good" }
        : crt
          ? { label: "Senior rules outstanding", tone: "warn" }
          : { label: "Not trained", tone: "bad" }
      : crt || senior
        ? { label: "Complete", tone: "good" }
        : { label: "Not trained", tone: "bad" };
    return { person: p, smf, crt, senior, status, recs };
  });
  const outstanding = rows.filter((r) => r.status.tone !== "good");

  const selectOutstanding = () => {
    const ids = rows
      .filter((r) => (topic === "senior_conduct_rules" ? r.smf && !r.senior : topic === "conduct_rules" ? !r.crt && !r.senior : true))
      .map((r) => r.person.id);
    setSelected(ids);
  };

  const save = () => {
    if (selected.length === 0) return setError("Select at least one person.");
    if (!completedOn) return setError("Enter the completion date.");
    update((d) => {
      for (const personId of selected) d.training.push({ id: newId("training"), personId, topic, completedOn, notes: notes.trim() });
    });
    onFlash(`${selected.length} training record(s) added.`);
    setSelected([]);
    setNotes("");
    setError(null);
    setOpen(false);
  };

  const remove = (t: TrainingRecord) => {
    if (!window.confirm("Delete this training record?")) return;
    update((d) => {
      d.training = d.training.filter((x) => x.id !== t.id);
    });
  };

  const exportCsv = () => {
    const out = sortByDateDesc(ws.training, (t) => t.completedOn).map((t) => {
      const p = getPerson(ws, t.personId);
      return [p?.name ?? "Unknown", p ? p.smfs.map((s) => s.smfId).join("; ") : "", TOPIC_LABELS[t.topic], t.completedOn, t.notes];
    });
    downloadCSV(`conduct-training-${slugify(ws.firm.name)}-${today}`, ["Person", "SMFs", "Training", "Completed on", "Notes"], out);
  };

  const everyone = activePeople(ws);

  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle
          title="Conduct Rules training"
          description={
            <>
              Firms must tell Conduct Rules staff which rules apply to them and train them on how the rules apply in their role. SMF holders also need
              training on the Senior Manager Conduct Rules.
              <Refs>COCON 2.3; SYSC 24 PR (b-1)</Refs>
            </>
          }
          actions={
            <>
              <Button variant="primary" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                <Plus className="size-4" aria-hidden /> Add training
              </Button>
              <Button size="sm" onClick={exportCsv} disabled={ws.training.length === 0}>
                <Download className="size-4" aria-hidden /> Export CSV
              </Button>
            </>
          }
        />

        {open && (
          <div className="mb-6 space-y-4 rounded-2xl border border-emerald/30 bg-midnight/40 p-4">
            <p className="text-sm text-sand/70">Record the same session for several people at once.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Training topic">
                <Select value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
                  {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
                    <option key={t} value={t}>
                      {TOPIC_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Completed on">
                <TextInput type="date" value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm text-sand/80">People ({selected.length} selected)</legend>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={selectOutstanding}>
                  Select everyone still needing this
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(everyone.map((p) => p.id))}>
                  Select all
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  Clear
                </Button>
              </div>
              <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                {everyone.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={personLabel(p) || "Unnamed person"}
                    hint={p.conductRulesStaff ? undefined : "Ancillary staff"}
                    checked={selected.includes(p.id)}
                    onChange={(v) => setSelected((ids) => (v ? [...ids, p.id] : ids.filter((x) => x !== p.id)))}
                  />
                ))}
              </div>
            </fieldset>
            <Field label="Notes" hint="e.g. provider, format, materials reference">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={save}>
                Save {selected.length || ""} record{selected.length === 1 ? "" : "s"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {staff.length === 0 ? (
          <EmptyState icon={<GraduationCap className="size-8" aria-hidden />} title="No Conduct Rules staff yet" description="Add people in the builder; everyone except ancillary staff is Conduct Rules staff." />
        ) : (
          <>
            <p className="mb-3 text-sm text-sand/70">
              {staff.length} Conduct Rules staff · {outstanding.length ? `${outstanding.length} with training outstanding` : "no gaps found"}
              {ancillary.length ? ` · ${ancillary.length} ancillary staff (not in scope)` : ""}
            </p>
            <RegisterTable
              caption="Conduct Rules training status"
              rows={rows}
              rowKey={(r) => r.person.id}
              columns={[
                {
                  header: "Person",
                  cell: (r) => (
                    <span>
                      <span className="font-medium text-sand">{r.person.name}</span>
                      {r.smf && <span className="block text-xs text-sand/60">{r.person.smfs.map((s) => s.smfId).join(", ")}</span>}
                    </span>
                  ),
                },
                { header: "Conduct Rules", cell: (r) => (r.crt ? formatDate(r.crt.completedOn) : <span className="text-sand/50">—</span>) },
                {
                  header: "Senior Manager rules",
                  cell: (r) => (r.senior ? formatDate(r.senior.completedOn) : <span className="text-sand/50">{r.smf ? "Required" : "n/a"}</span>),
                },
                { header: "Status", cell: (r) => <Badge tone={r.status.tone}>{r.status.label}</Badge> },
              ]}
            />
          </>
        )}
      </Panel>

      {ws.training.length > 0 && (
        <Panel>
          <SectionTitle title="Training log" description="All training records, newest first." />
          <RegisterTable
            caption="Training log"
            rows={sortByDateDesc(ws.training, (t) => t.completedOn)}
            rowKey={(t) => t.id}
            columns={[
              { header: "Person", cell: (t) => getPerson(ws, t.personId)?.name ?? "Unknown" },
              { header: "Topic", cell: (t) => TOPIC_LABELS[t.topic] },
              { header: "Completed", cell: (t) => formatDate(t.completedOn) },
              { header: "Notes", cell: (t) => <span className="text-sand/70">{t.notes || "—"}</span> },
              {
                header: "Actions",
                hideLabelOnMobile: true,
                cell: (t) => (
                  <Button size="sm" variant="ghost" onClick={() => remove(t)} aria-label={`Delete training record for ${getPerson(ws, t.personId)?.name ?? "person"}`}>
                    Delete
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------ Breaches tab -------------------------------- */

type BreachDraft = Omit<Breach, "id"> & { id?: string };

function blankBreach(today: string): BreachDraft {
  return {
    personId: "",
    ruleIds: [],
    occurredOn: today,
    identifiedOn: today,
    description: "",
    nonFinancialMisconduct: false,
    disciplinaryAction: false,
    disciplinaryActionOn: undefined,
    status: "investigating",
    notifiedOn: undefined,
    notes: "",
  };
}

function BreachForm({ initial, onClose, onFlash }: { initial: BreachDraft; onClose: () => void; onFlash: (m: string) => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const [b, setB] = useState<BreachDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BreachDraft>(k: K, v: BreachDraft[K]) => setB((x) => ({ ...x, [k]: v }));
  const person = getPerson(ws, b.personId);
  const people = ws.people.filter((p) => p.conductRulesStaff || p.id === b.personId);
  const route = person ? breachRoute({ ...b, id: b.id ?? "draft" } as Breach, person, today) : null;
  const availableRules = CONDUCT_RULES.filter((r) => r.tier === "individual" || isSmf(person) || b.ruleIds.includes(r.id));

  const save = () => {
    if (!b.personId) return setError("Select the person concerned.");
    if (!b.occurredOn) return setError("Enter the date of the breach (or when it started).");
    if (b.ruleIds.length === 0 && b.status !== "not_a_breach") return setError("Select at least one rule that may have been breached.");
    const record: Breach = { ...b, id: b.id ?? newId("breach"), description: b.description.trim(), notes: b.notes.trim() };
    if (!record.disciplinaryAction) record.disciplinaryActionOn = undefined;
    update((d) => {
      const i = d.breaches.findIndex((x) => x.id === record.id);
      if (i >= 0) d.breaches[i] = record;
      else d.breaches.push(record);
    });
    onFlash(b.id ? "Breach updated." : "Breach added to the log.");
    onClose();
  };

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-emerald/30 bg-midnight/40 p-4">
      <h3 className="text-xl">{b.id ? "Edit breach" : "Log a suspected breach"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <PersonSelect label="Person concerned" value={b.personId} onChange={(v) => set("personId", v)} people={people} />
        <Field label="Status">
          <Select value={b.status} onChange={(e) => set("status", e.target.value as Breach["status"])}>
            {(Object.keys(BREACH_STATUS) as Breach["status"][]).map((s) => (
              <option key={s} value={s}>
                {BREACH_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date of breach">
          <TextInput type="date" value={b.occurredOn} onChange={(e) => set("occurredOn", e.target.value)} />
        </Field>
        <Field label="Date identified">
          <TextInput type="date" value={b.identifiedOn ?? ""} onChange={(e) => set("identifiedOn", optDate(e.target.value))} />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm text-sand/80">Rules potentially breached</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableRules.map((r) => (
            <Checkbox
              key={r.id}
              label={`${r.id} — ${r.text}`}
              checked={b.ruleIds.includes(r.id)}
              onChange={(v) => set("ruleIds", v ? [...b.ruleIds, r.id] : b.ruleIds.filter((x) => x !== r.id))}
            />
          ))}
        </div>
        {!isSmf(person) && <p className="text-xs text-sand/50">Senior Manager rules are shown when the person holds an SMF.</p>}
      </fieldset>
      <Field label="What happened">
        <TextArea rows={4} value={b.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Checkbox
        label="Non-financial misconduct"
        hint="Bullying, harassment, violence or similar (COCON 1.1.7FR, from 1 September 2026)"
        checked={b.nonFinancialMisconduct}
        onChange={(v) => set("nonFinancialMisconduct", v)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Checkbox
          label="Disciplinary action taken"
          hint="Formal warning, suspension, dismissal or reduction/recovery of remuneration (SUP 15.11)"
          checked={b.disciplinaryAction}
          onChange={(v) => set("disciplinaryAction", v)}
        />
        {b.disciplinaryAction && (
          <Field label="Date of disciplinary action">
            <TextInput type="date" value={b.disciplinaryActionOn ?? ""} onChange={(e) => set("disciplinaryActionOn", optDate(e.target.value))} />
          </Field>
        )}
      </div>
      {route && (
        <Callout tone={route.kind === "formD" ? "warn" : "info"} title={`Reporting route: ${route.label}`}>
          {route.detail}
        </Callout>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date notified to the FCA" hint="Form D or REP008 submission date">
          <TextInput type="date" value={b.notifiedOn ?? ""} onChange={(e) => set("notifiedOn", optDate(e.target.value))} />
        </Field>
        <Field label="Notes">
          <TextInput value={b.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
      {b.nonFinancialMisconduct || b.status === "confirmed" ? (
        <p className="text-xs text-sand/60">
          Confirmed breaches and non-financial misconduct are relevant to the person&apos;s next fitness and propriety assessment and to any regulatory
          reference you give.
        </p>
      ) : null}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          Save breach
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Rep008Panel() {
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();
  const obligation = useMemo(() => getObligations(ws, today).find((o) => o.key.startsWith("rep008-")), [ws, today]);
  const lastPeriod = obligation ? rep008PeriodFor(addDays(obligation.dueOn, -62)) : null;
  const current = rep008PeriodFor(today);
  const count = (p: { start: string; end: string } | null) =>
    p
      ? ws.breaches.filter((b) => {
          const d = breachPeriodDate(b);
          return breachReportable(b) && !isSmf(getPerson(ws, b.personId)) && d >= p.start && d <= p.end;
        }).length
      : 0;
  const days = obligation ? daysBetween(today, obligation.dueOn) : null;
  return (
    <Panel>
      <SectionTitle
        title="Annual Conduct Rules report (REP008)"
        description={
          <>
            Breaches by staff other than SMF holders that led to disciplinary action are reported annually. A nil return is required if there were none.
            <Refs>{DEADLINE_SOURCES.rep008}</Refs>
          </>
        }
      />
      {!obligation ? (
        <p className="text-sm text-sand/60">No Conduct Rules staff recorded yet, so no REP008 obligation is shown.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-sand/50">Next return due</p>
            <p className="mt-1 text-xl">{formatDate(obligation.dueOn)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sand/60">
              {obligation.status === "done" ? "Marked done" : days !== null && days >= 0 ? `in ${days} days` : "overdue"} <VerifyBadge title="REP008 dates to be confirmed against SUP 15.11" />
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-sand/50">Reportable in that return</p>
            <p className="mt-1 text-xl">{count(lastPeriod)}</p>
            {lastPeriod && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sand/60">
                {formatDate(lastPeriod.start)} – {formatDate(lastPeriod.end)} <VerifyBadge title="Reporting period to be confirmed" />
              </p>
            )}
            {lastPeriod && count(lastPeriod) === 0 && <p className="mt-1 text-xs text-sand/60">Submit a nil return.</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-sand/50">Current period so far</p>
            <p className="mt-1 text-xl">{count(current)}</p>
            <p className="mt-1 text-xs text-sand/60">
              {formatDate(current.start)} – {formatDate(current.end)}
            </p>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-sand/50">
        Mark the return as submitted in the{" "}
        <Link href="/workspace/calendar" className="text-emerald underline underline-offset-2">
          obligations calendar
        </Link>
        .
      </p>
    </Panel>
  );
}

function BreachesSection({ onFlash }: { onFlash: (m: string) => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const [editing, setEditing] = useState<BreachDraft | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("all");
  const [personFilter, setPersonFilter] = useState("");

  const all = sortByDateDesc(ws.breaches, (b) => b.occurredOn);
  const rows = all.filter(
    (b) => (statusFilter === "all" || b.status === "investigating" || b.status === "confirmed") && (!personFilter || b.personId === personFilter),
  );
  const peopleWithBreaches = ws.people.filter((p) => ws.breaches.some((b) => b.personId === p.id));

  const remove = (b: Breach) => {
    if (!window.confirm("Delete this breach record? This cannot be undone.")) return;
    update((d) => {
      d.breaches = d.breaches.filter((x) => x.id !== b.id);
    });
  };

  const exportCsv = () => {
    const out = all.map((b) => {
      const p = getPerson(ws, b.personId);
      const r = breachRoute(b, p, today);
      return [
        p?.name ?? "Unknown",
        p ? p.smfs.map((s) => s.smfId).join("; ") : "",
        b.ruleIds.join("; "),
        b.occurredOn,
        b.identifiedOn ?? "",
        b.description,
        b.nonFinancialMisconduct,
        b.disciplinaryAction,
        b.disciplinaryActionOn ?? "",
        BREACH_STATUS[b.status].label,
        r.label,
        r.dueOn ?? "",
        b.notifiedOn ?? "",
        b.notes,
      ];
    });
    downloadCSV(
      `conduct-breach-log-${slugify(ws.firm.name)}-${today}`,
      ["Person", "SMFs", "Rules", "Occurred", "Identified", "Description", "Non-financial misconduct", "Disciplinary action", "Disciplinary action date", "Status", "Reporting route", "Form D due", "Notified", "Notes"],
      out,
    );
  };

  return (
    <div className="space-y-6">
      <Rep008Panel />
      <Panel>
        <SectionTitle
          title="Breach log"
          description={
            <>
              Record every suspected Conduct Rule breach, including those found not to be breaches. The reporting route is worked out from the person&apos;s
              role and whether disciplinary action was taken.
              <Refs>SUP 15.11; COCON</Refs>
            </>
          }
          actions={
            <>
              <Button variant="primary" size="sm" onClick={() => setEditing(blankBreach(today))}>
                <Plus className="size-4" aria-hidden /> Log breach
              </Button>
              <Button size="sm" onClick={exportCsv} disabled={all.length === 0}>
                <Download className="size-4" aria-hidden /> Export CSV
              </Button>
            </>
          }
        />
        {editing && <BreachForm key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} onFlash={onFlash} />}

        {all.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-8" aria-hidden />} title="No breaches logged" description="Suspected breaches you record here will show their FCA reporting route and deadline." />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <Field label="Show">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "open" | "all")}>
                  <option value="all">All breaches</option>
                  <option value="open">Open (investigating or confirmed)</option>
                </Select>
              </Field>
              <PersonSelect label="Person" value={personFilter} onChange={setPersonFilter} people={peopleWithBreaches} placeholder="Everyone" />
            </div>
            <RegisterTable
              caption="Conduct Rules breach log"
              rows={rows}
              rowKey={(b) => b.id}
              rowClassName={(b) => (breachRoute(b, getPerson(ws, b.personId), today).overdue ? "bg-danger/10" : undefined)}
              columns={[
                {
                  header: "Person",
                  cell: (b) => {
                    const p = getPerson(ws, b.personId);
                    return (
                      <span>
                        <span className="font-medium text-sand">{p?.name ?? "Unknown"}</span>
                        {p && p.smfs.length > 0 && <span className="block text-xs text-sand/60">{p.smfs.map((s) => s.smfId).join(", ")}</span>}
                      </span>
                    );
                  },
                },
                {
                  header: "Breach",
                  cell: (b) => (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {b.ruleIds.map((r) => (
                          <Badge key={r} tone={r.startsWith("SC") ? "plum" : "info"}>
                            {r}
                          </Badge>
                        ))}
                        {b.nonFinancialMisconduct && <Badge tone="warn">Non-financial</Badge>}
                      </div>
                      <p className="line-clamp-3 text-sand/70">{b.description || "—"}</p>
                      <p className="text-xs text-sand/50">Occurred {formatDate(b.occurredOn)}</p>
                    </div>
                  ),
                },
                { header: "Status", cell: (b) => <Badge tone={BREACH_STATUS[b.status].tone}>{BREACH_STATUS[b.status].label}</Badge> },
                {
                  header: "Reporting route",
                  cell: (b) => {
                    const r = breachRoute(b, getPerson(ws, b.personId), today);
                    return (
                      <div className="space-y-1">
                        <Badge tone={r.overdue ? "bad" : r.kind === "formD" ? "warn" : r.kind === "rep008" ? "info" : "neutral"}>
                          {r.label}
                          {r.overdue ? " — overdue" : ""}
                        </Badge>
                        <p className={cx("text-xs", r.overdue ? "text-danger" : "text-sand/60")}>{r.detail}</p>
                      </div>
                    );
                  },
                },
                {
                  header: "Actions",
                  hideLabelOnMobile: true,
                  cell: (b) => (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setEditing({ ...b })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(b)}>
                        Delete
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
            {rows.length === 0 && <p className="text-sm text-sand/60">No breaches match these filters.</p>}
          </>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export function ConductPage() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(initial === "rules" || initial === "training" || initial === "breaches" ? initial : "training");
  const [flash, setFlash] = useFlash();

  if (!hydrated) return <LoadingPanel />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registers"
        title="Conduct Rules"
        description={
          <>
            The Conduct Rules apply to almost everyone in the firm. Keep evidence that staff have been told about and trained on the rules, log suspected
            breaches, and notify the FCA where required.
            <Refs>COCON; SUP 15.11; SYSC 24</Refs>
          </>
        }
      />
      <Segmented
        name="conduct-tab"
        ariaLabel="Conduct Rules section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "training", label: "Training" },
          { value: "breaches", label: "Breaches & reporting" },
          { value: "rules", label: "The rules" },
        ]}
      />
      <FlashMessage message={flash} />
      {tab === "rules" && <RulesReference />}
      {tab === "training" && <TrainingSection onFlash={setFlash} />}
      {tab === "breaches" && <BreachesSection onFlash={setFlash} />}
    </div>
  );
}
