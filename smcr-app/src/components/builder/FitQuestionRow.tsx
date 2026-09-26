"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { isAdverse, type FitAnswer, type FitQuestion } from "@/lib/rules/fca-solo";
import type { FitAnswerRecord } from "@/lib/workspace/schema";
import { useWorkspace } from "@/stores/useWorkspace";
import { Field, Segmented, TextArea, TextInput } from "@/components/ui";

export function FitQuestionRow({ personId, question, record }: { personId: string; question: FitQuestion; record: FitAnswerRecord | undefined }) {
  const setFitAnswer = useWorkspace((s) => s.setFitAnswer);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const answer = record?.answer === "na" && !question.allowNA ? undefined : record?.answer;
  const adverse = isAdverse(question, answer);
  const detailsMissing = adverse && (record?.details.trim().length ?? 0) < 10;
  const dateMissing = adverse && question.askDate && !record?.date;
  const other: "yes" | "no" = question.adverseAnswer === "yes" ? "no" : "yes";

  const options: { value: FitAnswer; label: string; tone: "good" | "bad" | "neutral" }[] = [
    { value: "yes", label: "Yes", tone: question.adverseAnswer === "yes" ? "bad" : "good" },
    { value: "no", label: "No", tone: question.adverseAnswer === "no" ? "bad" : "good" },
  ];
  if (question.allowNA) options.push({ value: "na", label: "N/A", tone: "neutral" });

  const set = (patch: Partial<FitAnswerRecord>) => setFitAnswer(personId, question.id, patch);

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-sand">{question.text}</p>
          <p className="mt-1 text-xs text-sand/50">
            A &ldquo;{question.adverseAnswer === "yes" ? "Yes" : "No"}&rdquo; answer is a potential concern that needs explaining; &ldquo;{other === "yes" ? "Yes" : "No"}&rdquo; is the expected answer.
          </p>
          {question.help && (
            <div className="mt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-cloud underline-offset-2 hover:underline"
                aria-expanded={helpOpen}
                aria-controls={helpId}
                onClick={() => setHelpOpen((v) => !v)}
              >
                <HelpCircle className="size-3.5" aria-hidden />
                {helpOpen ? "Hide guidance" : "Show guidance"}
              </button>
              {helpOpen && (
                <p id={helpId} className="mt-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-sand/80">
                  {question.help}
                </p>
              )}
            </div>
          )}
        </div>
        <Segmented name={`${personId}-${question.id}`} ariaLabel={question.text} value={answer} options={options} onChange={(v) => set({ answer: v })} />
      </div>

      {adverse && (
        <div className="grid gap-3 rounded-xl border border-warning/40 bg-warning/5 p-3 sm:grid-cols-[1fr_12rem]">
          <Field label="Explanation" hint="What happened, when, and why the firm is (or is not) satisfied." error={detailsMissing ? "Required — at least 10 characters." : undefined}>
            <TextArea
              value={record?.details ?? ""}
              className={detailsMissing ? "border-warning ring-1 ring-warning/60" : undefined}
              onChange={(e) => set({ details: e.target.value })}
            />
          </Field>
          {question.askDate && (
            <Field label="Date of event" error={dateMissing ? "Enter the date." : undefined}>
              <TextInput type="date" value={record?.date ?? ""} className={dateMissing ? "border-warning" : undefined} onChange={(e) => set({ date: e.target.value || undefined })} />
            </Field>
          )}
        </div>
      )}

      <Field label="Evidence reference (optional)" hint="e.g. DBS certificate number, reference letter, file location.">
        <TextInput value={record?.evidence ?? ""} onChange={(e) => set({ evidence: e.target.value })} />
      </Field>
    </li>
  );
}
