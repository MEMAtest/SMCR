"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, AlertTriangle, Award } from "lucide-react";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { FIT_SECTIONS, getApplicablePRs } from "@/lib/smcr-data";
import { buildNextActions } from "@/lib/insights/nextActions";
import { calculateBoardReadiness } from "@/lib/insights/boardReadiness";

const PIE_COLORS = ["#3CCB8B", "#7F5AF0"];

export function ReportSummaryPanel() {
  const [mounted, setMounted] = useState(false);
  const setActiveStep = useSmcrStore((state) => state.setActiveStep);
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const coverage = useSmcrStore((state) => state.getResponsibilityCoverage());
  const individuals = useSmcrStore((state) => state.individuals);
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);
  const responsibilityEvidence = useSmcrStore((state) => state.responsibilityEvidence);

  const applicableResponsibilities = useMemo(() => {
    if (!firmProfile.firmType) return [];
    return getApplicablePRs(
      firmProfile.firmType,
      firmProfile.smcrCategory,
      firmProfile.isCASSFirm ?? false
    );
  }, [firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm]);

  // Calculate dynamic metrics
  const assignedCount = useMemo(
    () => applicableResponsibilities.filter((pr) => responsibilityAssignments[pr.ref]).length,
    [applicableResponsibilities, responsibilityAssignments]
  );
  const ownedCount = useMemo(
    () =>
      applicableResponsibilities.filter(
        (pr) => responsibilityAssignments[pr.ref] && !!responsibilityOwners[pr.ref]
      ).length,
    [applicableResponsibilities, responsibilityAssignments, responsibilityOwners]
  );
  const unassignedCount = Math.max(0, assignedCount - ownedCount);

  const FIT_QUESTIONS_PER_INDIVIDUAL = useMemo(
    () => FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0),
    []
  );
  const expectedFitnessResponses = individuals.length * FIT_QUESTIONS_PER_INDIVIDUAL;
  const answeredFitnessResponses = useMemo(
    () => fitnessResponses.filter((r) => r.response && r.response.trim().length > 0).length,
    [fitnessResponses]
  );
  const outstandingFitness = Math.max(0, expectedFitnessResponses - answeredFitnessResponses);
  const fitnessCompletionRate = expectedFitnessResponses > 0
    ? Math.round((answeredFitnessResponses / expectedFitnessResponses) * 100)
    : 0;

  const insights = useMemo(
    () => [
      {
        label: "Responsibilities coverage",
        value: coverage > 0 ? `${coverage}%` : "0%",
        subLabel: assignedCount > 0
          ? `${ownedCount}/${assignedCount} assigned • ${unassignedCount} pending`
          : "No responsibilities selected yet",
        icon: CheckCircle2,
        tone: coverage === 100 ? ("positive" as const) : coverage > 0 ? ("warning" as const) : ("neutral" as const),
      },
      {
        label: "SMF individuals",
        value: individuals.length.toString(),
        subLabel: individuals.length > 0
          ? `${individuals.length} individual${individuals.length === 1 ? "" : "s"} with SMF roles`
          : "Add individuals to continue",
        icon: AlertTriangle,
        tone: individuals.length > 0 ? ("positive" as const) : ("warning" as const),
      },
      {
        label: "FIT assessments",
        value: individuals.length > 0 ? `${fitnessCompletionRate}%` : "–",
        subLabel: individuals.length > 0
          ? `${answeredFitnessResponses}/${expectedFitnessResponses} questions • ${outstandingFitness} remaining`
          : "Complete SMF roster first",
        icon: Award,
        tone: fitnessCompletionRate === 100 ? ("positive" as const) : fitnessCompletionRate > 0 ? ("warning" as const) : ("neutral" as const),
      },
    ],
    [coverage, assignedCount, ownedCount, unassignedCount, outstandingFitness, individuals.length, answeredFitnessResponses, expectedFitnessResponses, fitnessCompletionRate]
  );

  const pieData = useMemo(
    () => [
      { name: "Complete", value: coverage },
      { name: "Outstanding", value: Math.max(0, 100 - coverage) },
    ],
    [coverage]
  );

  // Generate bar chart data from real individuals
  const certificationData = useMemo(() => {
    if (individuals.length === 0) {
      return [];
    }

    return individuals.map((individual) => {
      // Count how many responsibilities this individual owns
      const ownedResponsibilities = Object.values(responsibilityOwners).filter((id) => id === individual.id).length;

      // Count fitness responses for this individual
      // New questionId format: "individualId::sectionId::questionIndex"
      const individualResponses = fitnessResponses.filter((r) => {
        const [individualId] = r.questionId.split("::");
        return individualId === individual.id;
      }).length;

      // Calculate completion (30 total questions across 3 FIT sections)
      const totalQuestions = FIT_QUESTIONS_PER_INDIVIDUAL;
      const completionPercentage = totalQuestions > 0
        ? Math.round((individualResponses / totalQuestions) * 100)
        : 0;

      return {
        name: individual.name.substring(0, 12),
        complete: completionPercentage,
        outstanding: 100 - completionPercentage,
      };
    });
  }, [individuals, responsibilityOwners, fitnessResponses, FIT_QUESTIONS_PER_INDIVIDUAL]);

  const nextActions = useMemo(
    () =>
      buildNextActions({
        firmProfile,
        individuals,
        responsibilityAssignments,
        responsibilityOwners,
        responsibilityEvidence,
        fitnessResponses,
      }),
    [
      firmProfile,
      individuals,
      responsibilityAssignments,
      responsibilityOwners,
      responsibilityEvidence,
      fitnessResponses,
    ]
  );

  const boardReadiness = useMemo(
    () =>
      calculateBoardReadiness({
        firmProfile,
        individuals,
        responsibilityAssignments,
        responsibilityOwners,
        responsibilityEvidence,
        fitnessResponses,
      }),
    [
      firmProfile,
      individuals,
      responsibilityAssignments,
      responsibilityOwners,
      responsibilityEvidence,
      fitnessResponses,
    ]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="glass-panel p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald">live preview</p>
        <h3 className="text-2xl">Report outputs</h3>
        <p className="text-sm text-sand/70">Real-time metrics from your SMCR journey progress.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-sand/70">Board readiness</p>
          <span
            className={`text-xs font-semibold ${
              boardReadiness.label === "Board-ready"
                ? "text-emerald"
                : boardReadiness.label === "In progress"
                ? "text-warning"
                : "text-sand/60"
            }`}
          >
            {boardReadiness.label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-bold text-emerald">{boardReadiness.score}</p>
          <p className="text-xs text-sand/60">/ {boardReadiness.maxScore}</p>
        </div>
        <div className="relative h-2 rounded-full bg-midnight/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald to-emerald/60 transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, boardReadiness.score))}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className={`rounded-2xl border px-4 py-3 transition-all ${
              insight.tone === "positive"
                ? "border-emerald/40 bg-emerald/5"
                : insight.tone === "warning"
                ? "border-warning/30 bg-warning/5"
                : "border-white/20 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm text-sand/70">{insight.label}</p>
                <p className={`text-xl font-semibold ${
                  insight.tone === "positive"
                    ? "text-emerald"
                    : insight.tone === "warning"
                    ? "text-warning"
                    : "text-sand"
                }`}>
                  {insight.value}
                </p>
              </div>
              <insight.icon className={`size-6 ${
                insight.tone === "positive"
                  ? "text-emerald"
                  : insight.tone === "warning"
                  ? "text-warning"
                  : "text-sand/70"
              }`} />
            </div>
            <p className="text-xs text-sand/60">{insight.subLabel}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-sand/70">Next actions</p>
          {nextActions.length === 0 && (
            <span className="text-xs font-semibold text-emerald">All set</span>
          )}
        </div>
        {nextActions.slice(0, 3).map((action) => (
          <div
            key={action.id}
            className={`rounded-xl border px-3 py-2 flex items-start justify-between gap-3 ${
              action.severity === "blocker"
                ? "border-warning/40 bg-warning/5"
                : action.severity === "warning"
                ? "border-white/15 bg-white/5"
                : "border-white/10 bg-white/0"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sand">{action.title}</p>
              <p className="text-xs text-sand/60">{action.detail}</p>
            </div>
            {action.ctaStep && (
              <button
                type="button"
                onClick={() => setActiveStep(action.ctaStep!)}
                className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-sand/80 hover:bg-white/5 transition"
              >
                Go
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-sand/70 mb-2">Responsibilities coverage</p>
        <div className="h-48">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={55} outerRadius={80} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip wrapperClassName="text-midnight" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-2xl bg-white/10" />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-sand/70 mb-2">Certification readiness by individual</p>
        <div className="h-48">
          {!mounted ? (
            <div className="h-full w-full animate-pulse rounded-2xl bg-white/10" />
          ) : certificationData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center">
              <p className="text-sm text-sand/50">Add SMF individuals to see certification progress</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={certificationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff22" />
                <XAxis dataKey="name" stroke="#E3E8EE" />
                <YAxis stroke="#E3E8EE" />
                <Tooltip wrapperClassName="text-midnight" />
                <Bar dataKey="complete" stackId="a" fill="#3CCB8B" radius={[8, 8, 0, 0]} />
                <Bar dataKey="outstanding" stackId="a" fill="#7F5AF0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
