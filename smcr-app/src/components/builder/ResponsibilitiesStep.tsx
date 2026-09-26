"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategory, getWorkspacePRs, smfHolders } from "@/lib/workspace/derive";
import { useWorkspace } from "@/stores/useWorkspace";
import { Callout, Panel, SectionTitle } from "@/components/ui";
import { ResponsibilityMatrix } from "./ResponsibilityMatrix";
import { PrCard } from "./PrCard";
import { OtherResponsibilities } from "./OtherResponsibilities";
import { stepHref } from "./shared";

export function ResponsibilitiesStep() {
  const ws = useWorkspace((s) => s.ws);
  const category = getCategory(ws);
  const prs = getWorkspacePRs(ws);
  const holders = smfHolders(ws);

  if (!category) {
    return (
      <Callout tone="warn" title="Firm category needed">
        Complete the <Link href={stepHref("firm")} className="underline">firm profile</Link> first — the prescribed responsibilities that apply depend on your category.
      </Callout>
    );
  }

  if (category === "limited") {
    return (
      <Panel className="space-y-4">
        <SectionTitle title="No prescribed responsibilities apply" />
        <p className="text-sm text-sand/80">
          Limited Scope firms are not required to allocate prescribed responsibilities (SYSC 24 applies to Core and Enhanced firms only). Your senior
          managers still need Statements of Responsibilities describing what they are responsible for, and the Conduct Rules and Certification Regime
          still apply.
        </p>
        <p className="text-sm text-sand/80">You can move straight on to fitness and propriety assessments.</p>
        <Link
          href={stepHref("fitness")}
          className="inline-flex items-center gap-2 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-midnight hover:bg-emerald/90"
        >
          Continue to Fitness &amp; propriety
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle
          title="Responsibility map"
          description={`${prs.length} prescribed responsibilities apply to your firm (SYSC 24.2.6R). Each must be allocated to one SMF manager; sharing is allowed only where genuinely shared and explained.`}
        />
        <ResponsibilityMatrix ws={ws} prs={prs} holders={holders} />
      </Panel>

      <Panel>
        <SectionTitle title="Prescribed responsibilities" description="Only responsibilities that apply to your firm's category and profile are shown." />
        <div className="space-y-4">
          {prs.map((pr) => (
            <PrCard key={pr.id} ws={ws} pr={pr} holders={holders} />
          ))}
        </div>
      </Panel>

      {category === "enhanced" && <OtherResponsibilities ws={ws} kind="overall" holders={holders} />}
      <OtherResponsibilities ws={ws} kind="additional" holders={holders} />
    </div>
  );
}
