"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, History, ListChecks, Loader2, MessageSquare, Send, ShieldQuestion, Sparkles } from "lucide-react";
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
  TextArea,
  cx,
} from "@/components/ui";
import { nowIso, postAi, truncate } from "@/lib/ai/client";
import { MAX_QUESTION_CHARS, type AskResponse, type GapReviewResponse } from "@/lib/ai/schemas";
import { buildAskContext, buildGapReviewInput } from "@/lib/ai/summarise";
import { CATEGORY_LABELS, type SmcrCategory } from "@/lib/rules/fca-solo";
import { formatDate } from "@/lib/workspace/dates";
import { getCategory } from "@/lib/workspace/derive";
import { newId, type AiLogEntry, type Workspace } from "@/lib/workspace/schema";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { AiDisclaimer, AiErrorNotice, SourceChip, type AiFailure } from "./shared";

const AI_LOG_MAX = 200;

const AREA_ROUTES: Record<string, { href: string; label: string }> = {
  firm: { href: "/builder?step=firm", label: "Firm profile" },
  people: { href: "/builder?step=people", label: "Senior managers" },
  responsibilities: { href: "/builder?step=responsibilities", label: "Responsibilities" },
  fitness: { href: "/builder?step=fitness", label: "Fitness & propriety" },
  documents: { href: "/workspace/documents", label: "Documents" },
  certification: { href: "/workspace/certification", label: "Certification" },
  conduct: { href: "/workspace/conduct", label: "Conduct Rules" },
  references: { href: "/workspace/references", label: "References" },
  obligations: { href: "/workspace/calendar", label: "Calendar" },
};

const FEATURE_LABELS: Record<AiLogEntry["feature"], string> = {
  ask: "Question",
  gap_review: "Gap review",
  sor_draft: "SoR draft",
};

function starterQuestions(category: SmcrCategory | null, ws: Workspace): string[] {
  const common = ["Which PRs apply to us and why?", "What changed under PS26/6?", "What must we do when an SMF leaves?"];
  const byCategory: Record<SmcrCategory | "none", string[]> = {
    none: ["How do we work out our SM&CR category?", "What makes a firm Enhanced?"],
    limited: ["Which senior manager functions does a Limited Scope firm need?", "Do prescribed responsibilities apply to us?"],
    core: ["Who is typically given PR (b-1) Conduct Rules training?", "How often must certified staff be re-assessed?"],
    enhanced: ["What extra duties does an Enhanced firm have?", "Which responsibilities are normally held by non-executives?"],
  };
  const extra: string[] = [];
  if (ws.firm.holdsClientAssets) extra.push("Who can hold the CASS responsibility?");
  if (ws.people.some((p) => p.smfs.some((s) => s.status === "temporary_cover"))) extra.push("What is the deadline when someone is providing temporary SMF cover?");
  return [...common, ...byCategory[category ?? "none"], ...extra].slice(0, 7);
}

interface Turn {
  id: string;
  question: string;
  status: "loading" | "done" | "error";
  result?: AskResponse;
  failure?: AiFailure;
}

const CONFIDENCE_TONE = { high: "good", medium: "info", low: "warn" } as const;
const PRIORITY_META = {
  now: { label: "Do now", tone: "bad" },
  next: { label: "Next", tone: "warn" },
  later: { label: "Later", tone: "info" },
} as const;

export function AssistantPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <LoadingPanel />;
  return <Assistant />;
}

function Assistant() {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const category = getCategory(ws);

  const askContext = useMemo(() => buildAskContext(ws, today), [ws, today]);
  const gapInput = useMemo(() => buildGapReviewInput(ws, today), [ws, today]);
  const starters = useMemo(() => starterQuestions(category, ws), [category, ws]);

  const [question, setQuestion] = useState("");
  const [questionError, setQuestionError] = useState<string | undefined>();
  const [thread, setThread] = useState<Turn[]>([]);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapResult, setGapResult] = useState<GapReviewResponse | null>(null);
  const [gapFailure, setGapFailure] = useState<AiFailure | null>(null);

  const busy = thread.some((t) => t.status === "loading");

  function log(entry: Omit<AiLogEntry, "id" | "at">) {
    update((d) => {
      d.aiLog.push({ id: newId("ai"), at: nowIso(), ...entry, summary: truncate(entry.summary, 200) });
      if (d.aiLog.length > AI_LOG_MAX) d.aiLog.splice(0, d.aiLog.length - AI_LOG_MAX);
    });
  }

  async function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setQuestionError("Type a question first.");
      return;
    }
    if (trimmed.length > MAX_QUESTION_CHARS) {
      setQuestionError(`Keep questions under ${MAX_QUESTION_CHARS.toLocaleString("en-GB")} characters.`);
      return;
    }
    if (busy) return;
    setQuestionError(undefined);
    const id = newId("turn");
    setThread((t) => [...t, { id, question: trimmed, status: "loading" }]);
    setQuestion("");
    const result = await postAi<AskResponse>("/api/ai/ask", { question: trimmed, context: askContext });
    setThread((t) =>
      t.map((turn) =>
        turn.id !== id ? turn : result.ok ? { ...turn, status: "done", result: result.data } : { ...turn, status: "error", failure: result },
      ),
    );
    if (result.ok) log({ feature: "ask", summary: `Q: ${trimmed}`, model: result.data.model.slice(0, 80) });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  async function runGapReview() {
    setGapLoading(true);
    setGapFailure(null);
    const result = await postAi<GapReviewResponse>("/api/ai/gap-review", gapInput);
    setGapLoading(false);
    if (!result.ok) {
      setGapFailure(result);
      return;
    }
    setGapResult(result.data);
    const n = result.data.actions.length;
    const now = result.data.actions.filter((a) => a.priority === "now").length;
    log({ feature: "gap_review", summary: `Gap review: ${n} action(s), ${now} to do now (${gapInput.issues.length} issues reviewed)`, model: result.data.model.slice(0, 80) });
  }

  const recentLog = [...ws.aiLog].reverse().slice(0, 25);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI assistant"
        title="Ask about SM&CR"
        description={
          <>
            Answers questions using this tool&apos;s versioned FCA rules pack and a summary of your workspace, with citations you can check. It
            can explain rules, deadlines and what applies to your firm. It cannot confirm you are compliant, give legal advice, or answer from
            anything outside the rules pack — if the pack does not cover something it will say so.
          </>
        }
      />

      <Callout tone="info" title="AI output is a draft">
        <AiDisclaimer />
      </Callout>

      <details className="glass-panel group p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-sand">
          <ShieldQuestion className="size-4 text-emerald" aria-hidden />
          What is shared with the AI?
          <span className="ml-auto text-xs font-normal text-sand/60 group-open:hidden">Show</span>
        </summary>
        <div className="mt-4 space-y-3 text-sm text-sand/80">
          <ul className="list-disc space-y-1 pl-5">
            <li>The FCA rules pack text (public reference data), plus your question.</li>
            <li>A summary of your workspace by role only — no names of individuals, no emails and no fitness &amp; propriety answers.</li>
            <li>For the gap review: health-check issues and obligations with names replaced by roles, and F&amp;P, conduct and reference matters reduced to counts.</li>
            <li>Requests are sent from this app&apos;s server to Anthropic&apos;s Claude API. The API key never reaches your browser.</li>
            <li>SoR drafting (on the Documents page) sends that one SoR&apos;s content, including the person&apos;s name and job title.</li>
          </ul>
          <p className="font-semibold text-sand">Workspace summary sent with each question ({askContext.length.toLocaleString("en-GB")} characters):</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-midnight/70 p-3 text-xs text-sand/80">{askContext}</pre>
          <p className="font-semibold text-sand">Sent for “Review my gaps”:</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-midnight/70 p-3 text-xs text-sand/80">
            {JSON.stringify(gapInput, null, 2)}
          </pre>
        </div>
      </details>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ------------------------------ Q&A ------------------------------ */}
        <Panel className="min-w-0 space-y-5">
          <SectionTitle
            title="Questions"
            description={category ? `Tailored to a ${CATEGORY_LABELS[category]} firm.` : "Complete the firm profile for answers tailored to your category."}
          />

          {thread.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="size-6" aria-hidden />}
              title="Ask anything about SM&CR for your firm"
              description="Try one of the suggestions below. Every answer lists the rules-pack entries it relies on."
            />
          ) : (
            <ol className="space-y-5" aria-live="polite">
              {thread.map((turn) => (
                <li key={turn.id} className="space-y-3">
                  <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-emerald/15 px-4 py-2 text-sm text-sand">
                    {turn.question}
                  </p>
                  {turn.status === "loading" && (
                    <p className="flex items-center gap-2 text-sm text-sand/70" role="status">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Checking the rules pack…
                    </p>
                  )}
                  {turn.status === "error" && turn.failure && <AiErrorNotice failure={turn.failure} />}
                  {turn.status === "done" && turn.result && <Answer result={turn.result} onFollowUp={(q) => void ask(q)} disabled={busy} />}
                </li>
              ))}
            </ol>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-sand/60">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <Button key={s} size="sm" variant="secondary" disabled={busy} onClick={() => void ask(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-2">
            <Field
              label="Your question"
              error={questionError}
              hint={`${question.length.toLocaleString("en-GB")} / ${MAX_QUESTION_CHARS.toLocaleString("en-GB")} characters. Please don't include personal information.`}
            >
              <TextArea
                rows={3}
                value={question}
                maxLength={MAX_QUESTION_CHARS}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (questionError) setQuestionError(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void ask(question);
                  }
                }}
                placeholder="e.g. Who should hold the financial crime responsibility?"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" disabled={busy || !question.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Ask
              </Button>
              {thread.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setThread([])} disabled={busy}>
                  Clear conversation
                </Button>
              )}
            </div>
          </form>
        </Panel>

        {/* --------------------------- Gap review --------------------------- */}
        <div className="min-w-0 space-y-6">
          <Panel className="space-y-4">
            <SectionTitle
              title="Review my gaps"
              description={`Turns your ${gapInput.issues.length} open health-check item(s) and ${
                gapInput.obligations.counts.overdue + gapInput.obligations.counts.due_soon
              } overdue or due-soon obligation(s) into a prioritised action plan.`}
            />
            <Button variant="primary" onClick={runGapReview} disabled={gapLoading} aria-busy={gapLoading}>
              {gapLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ListChecks className="size-4" aria-hidden />}
              {gapLoading ? "Reviewing…" : gapResult ? "Review again" : "Review my gaps"}
            </Button>
            {gapFailure && <AiErrorNotice failure={gapFailure} />}
            {gapResult && <GapPlan result={gapResult} />}
          </Panel>

          <Panel className="space-y-4">
            <SectionTitle title="AI activity log" description="Every AI call made from this workspace. Stored with your workspace." />
            {recentLog.length === 0 ? (
              <EmptyState icon={<History className="size-6" aria-hidden />} title="No AI activity yet" />
            ) : (
              <ul className="space-y-2">
                {recentLog.map((e) => (
                  <li key={e.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={e.feature === "sor_draft" ? "plum" : e.feature === "gap_review" ? "warn" : "info"}>{FEATURE_LABELS[e.feature]}</Badge>
                      <span className="text-xs text-sand/60">
                        {formatDate(e.at.slice(0, 10))} {e.at.length > 16 ? e.at.slice(11, 16) : ""} · {e.model}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sand/80">{e.summary}</p>
                    {e.acceptedBy && <p className="text-xs text-emerald">Reviewed and accepted by {e.acceptedBy}</p>}
                  </li>
                ))}
              </ul>
            )}
            {ws.aiLog.length > recentLog.length && <p className="text-xs text-sand/60">Showing the latest {recentLog.length} of {ws.aiLog.length} entries.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Sub-components ------------------------------ */

function Answer({ result, onFollowUp, disabled }: { result: AskResponse; onFollowUp: (q: string) => void; disabled: boolean }) {
  return (
    <article className="space-y-3 rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="plum">
          <Sparkles className="size-3" aria-hidden /> AI answer
        </Badge>
        <Badge tone={CONFIDENCE_TONE[result.confidence]}>Confidence: {result.confidence}</Badge>
        <span className="text-xs text-sand/50">{result.model}</span>
      </div>
      {result.outOfScope && (
        <Callout tone="warn" title="Outside the rules pack">
          The rules pack does not fully cover this question. Check the FCA Handbook or take professional advice rather than relying on this answer.
        </Callout>
      )}
      {result.confidence === "low" && !result.outOfScope && (
        <Callout tone="warn">Low confidence — treat this as a starting point and verify it against the Handbook.</Callout>
      )}
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-sand">{result.answer}</div>
      {result.citations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-sand/60">Sources</p>
          <ul className="flex flex-wrap gap-2">
            {result.citations.map((c) => (
              <li key={c.sourceId} className="max-w-full">
                <SourceChip sourceId={c.sourceId} note={c.note} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.citations.length === 0 && !result.outOfScope && (
        <p className="text-xs text-warning">No rules-pack sources were cited — do not rely on this answer without checking.</p>
      )}
      {result.unverifiedCitations > 0 && (
        <p className="text-xs text-sand/60">
          {result.unverifiedCitations} citation(s) were removed because they did not match an entry in the rules pack.
        </p>
      )}
      {result.followUps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.followUps.map((f) => (
            <button
              key={f}
              type="button"
              disabled={disabled}
              onClick={() => onFollowUp(f)}
              className="rounded-full border border-emerald/40 px-3 py-1 text-left text-xs text-emerald transition hover:bg-emerald/10 disabled:opacity-40"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function GapPlan({ result }: { result: GapReviewResponse }) {
  const groups = (["now", "next", "later"] as const).map((p) => ({ p, actions: result.actions.filter((a) => a.priority === p) })).filter((g) => g.actions.length);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="plum">AI draft — review before use</Badge>
        <span className="text-xs text-sand/50">{result.model}</span>
      </div>
      <p className="text-sm text-sand/90">{result.summary}</p>
      {groups.length === 0 && <p className="text-sm text-sand/70">No actions suggested.</p>}
      {groups.map(({ p, actions }) => (
        <div key={p} className="space-y-2">
          <h3 className="text-base">
            <Badge tone={PRIORITY_META[p].tone}>{PRIORITY_META[p].label}</Badge>
          </h3>
          <ul className="space-y-2">
            {actions.map((a, i) => {
              const route = AREA_ROUTES[a.area];
              return (
                <li key={`${p}-${i}`} className={cx("space-y-2 rounded-xl border border-white/10 bg-white/5 p-3")}>
                  <p className="font-semibold text-sand">{a.title}</p>
                  <p className="text-sm text-sand/75">{a.why}</p>
                  {a.sourceIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {a.sourceIds.map((id) => (
                        <SourceChip key={id} sourceId={id} />
                      ))}
                    </div>
                  )}
                  {route && (
                    <Link href={route.href} className="inline-flex items-center gap-1 text-sm text-emerald underline-offset-2 hover:underline">
                      Go to {route.label} <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {result.unverifiedCitations > 0 && (
        <p className="text-xs text-sand/60">{result.unverifiedCitations} source reference(s) were removed because they did not match the rules pack.</p>
      )}
    </div>
  );
}
