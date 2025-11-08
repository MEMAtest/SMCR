"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { REPORT_INSIGHTS, SAMPLE_BAR } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";

const PIE_COLORS = ["#3CCB8B", "#7F5AF0"];

export function ReportSummaryPanel() {
  const [mounted, setMounted] = useState(false);
  const coverage = useSmcrStore((state) => state.getResponsibilityCoverage());

  const insights = useMemo(
    () =>
      REPORT_INSIGHTS.map((insight) =>
        insight.label === "Responsibilities coverage"
          ? { ...insight, value: `${coverage}%` }
          : insight
      ),
    [coverage]
  );

  const pieData = useMemo(
    () => [
      { name: "Complete", value: coverage },
      { name: "Outstanding", value: Math.max(0, 100 - coverage) },
    ],
    [coverage]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="glass-panel p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald">live preview</p>
        <h3 className="text-2xl">Report outputs</h3>
        <p className="text-sm text-sand/70">Push to MEMA vulnerability + FCA fines tools when ready.</p>
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
        <p className="text-sm text-sand/70 mb-2">Certification readiness</p>
        <div className="h-48">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SAMPLE_BAR}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff22" />
                <XAxis dataKey="name" stroke="#E3E8EE" />
                <YAxis stroke="#E3E8EE" />
                <Tooltip wrapperClassName="text-midnight" />
                <Bar dataKey="complete" stackId="a" fill="#3CCB8B" radius={[8, 8, 0, 0]} />
                <Bar dataKey="outstanding" stackId="a" fill="#7F5AF0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-2xl bg-white/10" />
          )}
        </div>
      </div>
    </div>
  );
}
