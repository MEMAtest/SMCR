"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, History, Users } from "lucide-react";
import { AiSorDraft } from "@/components/ai/AiSorDraft";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Field,
  Panel,
  SectionTitle,
  Select,
  TextArea,
  TextInput,
  VerifyBadge,
  downloadFile,
} from "@/components/ui";
import { CATEGORY_LABELS, getPR } from "@/lib/rules/fca-solo";
import { getCategory, smfHolders } from "@/lib/workspace/derive";
import { emptySor, type Sor } from "@/lib/workspace/schema";
import { formatDate } from "@/lib/workspace/dates";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { diffHasChanges, lineDiff } from "@/lib/export/diff";
import { docMeta, exportFilename, sorVersionState } from "@/lib/export/models";
import { smfStatusLabel } from "@/lib/export/csv";
import { SorPreview } from "./SorPreview";
import { sorQualityHints } from "./sorQuality";
import { DataTable, ExportButton, useDocParams } from "./shared";

const SMF_STATUS_KEYS = ["proposed", "temporary_cover", "application_submitted", "approved"];

export function SorTab() {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const { person: personParam, setParams } = useDocParams();

  const holders = useMemo(() => smfHolders(ws), [ws]);
  const personId = holders.find((p) => p.id === personParam)?.id ?? holders[0]?.id;
  const state = useMemo(() => (personId ? sorVersionState(ws, personId) : null), [ws, personId]);
  const sor = personId ? ws.sors[personId] : undefined;
  const category = getCategory(ws);
  const categoryLabel = category ? CATEGORY_LABELS[category] : "Not categorised";

  // Any change after approval (here or in allocations elsewhere) returns the SoR to draft
  // and moves it on to the next version number.
  const storedApproved = sor?.status === "approved";
  const changed = state?.changedSinceApproval ?? false;
  const lastVersion = state?.lastApproved?.version;
  useEffect(() => {
    if (!personId || !storedApproved || !changed || lastVersion === undefined) return;
    update((d) => {
      const s = d.sors[personId];
      if (!s || s.status !== "approved") return;
      s.status = "draft";
      s.version = Math.max(s.version, lastVersion + 1);
    });
  }, [personId, storedApproved, changed, lastVersion, update]);

  if (holders.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title="No senior managers yet"
          description="Statements of Responsibilities are prepared for each SMF holder. Add your senior managers first."
          action={
            <Link href="/builder?step=people" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-midnight hover:bg-emerald/90">
              Add senior managers
            </Link>
          }
        />
      </Panel>
    );
  }
  if (!personId || !state) return null;

  const setField = (field: "additionalText" | "reportingLine" | "committees", value: string) =>
    update((d) => {
      const s = (d.sors[personId] ??= emptySor());
      s[field] = value;
    });

  const exportPdf = async () => {
    const { generateSorPdf } = await import("@/lib/pdf/generate");
    const blob = await generateSorPdf({
      meta: docMeta(ws, "Statement of Responsibilities", today),
      model: state.model,
      categoryLabel,
      status: state.effectiveStatus,
      version: state.displayVersion,
      history: sor?.history ?? [],
      smfStatusLabels: Object.fromEntries(SMF_STATUS_KEYS.map((k) => [k, smfStatusLabel(k)])),
    });
    downloadFile(blob, exportFilename(ws.firm.name, `sor-${state.model.person.name}-v${state.displayVersion}`, today, "pdf"));
  };

  const hints = sorQualityHints(state.model.additionalText);
  const approved = state.effectiveStatus === "approved";

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Field label="Senior manager" className="w-full max-w-md">
            <Select value={personId} onChange={(e) => setParams({ person: e.target.value })}>
              {holders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Unnamed"} ({p.smfs.map((s) => s.smfId).join(", ")})
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={approved ? "good" : "warn"}>
              v{state.displayVersion} · {approved ? "Approved" : "Draft"}
            </Badge>
            {state.changedSinceApproval && <Badge tone="info">Changed since approval (v{state.lastApproved?.version})</Badge>}
            <ExportButton label="SoR PDF" run={exportPdf} variant="primary" icon={<FileText className="size-4" aria-hidden />} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Panel>
            <SectionTitle
              title="Prescribed responsibilities"
              description="Taken from your allocations. Change them in the builder."
              actions={
                <Link href="/builder?step=responsibilities" className="text-sm text-emerald underline-offset-4 hover:underline">
                  Edit allocations
                </Link>
              }
            />
            {state.model.prescribed.length === 0 ? (
              <p className="text-sm text-sand/60">
                {category === "limited" ? "Prescribed responsibilities do not apply to Limited Scope firms." : "No prescribed responsibilities are allocated to this person."}
              </p>
            ) : (
              <ul className="space-y-3">
                {state.model.prescribed.map((pr) => {
                  const def = getPR(pr.id);
                  return (
                    <li key={pr.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sand">{pr.label}</span>
                        <span className="text-sand/80">{pr.title}</span>
                        {(def?.verify || def?.letterConfirmed === false) && <VerifyBadge />}
                        {pr.shared && <Badge tone="plum">Shared</Badge>}
                      </div>
                      {pr.shared && <p className="mt-1 text-xs text-sand/70">Shared with {pr.sharedWith.join(", ") || "—"}</p>}
                      {pr.shared && !pr.notes.trim() && <p className="mt-1 text-xs text-warning">Explain how this shared responsibility is split (FG19/2).</p>}
                      {pr.notes && <p className="mt-1 text-xs text-sand/60">Notes: {pr.notes}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {state.model.other.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-sand">Other allocated responsibilities</p>
                <ul className="space-y-1 text-sm text-sand/80">
                  {state.model.other.map((o, i) => (
                    <li key={i}>
                      <Badge tone={o.kind === "overall" ? "info" : "neutral"}>{o.kind === "overall" ? "Overall" : "Additional"}</Badge> {o.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle title="Additional content" description="FG19/2: be specific and self-contained; describe what the person is accountable for, not their skills." />
            <div className="space-y-4">
              <Field label="Additional responsibilities and information" hint="Plain English. Avoid relying on other documents.">
                <TextArea rows={7} value={state.model.additionalText} maxLength={8000} onChange={(e) => setField("additionalText", e.target.value)} />
              </Field>
              {hints.length > 0 && (
                <ul className="space-y-1" aria-live="polite">
                  {hints.map((h, i) => (
                    <li key={i} className={h.tone === "warn" ? "text-xs text-warning" : "text-xs text-cloud"}>
                      {h.message}
                    </li>
                  ))}
                </ul>
              )}
              <Field label="Reporting line" hint="Who this person reports to (e.g. the Board, via the Chair).">
                <TextInput value={state.model.reportingLine} maxLength={500} onChange={(e) => setField("reportingLine", e.target.value)} />
              </Field>
              <Field label="Committee memberships">
                <TextArea rows={3} value={state.model.committees} maxLength={1000} onChange={(e) => setField("committees", e.target.value)} />
              </Field>
            </div>
          </Panel>

          <AiSorDraft personId={personId} />

          <ApprovalPanel key={personId} personId={personId} sor={sor} state={state} today={today} />
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-sand/60">Live preview</p>
          <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <SorPreview model={state.model} status={state.effectiveStatus} version={state.displayVersion} categoryLabel={categoryLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalPanel({
  personId,
  sor,
  state,
  today,
}: {
  personId: string;
  sor: Sor | undefined;
  state: NonNullable<ReturnType<typeof sorVersionState>>;
  today: string;
}) {
  const update = useWorkspace((s) => s.update);
  const [approver, setApprover] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const history = sor?.history ?? [];
  const approved = state.effectiveStatus === "approved";
  const diff = useMemo(() => (state.lastApproved ? lineDiff(state.lastApproved.snapshot, state.text) : []), [state.lastApproved, state.text]);

  const approve = () => {
    const name = approver.trim();
    if (!name) {
      setError("Enter the name of the person approving this version.");
      return;
    }
    const version = state.displayVersion;
    update((d) => {
      const s = (d.sors[personId] ??= emptySor());
      s.status = "approved";
      s.approvedBy = name;
      s.approvedOn = today;
      s.version = version;
      s.history.push({
        version,
        date: today,
        summary: summary.trim() || (s.history.length ? `Version ${version} approved` : "Initial version approved"),
        snapshot: state.text,
      });
    });
    setApprover("");
    setSummary("");
    setError(null);
  };

  return (
    <Panel>
      <SectionTitle title="Versioning and approval" />
      {approved ? (
        <Callout tone="good" title={`Version ${state.displayVersion} approved`}>
          Approved by {sor?.approvedBy || "—"} on {formatDate(sor?.approvedOn)}. Any edit (including changes to allocations) returns the SoR to draft as version{" "}
          {state.displayVersion + 1}.
        </Callout>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Approver name" error={error ?? undefined}>
              <TextInput value={approver} maxLength={200} onChange={(e) => setApprover(e.target.value)} placeholder="e.g. Board Chair" />
            </Field>
            <Field label="Summary of changes (optional)">
              <TextInput value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} />
            </Field>
          </div>
          <Button variant="primary" onClick={approve}>
            <CheckCircle2 className="size-4" aria-hidden /> Approve version {state.displayVersion}
          </Button>
        </div>
      )}

      {state.lastApproved && diffHasChanges(diff) && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-sand">Changes since approved version {state.lastApproved.version}</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-midnight/70 p-3 font-mono text-xs leading-relaxed">
            {diff.map((d, i) => (
              <span
                key={i}
                className={
                  d.type === "added" ? "block bg-emerald/10 text-emerald" : d.type === "removed" ? "block bg-danger/10 text-danger line-through decoration-danger/40" : "block text-sand/50"
                }
              >
                {d.type === "added" ? "+ " : d.type === "removed" ? "− " : "  "}
                {d.text || " "}
              </span>
            ))}
          </pre>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-sand">
          <History className="size-4" aria-hidden /> Approval history
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-sand/60">No versions approved yet.</p>
        ) : (
          <>
            <DataTable
              headers={["Version", "Approved on", "Summary", ""]}
              rows={[...history].reverse().map((h) => [
                `v${h.version}`,
                formatDate(h.date),
                h.summary,
                <Button key="v" size="sm" variant="ghost" onClick={() => setViewing(viewing === h.version ? null : h.version)} aria-expanded={viewing === h.version}>
                  {viewing === h.version ? "Hide" : "View"}
                </Button>,
              ])}
            />
            {viewing !== null && (
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white p-4 font-mono text-xs text-ink">
                {history.find((h) => h.version === viewing)?.snapshot || "No snapshot stored."}
              </pre>
            )}
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-sand/60">
        PS26/6: revised SoRs no longer need to be sent each time they change. They can be batched and submitted to the FCA at least every six months (SUP 10C.11).
      </p>
    </Panel>
  );
}
