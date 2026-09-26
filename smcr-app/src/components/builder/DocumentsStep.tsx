"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FileText, LayoutDashboard, Map, Presentation } from "lucide-react";
import { buildSorModel, getCategory, smfHolders } from "@/lib/workspace/derive";
import { formatDate } from "@/lib/workspace/dates";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { Badge, EmptyState, Panel, SectionTitle } from "@/components/ui";
import { IssueLink, useHealthIssues } from "./shared";

export function DocumentsStep() {
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();
  const category = getCategory(ws);
  const holders = smfHolders(ws);
  const docIssues = useHealthIssues(ws, today).filter((i) => i.area === "documents" && i.severity !== "info");

  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle
          title="Statements of Responsibilities"
          description="Every SMF manager needs a Statement of Responsibilities (SUP 10C.11). Review, edit and approve each one in the Documents module."
        />
        {holders.length === 0 ? (
          <EmptyState title="No SMF holders yet" description="Add senior managers first — each SMF holder gets a Statement of Responsibilities." />
        ) : (
          <ul className="divide-y divide-white/10">
            {holders.map((p) => {
              const sor = ws.sors[p.id];
              const model = buildSorModel(ws, p.id);
              const aiPending = !!sor?.aiDraft && !sor.aiDraft.acceptedBy;
              return (
                <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-sand">
                      {p.name} <span className="font-normal text-sand/60">· {p.smfs.map((s) => s.smfId).join(", ")}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sor?.status === "approved" ? (
                        <Badge tone="good">
                          Approved v{sor.version}
                          {sor.approvedOn && ` · ${formatDate(sor.approvedOn)}`}
                        </Badge>
                      ) : (
                        <Badge tone="warn">Draft</Badge>
                      )}
                      {aiPending && <Badge tone="plum">AI draft awaiting review</Badge>}
                      <Badge>{model?.prescribed.length ?? 0} PRs</Badge>
                      {(model?.other.length ?? 0) > 0 && <Badge>{model?.other.length} other</Badge>}
                    </div>
                  </div>
                  <Link
                    href={`/workspace/documents?tab=sor&person=${p.id}`}
                    className="inline-flex items-center gap-1 text-sm text-emerald underline-offset-4 hover:underline"
                  >
                    Open SoR
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {docIssues.length > 0 && (
          <ul className="-mx-2 mt-4 space-y-0.5 border-t border-white/10 pt-3">
            {docIssues.map((i) => (
              <li key={i.id}>
                <IssueLink issue={i} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {category === "enhanced" && (
          <DocLink
            href="/workspace/documents?tab=mrm"
            icon={<Map className="size-5" aria-hidden />}
            title="Management responsibilities map"
            description={ws.mrm.governanceSummary.trim() ? `Last reviewed ${formatDate(ws.mrm.lastReviewedOn)}.` : "Required for Enhanced firms (SYSC 25). Not started."}
          />
        )}
        <DocLink
          href="/workspace/documents?tab=board"
          icon={<Presentation className="size-5" aria-hidden />}
          title="Board pack"
          description="Summary of your SM&CR arrangements, gaps and upcoming obligations for the board."
        />
        <DocLink
          href="/workspace/documents?tab=sor"
          icon={<FileText className="size-5" aria-hidden />}
          title="All Statements of Responsibilities"
          description="Edit, version and export SoRs."
        />
        <DocLink
          href="/workspace"
          icon={<LayoutDashboard className="size-5" aria-hidden />}
          title="Dashboard"
          description="Health, next obligations and year-round modules (certification, conduct, references, calendar)."
        />
      </div>
    </div>
  );
}

function DocLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="glass-panel group flex items-start gap-3 p-5 transition hover:border-emerald/50">
      <span className="text-emerald">{icon}</span>
      <span>
        <span className="block font-semibold text-sand group-hover:text-emerald">{title}</span>
        <span className="block text-sm text-sand/70">{description}</span>
      </span>
    </Link>
  );
}
