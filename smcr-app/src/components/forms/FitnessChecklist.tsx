"use client";

import { FIT_SECTIONS } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { CheckCircle2, UploadCloud } from "lucide-react";

export function FitnessChecklist() {
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const setFitnessResponse = useSmcrStore((state) => state.setFitnessResponse);
  const individuals = useSmcrStore((state) => state.individuals);

  const getResponseValue = (sectionId: string, questionId: string) => {
    const response = fitnessResponses.find(
      (r) => r.sectionId === sectionId && r.questionId === questionId
    );
    return response?.response || "";
  };

  const getEvidenceValue = (sectionId: string, questionId: string) => {
    const response = fitnessResponses.find(
      (r) => r.sectionId === sectionId && r.questionId === questionId
    );
    return response?.evidence || "";
  };

  const handleResponseChange = (sectionId: string, question: string, value: string) => {
    const questionId = `${sectionId}-${question.substring(0, 20)}`;
    setFitnessResponse({
      sectionId,
      questionId,
      response: value,
      evidence: getEvidenceValue(sectionId, questionId),
    });
  };

  const handleEvidenceChange = (sectionId: string, question: string, value: string) => {
    const questionId = `${sectionId}-${question.substring(0, 20)}`;
    setFitnessResponse({
      sectionId,
      questionId,
      response: getResponseValue(sectionId, questionId),
      evidence: value,
    });
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 03</p>
          <h3 className="text-2xl">Fitness & propriety snapshot</h3>
        </div>
        <CheckCircle2 className="size-8 text-emerald" />
      </div>
      <p className="text-sm text-sand/70">
        Capture evidence for FIT 2.1 – 2.3. Responses saved to secure draft storage automatically.
      </p>
      {individuals.length === 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-sm text-warning">Add SMF individuals in step 02 to complete fitness assessments.</p>
        </div>
      )}
      <div className="space-y-4">
        {FIT_SECTIONS.map((section) => (
          <details key={section.id} className="rounded-2xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer px-4 py-3 text-lg font-semibold text-sand">
              {section.title}
            </summary>
            <div className="space-y-4 px-4 pb-4">
              {section.questions.map((question, idx) => {
                const questionId = `${section.id}-${question.substring(0, 20)}`;
                return (
                  <div key={question} className="space-y-2">
                    <label className="block text-sm text-sand/80">
                      {question}
                      <textarea
                        className="mt-2 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-3 text-sand focus:border-emerald focus:outline-none"
                        placeholder="Add your response"
                        rows={3}
                        value={getResponseValue(section.id, questionId)}
                        onChange={(e) => handleResponseChange(section.id, question, e.target.value)}
                      />
                    </label>
                    <label className="block text-xs text-sand/60">
                      Evidence link (optional)
                      <input
                        type="text"
                        className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sm text-sand focus:border-emerald focus:outline-none"
                        placeholder="https://..."
                        value={getEvidenceValue(section.id, questionId)}
                        onChange={(e) => handleEvidenceChange(section.id, question, e.target.value)}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
