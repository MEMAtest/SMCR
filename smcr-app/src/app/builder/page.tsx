"use client";

import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
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
          {activeStep === "reports" && <BoardReport />}
          <SaveDraftButton />
        </WizardShell>
      </div>
    </main>
  );
}
