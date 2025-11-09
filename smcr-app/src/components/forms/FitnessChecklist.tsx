"use client";

import { FIT_SECTIONS } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { CheckCircle2, User, ChevronDown } from "lucide-react";
import { useState } from "react";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";

export function FitnessChecklist() {
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const setFitnessResponse = useSmcrStore((state) => state.setFitnessResponse);
  const individuals = useSmcrStore((state) => state.individuals);
  const [expandedIndividual, setExpandedIndividual] = useState<string | null>(null);

  // Generate unique questionId that includes individual ID
  const generateQuestionId = (individualId: string, sectionId: string, questionIndex: number) => {
    return `${individualId}::${sectionId}::${questionIndex}`;
  };

  const parseQuestionId = (questionId: string) => {
    const [individualId, sectionId, questionIndex] = questionId.split("::");
    return { individualId, sectionId, questionIndex };
  };

  const getResponseValue = (individualId: string, sectionId: string, questionIndex: number) => {
    const questionId = generateQuestionId(individualId, sectionId, questionIndex);
    const response = fitnessResponses.find((r) => r.questionId === questionId);
    return response?.response || "";
  };

  const getEvidenceValue = (individualId: string, sectionId: string, questionIndex: number) => {
    const questionId = generateQuestionId(individualId, sectionId, questionIndex);
    const response = fitnessResponses.find((r) => r.questionId === questionId);
    return response?.evidence || "";
  };

  const handleResponseChange = (
    individualId: string,
    sectionId: string,
    questionIndex: number,
    value: string
  ) => {
    const questionId = generateQuestionId(individualId, sectionId, questionIndex);
    setFitnessResponse({
      sectionId,
      questionId,
      response: value,
      evidence: getEvidenceValue(individualId, sectionId, questionIndex),
    });
  };

  const handleEvidenceChange = (
    individualId: string,
    sectionId: string,
    questionIndex: number,
    value: string
  ) => {
    const questionId = generateQuestionId(individualId, sectionId, questionIndex);
    setFitnessResponse({
      sectionId,
      questionId,
      response: getResponseValue(individualId, sectionId, questionIndex),
      evidence: value,
    });
  };

  // Calculate completion per individual
  const getIndividualCompletion = (individualId: string) => {
    const totalQuestions = FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);
    const answered = fitnessResponses.filter((r) => {
      const parsed = parseQuestionId(r.questionId);
      return parsed.individualId === individualId && r.response.trim().length > 0;
    }).length;
    return totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 03</p>
          <h3 className="text-2xl">Fitness & Propriety Assessment</h3>
        </div>
        <CheckCircle2 className="size-8 text-emerald" />
      </div>
      <p className="text-sm text-sand/70">
        Complete FIT 2.1 – 2.3 assessments for each SMF individual. Responses saved automatically.
      </p>

      {individuals.length === 0 ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-sm text-warning">Add SMF individuals in step 02 to complete fitness assessments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {individuals.map((individual) => {
            const completion = getIndividualCompletion(individual.id);
            const isExpanded = expandedIndividual === individual.id;

            return (
              <div key={individual.id} className="rounded-2xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => setExpandedIndividual(isExpanded ? null : individual.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <User className="size-5 text-emerald" />
                    <div className="text-left">
                      <p className="text-base font-semibold text-sand">{individual.name}</p>
                      <p className="text-sm text-sand/70">{individual.smfRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-emerald font-semibold">{completion}% complete</p>
                    </div>
                    <ChevronDown
                      className={`size-5 text-sand/70 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                    {FIT_SECTIONS.map((section) => (
                      <div key={section.id} className="space-y-3">
                        <h4 className="text-base font-semibold text-sand border-l-2 border-emerald pl-3">
                          {section.title}
                        </h4>
                        {section.questions.map((question, questionIndex) => (
                          <div key={questionIndex} className="space-y-2 pl-5">
                            <label className="block text-sm text-sand/80">
                              {question}
                              <textarea
                                className="mt-2 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-3 text-sand focus:border-emerald focus:outline-none"
                                placeholder="Add your response"
                                rows={3}
                                value={getResponseValue(individual.id, section.id, questionIndex)}
                                onChange={(e) =>
                                  handleResponseChange(individual.id, section.id, questionIndex, e.target.value)
                                }
                              />
                            </label>
                            <label className="block text-xs text-sand/60">
                              Evidence link (optional)
                              <input
                                type="text"
                                className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sm text-sand focus:border-emerald focus:outline-none"
                                placeholder="https://..."
                                value={getEvidenceValue(individual.id, section.id, questionIndex)}
                                onChange={(e) =>
                                  handleEvidenceChange(individual.id, section.id, questionIndex, e.target.value)
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <WizardNavigation currentStep="fitness" showErrors />
    </div>
  );
}
