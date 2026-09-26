import { Text, View } from "@react-pdf/renderer";
import type { DocMeta, MrmModel } from "@/lib/export/models";
import { formatDate } from "@/lib/workspace/dates";
import { H2, H3, KV, Paragraphs, PdfShell, Table, s } from "./common";

export interface MrmDocumentProps {
  meta: DocMeta;
  model: MrmModel;
}

type PrRow = MrmModel["prs"][number];
type SmfRow = MrmModel["smfs"][number];
type OverallRow = MrmModel["overall"][number];

export function MrmDocument({ meta, model }: MrmDocumentProps) {
  return (
    <PdfShell meta={meta}>
      <Text style={s.title}>{model.enhanced ? "Management responsibilities map" : "Responsibilities overview"}</Text>
      <Text style={s.subtitle}>
        {meta.firmName} · {model.categoryLabel} firm
      </Text>
      {!model.enhanced ? (
        <Text style={[s.p, s.small]}>
          A management responsibilities map is required only for Enhanced firms (SYSC 25). This overview is an optional artefact that
          summarises how senior management responsibilities are allocated.
        </Text>
      ) : null}
      <KV k="Last reviewed" v={formatDate(model.lastReviewedOn)} />
      <KV k="Approved by" v={model.approvedBy || "—"} />

      {model.enhanced ? (
        <View>
          <H2>1. Governance arrangements</H2>
          <Paragraphs text={model.governanceSummary} />
          <H2>2. Reporting lines</H2>
          <Paragraphs text={model.reportingLines} />
          <H2>3. Committees</H2>
          {model.committees.length === 0 ? (
            <Text style={[s.p, s.small]}>No committees recorded.</Text>
          ) : (
            model.committees.map((c, i) => (
              <View key={i} style={s.box} wrap={false}>
                <Text style={s.bold}>{c.name}</Text>
                {c.purpose ? <Text style={s.p}>{c.purpose}</Text> : null}
                <Text style={s.small}>Chair: {c.chair}</Text>
                <Text style={s.small}>Members: {c.members.join(", ") || "—"}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      <H2>{model.enhanced ? "4. " : ""}Prescribed responsibilities</H2>
      <Table
        columns={[
          { header: "PR", width: 1.1, cell: (r: PrRow) => `${r.label}${r.verify ? " *" : ""}` },
          { header: "Responsibility", width: 3, cell: (r) => r.title },
          { header: "Holder", width: 2, cell: (r) => (r.ownerSmfs ? `${r.owner} (${r.ownerSmfs})` : r.owner) },
          { header: "Shared with", width: 1.8, cell: (r) => r.sharedWith.join(", ") || "—" },
        ]}
        rows={model.prs}
        empty={model.enhanced ? "No prescribed responsibilities apply." : "Prescribed responsibilities do not apply to this firm's category."}
      />
      {model.prs.some((p) => p.verify) ? (
        <Text style={s.small}>* Letter or wording to be verified against the live FCA Handbook.</Text>
      ) : null}

      <H2>{model.enhanced ? "5. " : ""}Overall responsibilities</H2>
      <Table
        columns={[
          { header: "Activity, business area or function", width: 3, cell: (r: OverallRow) => (r.description ? `${r.title} — ${r.description}` : r.title) },
          { header: "Holder", width: 1.5, cell: (r) => r.holder },
        ]}
        rows={model.overall}
        empty="No overall responsibilities recorded."
      />

      <H2>{model.enhanced ? "6. " : ""}Senior management functions</H2>
      <Table
        columns={[
          { header: "SMF", width: 0.8, cell: (r: SmfRow) => r.id },
          { header: "Function", width: 2.2, cell: (r) => r.title },
          { header: "Held by", width: 3, cell: (r) => r.holders.map((h) => `${h.name} (${h.status})`).join("; ") },
        ]}
        rows={model.smfs}
        empty="No senior management functions recorded."
      />
      <H3>Note</H3>
      <Text style={s.small}>
        Generated from the firm&apos;s SM&CR workspace. The map should be kept up to date and be available to the FCA on request (SYSC 25).
      </Text>
    </PdfShell>
  );
}
