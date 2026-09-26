"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Map as MapIcon, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Field, Panel, SectionTitle, Select, TextArea, TextInput, VerifyBadge, downloadFile } from "@/components/ui";
import { activePeople } from "@/lib/workspace/derive";
import { newId } from "@/lib/workspace/schema";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { buildMrmModel, docMeta, exportFilename, type MrmModel } from "@/lib/export/models";
import { DataTable, ExportButton } from "./shared";

export function MrmTab() {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const model = useMemo(() => buildMrmModel(ws), [ws]);
  const people = useMemo(() => activePeople(ws), [ws]);
  const title = model.enhanced ? "Management responsibilities map" : "Responsibilities overview";

  const exportPdf = async () => {
    const { generateMrmPdf } = await import("@/lib/pdf/generate");
    const blob = await generateMrmPdf({ meta: docMeta(ws, title, today), model });
    downloadFile(blob, exportFilename(ws.firm.name, model.enhanced ? "responsibilities-map" : "responsibilities-overview", today, "pdf"));
  };

  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle
          title={title}
          description={
            model.enhanced
              ? "Enhanced firms must maintain a single, up-to-date management responsibilities map (SYSC 25)."
              : `${model.categoryLabel} firms are not required to keep a management responsibilities map.`
          }
          actions={<ExportButton label={`${model.enhanced ? "Map" : "Overview"} PDF`} run={exportPdf} variant="primary" icon={<MapIcon className="size-4" aria-hidden />} />}
        />
        {!model.enhanced && (
          <Callout tone="info" title="Optional for your firm">
            The management responsibilities map is an Enhanced firm requirement (SYSC 25). The overview below is generated from your allocations and is a useful artefact for
            the board and for showing clear accountability, but you do not need to maintain or submit it.
          </Callout>
        )}
      </Panel>

      {model.enhanced && (
        <Panel>
          <SectionTitle title="Governance arrangements" description="Describe how the firm is governed, how decisions are made and how responsibilities fit together." />
          <div className="space-y-4">
            <Field label="Governance summary">
              <TextArea
                rows={6}
                maxLength={8000}
                value={ws.mrm.governanceSummary}
                onChange={(e) => update((d) => void (d.mrm.governanceSummary = e.target.value))}
              />
            </Field>
            <Field label="Reporting lines" hint="Who reports to whom, including matrix or group reporting lines.">
              <TextArea rows={4} maxLength={4000} value={ws.mrm.reportingLines} onChange={(e) => update((d) => void (d.mrm.reportingLines = e.target.value))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Last reviewed">
                <TextInput type="date" value={ws.mrm.lastReviewedOn ?? ""} onChange={(e) => update((d) => void (d.mrm.lastReviewedOn = e.target.value || undefined))} />
              </Field>
              <Field label="Approved by">
                <TextInput maxLength={200} value={ws.mrm.approvedBy} onChange={(e) => update((d) => void (d.mrm.approvedBy = e.target.value))} />
              </Field>
            </div>
          </div>
        </Panel>
      )}

      {model.enhanced && (
        <Panel>
          <SectionTitle
            title="Committees"
            actions={
              <Button
                size="sm"
                onClick={() => update((d) => void d.mrm.committees.push({ id: newId("committee"), name: "", purpose: "", chairId: undefined, memberIds: [] }))}
              >
                <Plus className="size-4" aria-hidden /> Add committee
              </Button>
            }
          />
          {ws.mrm.committees.length === 0 ? (
            <p className="text-sm text-sand/60">No committees recorded. Add the board and any board or executive committees.</p>
          ) : (
            <ul className="space-y-4">
              {ws.mrm.committees.map((c, idx) => {
                const edit = (fn: (x: (typeof ws.mrm.committees)[number]) => void) =>
                  update((d) => {
                    const target = d.mrm.committees.find((x) => x.id === c.id);
                    if (target) fn(target);
                  });
                return (
                  <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Committee name">
                        <TextInput maxLength={200} value={c.name} onChange={(e) => edit((x) => void (x.name = e.target.value))} />
                      </Field>
                      <Field label="Chair">
                        <Select value={c.chairId ?? ""} onChange={(e) => edit((x) => void (x.chairId = e.target.value || undefined))}>
                          <option value="">Not set</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name || "Unnamed"}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Purpose" className="sm:col-span-2">
                        <TextArea rows={2} maxLength={1000} value={c.purpose} onChange={(e) => edit((x) => void (x.purpose = e.target.value))} />
                      </Field>
                    </div>
                    <fieldset className="mt-3">
                      <legend className="mb-2 text-sm text-sand/80">Members</legend>
                      <div className="flex flex-wrap gap-2">
                        {people.map((p) => {
                          const checked = c.memberIds.includes(p.id);
                          return (
                            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/30">
                              <input
                                type="checkbox"
                                className="size-4 accent-emerald"
                                checked={checked}
                                onChange={(e) =>
                                  edit((x) => {
                                    x.memberIds = e.target.checked ? [...x.memberIds, p.id] : x.memberIds.filter((m) => m !== p.id);
                                  })
                                }
                              />
                              {p.name || "Unnamed"}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={`Remove committee ${c.name || idx + 1}`}
                        onClick={() => update((d) => void (d.mrm.committees = d.mrm.committees.filter((x) => x.id !== c.id)))}
                      >
                        <Trash2 className="size-4" aria-hidden /> Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      <MrmOverview model={model} />
    </div>
  );
}

export function MrmOverview({ model }: { model: MrmModel }) {
  return (
    <Panel>
      <SectionTitle
        title="Generated map"
        description="Built from your allocations and people."
        actions={
          <Link href="/builder?step=responsibilities" className="text-sm text-emerald underline-offset-4 hover:underline">
            Edit allocations
          </Link>
        }
      />
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-lg">Prescribed responsibilities</h3>
          <DataTable
            headers={["PR", "Responsibility", "Holder", "Shared with"]}
            rows={model.prs.map((p) => [
              <span key="l" className="inline-flex flex-wrap items-center gap-1">
                {p.label} {p.verify && <VerifyBadge />}
              </span>,
              p.title,
              p.owner === "Unallocated" ? <Badge tone="bad">Unallocated</Badge> : `${p.owner}${p.ownerSmfs ? ` (${p.ownerSmfs})` : ""}`,
              p.sharedWith.join(", ") || "—",
            ])}
            empty="Prescribed responsibilities do not apply to this firm's category."
          />
        </div>
        <div>
          <h3 className="mb-2 text-lg">Overall responsibilities</h3>
          <DataTable
            headers={["Activity, business area or function", "Holder"]}
            rows={model.overall.map((o) => [o.description ? `${o.title} — ${o.description}` : o.title, o.holder])}
            empty="No overall responsibilities recorded."
          />
        </div>
        <div>
          <h3 className="mb-2 text-lg">Senior management functions</h3>
          <DataTable
            headers={["SMF", "Function", "Held by"]}
            rows={model.smfs.map((s) => [s.id, s.title, s.holders.map((h) => `${h.name} (${h.status})`).join("; ")])}
            empty="No senior management functions recorded."
          />
        </div>
      </div>
    </Panel>
  );
}
