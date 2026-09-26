"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, ClipboardCopy, Download, Plus, Printer, UserMinus } from "lucide-react";
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
  TextArea,
  TextInput,
  VerifyBadge,
  slugify,
} from "@/components/ui";
import { DEADLINES, DEADLINE_SOURCES, getPR, getSmf, prLabel } from "@/lib/rules/fca-solo";
import { addBusinessDays, addMonths, formatDate } from "@/lib/workspace/dates";
import { getPerson, prsHeldBy } from "@/lib/workspace/derive";
import { getObligations } from "@/lib/workspace/obligations";
import { newId, type Handover, type Workspace } from "@/lib/workspace/schema";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { STEP_KIND_LABELS } from "./ReasonableStepsPage";
import { downloadCSV } from "./csv";
import { FlashMessage, PersonSelect, RegisterTable, Refs, copyText, sortByDateDesc, useFlash, usePrintable } from "./shared";

/* ------------------------------- Pack builder ------------------------------- */

interface PackSection {
  title: string;
  items: { label: string; detail?: string }[];
  empty: string;
}

function prText(id: string) {
  const pr = getPR(id);
  return pr ? { label: `${prLabel(pr)} ${pr.title}`, detail: pr.text, verify: !pr.letterConfirmed || !!pr.verify } : { label: id, detail: "", verify: false };
}

function buildPack(ws: Workspace, h: Handover, today: string): { heading: string[]; sections: PackSection[] } {
  const from = getPerson(ws, h.fromPersonId);
  const to = getPerson(ws, h.toPersonId);
  const since = addMonths(today, -12);
  const sor = ws.sors[h.fromPersonId];
  const obligations = getObligations(ws, today).filter((o) => o.personId === h.fromPersonId && o.status !== "done");
  const breaches = ws.breaches.filter((b) => b.personId === h.fromPersonId && (b.status === "investigating" || b.status === "confirmed"));
  const steps = sortByDateDesc(
    ws.reasonableSteps.filter((s) => s.personId === h.fromPersonId && s.date >= since),
    (s) => s.date,
  ).slice(0, 25);
  const refs = ws.references.filter((r) => r.personId === h.fromPersonId);
  const others = ws.otherResponsibilities.filter((o) => o.ownerId === h.fromPersonId);
  const heldNow = prsHeldBy(ws, h.fromPersonId).map(({ pr }) => pr.id);
  const allPrIds = [...new Set([...h.prIds, ...heldNow])];

  return {
    heading: [
      `Handover pack — ${from?.name ?? "Unknown"}${to ? ` to ${to.name}` : ""}`,
      `Firm: ${ws.firm.name || "—"}${ws.firm.frn ? ` (FRN ${ws.firm.frn})` : ""}`,
      `Handover date: ${formatDate(h.date)} · Status: ${h.status === "completed" ? "Completed" : "Draft"} · Generated ${formatDate(today)}`,
      `Outgoing SMFs: ${from?.smfs.map((s) => `${s.smfId} ${getSmf(s.smfId)?.title ?? ""}`.trim()).join("; ") || "None"}`,
    ],
    sections: [
      {
        title: "Prescribed responsibilities",
        empty: "None",
        items: allPrIds.map((id) => {
          const t = prText(id);
          const handing = h.prIds.includes(id);
          return { label: `${t.label}${handing ? " — being handed over" : " — held, not in this handover"}${t.verify ? " [verify]" : ""}`, detail: t.detail };
        }),
      },
      {
        title: "Other responsibilities (SoR)",
        empty: "None recorded",
        items: [
          ...others.map((o) => ({ label: `${o.title}${o.kind === "overall" ? " (overall responsibility)" : ""}`, detail: o.description })),
          ...(sor?.additionalText ? [{ label: "Additional SoR text", detail: sor.additionalText }] : []),
          ...(sor?.reportingLine ? [{ label: "Reporting line", detail: sor.reportingLine }] : []),
          ...(sor?.committees ? [{ label: "Committees", detail: sor.committees }] : []),
        ],
      },
      {
        title: "Open Conduct Rules breaches",
        empty: "None open",
        items: breaches.map((b) => ({ label: `${formatDate(b.occurredOn)} — ${b.ruleIds.join(", ") || "rules not recorded"} (${b.status})`, detail: b.description })),
      },
      {
        title: "Open obligations",
        empty: "None outstanding",
        items: obligations.map((o) => ({ label: `${formatDate(o.dueOn)} — ${o.title}${o.status === "overdue" ? " (OVERDUE)" : ""}`, detail: `${o.detail ?? ""}${o.detail ? " " : ""}Source: ${o.source}` })),
      },
      {
        title: "Recent reasonable steps (last 12 months)",
        empty: "None recorded — consider asking the outgoing SMF to document key matters before leaving",
        items: steps.map((s) => ({
          label: `${formatDate(s.date)} — ${STEP_KIND_LABELS[s.kind]}${s.prId ? ` (${prText(s.prId).label})` : ""}`,
          detail: `${s.summary}${s.evidence ? ` [Evidence: ${s.evidence}]` : ""}`,
        })),
      },
      {
        title: "Regulatory references",
        empty: "None recorded",
        items: refs.map((r) => ({
          label: `${r.direction === "incoming" ? "Requested by" : "Requested from"} ${r.counterparty} on ${formatDate(r.requestedOn)} — ${r.status}${r.adverse ? " (adverse)" : ""}`,
          detail: r.notes,
        })),
      },
      {
        title: "Handover notes",
        empty: "No notes",
        items: h.notes.trim() ? [{ label: h.notes.trim() }] : [],
      },
    ],
  };
}

function packToText(pack: ReturnType<typeof buildPack>): string {
  const lines = [...pack.heading, ""];
  for (const s of pack.sections) {
    lines.push(s.title.toUpperCase());
    if (!s.items.length) lines.push(`- ${s.empty}`);
    for (const i of s.items) {
      lines.push(`- ${i.label}`);
      if (i.detail) lines.push(`    ${i.detail.replace(/\n/g, "\n    ")}`);
    }
    lines.push("");
  }
  lines.push("Prepared under SYSC 25.9 (handover of responsibilities). Review and supplement before relying on it.");
  return lines.join("\n");
}

/* ---------------------------------- Form ---------------------------------- */

type Draft = Omit<Handover, "id"> & { id?: string };

function HandoverForm({ initial, onClose, onSaved }: { initial: Draft; onClose: () => void; onSaved: (id: string) => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const fromCandidates = ws.people.filter((p) => p.smfs.length > 0 || p.id === d.fromPersonId);
  const toCandidates = ws.people.filter((p) => p.status === "active" && p.id !== d.fromPersonId);
  const held = d.fromPersonId ? prsHeldBy(ws, d.fromPersonId) : [];
  const prIds = [...new Set([...held.map(({ pr }) => pr.id), ...d.prIds])];

  const chooseFrom = (id: string) => setD((x) => ({ ...x, fromPersonId: id, prIds: id ? prsHeldBy(ws, id).map(({ pr }) => pr.id) : [] }));

  const save = () => {
    if (!d.fromPersonId) return setError("Select the outgoing senior manager.");
    if (!d.date) return setError("Enter the handover date.");
    const rec: Handover = { ...d, id: d.id ?? newId("handover"), toPersonId: d.toPersonId || undefined, notes: d.notes.trim() };
    update((w) => {
      const i = w.handovers.findIndex((x) => x.id === rec.id);
      if (i >= 0) w.handovers[i] = rec;
      else w.handovers.push(rec);
    });
    onSaved(rec.id);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-emerald/30 bg-midnight/40 p-4">
      <h3 className="text-xl">{d.id ? "Edit handover" : "New handover"}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <PersonSelect label="Outgoing senior manager" value={d.fromPersonId} onChange={chooseFrom} people={fromCandidates} />
        <PersonSelect label="Incoming person (optional)" value={d.toPersonId} onChange={(v) => set("toPersonId", v || undefined)} people={toCandidates} placeholder="Not yet known" />
        <Field label="Handover date">
          <TextInput type="date" value={d.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
      </div>
      {d.fromPersonId && (
        <fieldset className="space-y-2">
          <legend className="text-sm text-sand/80">Prescribed responsibilities being handed over</legend>
          {prIds.length === 0 ? (
            <p className="text-sm text-sand/60">This person holds no prescribed responsibilities.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {prIds.map((id) => {
                const t = prText(id);
                return (
                  <Checkbox
                    key={id}
                    label={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {t.label} {t.verify && <VerifyBadge />}
                      </span>
                    }
                    checked={d.prIds.includes(id)}
                    onChange={(v) => set("prIds", v ? [...d.prIds, id] : d.prIds.filter((x) => x !== id))}
                  />
                );
              })}
            </div>
          )}
        </fieldset>
      )}
      <Field label="Handover notes" hint="Open issues, key risks, ongoing projects, where to find records, regulator contact history">
        <TextArea rows={6} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="space-y-1">
        <p className="text-sm text-sand/80">Status</p>
        <Segmented
          name="handover-status"
          ariaLabel="Handover status"
          value={d.status}
          onChange={(v) => set("status", v)}
          options={[
            { value: "draft", label: "Draft" },
            { value: "completed", label: "Completed", tone: "good" },
          ]}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          Save handover
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ Pack preview ------------------------------- */

function PackView({ handover, onEdit }: { handover: Handover; onEdit: () => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const updatePerson = useWorkspace((s) => s.updatePerson);
  const setPrOwner = useWorkspace((s) => s.setPrOwner);
  const today = useToday();
  const [flash, setFlash] = useFlash();
  const { print, portal } = usePrintable();
  const pack = useMemo(() => buildPack(ws, handover, today), [ws, handover, today]);
  const from = getPerson(ws, handover.fromPersonId);
  const to = getPerson(ws, handover.toPersonId);
  const [leftDate, setLeftDate] = useState(handover.date);
  const text = packToText(pack);

  const copy = async () => setFlash((await copyText(text)) ? "Handover pack copied to the clipboard." : "Could not copy — select the text and copy it manually.");

  const csv = () =>
    downloadCSV(
      `handover-${slugify(from?.name ?? "smf")}-${handover.date}`,
      ["Section", "Item", "Detail"],
      pack.sections.flatMap((s) => (s.items.length ? s.items.map((i) => [s.title, i.label, i.detail ?? ""]) : [[s.title, s.empty, ""]])),
    );

  const markLeft = () => {
    if (!from || !leftDate) return;
    updatePerson(from.id, (p) => {
      p.status = "left";
      p.leftDate = leftDate;
    });
    setFlash(`${from.name} marked as left. Form C and Directory reminders have been added to the calendar.`);
  };

  const transferable = handover.prIds.filter((id) => ws.responsibilities[id]?.ownerId !== handover.toPersonId);
  const transfer = () => {
    if (!to) return;
    for (const id of transferable) setPrOwner(id, to.id);
    setFlash(`${transferable.length} prescribed responsibilit${transferable.length === 1 ? "y" : "ies"} reallocated to ${to.name}. Update both SoRs.`);
  };

  const complete = () =>
    update((w) => {
      const h = w.handovers.find((x) => x.id === handover.id);
      if (h) h.status = h.status === "completed" ? "draft" : "completed";
    });

  return (
    <Panel>
      {portal}
      <SectionTitle
        title="Handover pack"
        description="Generated from the data in this workspace. Review and add context before giving it to the incoming manager."
        actions={
          <>
            <Button size="sm" onClick={copy}>
              <ClipboardCopy className="size-4" aria-hidden /> Copy as text
            </Button>
            <Button size="sm" onClick={csv}>
              <Download className="size-4" aria-hidden /> CSV
            </Button>
            <Button size="sm" onClick={() => print(<pre>{text}</pre>)}>
              <Printer className="size-4" aria-hidden /> Print
            </Button>
          </>
        }
      />
      <FlashMessage message={flash} />

      <div className="mt-3 space-y-1 text-sm text-sand/80">
        {pack.heading.map((l, i) => (
          <p key={i} className={i === 0 ? "font-display text-xl text-sand" : undefined}>
            {l}
          </p>
        ))}
      </div>
      <div className="mt-4 space-y-5">
        {pack.sections.map((s) => (
          <section key={s.title}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald">{s.title}</h3>
            {s.items.length === 0 ? (
              <p className="text-sm text-sand/50">{s.empty}</p>
            ) : (
              <ul className="space-y-2">
                {s.items.map((i, idx) => (
                  <li key={idx} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <p className="whitespace-pre-wrap text-sand">{i.label}</p>
                    {i.detail && <p className="mt-1 whitespace-pre-wrap text-xs text-sand/60">{i.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
        <h3 className="text-lg">Next steps</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onEdit}>
            Edit handover
          </Button>
          <Button size="sm" variant={handover.status === "completed" ? "ghost" : "primary"} onClick={complete}>
            {handover.status === "completed" ? "Reopen as draft" : "Mark completed"}
          </Button>
          {to && transferable.length > 0 && (
            <Button size="sm" onClick={transfer}>
              <ArrowRightLeft className="size-4" aria-hidden /> Reallocate {transferable.length} PR(s) to {to.name}
            </Button>
          )}
        </div>
        {to && to.smfs.length === 0 && handover.prIds.length > 0 && (
          <Callout tone="warn">{to.name} does not hold an SMF. Prescribed responsibilities can only be allocated to an approved senior manager.</Callout>
        )}
        {from && from.status === "active" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-end">
            <Field label={`Date ${from.name} stops performing the SMF`} className="sm:w-60">
              <TextInput type="date" value={leftDate} onChange={(e) => setLeftDate(e.target.value)} />
            </Field>
            <Button variant="danger" size="sm" onClick={markLeft} disabled={!leftDate}>
              <UserMinus className="size-4" aria-hidden /> Mark {from.name} as left
            </Button>
            <p className="text-xs text-sand/60 sm:flex-1">
              Form C is due within {DEADLINES.formCBusinessDays} business days ({DEADLINE_SOURCES.formC}) — by{" "}
              {leftDate ? formatDate(addBusinessDays(leftDate, DEADLINES.formCBusinessDays)) : "—"}. UK bank holidays are not counted in this estimate.
            </p>
          </div>
        )}
        {from && from.status === "left" && (
          <Callout tone="info">
            {from.name} left on {formatDate(from.leftDate)}. Form C due by {from.leftDate ? formatDate(addBusinessDays(from.leftDate, DEADLINES.formCBusinessDays)) : "—"} — track
            it in the calendar.
          </Callout>
        )}
      </div>
    </Panel>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export function HandoverPage() {
  const hydrated = useHydrated();
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  if (!hydrated) return <LoadingPanel />;

  const handovers = sortByDateDesc(ws.handovers, (h) => h.date);
  const current = selected ? ws.handovers.find((h) => h.id === selected) : undefined;

  const remove = (h: Handover) => {
    if (!window.confirm("Delete this handover record?")) return;
    update((w) => {
      w.handovers = w.handovers.filter((x) => x.id !== h.id);
    });
    if (selected === h.id) setSelected(null);
  };

  const exportCsv = () =>
    downloadCSV(
      `handovers-${slugify(ws.firm.name)}-${today}`,
      ["Date", "From", "To", "Prescribed responsibilities", "Status", "Notes"],
      handovers.map((h) => [
        h.date,
        getPerson(ws, h.fromPersonId)?.name ?? "Unknown",
        getPerson(ws, h.toPersonId)?.name ?? "",
        h.prIds.map((id) => prText(id).label).join("; "),
        h.status,
        h.notes,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registers"
        title="Handovers"
        description={
          <>
            When a senior manager leaves or changes role, the firm must take reasonable steps to ensure a handover takes place so the successor has the
            information they need to do the job. Build the pack here from what is already recorded.
            <Refs>SYSC 25.9; SUP 10C.14 (Form C)</Refs>
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => {
                setSelected(null);
                setEditing({ fromPersonId: "", toPersonId: undefined, date: today, prIds: [], notes: "", status: "draft" });
              }}
            >
              <Plus className="size-4" aria-hidden /> New handover
            </Button>
            <Button onClick={exportCsv} disabled={handovers.length === 0}>
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
          </>
        }
      />

      {editing && (
        <HandoverForm
          key={editing.id ?? "new"}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setSelected(id);
          }}
        />
      )}

      <Panel>
        <SectionTitle title="Handover register" />
        {handovers.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="size-8" aria-hidden />}
            title="No handovers recorded"
            description="Start one when an SMF is leaving or changing role — the pack pulls in their responsibilities, open issues and recent evidence."
          />
        ) : (
          <RegisterTable
            caption="Handover register"
            rows={handovers}
            rowKey={(h) => h.id}
            rowClassName={(h) => (h.id === selected ? "bg-emerald/5" : undefined)}
            columns={[
              { header: "Date", cell: (h) => formatDate(h.date), className: "whitespace-nowrap" },
              {
                header: "From → to",
                cell: (h) => (
                  <span>
                    {getPerson(ws, h.fromPersonId)?.name ?? "Unknown"} → {getPerson(ws, h.toPersonId)?.name ?? <span className="text-sand/50">not yet known</span>}
                  </span>
                ),
              },
              { header: "PRs", cell: (h) => (h.prIds.length ? h.prIds.map((id) => getPR(id)?.letter ?? id).join(", ") : "—") },
              { header: "Status", cell: (h) => <Badge tone={h.status === "completed" ? "good" : "warn"}>{h.status === "completed" ? "Completed" : "Draft"}</Badge> },
              {
                header: "Actions",
                hideLabelOnMobile: true,
                cell: (h) => (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={h.id === selected ? "primary" : "secondary"} onClick={() => setSelected(h.id === selected ? null : h.id)} aria-expanded={h.id === selected}>
                      {h.id === selected ? "Hide pack" : "View pack"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(h)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>

      {current && (
        <PackView
          key={current.id}
          handover={current}
          onEdit={() => {
            setEditing({ ...current });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
