"use client";

import { useMemo, useState } from "react";
import { Download, NotebookPen, Plus } from "lucide-react";
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
  Select,
  TextArea,
  TextInput,
  VerifyBadge,
  slugify,
} from "@/components/ui";
import { getPR, prLabel } from "@/lib/rules/fca-solo";
import { addDays, addMonths, formatDate } from "@/lib/workspace/dates";
import { getPerson, prsHeldBy, smfHolders } from "@/lib/workspace/derive";
import { newId, type ReasonableStep, type Workspace } from "@/lib/workspace/schema";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { downloadCSV } from "./csv";
import { FlashMessage, PersonSelect, RegisterTable, Refs, sortByDateDesc, useFlash } from "./shared";

type Kind = ReasonableStep["kind"];

export const STEP_KIND_LABELS: Record<Kind, string> = {
  mi_review: "Reviewed management information",
  challenge: "Challenged / asked questions",
  escalation: "Escalated an issue",
  meeting: "Meeting / committee",
  policy_review: "Policy or procedure review",
  delegation_oversight: "Oversight of delegated task",
  training: "Training / briefing",
  other: "Other",
};

function prName(id: string | undefined) {
  if (!id) return "General";
  const pr = getPR(id);
  return pr ? `${prLabel(pr)} ${pr.title}` : id;
}

function exportPerson(ws: Workspace, personId: string, today: string) {
  const person = getPerson(ws, personId);
  const steps = sortByDateDesc(
    ws.reasonableSteps.filter((s) => s.personId === personId),
    (s) => s.date,
  );
  downloadCSV(
    `reasonable-steps-${slugify(person?.name ?? "person")}-${today}`,
    ["Date", "Senior manager", "SMFs", "Prescribed responsibility", "Type", "Summary", "Evidence reference"],
    steps.map((s) => [s.date, person?.name ?? "", person?.smfs.map((x) => x.smfId).join("; ") ?? "", prName(s.prId), STEP_KIND_LABELS[s.kind], s.summary, s.evidence]),
  );
}

/* ------------------------------- Entry form -------------------------------- */

type Draft = { id?: string; personId: string; prId: string; date: string; kind: Kind; summary: string; evidence: string };

function EntryForm({ initial, onSaved, onCancel }: { initial: Draft; onSaved: (msg: string, keep: Draft) => void; onCancel?: () => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const people = smfHolders(ws);
  const extra = d.personId && !people.some((p) => p.id === d.personId) ? [getPerson(ws, d.personId)!].filter(Boolean) : [];
  const prs = d.personId ? prsHeldBy(ws, d.personId) : [];

  const save = () => {
    if (!d.personId) return setError("Select the senior manager.");
    if (!d.date) return setError("Enter the date.");
    if (d.summary.trim().length < 5) return setError("Describe what was done (a sentence is enough).");
    const rec: ReasonableStep = {
      id: d.id ?? newId("step"),
      personId: d.personId,
      prId: d.prId || undefined,
      date: d.date,
      kind: d.kind,
      summary: d.summary.trim(),
      evidence: d.evidence.trim(),
    };
    update((w) => {
      const i = w.reasonableSteps.findIndex((x) => x.id === rec.id);
      if (i >= 0) w.reasonableSteps[i] = rec;
      else w.reasonableSteps.push(rec);
    });
    setError(null);
    onSaved(d.id ? "Entry updated." : "Entry added.", d);
    if (!d.id) setD((x) => ({ ...x, summary: "", evidence: "" }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PersonSelect label="Senior manager" value={d.personId} onChange={(v) => setD((x) => ({ ...x, personId: v, prId: "" }))} people={[...people, ...extra]} />
        <Field label="Prescribed responsibility (optional)">
          <Select value={d.prId} onChange={(e) => set("prId", e.target.value)} disabled={!d.personId}>
            <option value="">General / not PR-specific</option>
            {prs.map(({ pr }) => (
              <option key={pr.id} value={pr.id}>
                {prLabel(pr)} {pr.title}
              </option>
            ))}
            {d.prId && !prs.some(({ pr }) => pr.id === d.prId) && <option value={d.prId}>{prName(d.prId)}</option>}
          </Select>
        </Field>
        <Field label="Date">
          <TextInput type="date" value={d.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Type of step">
          <Select value={d.kind} onChange={(e) => set("kind", e.target.value as Kind)}>
            {(Object.keys(STEP_KIND_LABELS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {STEP_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="What was done and why" className="lg:col-span-2">
          <TextArea
            rows={2}
            value={d.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="e.g. Reviewed Q3 complaints MI; queried rise in delays; asked ops for root-cause analysis by 30 Oct"
          />
        </Field>
        <Field label="Evidence reference" hint="Minutes, email, file path, ticket">
          <TextInput value={d.evidence} onChange={(e) => set("evidence", e.target.value)} placeholder="e.g. Board minutes 12/09 item 4" />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          <Plus className="size-4" aria-hidden /> {d.id ? "Save changes" : "Add entry"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export function ReasonableStepsPage() {
  const hydrated = useHydrated();
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const [flash, setFlash] = useFlash();
  const [lastPerson, setLastPerson] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [fPerson, setFPerson] = useState("");
  const [fPr, setFPr] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const smfs = useMemo(() => smfHolders(ws), [ws]);
  const since90 = addDays(today, -90);
  const since6m = addMonths(today, -6);

  const summaries = useMemo(
    () =>
      smfs.map((p) => {
        const steps = ws.reasonableSteps.filter((s) => s.personId === p.id);
        const recent = steps.filter((s) => s.date >= since90).length;
        const last = sortByDateDesc(steps, (s) => s.date)[0]?.date;
        const stalePrs = prsHeldBy(ws, p.id).filter(({ pr }) => !steps.some((s) => s.prId === pr.id && s.date >= since6m));
        return { person: p, total: steps.length, recent, last, stalePrs };
      }),
    [smfs, ws, since90, since6m],
  );

  const filtered = useMemo(
    () =>
      sortByDateDesc(ws.reasonableSteps, (s) => s.date).filter(
        (s) =>
          (!fPerson || s.personId === fPerson) &&
          (!fPr || (fPr === "__general" ? !s.prId : s.prId === fPr)) &&
          (!fFrom || s.date >= fFrom) &&
          (!fTo || s.date <= fTo),
      ),
    [ws.reasonableSteps, fPerson, fPr, fFrom, fTo],
  );

  const prOptions = useMemo(() => {
    const ids = new Set(ws.reasonableSteps.filter((s) => (!fPerson || s.personId === fPerson) && s.prId).map((s) => s.prId!));
    return [...ids];
  }, [ws.reasonableSteps, fPerson]);

  if (!hydrated) return <LoadingPanel />;

  const remove = (s: ReasonableStep) => {
    if (!window.confirm("Delete this evidence entry?")) return;
    update((w) => {
      w.reasonableSteps = w.reasonableSteps.filter((x) => x.id !== s.id);
    });
  };

  const exportFiltered = () =>
    downloadCSV(
      `reasonable-steps-${slugify(ws.firm.name)}-${today}`,
      ["Date", "Senior manager", "Prescribed responsibility", "Type", "Summary", "Evidence reference"],
      filtered.map((s) => [s.date, getPerson(ws, s.personId)?.name ?? "Unknown", prName(s.prId), STEP_KIND_LABELS[s.kind], s.summary, s.evidence]),
    );

  const peopleInLog = ws.people.filter((p) => ws.reasonableSteps.some((s) => s.personId === p.id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registers"
        title="Reasonable steps"
        description={
          <>
            A running log of what each senior manager does to oversee their responsibilities — reviewing MI, challenging, escalating, overseeing delegates.
            <Refs>FSMA s66A(5) and s66B(5) (Duty of Responsibility); DEPP 6.2.9-EG; COCON 4.2</Refs>
          </>
        }
      />

      <Callout title="Why this matters">
        Under the Duty of Responsibility the FCA can take action against a senior manager if something goes wrong in their area and they did not take the
        steps a senior manager in their position could reasonably be expected to take. The FCA has to show that failure — but short, dated records made at the
        time are the senior manager&apos;s best evidence of what they actually did.
      </Callout>

      <Panel>
        <SectionTitle title="Quick entry" description="Takes under a minute. The person and responsibility stay selected so you can log several steps in a row." />
        {smfs.length === 0 ? (
          <EmptyState icon={<NotebookPen className="size-8" aria-hidden />} title="No senior managers yet" description="Add SMF holders in the builder to start logging reasonable steps." />
        ) : (
          <EntryForm
            key={`new-${lastPerson}`}
            initial={{ personId: lastPerson, prId: "", date: today, kind: "mi_review", summary: "", evidence: "" }}
            onSaved={(msg) => setFlash(msg)}
          />
        )}
        <FlashMessage message={flash} />
      </Panel>

      {summaries.length > 0 && (
        <Panel>
          <SectionTitle title="Senior manager summary" description="Prescribed responsibilities with no evidence in the last 6 months are flagged." />
          <ul className="grid gap-4 md:grid-cols-2">
            {summaries.map((s) => (
              <li key={s.person.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sand">{s.person.name}</p>
                    <p className="text-xs text-sand/60">{s.person.smfs.map((x) => x.smfId).join(", ")}</p>
                  </div>
                  <Badge tone={s.recent > 0 ? "good" : "warn"}>{s.recent} in last 90 days</Badge>
                </div>
                <p className="text-sand/70">
                  {s.total} entries in total · last entry {formatDate(s.last)}
                </p>
                {s.stalePrs.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-warning">No evidence in the last 6 months for:</p>
                    <div className="flex flex-wrap gap-1">
                      {s.stalePrs.map(({ pr }) => (
                        <Badge key={pr.id} tone="warn">
                          {prLabel(pr)} {pr.title}
                          {(pr.verify || !pr.letterConfirmed) && <span className="sr-only"> (verify)</span>}
                        </Badge>
                      ))}
                    </div>
                    {s.stalePrs.some(({ pr }) => pr.verify || !pr.letterConfirmed) && (
                      <p className="flex items-center gap-2 text-xs text-sand/50">
                        Some PR letters are unconfirmed <VerifyBadge />
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-sand/60">{prsHeldBy(ws, s.person.id).length ? "Evidence recorded for every PR held in the last 6 months." : "Holds no prescribed responsibilities."}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => setLastPerson(s.person.id)}>
                    Log a step
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => exportPerson(ws, s.person.id, today)} disabled={s.total === 0}>
                    <Download className="size-4" aria-hidden /> Export evidence file
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <SectionTitle
          title="Evidence log"
          description={`${filtered.length} of ${ws.reasonableSteps.length} entries`}
          actions={
            <Button size="sm" onClick={exportFiltered} disabled={filtered.length === 0}>
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
          }
        />
        {editing && (
          <div className="mb-6 rounded-2xl border border-emerald/30 bg-midnight/40 p-4">
            <h3 className="mb-3 text-xl">Edit entry</h3>
            <EntryForm
              key={editing.id}
              initial={editing}
              onSaved={(msg) => {
                setFlash(msg);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
        {ws.reasonableSteps.length === 0 ? (
          <EmptyState icon={<NotebookPen className="size-8" aria-hidden />} title="No entries yet" description="Log the first step above — for example, the last time a board pack or MI report was reviewed and challenged." />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PersonSelect label="Senior manager" value={fPerson} onChange={(v) => { setFPerson(v); setFPr(""); }} people={peopleInLog} placeholder="Everyone" />
              <Field label="Responsibility">
                <Select value={fPr} onChange={(e) => setFPr(e.target.value)}>
                  <option value="">All</option>
                  <option value="__general">General / not PR-specific</option>
                  {prOptions.map((id) => (
                    <option key={id} value={id}>
                      {prName(id)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="From">
                <TextInput type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <TextInput type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
              </Field>
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-sand/60">No entries match these filters.</p>
            ) : (
              <RegisterTable
                caption="Reasonable steps evidence log"
                rows={filtered}
                rowKey={(s) => s.id}
                columns={[
                  { header: "Date", cell: (s) => formatDate(s.date), className: "whitespace-nowrap" },
                  { header: "Senior manager", cell: (s) => getPerson(ws, s.personId)?.name ?? "Unknown" },
                  {
                    header: "Step",
                    cell: (s) => (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone="info">{STEP_KIND_LABELS[s.kind]}</Badge>
                          {s.prId && <Badge tone="plum">{prName(s.prId)}</Badge>}
                        </div>
                        <p className="whitespace-pre-wrap text-sand/80">{s.summary}</p>
                      </div>
                    ),
                  },
                  { header: "Evidence", cell: (s) => <span className="text-sand/70">{s.evidence || "—"}</span> },
                  {
                    header: "Actions",
                    hideLabelOnMobile: true,
                    cell: (s) => (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ id: s.id, personId: s.personId, prId: s.prId ?? "", date: s.date, kind: s.kind, summary: s.summary, evidence: s.evidence })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                          Delete
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
