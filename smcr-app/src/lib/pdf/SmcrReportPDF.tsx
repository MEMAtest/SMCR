import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { FirmProfile, Individual, FitnessResponse } from "../validation";
import {
  FIRM_TYPES,
  FIT_SECTIONS,
  PSD_CATEGORIES,
  SMCR_CATEGORIES,
  SMF_ROLES,
  getApplicablePRs,
  getFirmRegime,
  type PrescribedResponsibility,
  type RegimeKey,
} from "../smcr-data";
import { calculateAllRisks, getFirmRiskSummary } from "../fitness-risk-rating";
import { buildNextActions } from "../insights/nextActions";
import { calculateBoardReadiness } from "../insights/boardReadiness";

const BRAND = {
  ink: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  bgSoft: "#F8FAFC",
  accent: "#10B981",
  accentInk: "#065F46",
  warningBg: "#FEF3C7",
  warningInk: "#92400E",
  dangerBg: "#FEE2E2",
  dangerInk: "#991B1B",
};

const styles = StyleSheet.create({
  coverPage: {
    padding: 48,
    fontFamily: "Helvetica",
    color: BRAND.ink,
    backgroundColor: "#FFFFFF",
  },
  coverAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: BRAND.accent,
  },
  coverEyebrow: {
    fontSize: 9,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginTop: 28,
  },
  coverTitle: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
  },
  coverFirm: {
    fontSize: 14,
    color: BRAND.muted,
    marginTop: 10,
  },
  coverMeta: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 6,
  },
  coverGrid: {
    flexDirection: "row",
    marginTop: 26,
  },
  cardSpaced: {
    marginRight: 12,
  },
  card: {
    flex: 1,
    border: `1 solid ${BRAND.border}`,
    backgroundColor: BRAND.bgSoft,
    borderRadius: 8,
    padding: 12,
  },
  cardLabel: {
    fontSize: 8,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardValue: {
    fontSize: 16,
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
  },
  cardValueMuted: {
    fontSize: 10,
    marginTop: 4,
    color: BRAND.muted,
  },
  coverActions: {
    marginTop: 18,
  },
  coverActionsTitle: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  coverActionCard: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: BRAND.border,
    borderRadius: 8,
  },
  coverActionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  coverActionChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  coverActionChipText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  coverActionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  coverActionDetail: {
    fontSize: 9,
    color: BRAND.muted,
    lineHeight: 12,
    marginTop: 4,
  },
  coverDisclaimer: {
    position: "absolute",
    bottom: 40,
    left: 48,
    right: 48,
    borderTop: `1 solid ${BRAND.border}`,
    paddingTop: 12,
    fontSize: 8,
    color: BRAND.muted,
    lineHeight: 11,
  },
  page: {
    paddingTop: 86,
    paddingBottom: 70,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.ink,
    backgroundColor: "#FFFFFF",
  },
  runningHeader: {
    position: "absolute",
    top: 32,
    left: 48,
    right: 48,
    paddingBottom: 10,
    borderBottom: `1 solid ${BRAND.border}`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  runningTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  runningMeta: {
    fontSize: 9,
    color: BRAND.muted,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTop: `1 solid ${BRAND.border}`,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 8,
    color: BRAND.muted,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 9,
    color: BRAND.muted,
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 12,
  },
  actionCard: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: BRAND.border,
    borderRadius: 8,
    backgroundColor: BRAND.bgSoft,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  actionChipText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  actionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  actionDetail: {
    fontSize: 9,
    color: BRAND.muted,
    lineHeight: 12,
    marginTop: 4,
  },
  table: {
    marginTop: 6,
    border: `1 solid ${BRAND.border}`,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: BRAND.bgSoft,
    borderBottom: `1 solid ${BRAND.border}`,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1 solid ${BRAND.border}`,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  th: {
    fontSize: 8,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "Helvetica-Bold",
  },
  td: {
    fontSize: 9,
    lineHeight: 12,
  },
  cellName: { flex: 1.2, paddingRight: 10 },
  cellRole: { flex: 1.8, paddingRight: 10 },
  cellSmall: { flex: 0.6, textAlign: "right" },
  cellRef: { flex: 0.45, paddingRight: 10 },
  cellResp: { flex: 2.35, paddingRight: 10 },
  cellOwner: { flex: 1.2 },
  italics: {
    fontSize: 9,
    color: BRAND.muted,
    fontStyle: "italic",
    marginTop: 6,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    alignSelf: "flex-start",
  },
  riskHigh: { backgroundColor: BRAND.dangerBg, color: BRAND.dangerInk },
  riskMedium: { backgroundColor: BRAND.warningBg, color: BRAND.warningInk },
  riskLow: { backgroundColor: "#FEF9C3", color: "#92400E" },
  riskClear: { backgroundColor: "#D1FAE5", color: BRAND.accentInk },
});

export interface SmcrReportPDFProps {
  firmProfile: FirmProfile;
  individuals: Individual[];
  responsibilityAssignments: Record<string, boolean>;
  responsibilityEvidence: Record<string, string>;
  assignedResponsibilities: PrescribedResponsibility[];
  responsibilityOwners: Record<string, string>;
  fitnessResponses: FitnessResponse[];
}

export function SmcrReportPDF({
  firmProfile,
  individuals,
  responsibilityAssignments,
  responsibilityEvidence,
  assignedResponsibilities,
  responsibilityOwners,
  fitnessResponses,
}: SmcrReportPDFProps) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const regime: RegimeKey = firmProfile.firmType ? getFirmRegime(firmProfile.firmType) : "SMCR";

  const firmTypeLabel = firmProfile.firmType ? (FIRM_TYPES[firmProfile.firmType]?.label ?? firmProfile.firmType) : "–";

  const categoryLabel = (() => {
    if (!firmProfile.smcrCategory) return "–";
    if (regime === "PSD") {
      return PSD_CATEGORIES.find((c) => c.key === firmProfile.smcrCategory)?.label ?? firmProfile.smcrCategory;
    }
    return SMCR_CATEGORIES.find((c) => c.key === firmProfile.smcrCategory)?.label ?? firmProfile.smcrCategory;
  })();

  const roleLabelByRef = new Map(SMF_ROLES.map((role) => [role.ref, role.label]));
  const formatRole = (ref: string) => {
    const label = roleLabelByRef.get(ref);
    return label ? `${label} (${ref})` : ref;
  };
  const formatRoles = (refs: string[]) => (refs.length ? refs.map(formatRole).join(", ") : "–");

  const ownedResponsibilities = assignedResponsibilities.filter((pr) => responsibilityOwners[pr.ref]);
  const unassignedCount = assignedResponsibilities.length - ownedResponsibilities.length;

  const nextActions = buildNextActions({
    firmProfile,
    individuals,
    responsibilityAssignments,
    responsibilityOwners,
    responsibilityEvidence,
    fitnessResponses,
  }).slice(0, 6);

  // FIT completion stats
  const fitQuestionsPerIndividual = FIT_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);
  const expectedFit = individuals.length * fitQuestionsPerIndividual;
  const answeredFit = fitnessResponses.filter((r) => r.response && r.response.trim().length > 0).length;
  const fitCompletion = expectedFit > 0 ? Math.round((answeredFit / expectedFit) * 100) : 0;

  // Risk assessments
  const fitnessData: Record<string, Record<string, any>> = {};
  fitnessResponses.forEach((response) => {
    const parts = response.questionId.split("::");
    if (parts.length === 3) {
      const [individualId, , questionId] = parts;
      if (!fitnessData[individualId]) fitnessData[individualId] = {};
      fitnessData[individualId][questionId] = {
        response: response.response,
        details: response.details,
        date: response.date,
      };
    }
  });

  const riskAssessments = calculateAllRisks(individuals, fitnessData);
  const firmRiskSummary = getFirmRiskSummary(riskAssessments);
  const riskById = new Map(riskAssessments.map((a) => [a.individualId, a]));

  const applicableResponsibilities = firmProfile.firmType
    ? getApplicablePRs(firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm ?? false)
    : [];
  const mandatoryApplicable = applicableResponsibilities.filter((r) => r.mandatory);
  const mandatoryOwnedCount = mandatoryApplicable.filter(
    (r) => responsibilityAssignments[r.ref] && !!responsibilityOwners[r.ref]
  ).length;

  const boardReadiness = calculateBoardReadiness({
    firmProfile,
    individuals,
    responsibilityAssignments,
    responsibilityOwners,
    responsibilityEvidence,
    fitnessResponses,
  });
  const boardReadinessScore = boardReadiness.score;
  const evidencePercent = boardReadiness.components.evidenceCompleteness.percent;

  const getRiskStyle = (level: string) => {
    switch (level) {
      case "High":
        return styles.riskHigh;
      case "Medium":
        return styles.riskMedium;
      case "Low":
        return styles.riskLow;
      case "Clear":
      default:
        return styles.riskClear;
    }
  };

  const reportTitle = regime === "PSD" ? "Board-ready Governance Report (PSD/EMR)" : "Board-ready SMCR Report";
  const rolesTitle = regime === "PSD" ? "Key roles" : "Senior manager functions";
  const responsibilitiesTitle = regime === "PSD" ? "Governance responsibilities" : "Prescribed responsibilities";

  const actionToneForSeverity = (severity: string) => {
    switch (severity) {
      case "blocker":
        return {
          cardBg: "#FFF7F7",
          cardBorder: "#FECACA",
          chipBg: BRAND.dangerBg,
          chipInk: BRAND.dangerInk,
        };
      case "warning":
        return {
          cardBg: "#FFFBEB",
          cardBorder: "#FDE68A",
          chipBg: BRAND.warningBg,
          chipInk: BRAND.warningInk,
        };
      default:
        return {
          cardBg: "#EFF6FF",
          cardBorder: "#BFDBFE",
          chipBg: "#DBEAFE",
          chipInk: "#1D4ED8",
        };
    }
  };

  const truncate = (value: string, maxLen: number) => {
    const trimmed = value.trim();
    if (trimmed.length <= maxLen) return trimmed;
    return trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
  };

  return (
    <Document title={reportTitle} author="MEMA Consultants">
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverAccent} />

        <Text style={styles.coverEyebrow}>MEMA Consultants</Text>
        <Text style={styles.coverTitle}>{reportTitle}</Text>
        <Text style={styles.coverFirm}>{firmProfile.firmName || "Firm Name Not Provided"}</Text>
        <Text style={styles.coverMeta}>Generated: {today}</Text>

        <View style={styles.coverGrid}>
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.cardLabel}>Firm Type</Text>
            <Text style={styles.cardValue}>{firmTypeLabel}</Text>
            <Text style={styles.cardValueMuted}>
              {regime === "PSD" ? "PSD/EMR perimeter" : "SM&CR perimeter"}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{regime === "PSD" ? "Payments Category" : "SMCR Category"}</Text>
            <Text style={styles.cardValue}>{categoryLabel}</Text>
            <Text style={styles.cardValueMuted}>
              {firmProfile.isCASSFirm ? "CASS firm" : "Non-CASS"} · {firmProfile.optUp ? "Opted up" : "Not opted up"}
            </Text>
          </View>
        </View>

        <View style={styles.coverGrid}>
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.cardLabel}>Individuals</Text>
            <Text style={styles.cardValue}>{individuals.length}</Text>
            <Text style={styles.cardValueMuted}>{rolesTitle}</Text>
          </View>
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.cardLabel}>Responsibilities Selected</Text>
            <Text style={styles.cardValue}>{assignedResponsibilities.length}</Text>
            <Text style={styles.cardValueMuted}>
              {ownedResponsibilities.length} owned · {unassignedCount} unassigned
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>FIT Completion</Text>
            <Text style={styles.cardValue}>{expectedFit > 0 ? `${fitCompletion}%` : "–"}</Text>
            <Text style={styles.cardValueMuted}>
              {expectedFit > 0 ? `${answeredFit} / ${expectedFit} answers recorded` : "No FIT questions loaded"}
            </Text>
          </View>
        </View>

        <View style={styles.coverGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Risk Snapshot</Text>
            <Text style={styles.cardValue}>
              {firmRiskSummary.high > 0
                ? `${firmRiskSummary.high} high`
                : firmRiskSummary.medium > 0
                  ? `${firmRiskSummary.medium} medium`
                  : "No red flags"}
            </Text>
            <Text style={styles.cardValueMuted}>
              High {firmRiskSummary.high} · Medium {firmRiskSummary.medium} · Low {firmRiskSummary.low} · Clear{" "}
              {firmRiskSummary.clear}
            </Text>
          </View>
        </View>

        <View style={styles.coverGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Board readiness</Text>
            <Text style={styles.cardValue}>{boardReadinessScore} / 100</Text>
            <Text style={styles.cardValueMuted}>
              Mandatory owned {mandatoryOwnedCount}/{mandatoryApplicable.length || "–"} · FIT {expectedFit > 0 ? `${fitCompletion}%` : "–"} · Evidence {evidencePercent}% · High {firmRiskSummary.high}
            </Text>
          </View>
        </View>

        <View style={styles.coverActions}>
          <Text style={styles.coverActionsTitle}>Priority actions</Text>
          {nextActions.length === 0 ? (
            <Text style={styles.italics}>No outstanding actions detected.</Text>
          ) : (
            nextActions.map((action) => {
              const tone = actionToneForSeverity(action.severity);
              return (
                <View
                  key={action.id}
                  style={[
                    styles.coverActionCard,
                    { backgroundColor: tone.cardBg, borderColor: tone.cardBorder },
                  ]}
                  wrap={false}
                >
                  <View style={styles.coverActionHeader}>
                    <View style={[styles.coverActionChip, { backgroundColor: tone.chipBg }]}>
                      <Text style={[styles.coverActionChipText, { color: tone.chipInk }]}>
                        {action.severity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.coverActionTitle}>{action.title}</Text>
                  </View>
                  <Text style={styles.coverActionDetail}>{action.detail}</Text>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.coverDisclaimer}>
          Internal board pack generated by the MEMA tool. Validate against current FCA/PRA expectations and your firm’s
          governance documents before submission or filing.
        </Text>
      </Page>

      {/* Content */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningTitle}>{reportTitle}</Text>
          <Text style={styles.runningMeta}>
            {(firmProfile.firmName || "Firm") + " · " + today}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>MEMA Consultants</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          <Text>memaconsultants.com</Text>
        </View>

        <Text style={styles.sectionTitle}>Priority actions</Text>
        <Text style={styles.hint}>
          This section highlights what to fix next to make the board pack complete and defensible.
        </Text>
        {nextActions.length === 0 ? (
          <Text style={styles.italics}>No outstanding actions detected.</Text>
        ) : (
          nextActions.map((action) => {
            const tone = actionToneForSeverity(action.severity);
            return (
              <View
                key={action.id}
                style={[styles.actionCard, { backgroundColor: tone.cardBg, borderColor: tone.cardBorder }]}
                wrap={false}
              >
                <View style={styles.actionHeader}>
                  <View style={[styles.actionChip, { backgroundColor: tone.chipBg }]}>
                    <Text style={[styles.actionChipText, { color: tone.chipInk }]}>
                      {action.severity.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                </View>
                <Text style={styles.actionDetail}>{action.detail}</Text>
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>{rolesTitle}</Text>
        {individuals.length === 0 ? (
          <Text style={styles.italics}>No individuals added.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.cellName]}>Individual</Text>
              <Text style={[styles.th, styles.cellRole]}>Role(s)</Text>
              <Text style={[styles.th, styles.cellSmall]}>Owned</Text>
              <Text style={[styles.th, styles.cellSmall]}>Risk</Text>
            </View>
            {individuals.map((individual, idx) => {
              const ownedCount = Object.values(responsibilityOwners).filter((id) => id === individual.id).length;
              const assessment = riskById.get(individual.id);
              const riskLevel = assessment?.riskLevel ?? "Clear";
              const rowStyle =
                idx === individuals.length - 1
                  ? [styles.tableRow, { borderBottom: "0 solid transparent" }]
                  : styles.tableRow;
              return (
                <View key={individual.id} style={rowStyle as any}>
                  <Text style={[styles.td, styles.cellName]}>{individual.name}</Text>
                  <Text style={[styles.td, styles.cellRole]}>{formatRoles(individual.smfRoles)}</Text>
                  <Text style={[styles.td, styles.cellSmall]}>{ownedCount}</Text>
                  <View style={[styles.cellSmall, { alignItems: "flex-end" }] as any}>
                    <Text style={[styles.badge, getRiskStyle(riskLevel)]}>{riskLevel}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>{responsibilitiesTitle}</Text>
        <Text style={styles.hint}>
          Selected responsibilities and the accountable owner. Unassigned items should be resolved before board approval.
        </Text>
        {assignedResponsibilities.length === 0 ? (
          <Text style={styles.italics}>No responsibilities selected.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.cellRef]}>Ref</Text>
              <Text style={[styles.th, styles.cellResp]}>Responsibility</Text>
              <Text style={[styles.th, styles.cellOwner]}>Owner</Text>
            </View>
            {assignedResponsibilities.map((resp, idx) => {
              const owner = individuals.find((ind) => ind.id === responsibilityOwners[resp.ref]);
              const ownerText = owner ? `${owner.name} — ${formatRoles(owner.smfRoles)}` : "Unassigned";
              const evidenceRaw = responsibilityEvidence?.[resp.ref] || "";
              const evidenceText = evidenceRaw.trim().length > 0 ? truncate(evidenceRaw, 90) : "–";
              const rowStyle =
                idx === assignedResponsibilities.length - 1
                  ? [styles.tableRow, { borderBottom: "0 solid transparent" }]
                  : styles.tableRow;
              return (
                <View key={resp.ref} style={rowStyle as any}>
                  <Text style={[styles.td, styles.cellRef]}>{resp.ref}</Text>
                  <Text style={[styles.td, styles.cellResp]}>
                    {resp.text}
                    {resp.mandatory ? "  (Required)" : ""}
                  </Text>
                  <View style={styles.cellOwner as any}>
                    <Text style={styles.td}>{ownerText}</Text>
                    <Text style={[styles.td, { fontSize: 8, color: BRAND.muted, marginTop: 2 }] as any}>
                      Evidence: {evidenceText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Fitness & Propriety</Text>
        <Text style={styles.hint}>
          Completion and risk snapshot based on FIT 2.1 to 2.3 answers recorded in the tool.
        </Text>

        <View style={styles.coverGrid}>
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.cardLabel}>FIT completion</Text>
            <Text style={styles.cardValue}>{expectedFit > 0 ? `${fitCompletion}%` : "–"}</Text>
            <Text style={styles.cardValueMuted}>
              {expectedFit > 0 ? `${answeredFit} / ${expectedFit} answers recorded` : "No FIT questions loaded"}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Risk counts</Text>
            <Text style={styles.cardValue}>{firmRiskSummary.total}</Text>
            <Text style={styles.cardValueMuted}>
              High {firmRiskSummary.high} · Medium {firmRiskSummary.medium} · Low {firmRiskSummary.low} · Clear{" "}
              {firmRiskSummary.clear}
            </Text>
          </View>
        </View>

        {individuals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Individual FIT summary</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.cellName]}>Individual</Text>
                <Text style={[styles.th, styles.cellRole]}>Role(s)</Text>
                <Text style={[styles.th, styles.cellSmall]}>Flags</Text>
                <Text style={[styles.th, styles.cellSmall]}>Risk</Text>
              </View>
              {individuals.map((individual, idx) => {
                const assessment = riskById.get(individual.id);
                const flags = assessment?.allFlaggedQuestions?.length ?? 0;
                const riskLevel = assessment?.riskLevel ?? "Clear";
                const rowStyle =
                  idx === individuals.length - 1
                    ? [styles.tableRow, { borderBottom: "0 solid transparent" }]
                    : styles.tableRow;
                return (
                  <View key={individual.id} style={rowStyle as any}>
                    <Text style={[styles.td, styles.cellName]}>{individual.name}</Text>
                    <Text style={[styles.td, styles.cellRole]}>{formatRoles(individual.smfRoles)}</Text>
                    <Text style={[styles.td, styles.cellSmall]}>{flags}</Text>
                    <View style={[styles.cellSmall, { alignItems: "flex-end" }] as any}>
                      <Text style={[styles.badge, getRiskStyle(riskLevel)]}>{riskLevel}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}
