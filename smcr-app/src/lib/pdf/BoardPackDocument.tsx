import { Text, View } from "@react-pdf/renderer";
import type { BoardFitRow, BoardPackModel, DocMeta, MrmModel } from "@/lib/export/models";
import type { Obligation } from "@/lib/workspace/obligations";
import type { HealthIssue } from "@/lib/workspace/health";
import { formatDate } from "@/lib/workspace/dates";
import { colors, H2, H3, KV, PdfShell, StatusLabel, Table, s } from "./common";

export interface BoardPackDocumentProps {
  meta: DocMeta;
  model: BoardPackModel;
}

type RosterRow = BoardPackModel["roster"][number];

export function BoardPackDocument({ meta, model }: BoardPackDocumentProps) {
  const counts = model.issueCounts;
  return (
    <PdfShell meta={meta} confidential={model.includeDisclosures}>
      <Text style={s.title}>SM&CR board pack</Text>
      <Text style={s.subtitle}>
        {model.firmName}
        {model.frn ? ` · FRN ${model.frn}` : ""} · {model.categoryLabel} firm
      </Text>

      <H2>1. Summary</H2>
      <KV k="SM&CR category" v={`${model.categoryLabel} — ${model.categoryReasons.join("; ")}`} />
      <KV k="Senior managers" v={String(model.roster.length)} />
      <KV k="People in F&P scope" v={String(model.fit.length)} />
      <KV k="Open issues" v={`${counts.blocker} blocker(s), ${counts.warning} warning(s), ${counts.info} note(s)`} />
      <KV k="Upcoming obligations" v={String(model.obligations.length)} />
      <View style={{ marginTop: 4 }}>
        {counts.blocker === 0 && counts.warning === 0 ? (
          <StatusLabel tone="good">No gaps found by the automated checks</StatusLabel>
        ) : (
          <StatusLabel tone={counts.blocker ? "bad" : "warn"}>Action required — see section 5</StatusLabel>
        )}
      </View>

      <H2>2. Senior managers</H2>
      <Table
        columns={[
          { header: "Name", width: 2, cell: (r: RosterRow) => (r.jobTitle ? `${r.name}\n${r.jobTitle}` : r.name) },
          { header: "SMF(s) and approval status", width: 4, cell: (r) => r.smfs.map((x) => `${x.id} ${x.title} — ${x.status}`).join("\n") },
          { header: "SoR", width: 1.3, cell: (r) => `v${r.sorVersion} ${r.sorStatus === "approved" ? "Approved" : "Draft"}` },
        ]}
        rows={model.roster}
        empty="No senior managers recorded."
      />

      <H2>3. Prescribed responsibilities</H2>
      <Table
        columns={[
          { header: "PR", width: 1, cell: (r: MrmModel["prs"][number]) => `${r.label}${r.verify ? " *" : ""}` },
          { header: "Responsibility", width: 3, cell: (r) => r.title },
          { header: "Holder", width: 2, cell: (r) => (r.ownerSmfs ? `${r.owner} (${r.ownerSmfs})` : r.owner) },
          { header: "Shared with", width: 1.6, cell: (r) => r.sharedWith.join(", ") || "—" },
        ]}
        rows={model.prs}
        empty="Prescribed responsibilities do not apply to this firm's category."
      />
      {model.prs.some((p) => p.verify) ? <Text style={s.small}>* To be verified against the live FCA Handbook.</Text> : null}

      <H2>4. Fitness and propriety</H2>
      <Table
        columns={[
          { header: "Person", width: 2, cell: (r: BoardFitRow) => `${r.name}\n${r.role}` },
          { header: "Answered", width: 1.1, cell: (r) => `${r.answered} / ${r.total}` },
          { header: "Disclosures", width: 1.1, cell: (r) => (r.unexplained ? `${r.disclosures} (${r.unexplained} unexplained)` : String(r.disclosures)) },
          { header: "Outcome", width: 1.6, cell: (r) => r.outcome },
          { header: "Assessed / next due", width: 1.6, cell: (r) => `${formatDate(r.assessedOn)}\n${r.nextDueOn ? `Next: ${formatDate(r.nextDueOn)}` : ""}` },
        ]}
        rows={model.fit}
        empty="No one currently requires an F&P assessment."
      />
      {model.includeDisclosures ? (
        <View>
          <H3>Disclosure details (confidential)</H3>
          <Text style={[s.small, { color: colors.bad, marginBottom: 4 }]}>
            Contains personal data that may include criminal offence data. Restrict circulation to those who need it and handle in line with
            the firm&apos;s data protection policy.
          </Text>
          {model.fit.filter((f) => f.details && f.details.length).length === 0 ? (
            <Text style={[s.p, s.small]}>No disclosures recorded.</Text>
          ) : (
            model.fit
              .filter((f) => f.details && f.details.length)
              .map((f) => (
                <View key={f.personId}>
                  <Text style={[s.bold, { marginTop: 6 }]} minPresenceAhead={40}>
                    {f.name}
                  </Text>
                  {f.details!.map((d, i) => (
                    <View key={i} style={s.box} wrap={false}>
                      <Text style={s.small}>{d.section}</Text>
                      <Text style={s.p}>{d.question}</Text>
                      <Text>
                        Answer: {d.answer}
                        {d.date ? ` · Date: ${formatDate(d.date)}` : ""}
                      </Text>
                      <Text>{d.details || "No explanation recorded."}</Text>
                    </View>
                  ))}
                </View>
              ))
          )}
        </View>
      ) : (
        <Text style={s.small}>Disclosure details are excluded from this pack. They are held in the F&P records.</Text>
      )}

      <H2>5. Issues requiring attention</H2>
      <Table
        columns={[
          { header: "Severity", width: 0.9, cell: (r: HealthIssue) => (r.severity === "blocker" ? "Blocker" : "Warning") },
          { header: "Issue", width: 4, cell: (r) => (r.detail ? `${r.title}\n${r.detail}` : r.title) },
          { header: "Reference", width: 1.2, cell: (r) => r.handbookRef ?? "" },
        ]}
        rows={model.issues}
        empty="No blockers or warnings found by the automated checks."
      />

      <H2>6. Next obligations</H2>
      <Table
        columns={[
          { header: "Due", width: 1.1, cell: (r: Obligation) => formatDate(r.dueOn) },
          { header: "Obligation", width: 4, cell: (r) => r.title },
          { header: "Status", width: 1, cell: (r) => (r.status === "overdue" ? "Overdue" : r.status === "due_soon" ? "Due soon" : "Upcoming") },
          { header: "Source", width: 1.6, cell: (r) => r.source },
        ]}
        rows={model.obligations}
        empty="No upcoming obligations."
      />
      <Text style={[s.small, { marginTop: 10 }]}>
        This pack is generated from the firm&apos;s SM&CR workspace using rules pack {model.rulesId}. Automated checks help identify gaps; they
        do not confirm compliance. Reference data should be confirmed against the live FCA Handbook.
      </Text>
    </PdfShell>
  );
}
