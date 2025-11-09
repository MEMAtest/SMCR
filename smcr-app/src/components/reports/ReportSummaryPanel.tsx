"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, AlertTriangle, Award } from "lucide-react";
import { useSmcrStore } from "@/stores/useSmcrStore";

const PIE_COLORS = ["#3CCB8B", "#7F5AF0"];

export function ReportSummaryPanel() {
  const [mounted, setMounted] = useState(false);
  const coverage = useSmcrStore((state) => state.getResponsibilityCoverage());
  const individuals = useSmcrStore((state) => state.individuals);
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);

  // Calculate dynamic metrics
  const assignedCount = useMemo(() => Object.values(responsibilityAssignments).filter(Boolean).length, [responsibilityAssignments]);
  const ownedCount = useMemo(() => Object.values(responsibilityOwners).filter((id) => id).length, [responsibilityOwners]);
  const unassignedCount = assignedCount - ownedCount;

  const expectedFitnessResponses = individuals.length * 3; // 3 key FIT sections per individual
  const outstandingFitness = Math.max(0, expectedFitnessResponses - fitnessResponses.length);

  const insights = useMemo(
    () => [
      {
        label: "Responsibilities coverage",
        value: coverage > 0 ? `${coverage}%` : "–",
        subLabel: assignedCount > 0 ? `${assignedCount} prescribed responsibilities` : "No responsibilities assigned",
        icon: CheckCircle2,
        tone: "positive" as const,
      },
      {
        label: "Outstanding assignments",
        value: unassignedCount > 0 ? unassignedCount.toString() : "–",
        subLabel: unassignedCount > 0 ? "Responsibilities need owners" : "All assigned",
        icon: AlertTriangle,
        tone: unassignedCount > 0 ? ("warning" as const) : ("positive" as const),
      },
      {
        label: "FIT assessments",
        value: outstandingFitness > 0 ? outstandingFitness.toString() : individuals.length > 0 ? "Complete" : "–",
        subLabel: individuals.length > 0 ? `${individuals.length} individuals` : "No individuals added",
        icon: Award,
        tone: outstandingFitness === 0 && individuals.length > 0 ? ("positive" as const) : ("warning" as const),
      },
    ],
    [coverage, assignedCount, unassignedCount, outstandingFitness, individuals.length]
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

      // Calculate completion (6 total questions across 3 FIT sections with 2 questions each)
      const totalQuestions = 6;
      const completionPercentage = totalQuestions > 0
        ? Math.round((individualResponses / totalQuestions) * 100)
        : 0;

      return {
        name: individual.smfRole || individual.name.substring(0, 8),
        complete: completionPercentage,
        outstanding: 100 - completionPercentage,
      };
    });
  }, [individuals, responsibilityOwners, fitnessResponses]);

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

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className={`rounded-2xl border px-4 py-3 ${
              insight.tone === "positive" ? "border-emerald/40 bg-emerald/5" : "border-warning/30 bg-warning/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-sand/70">{insight.label}</p>
                <p className="text-xl font-semibold">{insight.value}</p>
              </div>
              <insight.icon className="size-6" />
            </div>
            <p className="text-xs text-sand/60">{insight.subLabel}</p>
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
