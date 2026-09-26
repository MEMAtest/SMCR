"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { FIT_SECTIONS, NON_FINANCIAL_MISCONDUCT_NOTE } from "@/lib/rules/fca-solo";
import { fitnessStatus, peopleNeedingFit } from "@/lib/workspace/derive";
import { formatDate } from "@/lib/workspace/dates";
import { emptyFitAssessment, type FitAssessment } from "@/lib/workspace/schema";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { Badge, Callout, EmptyState, Field, Panel, ProgressBar, SectionTitle, Segmented, TextArea, TextInput, cx } from "@/components/ui";
import { FitQuestionRow } from "./FitQuestionRow";
import { stepHref } from "./shared";

export function FitnessStep() {
  const ws = useWorkspace((s) => s.ws);
  const router = useRouter();
  const params = useSearchParams();
  const people = peopleNeedingFit(ws);
  const requested = params.get("person");
  const person = people.find((p) => p.id === requested) ?? people[0];

  // Keep ?person= in sync so links and refreshes land on the same person.
  useEffect(() => {
    if (person && requested !== person.id) router.replace(stepHref("fitness", { person: person.id }), { scroll: false });
  }, [person, requested, router]);

  if (people.length === 0) {
    return (
      <EmptyState
        title="Nobody needs an F&P assessment yet"
        description="Assessments are needed for SMF holders and certified staff. Add SMFs or certification functions in the Senior managers step."
        action={
          <Link href={stepHref("people")} className="text-sm text-emerald underline">
            Go to Senior managers
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="p-4">
        <p className="mb-2 text-sm font-semibold text-sand">Choose a person</p>
        <ul className="flex flex-wrap gap-2">
          {people.map((p) => {
            const st = fitnessStatus(ws, p.id);
            const active = p.id === person?.id;
            return (
              <li key={p.id}>
                <Link
                  href={stepHref("fitness", { person: p.id })}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cx(
                    "flex flex-col rounded-2xl border px-3 py-2 text-sm",
                    active ? "border-emerald/60 bg-emerald/10" : "border-white/10 hover:border-white/30",
                  )}
                >
                  <span className="font-semibold text-sand">{p.name}</span>
                  <span className={cx("text-xs", st.complete ? "text-emerald" : st.unexplainedAdverse ? "text-danger" : "text-sand/60")}>
                    {st.complete ? "Complete" : `${st.answered}/${st.total} answered`}
                    {st.unexplainedAdverse > 0 && ` · ${st.unexplainedAdverse} to explain`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>
      {person && <PersonAssessment personId={person.id} />}
    </div>
  );
}

function PersonAssessment({ personId }: { personId: string }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const person = ws.people.find((p) => p.id === personId)!;
  const assessment = ws.fitness[personId];
  const answers = assessment?.answers ?? {};
  const st = fitnessStatus(ws, personId);

  const patchAssessment = (recipe: (a: FitAssessment) => void) =>
    update((d) => {
      recipe((d.fitness[personId] ??= emptyFitAssessment()));
    });

  return (
    <>
      <Panel>
        <SectionTitle
          title={`${person.name} — F&P assessment`}
          description={`${person.smfs.map((s) => s.smfId).join(", ") || "Certified staff"}. Assess against FIT 2 before appointment and at least every 12 months.`}
        />
        <ProgressBar value={(st.answered / st.total) * 100} label={`${st.answered} of ${st.total} questions answered`} />
        {st.nextDueOn && <p className="mt-2 text-xs text-sand/60">Last assessed {formatDate(assessment?.assessedOn)} · next due {formatDate(st.nextDueOn)}</p>}
      </Panel>

      <div id="fit-sections" className="space-y-6">
        {FIT_SECTIONS.map((section) => {
          const qs = section.questions;
          const answered = qs.filter((q) => {
            const a = answers[q.id]?.answer;
            return a && (a !== "na" || q.allowNA);
          }).length;
          return (
            <Panel key={section.id}>
              <SectionTitle
                title={section.title}
                description={section.handbookRef}
                actions={<Badge tone={answered === qs.length ? "good" : "neutral"}>{`${answered}/${qs.length}`}</Badge>}
              />
              {section.id === "fit21" && (
                <div className="mb-4">
                  <Callout tone="info" title="Non-financial misconduct">
                    {NON_FINANCIAL_MISCONDUCT_NOTE}
                  </Callout>
                </div>
              )}
              <ol className="divide-y divide-white/10">
                {qs.map((q) => (
                  <FitQuestionRow key={q.id} personId={personId} question={q} record={answers[q.id]} />
                ))}
              </ol>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <div id="fit-signoff">
          <SectionTitle title="Assessment sign-off" description="Record who assessed the individual, when, and the outcome." />
          {!st.allAnswered ? (
            <p className="text-sm text-sand/70">Answer all {st.total} questions to sign off ({st.total - st.answered} remaining).</p>
          ) : (
            <div className="space-y-4">
              {st.unexplainedAdverse > 0 && (
                <Callout tone="bad" title="Explanations missing">
                  {st.unexplainedAdverse} potential concern{st.unexplainedAdverse === 1 ? "" : "s"} still need{st.unexplainedAdverse === 1 ? "s" : ""} an explanation before the assessment is complete.
                </Callout>
              )}
              {st.missingDates > 0 && <Callout tone="warn">{st.missingDates} disclosure(s) have no date recorded.</Callout>}
              {st.adverse.length > 0 && st.unexplainedAdverse === 0 && (
                <Callout tone="warn" title="Disclosures to review">
                  {st.adverse.length} answer(s) indicate a potential concern. Make sure the outcome reflects your review of each one.
                </Callout>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assessor name" error={!assessment?.assessor.trim() ? "Required" : undefined}>
                  <TextInput value={assessment?.assessor ?? ""} onChange={(e) => patchAssessment((a) => void (a.assessor = e.target.value))} />
                </Field>
                <Field label="Assessment date" error={!assessment?.assessedOn ? "Required" : assessment.assessedOn > today ? "Date is in the future." : undefined}>
                  <TextInput type="date" value={assessment?.assessedOn ?? ""} onChange={(e) => patchAssessment((a) => void (a.assessedOn = e.target.value || undefined))} />
                </Field>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-sand/80">Outcome</p>
                <Segmented
                  name={`outcome-${personId}`}
                  ariaLabel="Assessment outcome"
                  value={assessment?.outcome}
                  options={[
                    { value: "fit", label: "Fit and proper", tone: "good" },
                    { value: "fit_with_conditions", label: "Fit with conditions", tone: "neutral" },
                    { value: "not_fit", label: "Not fit and proper", tone: "bad" },
                  ]}
                  onChange={(v) => patchAssessment((a) => void (a.outcome = v))}
                />
              </div>
              {assessment?.outcome === "fit_with_conditions" && (
                <Field label="Conditions" hint="e.g. supervision, training to complete, time limits." error={!assessment.conditions.trim() ? "Describe the conditions." : undefined}>
                  <TextArea value={assessment.conditions} onChange={(e) => patchAssessment((a) => void (a.conditions = e.target.value))} />
                </Field>
              )}
              {assessment?.outcome === "not_fit" && (
                <Callout tone="bad">
                  An individual assessed as not fit and proper should not perform the function. Take compliance/legal advice on next steps, including any FCA
                  notification.
                </Callout>
              )}
              {st.complete && <Callout tone="good">Assessment recorded. The next annual re-assessment is due {formatDate(st.nextDueOn)}.</Callout>}
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
