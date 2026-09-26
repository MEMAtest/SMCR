"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, FileText, Map as MapIcon } from "lucide-react";
import { Badge, Callout, Checkbox, Panel, SectionTitle, SeverityIcon, VerifyBadge, downloadFile } from "@/components/ui";
import { formatDate } from "@/lib/workspace/dates";
import { useToday, useWorkspace } from "@/stores/useWorkspace";
import { peopleRegisterCsv, responsibilitiesMatrixCsv } from "@/lib/export/csv";
import { buildBoardPackModel, buildMrmModel, docMeta, exportFilename } from "@/lib/export/models";
import { DataTable, ExportButton } from "./shared";

export function BoardTab() {
  const ws = useWorkspace((s) => s.ws);
  const today = useToday();
  const [includeDisclosures, setIncludeDisclosures] = useState(false);
  const model = useMemo(() => buildBoardPackModel(ws, today, false), [ws, today]);

  const firm = ws.firm.name;
  const exportBoardPdf = async () => {
    const { generateBoardPackPdf } = await import("@/lib/pdf/generate");
    const blob = await generateBoardPackPdf({
      meta: docMeta(ws, "SM&CR board pack", today),
      model: buildBoardPackModel(ws, today, includeDisclosures),
    });
    downloadFile(blob, exportFilename(firm, includeDisclosures ? "board-pack-confidential" : "board-pack", today, "pdf"));
  };
  const exportMrmPdf = async () => {
    const mrm = buildMrmModel(ws);
    const { generateMrmPdf } = await import("@/lib/pdf/generate");
    const blob = await generateMrmPdf({ meta: docMeta(ws, mrm.enhanced ? "Management responsibilities map" : "Responsibilities overview", today), model: mrm });
    downloadFile(blob, exportFilename(firm, mrm.enhanced ? "responsibilities-map" : "responsibilities-overview", today, "pdf"));
  };
  const exportMatrix = async () => downloadFile(responsibilitiesMatrixCsv(ws), exportFilename(firm, "responsibilities-matrix", today, "csv"), "text/csv;charset=utf-8");
  const exportPeople = async () => downloadFile(peopleRegisterCsv(ws), exportFilename(firm, "people-register", today, "csv"), "text/csv;charset=utf-8");

  const { blocker, warning, info } = model.issueCounts;

  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle title="Exports" description="PDFs are generated in your browser; nothing is sent to a server." />
        <div className="space-y-4">
          <Checkbox
            label="Include disclosure details in the board pack"
            hint="Adds each adverse F&P answer and its explanation. Off by default."
            checked={includeDisclosures}
            onChange={setIncludeDisclosures}
          />
          {includeDisclosures && (
            <Callout tone="warn" title="Sensitive personal data">
              Disclosure details can include criminal offence and financial data about individuals (UK GDPR Article 10). Only share this version with people who need it, store it
              securely and follow your data protection policy. The PDF will be marked confidential.
            </Callout>
          )}
          <div className="flex flex-wrap gap-3">
            <ExportButton label="Board pack PDF" run={exportBoardPdf} variant="primary" icon={<FileText className="size-4" aria-hidden />} />
            <ExportButton label="Responsibilities map PDF" run={exportMrmPdf} icon={<MapIcon className="size-4" aria-hidden />} />
            <ExportButton label="Responsibilities matrix CSV" run={exportMatrix} icon={<FileSpreadsheet className="size-4" aria-hidden />} />
            <ExportButton label="People register CSV" run={exportPeople} icon={<FileSpreadsheet className="size-4" aria-hidden />} />
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="Firm" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-sand/60">Firm</dt>
            <dd className="text-sand">
              {model.firmName}
              {model.frn ? ` · FRN ${model.frn}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sand/60">SM&CR category</dt>
            <dd className="text-sand">
              {model.categoryLabel} <span className="text-sand/60">— {model.categoryReasons.join("; ")}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sand/60">Checks</dt>
            <dd className="flex flex-wrap gap-2">
              <Badge tone={blocker ? "bad" : "good"}>{blocker} blockers</Badge>
              <Badge tone={warning ? "warn" : "good"}>{warning} warnings</Badge>
              <Badge tone="info">{info} notes</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sand/60">Rules pack</dt>
            <dd className="text-sand">{model.rulesId}</dd>
          </div>
        </dl>
      </Panel>

      <Panel>
        <SectionTitle title="Senior managers" />
        <DataTable
          headers={["Name", "SMFs and approval status", "SoR"]}
          rows={model.roster.map((r) => [
            <span key="n">
              {r.name}
              {r.jobTitle && <span className="block text-xs text-sand/60">{r.jobTitle}</span>}
            </span>,
            <ul key="s" className="space-y-1">
              {r.smfs.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {x.id} {x.title}
                  </span>
                  <Badge tone={x.approved ? "good" : "warn"}>{x.status}</Badge>
                </li>
              ))}
            </ul>,
            <Badge key="v" tone={r.sorStatus === "approved" ? "good" : "neutral"}>
              v{r.sorVersion} {r.sorStatus === "approved" ? "Approved" : "Draft"}
            </Badge>,
          ])}
          empty="No senior managers recorded."
        />
      </Panel>

      <Panel>
        <SectionTitle title="Prescribed responsibilities" />
        <DataTable
          headers={["PR", "Responsibility", "Holder", "Shared with"]}
          rows={model.prs.map((p) => [
            <span key="l" className="inline-flex flex-wrap items-center gap-1">
              {p.label} {p.verify && <VerifyBadge />}
            </span>,
            p.title,
            p.owner === "Unallocated" ? <Badge tone="bad">Unallocated</Badge> : `${p.owner}${p.ownerSmfs ? ` (${p.ownerSmfs})` : ""}`,
            p.sharedWith.join(", ") || "—",
          ])}
          empty="Prescribed responsibilities do not apply to this firm's category."
        />
      </Panel>

      <Panel>
        <SectionTitle title="Fitness and propriety" description="Counts only. Disclosure details stay in the F&P records unless you choose to include them in the PDF." />
        <DataTable
          headers={["Person", "Questions answered", "Disclosures", "Outcome", "Assessed", "Next due"]}
          rows={model.fit.map((f) => [
            <Link key="n" href={`/builder?step=fitness&person=${f.personId}`} className="text-emerald underline-offset-4 hover:underline">
              {f.name}
              <span className="block text-xs text-sand/60">{f.role}</span>
            </Link>,
            `${f.answered} / ${f.total}`,
            f.unexplained ? (
              <Badge key="d" tone="warn">
                {f.disclosures} ({f.unexplained} unexplained)
              </Badge>
            ) : (
              String(f.disclosures)
            ),
            f.outcome,
            formatDate(f.assessedOn),
            formatDate(f.nextDueOn),
          ])}
          empty="No one currently needs an F&P assessment."
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Issues requiring attention" />
          {model.issues.length === 0 ? (
            <p className="text-sm text-sand/70">No blockers or warnings found by the automated checks.</p>
          ) : (
            <ul className="space-y-2">
              {model.issues.map((i) => (
                <li key={i.id} className="flex gap-2 text-sm">
                  <SeverityIcon severity={i.severity} className="mt-0.5" />
                  <span>
                    {i.href ? (
                      <Link href={i.href} className="text-sand underline-offset-4 hover:underline">
                        {i.title}
                      </Link>
                    ) : (
                      i.title
                    )}
                    {i.detail && <span className="block text-xs text-sand/60">{i.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <SectionTitle
            title="Next obligations"
            actions={
              <Link href="/workspace/calendar" className="text-sm text-emerald underline-offset-4 hover:underline">
                Calendar
              </Link>
            }
          />
          {model.obligations.length === 0 ? (
            <p className="text-sm text-sand/70">No upcoming obligations.</p>
          ) : (
            <ul className="space-y-2">
              {model.obligations.map((o) => (
                <li key={o.key} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 pb-2 text-sm">
                  <span className="min-w-0 flex-1 text-sand">{o.title}</span>
                  <Badge tone={o.status === "overdue" ? "bad" : o.status === "due_soon" ? "warn" : "neutral"}>{formatDate(o.dueOn)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
