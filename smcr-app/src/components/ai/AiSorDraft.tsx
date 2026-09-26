"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Field, Segmented, TextInput, cx } from "@/components/ui";
import { nowIso, postAi, truncate } from "@/lib/ai/client";
import type { SorDraftResponse } from "@/lib/ai/schemas";
import { buildSorDraftInput } from "@/lib/ai/summarise";
import { formatDate, todayISO } from "@/lib/workspace/dates";
import { buildSorModel } from "@/lib/workspace/derive";
import { emptySor, newId, type Workspace } from "@/lib/workspace/schema";
import { useWorkspace } from "@/stores/useWorkspace";
import { AiDisclaimer, AiErrorNotice, type AiFailure } from "./shared";

const ADDITIONAL_TEXT_MAX = 8000;
const AI_LOG_MAX = 200;

function pushLog(d: Workspace, entry: Omit<Workspace["aiLog"][number], "id" | "at">) {
  d.aiLog.push({ id: newId("ai"), at: nowIso(), ...entry, summary: truncate(entry.summary, 200) });
  if (d.aiLog.length > AI_LOG_MAX) d.aiLog.splice(0, d.aiLog.length - AI_LOG_MAX);
}

/** AI drafting panel for a person's Statement of Responsibilities. */
export function AiSorDraft({ personId }: { personId: string }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const model = useMemo(() => buildSorModel(ws, personId), [ws, personId]);
  const sor = ws.sors[personId];
  const aiDraft = sor?.aiDraft;
  const pending = aiDraft && !aiDraft.acceptedBy ? aiDraft : undefined;

  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<AiFailure | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [reviewer, setReviewer] = useState("");
  const [reviewerError, setReviewerError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);

  if (!model) return null;
  const roleText = model.smfs.map((s) => s.id).join("/") || "senior manager";

  async function generate() {
    if (!model) return;
    setLoading(true);
    setFailure(null);
    setMessage(null);
    const result = await postAi<SorDraftResponse>("/api/ai/sor-draft", buildSorDraftInput(ws, model));
    setLoading(false);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const { draft, rationale, gaps, model: usedModel } = result.data;
    update((d) => {
      const target = (d.sors[personId] ??= emptySor());
      target.aiDraft = {
        text: draft.slice(0, ADDITIONAL_TEXT_MAX),
        generatedAt: nowIso(),
        model: usedModel.slice(0, 80),
        rationale: rationale.slice(0, 20).map((r) => r.slice(0, 1000)),
        gaps: gaps.slice(0, 20).map((g) => g.slice(0, 1000)),
      };
      pushLog(d, { feature: "sor_draft", summary: `Drafted SoR additional-responsibilities wording (${roleText})`, model: usedModel.slice(0, 80) });
    });
    setReviewer("");
    setReviewerError(undefined);
  }

  const existing = sor?.additionalText ?? "";
  const combined = pending ? (mode === "replace" || !existing.trim() ? pending.text : `${existing.trimEnd()}\n\n${pending.text}`) : "";
  const tooLong = combined.length > ADDITIONAL_TEXT_MAX;

  function accept() {
    if (!pending) return;
    const name = reviewer.trim();
    if (name.length < 2) {
      setReviewerError("Enter the name of the person who reviewed this draft.");
      return;
    }
    if (tooLong) return;
    update((d) => {
      const target = (d.sors[personId] ??= emptySor());
      target.additionalText = combined;
      if (target.aiDraft) {
        target.aiDraft.acceptedBy = name.slice(0, 200);
        target.aiDraft.acceptedOn = todayISO();
      }
      pushLog(d, {
        feature: "sor_draft",
        summary: `${mode === "replace" ? "Replaced" : "Appended to"} SoR additional text with reviewed AI draft (${roleText})`,
        model: pending.model,
        acceptedBy: name.slice(0, 200),
      });
    });
    setMessage(`Inserted into the SoR. Reviewed by ${name}.`);
  }

  function discard() {
    update((d) => {
      const target = d.sors[personId];
      if (target) delete target.aiDraft;
    });
    setMessage("AI draft discarded.");
  }

  const showNotes = pending && (pending.rationale.length > 0 || pending.gaps.length > 0) ? pending : null;

  return (
    <section aria-labelledby={`ai-sor-${personId}`} className="glass-panel space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`ai-sor-${personId}`} className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4 text-plumAccent" aria-hidden /> AI drafting assistant
          </h3>
          <p className="mt-1 text-sm text-sand/70">
            Suggests wording for the additional responsibilities section in line with FG19/2. It sees this SoR&apos;s content only — never
            fitness &amp; propriety answers.
          </p>
        </div>
        <Button variant={pending ? "secondary" : "primary"} size="sm" onClick={generate} disabled={loading} aria-busy={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {loading ? "Drafting…" : pending ? "Redraft with AI" : "Draft wording with AI"}
        </Button>
      </div>

      {failure && <AiErrorNotice failure={failure} />}
      {message && !pending && (
        <p role="status" className="text-sm text-emerald">
          {message}
        </p>
      )}

      {pending && (
        <div className="space-y-4 rounded-2xl border border-plumAccent/40 bg-plumAccent/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="plum">AI draft — review before use</Badge>
            <span className="text-xs text-sand/60">
              Generated {formatDate(pending.generatedAt.slice(0, 10))} · {pending.model}
            </span>
          </div>
          <div className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-midnight/60 p-3 text-sm text-sand">{pending.text}</div>

          {showNotes ? (
            <div className="grid gap-4 md:grid-cols-2">
              {showNotes.gaps.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-warning">Confirm before use</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sand/80">
                    {showNotes.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {showNotes.rationale.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-sand">Why it is worded this way</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sand/70">
                    {showNotes.rationale.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-sand/60">Check every [bracketed placeholder] and confirm the scope with the senior manager before inserting.</p>
          )}

          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="space-y-1">
              <p className="text-sm text-sand/80" id={`ai-sor-mode-${personId}`}>
                How should it be inserted?
              </p>
              <Segmented
                name={`ai-sor-mode-${personId}`}
                ariaLabel="Insert mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "append", label: "Append to existing text" },
                  { value: "replace", label: "Replace existing text" },
                ]}
              />
              {mode === "replace" && existing.trim() && (
                <p className="text-xs text-warning">This will overwrite the current additional text ({existing.trim().length} characters).</p>
              )}
            </div>
            <Field
              label="Reviewed by (required)"
              hint="The person taking responsibility for checking this wording. Recorded in the AI activity log."
              error={reviewerError}
              className="max-w-sm"
            >
              <TextInput
                value={reviewer}
                onChange={(e) => {
                  setReviewer(e.target.value);
                  if (reviewerError) setReviewerError(undefined);
                }}
                maxLength={200}
                autoComplete="name"
              />
            </Field>
            {sor?.status === "approved" && (
              <Callout tone="warn">This SoR is marked approved. Inserting text changes it — re-approve it once the change has been reviewed.</Callout>
            )}
            {tooLong && <Callout tone="bad">The combined text would exceed {ADDITIONAL_TEXT_MAX.toLocaleString("en-GB")} characters. Choose “Replace”, or shorten the existing text first.</Callout>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={accept} disabled={tooLong} className={cx(!reviewer.trim() && "opacity-80")}>
                <Check className="size-4" aria-hidden /> Insert into SoR
              </Button>
              <Button variant="ghost" size="sm" onClick={discard}>
                <Trash2 className="size-4" aria-hidden /> Discard
              </Button>
            </div>
          </div>
        </div>
      )}

      {aiDraft?.acceptedBy && !pending && (
        <p className="text-xs text-sand/60">
          Last AI draft inserted after review by {aiDraft.acceptedBy}
          {aiDraft.acceptedOn ? ` on ${formatDate(aiDraft.acceptedOn)}` : ""} ({aiDraft.model}).
        </p>
      )}

      <AiDisclaimer compact />
    </section>
  );
}
