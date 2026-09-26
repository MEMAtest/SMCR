import { Text, View } from "@react-pdf/renderer";
import type { DocMeta, SorHistoryEntry } from "@/lib/export/models";
import type { SorModel } from "@/lib/workspace/derive";
import { formatDate } from "@/lib/workspace/dates";
import { Bullets, H2, H3, KV, Paragraphs, PdfShell, StatusLabel, Table, s } from "./common";

export interface SorDocumentProps {
  meta: DocMeta;
  model: SorModel;
  categoryLabel: string;
  status: "draft" | "approved";
  version: number;
  history: SorHistoryEntry[];
  smfStatusLabels: Record<string, string>;
}

export function SorDocument({ meta, model, categoryLabel, status, version, history, smfStatusLabels }: SorDocumentProps) {
  const approved = status === "approved";
  const additional = model.other.filter((o) => o.kind === "additional");
  const overall = model.other.filter((o) => o.kind === "overall");
  return (
    <PdfShell meta={meta} watermark={approved ? undefined : "DRAFT"}>
      <Text style={s.title}>Statement of Responsibilities</Text>
      <Text style={s.subtitle}>
        {model.person.name} · {model.smfs.map((x) => x.id).join(", ") || "No SMF"} · Version {version}
      </Text>
      <View style={{ marginBottom: 8 }}>
        {approved ? (
          <StatusLabel tone="good">
            APPROVED by {model.approvedBy || "—"} on {formatDate(model.approvedOn)}
          </StatusLabel>
        ) : (
          <StatusLabel tone="warn">DRAFT — not approved for submission</StatusLabel>
        )}
      </View>

      <H2>Section 1 — Personal and senior management function details</H2>
      <KV k="Full name" v={model.person.name} />
      <KV k="Job title" v={model.person.jobTitle || "—"} />
      <KV k="Firm" v={model.firmName || "—"} />
      <KV k="Firm reference number" v={model.frn || "—"} />
      <KV k="SM&CR category" v={categoryLabel} />
      <KV k="Effective date of this version" v={approved ? formatDate(model.approvedOn) : "To be confirmed on approval"} />
      <H3>Senior management functions</H3>
      <Table
        columns={[
          { header: "Function", width: 1, cell: (r: SorModel["smfs"][number]) => r.id },
          { header: "Title", width: 3, cell: (r) => r.title },
          { header: "Approval status", width: 2, cell: (r) => smfStatusLabels[r.status] ?? r.status },
        ]}
        rows={model.smfs}
        empty="No senior management functions recorded."
      />

      <H2>Section 2 — Prescribed responsibilities</H2>
      {model.prescribed.length === 0 ? (
        <Text style={[s.p, s.small]}>
          {model.category === "limited"
            ? "Prescribed responsibilities do not apply to Limited Scope firms."
            : "No prescribed responsibilities are allocated to this senior manager."}
        </Text>
      ) : (
        model.prescribed.map((pr) => (
          <View key={pr.id} style={s.box} wrap={false}>
            <Text style={s.bold}>
              {pr.label} — {pr.title}
            </Text>
            <Text style={s.p}>{pr.text}</Text>
            {pr.shared ? (
              <Text style={s.small}>Shared with: {pr.sharedWith.join(", ") || "—"}</Text>
            ) : null}
            {pr.notes ? <Text style={s.small}>How this is discharged / split: {pr.notes}</Text> : null}
          </View>
        ))
      )}

      <H2>Section 3 — Other responsibilities and additional information</H2>
      {overall.length > 0 ? (
        <View>
          <H3>Overall responsibilities (SYSC 26)</H3>
          <Bullets items={overall.map((o) => (o.description ? `${o.title}: ${o.description}` : o.title))} />
        </View>
      ) : null}
      {additional.length > 0 ? (
        <View>
          <H3>Other responsibilities</H3>
          <Bullets items={additional.map((o) => (o.description ? `${o.title}: ${o.description}` : o.title))} />
        </View>
      ) : null}
      <H3>Additional responsibilities and information</H3>
      <Paragraphs text={model.additionalText} empty="None." />
      <H3>Reporting line</H3>
      <Paragraphs text={model.reportingLine} />
      <H3>Committee memberships</H3>
      <Paragraphs text={model.committees} empty="None recorded." />

      <H2>Version control and approval</H2>
      <KV k="Version" v={String(version)} />
      <KV k="Status" v={approved ? "Approved" : "Draft"} />
      <KV k="Approved by" v={approved ? model.approvedBy || "—" : "—"} />
      <KV k="Approved on" v={approved ? formatDate(model.approvedOn) : "—"} />
      {history.length > 0 ? (
        <Table
          columns={[
            { header: "Version", width: 1, cell: (h: SorHistoryEntry) => `v${h.version}` },
            { header: "Approved on", width: 2, cell: (h) => formatDate(h.date) },
            { header: "Summary", width: 5, cell: (h) => h.summary },
          ]}
          rows={[...history].reverse()}
        />
      ) : null}
      <Text style={[s.small, { marginTop: 8 }]}>
        Revised Statements of Responsibilities may be submitted to the FCA in batches, at least every six months (SUP 10C.11 as amended by
        PS26/6). Prepared in line with FG19/2. This document is a working draft for the firm and does not replace the FCA form.
      </Text>
    </PdfShell>
  );
}
