"use client";

import { prLabel, type PrescribedResponsibility } from "@/lib/rules/fca-solo";
import { allocationWarnings, getPerson, personLabel } from "@/lib/workspace/derive";
import type { Person, Workspace } from "@/lib/workspace/schema";
import { useWorkspace } from "@/stores/useWorkspace";
import { Badge, Checkbox, Field, Select, SeverityIcon, TextArea, VerifyBadge, cx } from "@/components/ui";

export function PrCard({ ws, pr, holders }: { ws: Workspace; pr: PrescribedResponsibility; holders: Person[] }) {
  const setPrOwner = useWorkspace((s) => s.setPrOwner);
  const update = useWorkspace((s) => s.update);
  const alloc = ws.responsibilities[pr.id];
  const owner = getPerson(ws, alloc?.ownerId);
  const sharedWith = alloc?.sharedWithIds ?? [];
  const warnings = allocationWarnings(ws, pr, owner);
  const needsNotes = sharedWith.length > 0 && (alloc?.notes.trim().length ?? 0) < 10;
  const ownerIsListed = !owner || holders.some((h) => h.id === owner.id);

  const patchAlloc = (recipe: (a: { ownerId?: string; sharedWithIds: string[]; notes: string }) => void) =>
    update((d) => {
      const a = (d.responsibilities[pr.id] ??= { sharedWithIds: [], notes: "" });
      recipe(a);
    });

  return (
    <article id={`pr-${pr.id}`} className={cx("rounded-2xl border p-4", owner ? "border-white/10" : "border-danger/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="plum">{prLabel(pr)}</Badge>
        {(!pr.letterConfirmed || pr.verify) && <VerifyBadge />}
        {owner ? <Badge tone="good">Owned</Badge> : <Badge tone="bad">No owner</Badge>}
        {sharedWith.length > 0 && <Badge tone="info">Shared</Badge>}
      </div>
      <h3 className="mt-2 text-xl">{pr.title}</h3>
      <p className="mt-1 text-sm text-sand/80">{pr.text}</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className="text-sand/70">
          <span className="font-semibold text-sand/90">Why this applies to you: </span>
          {pr.why}
        </p>
        <p className="text-sand/70">
          <span className="font-semibold text-sand/90">Typically held by: </span>
          {pr.typicalHolders.join(", ")}
          {pr.nedExpected && " (non-executive)"}
          <span className="block text-xs text-sand/50">{pr.handbookRef}</span>
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Owner" hint="Must be an approved (or proposed) SMF manager.">
          <Select value={alloc?.ownerId ?? ""} onChange={(e) => setPrOwner(pr.id, e.target.value || undefined)}>
            <option value="">— Not allocated —</option>
            {holders.map((h) => (
              <option key={h.id} value={h.id}>
                {personLabel(h)}
              </option>
            ))}
            {!ownerIsListed && owner && <option value={owner.id}>{owner.name} (not an active SMF holder)</option>}
          </Select>
        </Field>
        {owner && holders.length > 1 && (
          <fieldset>
            <legend className="mb-1 text-sm text-sand/80">Shared with (optional)</legend>
            <div className="space-y-1">
              {holders
                .filter((h) => h.id !== owner.id)
                .map((h) => (
                  <Checkbox
                    key={h.id}
                    label={personLabel(h)}
                    checked={sharedWith.includes(h.id)}
                    onChange={(v) =>
                      patchAlloc((a) => {
                        a.sharedWithIds = v ? [...new Set([...a.sharedWithIds, h.id])] : a.sharedWithIds.filter((x) => x !== h.id);
                      })
                    }
                  />
                ))}
            </div>
          </fieldset>
        )}
      </div>

      {sharedWith.length > 0 && (
        <Field
          className="mt-3"
          label="How is this responsibility shared?"
          hint="FG19/2: explain why it is shared and what each holder is responsible for."
          error={needsNotes ? "Required when shared (at least 10 characters)." : undefined}
        >
          <TextArea
            value={alloc?.notes ?? ""}
            className={needsNotes ? "border-warning" : undefined}
            onChange={(e) => patchAlloc((a) => void (a.notes = e.target.value))}
          />
        </Field>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-sm text-sand/80">
              <SeverityIcon severity="warning" className="mt-0.5" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
