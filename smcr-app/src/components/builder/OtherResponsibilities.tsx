"use client";

import { Plus, Trash2 } from "lucide-react";
import { personLabel } from "@/lib/workspace/derive";
import { newId, type OtherResponsibility, type Person, type Workspace } from "@/lib/workspace/schema";
import { useWorkspace } from "@/stores/useWorkspace";
import { Button, EmptyState, Field, Panel, SectionTitle, Select, TextArea, TextInput } from "@/components/ui";

const COPY: Record<OtherResponsibility["kind"], { title: string; description: string; empty: string; add: string; example: string }> = {
  overall: {
    title: "Overall responsibilities (SYSC 26)",
    description:
      "Enhanced firms must allocate overall responsibility for every activity, business area and management function to an SMF manager (e.g. Operations, IT, HR, Finance, Sales).",
    empty: "No overall responsibilities recorded yet.",
    add: "Add overall responsibility",
    example: "e.g. Operations and IT",
  },
  additional: {
    title: "Additional responsibilities",
    description: "Other responsibilities to include in a senior manager's Statement of Responsibilities (FG19/2: specific and self-contained).",
    empty: "No additional responsibilities recorded.",
    add: "Add responsibility",
    example: "e.g. Consumer Duty champion",
  },
};

export function OtherResponsibilities({ ws, kind, holders }: { ws: Workspace; kind: OtherResponsibility["kind"]; holders: Person[] }) {
  const update = useWorkspace((s) => s.update);
  const items = ws.otherResponsibilities.filter((o) => o.kind === kind);
  const copy = COPY[kind];

  const patch = (id: string, recipe: (o: OtherResponsibility) => void) =>
    update((d) => {
      const o = d.otherResponsibilities.find((x) => x.id === id);
      if (o) recipe(o);
    });

  return (
    <Panel>
      <div id={kind === "overall" ? "overall-responsibilities" : "additional-responsibilities"}>
        <SectionTitle
          title={copy.title}
          description={copy.description}
          actions={
            <Button
              size="sm"
              onClick={() =>
                update((d) => {
                  d.otherResponsibilities.push({ id: newId("resp"), title: "", description: "", kind });
                })
              }
            >
              <Plus className="size-4" aria-hidden />
              {copy.add}
            </Button>
          }
        />
        {items.length === 0 ? (
          <EmptyState title={copy.empty} />
        ) : (
          <ul className="space-y-3">
            {items.map((o) => (
              <li key={o.id} className="grid gap-3 rounded-2xl border border-white/10 p-4 md:grid-cols-[1fr_1fr_auto]">
                <Field label="Title" error={!o.title.trim() ? "Required" : undefined}>
                  <TextInput value={o.title} placeholder={copy.example} onChange={(e) => patch(o.id, (x) => void (x.title = e.target.value))} />
                </Field>
                <Field label="Owner">
                  <Select value={o.ownerId ?? ""} onChange={(e) => patch(o.id, (x) => void (x.ownerId = e.target.value || undefined))}>
                    <option value="">— Not allocated —</option>
                    {holders.map((h) => (
                      <option key={h.id} value={h.id}>
                        {personLabel(h)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${o.title || "responsibility"}`}
                    onClick={() => update((d) => void (d.otherResponsibilities = d.otherResponsibilities.filter((x) => x.id !== o.id)))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <Field label="Description" className="md:col-span-3">
                  <TextArea rows={2} value={o.description} onChange={(e) => patch(o.id, (x) => void (x.description = e.target.value))} />
                </Field>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
