import type { ReactNode } from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DocMeta } from "@/lib/export/models";
import { formatDate } from "@/lib/workspace/dates";

/**
 * Shared building blocks for all PDFs. This module statically imports
 * @react-pdf/renderer, so it must only ever be reached via dynamic import()
 * (see ./generate.tsx) to keep the renderer out of the page bundle.
 */

export const colors = {
  ink: "#111826",
  muted: "#4B5563",
  faint: "#9CA3AF",
  rule: "#D1D5DB",
  zebra: "#F3F4F6",
  accent: "#1FA471",
  warn: "#B45309",
  bad: "#B91C1C",
};

const A4_HEIGHT = 841.89;

export const s = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.4,
    paddingTop: 70,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 0.75,
    borderBottomColor: colors.rule,
    paddingBottom: 6,
  },
  headerFirm: { fontFamily: "Helvetica-Bold", fontSize: 9, color: colors.ink },
  headerTitle: { fontSize: 8.5, color: colors.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    height: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: colors.rule,
    paddingTop: 6,
    fontSize: 7.5,
    color: colors.muted,
  },
  pageNumber: {
    // Anchored from the top (A4 = 841.89pt): react-pdf 4 mis-measures render-prop Text height,
    // which throws a bottom-anchored node off the page.
    position: "absolute",
    top: A4_HEIGHT - 24 - 23.5,
    left: 48,
    right: 48,
    paddingTop: 6.75,
    textAlign: "right",
    fontSize: 7.5,
    color: colors.muted,
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 70,
    fontSize: 120,
    fontFamily: "Helvetica-Bold",
    color: "#E5E7EB",
    opacity: 0.6,
    transform: "rotate(-35deg)",
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, lineHeight: 1.2, marginBottom: 6 },
  subtitle: { fontSize: 10, color: colors.muted, marginBottom: 14 },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 2 },
  p: { marginBottom: 4 },
  small: { fontSize: 8, color: colors.muted },
  bold: { fontFamily: "Helvetica-Bold" },
  kvRow: { flexDirection: "row", marginBottom: 3 },
  kvKey: { width: 150, color: colors.muted },
  kvVal: { flex: 1 },
  table: { borderWidth: 0.75, borderColor: colors.rule, marginTop: 4, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.rule },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, backgroundColor: colors.zebra, padding: 4 },
  td: { fontSize: 8.5, padding: 4 },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  box: { borderWidth: 0.75, borderColor: colors.rule, borderRadius: 3, padding: 8, marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
});

export function PdfShell({
  meta,
  children,
  watermark,
  confidential,
}: {
  meta: DocMeta;
  children: ReactNode;
  watermark?: string;
  confidential?: boolean;
}) {
  return (
    <Document title={`${meta.title} — ${meta.firmName}`} author={meta.firmName} creator="SM&CR Studio" producer="SM&CR Studio">
      <Page size="A4" style={s.page} wrap>
        {watermark ? (
          <Text style={s.watermark} fixed>
            {watermark}
          </Text>
        ) : null}
        <View style={s.header} fixed>
          <Text style={s.headerFirm}>{meta.firmName}</Text>
          <Text style={s.headerTitle}>
            {meta.title}
            {confidential ? "  |  CONFIDENTIAL" : ""}
            {watermark ? `  |  ${watermark}` : ""}
          </Text>
        </View>
        <View style={s.footer} fixed>
          <Text>
            Generated {formatDate(meta.generatedOn)} · Rules pack {meta.rulesId}
          </Text>
        </View>
        {/* Own absolute node with a placeholder child: react-pdf 4 drops an empty render-prop Text inside a flex row. */}
        <Text style={s.pageNumber} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}>
          {" "}
        </Text>
        {children}
      </Page>
    </Document>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <Text style={s.h2} minPresenceAhead={60}>
      {children}
    </Text>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <Text style={s.h3} minPresenceAhead={30}>
      {children}
    </Text>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <View style={s.kvRow} wrap={false}>
      <Text style={s.kvKey}>{k}</Text>
      <Text style={s.kvVal}>{v}</Text>
    </View>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatusLabel({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  const c = tone === "good" ? colors.accent : tone === "warn" ? colors.warn : tone === "bad" ? colors.bad : colors.muted;
  return <Text style={[s.label, { color: c, borderWidth: 0.75, borderColor: c }]}>{children}</Text>;
}

export interface Column<T> {
  header: string;
  /** flex weight */
  width: number;
  cell: (row: T) => string;
}

/** Simple table; the header row repeats on each page, rows never split across pages. */
export function Table<T>({ columns, rows, empty = "None recorded." }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  if (rows.length === 0) return <Text style={[s.p, s.small]}>{empty}</Text>;
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        {columns.map((c, i) => (
          <Text key={i} style={[s.th, { flex: c.width }]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.tr, ri % 2 === 1 ? { backgroundColor: "#FAFAFA" } : {}]} wrap={false}>
          {columns.map((c, ci) => (
            <Text key={ci} style={[s.td, { flex: c.width }]}>
              {c.cell(r)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Split free text into paragraphs for nicer wrapping. */
export function Paragraphs({ text, empty = "Not provided." }: { text: string; empty?: string }) {
  const paras = text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return <Text style={[s.p, s.small]}>{empty}</Text>;
  return (
    <View>
      {paras.map((p, i) => (
        <Text key={i} style={s.p}>
          {p}
        </Text>
      ))}
    </View>
  );
}
