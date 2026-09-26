"use client";

import { Trash2 } from "lucide-react";
import { CERTIFICATION_FUNCTIONS, DEADLINES, getSmf } from "@/lib/rules/fca-solo";
import { addDays, addMonths, formatDate } from "@/lib/workspace/dates";
import { getCategory, getWorkspaceSmfs } from "@/lib/workspace/derive";
import type { SmfHolding } from "@/lib/workspace/schema";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { Badge, Button, Callout, Checkbox, Field, Segmented, Select, TextInput, VerifyBadge } from "@/components/ui";

const HOLDING_STATUSES: { value: SmfHolding["status"]; label: string }[] = [
  { value: "proposed", label: "Proposed (not yet applied)" },
  { value: "temporary_cover", label: "Temporary cover (12-week rule)" },
  { value: "application_submitted", label: "Application submitted" },
  { value: "approved", label: "Approved by the FCA" },
];

export function PersonEditor({ personId, onRemoved }: { personId: string; onRemoved: () => void }) {
  const ws = useWorkspace((s) => s.ws);
  const person = ws.people.find((p) => p.id === personId);
  const updatePerson = useWorkspace((s) => s.updatePerson);
  const removePerson = useWorkspace((s) => s.removePerson);
  const today = useToday();
  if (!person) return null;

  const category = getCategory(ws);
  const smfs = getWorkspaceSmfs(ws);
  const applicableIds = new Set(smfs.map((s) => s.id));
  const staleHoldings = person.smfs.filter((h) => !applicableIds.has(h.smfId));
  const set = (recipe: Parameters<typeof updatePerson>[1]) => updatePerson(personId, recipe);

  const crcExpiry = person.criminalRecordCheckDate ? addMonths(person.criminalRecordCheckDate, DEADLINES.criminalRecordCheckValidityMonths) : undefined;
  const crcExpired = crcExpiry ? crcExpiry < today : false;
  const pendingApproval = person.smfs.some((s) => s.status !== "approved");

  const toggleSmf = (smfId: string, on: boolean) =>
    set((p) => {
      if (on && !p.smfs.some((s) => s.smfId === smfId)) p.smfs.push({ smfId, status: "proposed" });
      if (!on) p.smfs = p.smfs.filter((s) => s.smfId !== smfId);
    });

  const updateHolding = (smfId: string, patch: Partial<SmfHolding>) =>
    set((p) => {
      const h = p.smfs.find((s) => s.smfId === smfId);
      if (h) Object.assign(h, patch);
    });

  const onRemove = () => {
    const ok = window.confirm(
      `Delete ${person.name || "this person"} and all of their records?\n\nThis permanently removes their F&P assessment, Statement of Responsibilities, certificates, training, breaches, references and reasonable-steps records, and unassigns any responsibilities they hold.\n\nIf they have left the firm, cancel and mark them as "Left" instead — you will keep the audit trail and get Form C / Directory reminders.`,
    );
    if (!ok) return;
    removePerson(personId);
    onRemoved();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={!person.name.trim() ? "Required" : undefined}>
          <TextInput value={person.name} onChange={(e) => set((p) => void (p.name = e.target.value))} />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={person.email} onChange={(e) => set((p) => void (p.email = e.target.value))} />
        </Field>
        <Field label="Job title">
          <TextInput value={person.jobTitle} onChange={(e) => set((p) => void (p.jobTitle = e.target.value))} />
        </Field>
        <Field label="Start date" hint="Used for Directory and first-assessment reminders.">
          <TextInput type="date" value={person.startDate ?? ""} onChange={(e) => set((p) => void (p.startDate = e.target.value || undefined))} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            label="Non-executive director"
            hint="Affects which prescribed responsibilities they would normally hold."
            checked={person.isNonExecutive}
            onChange={(v) => set((p) => void (p.isNonExecutive = v))}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <p className="text-sm text-sand/80">Status</p>
          <Segmented
            name={`status-${personId}`}
            ariaLabel="Employment status"
            value={person.status}
            options={[
              { value: "active", label: "Active" },
              { value: "left", label: "Left the firm" },
            ]}
            onChange={(v) =>
              set((p) => {
                p.status = v;
                if (v === "left" && !p.leftDate) p.leftDate = today;
                if (v === "active") p.leftDate = undefined;
              })
            }
          />
          {person.status === "left" && (
            <Field label="Date left" hint="Starts the Form C and Directory update deadlines on the calendar.">
              <TextInput type="date" value={person.leftDate ?? ""} onChange={(e) => set((p) => void (p.leftDate = e.target.value || undefined))} />
            </Field>
          )}
        </div>
      </div>

      {/* SMF holdings */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-display text-sand">Senior management functions</legend>
        {!category ? (
          <p className="text-sm text-sand/60">Complete the firm profile to see the SMFs available to your firm.</p>
        ) : (
          <p className="text-sm text-sand/60">Only SMFs that apply to your firm&apos;s category are listed.</p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {smfs.map((def) => {
            const holding = person.smfs.find((s) => s.smfId === def.id);
            return (
              <div key={def.id} className="space-y-2">
                <Checkbox
                  checked={!!holding}
                  onChange={(v) => toggleSmf(def.id, v)}
                  label={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{def.id}</span> {def.title} {def.verify && <VerifyBadge />}
                    </span>
                  }
                  hint={def.description}
                />
                {holding && (
                  <div className="ml-3 space-y-2 border-l border-emerald/30 pl-3">
                    <Field label={`${def.id} approval status`}>
                      <Select value={holding.status} onChange={(e) => updateHolding(def.id, { status: e.target.value as SmfHolding["status"] })}>
                        {HOLDING_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {holding.status === "temporary_cover" && (
                      <Field
                        label="Temporary cover start date"
                        hint={
                          holding.coverStartDate
                            ? `Application must be submitted by ${formatDate(addDays(holding.coverStartDate, DEADLINES.temporaryCoverWeeks * 7))} (${DEADLINES.temporaryCoverWeeks} weeks, PS26/6).`
                            : `Under PS26/6 the application must be submitted within ${DEADLINES.temporaryCoverWeeks} weeks.`
                        }
                      >
                        <TextInput type="date" value={holding.coverStartDate ?? ""} onChange={(e) => updateHolding(def.id, { coverStartDate: e.target.value || undefined })} />
                      </Field>
                    )}
                    {holding.status === "application_submitted" && (
                      <Field label="Application submitted on" hint={`The FCA has ${DEADLINES.fcaDecisionMonthsComplete} months to decide a complete application.`}>
                        <TextInput
                          type="date"
                          value={holding.applicationSubmittedDate ?? ""}
                          onChange={(e) => updateHolding(def.id, { applicationSubmittedDate: e.target.value || undefined })}
                        />
                      </Field>
                    )}
                    {holding.status === "approved" && (
                      <Field label="Approved on">
                        <TextInput type="date" value={holding.approvedDate ?? ""} onChange={(e) => updateHolding(def.id, { approvedDate: e.target.value || undefined })} />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {staleHoldings.length > 0 && (
          <Callout tone="bad" title="SMFs that do not apply to this firm">
            <ul className="space-y-1">
              {staleHoldings.map((h) => (
                <li key={h.smfId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {h.smfId} {getSmf(h.smfId)?.title ?? ""} — not available for your current category.
                  </span>
                  <Button size="sm" variant="danger" onClick={() => toggleSmf(h.smfId, false)}>
                    Remove {h.smfId}
                  </Button>
                </li>
              ))}
            </ul>
          </Callout>
        )}
      </fieldset>

      {/* Criminal records check */}
      <div className="space-y-2">
        <Field
          label="Criminal records check date"
          hint={`A check is needed for SMF applications and is valid for ${DEADLINES.criminalRecordCheckValidityMonths} months before the application is submitted (PS26/6).`}
        >
          <TextInput
            type="date"
            className="sm:max-w-xs"
            value={person.criminalRecordCheckDate ?? ""}
            onChange={(e) => set((p) => void (p.criminalRecordCheckDate = e.target.value || undefined))}
          />
        </Field>
        {crcExpiry && pendingApproval && (
          <p className={crcExpired ? "text-xs text-danger" : "text-xs text-sand/70"}>
            {crcExpired ? "Expired on" : "Valid until"} {formatDate(crcExpiry)}
            {crcExpired ? " — obtain a new check before submitting the application." : " — submit the application before this date."}
          </p>
        )}
      </div>

      {/* Certification */}
      <fieldset className="space-y-2">
        <legend className="text-lg font-display text-sand">Certification functions</legend>
        <p className="text-sm text-sand/60">Tick any certification function this person performs (SYSC 27). SMF holders do not normally also need certifying for the same role.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {CERTIFICATION_FUNCTIONS.map((cf) => (
            <Checkbox
              key={cf.id}
              checked={person.certificationFunctions.includes(cf.id)}
              onChange={(v) =>
                set((p) => {
                  p.certificationFunctions = v ? [...new Set([...p.certificationFunctions, cf.id])] : p.certificationFunctions.filter((x) => x !== cf.id);
                })
              }
              label={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {cf.title} {cf.verify && <VerifyBadge />}
                </span>
              }
              hint={cf.description}
            />
          ))}
        </div>
      </fieldset>

      <Checkbox
        label="Subject to the Conduct Rules"
        hint="Everyone except ancillary staff (e.g. cleaners, catering) is Conduct Rules staff and needs training (COCON 2.3)."
        checked={person.conductRulesStaff}
        onChange={(v) => set((p) => void (p.conductRulesStaff = v))}
      />

      <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-sand/60">
          Deleting removes all of this person&apos;s records. If they have left the firm, mark them as <Badge>Left</Badge> instead.
        </p>
        <Button variant="danger" size="sm" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden />
          Delete person
        </Button>
      </div>
    </div>
  );
}
