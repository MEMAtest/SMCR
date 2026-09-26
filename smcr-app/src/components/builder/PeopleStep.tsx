"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/rules/fca-solo";
import { fitnessStatus, getCategory, getSmf, peopleNeedingFit } from "@/lib/workspace/derive";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { Badge, Button, Callout, EmptyState, Field, Panel, SectionTitle, TextInput, cx } from "@/components/ui";
import { IssueLink, useHealthIssues } from "./shared";
import { PersonEditor } from "./PersonEditor";

export function PeopleStep() {
  const ws = useWorkspace((s) => s.ws);
  const addPerson = useWorkspace((s) => s.addPerson);
  const today = useToday();
  const issues = useHealthIssues(ws, today).filter((i) => i.area === "people");
  const category = getCategory(ws);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string>();
  const needsFit = new Set(peopleNeedingFit(ws).map((p) => p.id));

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setAddError("Enter a name to add a person.");
      return;
    }
    const id = addPerson({ name });
    setNewName("");
    setAddError(undefined);
    setOpenId(id);
  };

  return (
    <div className="space-y-6">
      {!category && <Callout tone="warn">Complete the firm profile first — the SMFs you can choose depend on the firm&apos;s category.</Callout>}

      {issues.length > 0 && (
        <Panel className="p-4">
          <p className="mb-1 text-sm font-semibold text-sand">
            Expected senior managers{category ? ` for a ${CATEGORY_LABELS[category]} firm` : ""}
          </p>
          <ul className="-mx-2 space-y-0.5">
            {issues.map((i) => (
              <li key={i.id}>
                <IssueLink issue={i} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <SectionTitle
          title="People"
          description="Everyone who holds an SMF, performs a certification function or is subject to the Conduct Rules. Add people once — they are reused across every module."
        />
        <form onSubmit={onAdd} className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end" id="people-add">
          <Field label="Full name" className="flex-1" error={addError}>
            <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Jane Smith" />
          </Field>
          <Button type="submit" variant="primary">
            <UserPlus className="size-4" aria-hidden />
            Add person
          </Button>
        </form>

        {ws.people.length === 0 ? (
          <EmptyState title="No people yet" description="Start with your CEO or managing partner, then your compliance oversight (SMF16) and MLRO (SMF17)." />
        ) : (
          <ul className="space-y-3">
            {ws.people.map((p) => {
              const open = openId === p.id;
              const fit = needsFit.has(p.id) ? fitnessStatus(ws, p.id) : null;
              return (
                <li key={p.id} id={`person-${p.id}`} className={cx("rounded-2xl border", open ? "border-emerald/40 bg-white/5" : "border-white/10")}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={open}
                    aria-controls={`person-panel-${p.id}`}
                    onClick={() => setOpenId(open ? null : p.id)}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-sand">
                        {p.name || "Unnamed person"}
                        {p.jobTitle && <span className="font-normal text-sand/60"> · {p.jobTitle}</span>}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {p.status === "left" && <Badge tone="bad">Left</Badge>}
                        {p.smfs.map((s) => (
                          <Badge key={s.smfId} tone={getSmf(s.smfId) ? "plum" : "bad"}>
                            {s.smfId}
                            {s.status !== "approved" && <span className="text-sand/60"> · {s.status.replace(/_/g, " ")}</span>}
                          </Badge>
                        ))}
                        {p.certificationFunctions.length > 0 && <Badge tone="info">Certified ({p.certificationFunctions.length})</Badge>}
                        {p.isNonExecutive && <Badge>Non-executive</Badge>}
                        {fit && <Badge tone={fit.complete ? "good" : "warn"}>F&amp;P {fit.complete ? "complete" : `${fit.answered}/${fit.total}`}</Badge>}
                      </span>
                    </span>
                    {open ? <ChevronUp className="size-5 shrink-0 text-sand/60" aria-hidden /> : <ChevronDown className="size-5 shrink-0 text-sand/60" aria-hidden />}
                    <span className="sr-only">{open ? "Collapse" : "Edit"}</span>
                  </button>
                  {open && (
                    <div id={`person-panel-${p.id}`} className="border-t border-white/10 px-4 py-4">
                      <PersonEditor personId={p.id} onRemoved={() => setOpenId(null)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
