"use client";

import { FIT_SECTIONS } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { CheckCircle2, User, ChevronDown, Info, AlertCircle, ShieldAlert } from "lucide-react";
import { useState, useMemo } from "react";
import { WizardNavigation } from "@/components/wizard/WizardNavigation";
import type { FitnessResponse } from "@/lib/validation";
import { calculateIndividualRisk, getRiskColorClass, type RiskLevel } from "@/lib/fitness-risk-rating";

export function FitnessChecklist() {
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const setFitnessResponse = useSmcrStore((state) => state.setFitnessResponse);
  const individuals = useSmcrStore((state) => state.individuals);
  const [expandedIndividual, setExpandedIndividual] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Generate unique questionId that includes individual ID
  const generateQuestionId = (individualId: string, sectionId: string, questionId: string) => {
    return `${individualId}::${sectionId}::${questionId}`;
  };

  const parseQuestionId = (questionId: string) => {
    const [individualId, sectionId, qId] = questionId.split("::");
    return { individualId, sectionId, questionId: qId };
  };

  const getResponse = (individualId: string, sectionId: string, questionId: string): FitnessResponse | undefined => {
    const fullQuestionId = generateQuestionId(individualId, sectionId, questionId);
    return fitnessResponses.find((r) => r.questionId === fullQuestionId);
  };

  const handleResponseChange = (
    individualId: string,
    sectionId: string,
    questionId: string,
    value: "yes" | "no" | "n/a"
  ) => {
    const fullQuestionId = generateQuestionId(individualId, sectionId, questionId);
    const existing = getResponse(individualId, sectionId, questionId);

    setFitnessResponse({
      sectionId,
      questionId: fullQuestionId,
      response: value,
      details: existing?.details,
      date: existing?.date,
      evidence: existing?.evidence,
    });
  };

  const handleDetailsChange = (
    individualId: string,
    sectionId: string,
    questionId: string,
    value: string
  ) => {
    const fullQuestionId = generateQuestionId(individualId, sectionId, questionId);
    const existing = getResponse(individualId, sectionId, questionId);

    setFitnessResponse({
      sectionId,
      questionId: fullQuestionId,
      response: existing?.response || "",
      details: value,
      date: existing?.date,
      evidence: existing?.evidence,
    });
  };

  const handleDateChange = (
    individualId: string,
    sectionId: string,
    questionId: string,
    value: string
  ) => {
    const fullQuestionId = generateQuestionId(individualId, sectionId, questionId);
    const existing = getResponse(individualId, sectionId, questionId);

    setFitnessResponse({
      sectionId,
      questionId: fullQuestionId,
      response: existing?.response || "",
      details: existing?.details,
      date: value,
      evidence: existing?.evidence,
    });
  };

  const handleEvidenceChange = (
    individualId: string,
    sectionId: string,
    questionId: string,
    value: string
  ) => {
    const fullQuestionId = generateQuestionId(individualId, sectionId, questionId);
    const existing = getResponse(individualId, sectionId, questionId);

    setFitnessResponse({
      sectionId,
      questionId: fullQuestionId,
      response: existing?.response || "",
      details: existing?.details,
      date: existing?.date,
      evidence: value,
    });
  };

  // Calculate completion per individual
  const getIndividualCompletion = (individualId: string) => {
    const totalQuestions = FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);
    const answered = fitnessResponses.filter((r) => {
      const parsed = parseQuestionId(r.questionId);
      return parsed.individualId === individualId && r.response && r.response.trim().length > 0;
    }).length;
    return totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
  };

  // Calculate completion per section for an individual
  const getSectionCompletion = (individualId: string, sectionId: string) => {
    const section = FIT_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return 0;

    const totalQuestions = section.questions.length;
    const answered = section.questions.filter((q) => {
      const response = getResponse(individualId, sectionId, q.id);
      return response && response.response && response.response.trim().length > 0;
    }).length;

    return totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Bulk action: Set all questions in a section to Yes/No/N/A
  const handleBulkAction = (individualId: string, sectionId: string, value: "yes" | "no" | "n/a") => {
    const section = FIT_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

    section.questions.forEach((question) => {
      handleResponseChange(individualId, sectionId, question.id, value);
    });
  };

  // Calculate risk assessment for an individual
  const getIndividualRisk = (individualId: string) => {
    const individual = individuals.find((ind) => ind.id === individualId);
    if (!individual) return null;

    // Convert fitnessResponses array to the format expected by risk calculator
    const individualResponses: Record<string, any> = {};
    fitnessResponses.forEach((response) => {
      const parsed = parseQuestionId(response.questionId);
      if (parsed.individualId === individualId) {
        individualResponses[parsed.questionId] = {
          response: response.response,
          details: response.details,
          date: response.date,
        };
      }
    });

    return calculateIndividualRisk(individualId, individual.name, individualResponses);
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
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-8 text-center">
          <AlertCircle className="size-12 text-warning mx-auto mb-3" />
          <p className="text-sm text-warning">Add SMF individuals in step 02 to complete fitness assessments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {individuals.map((individual) => {
            const completion = getIndividualCompletion(individual.id);
            const isExpanded = expandedIndividual === individual.id;
            const riskAssessment = getIndividualRisk(individual.id);

            return (
              <div key={individual.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedIndividual(isExpanded ? null : individual.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-3">
                    <User className="size-5 text-emerald" />
                    <div className="text-left">
                      <p className="text-base font-semibold text-sand">{individual.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {individual.smfRoles.map((role, idx) => (
                          <span key={idx} className="text-xs text-sand/70">
                            {role}{idx < individual.smfRoles.length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {riskAssessment && riskAssessment.overallScore > 0 && (
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold border ${getRiskColorClass(riskAssessment.riskLevel)}`}>
                        <div className="flex items-center gap-1">
                          <ShieldAlert className="size-3" />
                          {riskAssessment.riskLevel} Risk
                        </div>
                      </div>
                    )}
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
                  <div className="border-t border-white/10">
                    {FIT_SECTIONS.map((section) => {
                      const sectionKey = `${individual.id}::${section.id}`;
                      const isSectionExpanded = expandedSections[sectionKey];
                      const sectionCompletion = getSectionCompletion(individual.id, section.id);

                      return (
                        <div key={section.id} className="border-b border-white/10 last:border-b-0">
                          <button
                            type="button"
                            onClick={() => toggleSection(sectionKey)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition text-left"
                          >
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-sand">{section.title}</h4>
                              <p className="text-xs text-sand/60 mt-0.5">{section.questions.length} questions</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-semibold ${
                                sectionCompletion === 100 ? "text-emerald" : "text-sand/70"
                              }`}>
                                {sectionCompletion}%
                              </span>
                              <ChevronDown
                                className={`size-4 text-sand/70 transition-transform ${
                                  isSectionExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {isSectionExpanded && (
                            <div className="px-4 pb-4 space-y-4 bg-midnight/30">
                              {/* Bulk action buttons */}
                              <div className="flex items-center gap-2 pt-2">
                                <span className="text-xs text-sand/60 mr-2">Quick fill:</span>
                                <button
                                  type="button"
                                  onClick={() => handleBulkAction(individual.id, section.id, "yes")}
                                  className="px-3 py-1 rounded-full text-xs font-semibold border border-emerald/30 bg-emerald/10 text-emerald hover:bg-emerald/20 transition"
                                >
                                  Yes to All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkAction(individual.id, section.id, "no")}
                                  className="px-3 py-1 rounded-full text-xs font-semibold border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 transition"
                                >
                                  No to All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkAction(individual.id, section.id, "n/a")}
                                  className="px-3 py-1 rounded-full text-xs font-semibold border border-sand/30 bg-sand/10 text-sand hover:bg-sand/20 transition"
                                >
                                  N/A to All
                                </button>
                              </div>

                              {section.questions.map((question) => {
                                const response = getResponse(individual.id, section.id, question.id);
                                const selectedValue = response?.response || "";
                                const showDetails = selectedValue === "yes" && question.requiresDetails;
                                const showDate = selectedValue === "yes" && question.requiresDate;

                                return (
                                  <div
                                    key={question.id}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
                                  >
                                    <div className="flex items-start gap-2">
                                      <p className="text-sm text-sand flex-1">{question.question}</p>
                                      {question.helpText && (
                                        <div className="group relative">
                                          <Info className="size-4 text-sand/40 cursor-help" />
                                          <div className="absolute right-0 top-6 w-64 rounded-lg bg-midnight border border-white/20 p-3 text-xs text-sand/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-10">
                                            {question.helpText}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Radio buttons for Yes/No/N/A */}
                                    <div className="flex gap-3">
                                      {["yes", "no", "n/a"].map((option) => (
                                        <label
                                          key={option}
                                          className={`flex-1 flex items-center justify-center gap-2 rounded-full border px-4 py-2 cursor-pointer transition ${
                                            selectedValue === option
                                              ? option === "yes"
                                                ? "border-emerald bg-emerald/10 text-emerald"
                                                : option === "no"
                                                ? "border-warning bg-warning/10 text-warning"
                                                : "border-sand/50 bg-sand/10 text-sand"
                                              : "border-white/20 text-sand/70 hover:border-white/40"
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`${individual.id}-${section.id}-${question.id}`}
                                            value={option}
                                            checked={selectedValue === option}
                                            onChange={() =>
                                              handleResponseChange(
                                                individual.id,
                                                section.id,
                                                question.id,
                                                option as "yes" | "no" | "n/a"
                                              )
                                            }
                                            className="sr-only"
                                          />
                                          <span className="text-sm font-semibold capitalize">{option}</span>
                                        </label>
                                      ))}
                                    </div>

                                    {/* Conditional details field */}
                                    {showDetails && (
                                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="block text-xs text-sand/80">
                                          Please provide details
                                          <textarea
                                            className="mt-1 w-full rounded-2xl border border-emerald/30 bg-midnight/60 px-4 py-2 text-sm text-sand focus:border-emerald focus:outline-none"
                                            placeholder="Add details about this response..."
                                            rows={3}
                                            value={response?.details || ""}
                                            onChange={(e) =>
                                              handleDetailsChange(
                                                individual.id,
                                                section.id,
                                                question.id,
                                                e.target.value
                                              )
                                            }
                                          />
                                        </label>
                                      </div>
                                    )}

                                    {/* Conditional date field */}
                                    {showDate && (
                                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="block text-xs text-sand/80">
                                          Date of event
                                          <input
                                            type="date"
                                            className="mt-1 w-full rounded-2xl border border-emerald/30 bg-midnight/60 px-4 py-2 text-sm text-sand focus:border-emerald focus:outline-none"
                                            value={response?.date || ""}
                                            onChange={(e) =>
                                              handleDateChange(individual.id, section.id, question.id, e.target.value)
                                            }
                                          />
                                        </label>
                                      </div>
                                    )}

                                    {/* Evidence field (always shown) */}
                                    <div className="space-y-2">
                                      <label className="block text-xs text-sand/60">
                                        Evidence link or reference (optional)
                                        <input
                                          type="text"
                                          className="mt-1 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-2 text-sm text-sand focus:border-emerald focus:outline-none"
                                          placeholder="https://... or document reference"
                                          value={response?.evidence || ""}
                                          onChange={(e) =>
                                            handleEvidenceChange(individual.id, section.id, question.id, e.target.value)
                                          }
                                        />
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
