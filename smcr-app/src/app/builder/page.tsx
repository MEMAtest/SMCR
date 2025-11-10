"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Share2 } from "lucide-react";
import { FirmProfileForm } from "@/components/forms/FirmProfileForm";
import { ResponsibilitiesPreview } from "@/components/forms/ResponsibilitiesPreview";
import { SmfRoster } from "@/components/forms/SmfRoster";
import { ResponsibilityMatrix } from "@/components/forms/ResponsibilityMatrix";
import { FitnessChecklist } from "@/components/forms/FitnessChecklist";
import { WizardShell } from "@/components/wizard/WizardShell";
import { ReportSummaryPanel } from "@/components/reports/ReportSummaryPanel";
import { BoardReport } from "@/components/reports/BoardReport";
import { SaveDraftButton } from "@/components/wizard/SaveDraftButton";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { DraftLoader } from "@/components/wizard/DraftLoader";
import { Suspense } from "react";

// Configurable MEMA tool links via environment variables
const memaTools = [
  {
    name: "Vulnerability heatmap",
    href: process.env.NEXT_PUBLIC_MEMA_VULNERABILITY_URL || "https://vulnerability.memaconsultants.com",
    description: "Push flagged SMFs for deeper conduct analytics.",
  },
  {
    name: "FCA fines tracker",
    href: process.env.NEXT_PUBLIC_MEMA_FINES_URL || "https://fcafines.memaconsultants.com",
    description: "Benchmark exposure against current enforcement actions.",
  },
];

export default function BuilderPage() {
  const activeStep = useSmcrStore((state) => state.activeStep);

  return (
    <main className="px-4 py-20 sm:px-8">
      <Suspense fallback={null}>
        <DraftLoader />
      </Suspense>
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-sand/70">
            <ArrowLeft className="size-4" /> Back to overview
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-sand/80">
            <Share2 className="size-4" /> Auto-save to secure draft storage
          </div>
        </div>

        <WizardShell rightPanel={<ReportSummaryPanel />}>
          {/* Conditional rendering - show only active step */}
          {activeStep === "firm" && <FirmProfileForm />}
          {activeStep === "responsibilities" && (
            <>
              <SmfRoster />
              <ResponsibilitiesPreview />
              <ResponsibilityMatrix />
            </>
          )}
          {activeStep === "fitness" && <FitnessChecklist />}
          {activeStep === "reports" && (
            <>
              <BoardReport />
              <section className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl">Connect with MEMA tools</h3>
                  <ArrowUpRight className="size-6 text-emerald" />
                </div>
                <p className="text-sm text-sand/70">
                  Use the same data spine to open contextual experiences in the MEMA suite. These will share auth +
                  payloads once the API contract is finalised.
                </p>
                <div className="grid gap-4">
                  {memaTools.map((tool) => (
                    <Link
                      key={tool.name}
                      href={tool.href}
                      target="_blank"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-emerald/50"
                    >
                      <p className="font-semibold">{tool.name}</p>
                      <p className="text-sm text-sand/70">{tool.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
          <SaveDraftButton />
        </WizardShell>
      </div>
    </main>
  );
}
