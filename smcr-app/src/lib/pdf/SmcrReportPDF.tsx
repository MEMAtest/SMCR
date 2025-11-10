import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { FirmProfile, Individual, FitnessResponse } from "@/lib/validation";
import type { PrescribedResponsibility } from "@/lib/smcr-data";
import { calculateAllRisks, getFirmRiskSummary } from "@/lib/fitness-risk-rating";

// Define PDF styles matching the brand's premium aesthetic
const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1A1B26",
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: "2 solid #3CCB8B",
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1A1B26",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1A1B26",
    marginTop: 24,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1 solid #E5E7EB",
  },
  subsectionHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#3CCB8B",
    marginTop: 16,
    marginBottom: 8,
  },
  table: {
    display: "flex",
    width: "100%",
    marginTop: 8,
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #F3F4F6",
    paddingVertical: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  tableCellBold: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  gridContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 16,
  },
  gridItem: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
  },
  label: {
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 11,
    color: "#1A1B26",
    fontFamily: "Helvetica-Bold",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    color: "#3CCB8B",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    paddingTop: 4,
    textAlign: "center",
  },
  listContent: {
    flex: 1,
    paddingTop: 2,
  },
  ownerTag: {
    fontSize: 8,
    color: "#3CCB8B",
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
    color: "#059669",
    alignSelf: "flex-start",
    marginTop: 8,
  },
  warningBadge: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    color: "#D97706",
    alignSelf: "flex-start",
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    borderTop: "1 solid #E5E7EB",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#6B7280",
  },
  riskBadgeHigh: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    color: "#DC2626",
    alignSelf: "flex-start",
  },
  riskBadgeMedium: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    color: "#F59E0B",
    alignSelf: "flex-start",
  },
  riskBadgeLow: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#FEF9C3",
    color: "#EAB308",
    alignSelf: "flex-start",
  },
  riskBadgeClear: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    color: "#059669",
    alignSelf: "flex-start",
  },
  riskItem: {
    backgroundColor: "#FEF9F3",
    padding: 8,
    marginBottom: 6,
    borderRadius: 4,
    borderLeft: "2 solid #F59E0B",
  },
});

export interface SmcrReportPDFProps {
  firmProfile: FirmProfile;
  individuals: Individual[];
  assignedResponsibilities: PrescribedResponsibility[];
  responsibilityOwners: Record<string, string>;
  fitnessResponses: FitnessResponse[];
}

export function SmcrReportPDF({
  firmProfile,
  individuals,
  assignedResponsibilities,
  responsibilityOwners,
  fitnessResponses,
}: SmcrReportPDFProps) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const ownedResponsibilities = assignedResponsibilities.filter((pr) => responsibilityOwners[pr.ref]);
  const unassignedCount = assignedResponsibilities.length - ownedResponsibilities.length;

  // Calculate risk assessments
  const fitnessData: Record<string, Record<string, any>> = {};
  fitnessResponses.forEach((response) => {
    const parts = response.questionId.split("::");
    if (parts.length === 3) {
      const [individualId, , questionId] = parts;
      if (!fitnessData[individualId]) {
        fitnessData[individualId] = {};
      }
      fitnessData[individualId][questionId] = {
        response: response.response,
        details: response.details,
        date: response.date,
      };
    }
  });

  const riskAssessments = calculateAllRisks(individuals, fitnessData);
  const firmRiskSummary = getFirmRiskSummary(riskAssessments);

  const getRiskBadgeStyle = (level: string) => {
    switch (level) {
      case "High":
        return styles.riskBadgeHigh;
      case "Medium":
        return styles.riskBadgeMedium;
      case "Low":
        return styles.riskBadgeLow;
      case "Clear":
        return styles.riskBadgeClear;
      default:
        return styles.riskBadgeClear;
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>SMCR Compliance Report</Text>
          <Text style={styles.subtitle}>{firmProfile.firmName || "Firm Name Not Provided"}</Text>
          <Text style={styles.subtitle}>Generated: {today}</Text>
        </View>

        {/* Executive Summary */}
        <Text style={styles.sectionHeader}>Executive Summary</Text>
        <View style={styles.gridContainer}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Firm Type</Text>
            <Text style={styles.value}>{firmProfile.firmType || "–"}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>SMCR Category</Text>
            <Text style={styles.value}>{firmProfile.smcrCategory || "–"}</Text>
          </View>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>SMF Individuals</Text>
            <Text style={styles.value}>{individuals.length}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Assigned Responsibilities</Text>
            <Text style={styles.value}>{assignedResponsibilities.length}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>With Owner</Text>
            <Text style={styles.value}>{ownedResponsibilities.length}</Text>
          </View>
        </View>

        {unassignedCount > 0 && (
          <View style={styles.warningBadge}>
            <Text>{unassignedCount} responsibilities require owner assignment</Text>
          </View>
        )}
        {unassignedCount === 0 && assignedResponsibilities.length > 0 && (
          <View style={styles.statusBadge}>
            <Text>All responsibilities assigned</Text>
          </View>
        )}

        {/* Firm Profile Details */}
        <Text style={styles.sectionHeader}>Firm Profile</Text>
        <View style={styles.gridContainer}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>CASS Firm</Text>
            <Text style={styles.value}>{firmProfile.isCASSFirm ? "Yes" : "No"}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Opt-Up Status</Text>
            <Text style={styles.value}>{firmProfile.optUp ? "Yes" : "No"}</Text>
          </View>
        </View>

        {/* Senior Manager Functions */}
        <Text style={styles.sectionHeader}>Senior Manager Functions</Text>
        {individuals.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#6B7280", fontStyle: "italic" }}>
            No SMF individuals added
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellBold}>Name</Text>
              <Text style={styles.tableCellBold}>SMF Role</Text>
              <Text style={styles.tableCellBold}>Owned PRs</Text>
            </View>
            {individuals.map((individual) => {
              const ownedCount = Object.values(responsibilityOwners).filter((id) => id === individual.id).length;
              return (
                <View key={individual.id} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{individual.name}</Text>
                  <Text style={styles.tableCell}>{individual.smfRoles.join(", ")}</Text>
                  <Text style={styles.tableCell}>{ownedCount}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Prescribed Responsibilities */}
        <Text style={styles.sectionHeader}>Prescribed Responsibilities</Text>
        {assignedResponsibilities.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#6B7280", fontStyle: "italic" }}>
            No responsibilities assigned
          </Text>
        ) : (
          assignedResponsibilities.map((resp) => {
            const owner = individuals.find((ind) => ind.id === responsibilityOwners[resp.ref]);
            return (
              <View key={resp.ref} style={styles.listItem}>
                <Text style={styles.bullet}>{resp.ref}</Text>
                <View style={styles.listContent}>
                  <Text style={{ fontSize: 9, color: "#1A1B26" }}>{resp.text}</Text>
                  {owner ? (
                    <Text style={styles.ownerTag}>
                      Owner: {owner.name} ({owner.smfRoles.join(", ")})
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 8, color: "#D97706", marginTop: 2 }}>
                      No owner assigned
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Fitness & Propriety Assessment */}
        <Text style={styles.sectionHeader}>Fitness & Propriety Assessment</Text>
        <View style={styles.gridContainer}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Individuals Assessed</Text>
            <Text style={styles.value}>{individuals.length}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Total Responses</Text>
            <Text style={styles.value}>{fitnessResponses.length}</Text>
          </View>
        </View>

        {individuals.length > 0 && (
          <>
            <Text style={styles.subsectionHeader}>Assessment Summary by Individual</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellBold}>Individual</Text>
                <Text style={styles.tableCellBold}>SMF Role</Text>
                <Text style={styles.tableCellBold}>Responses</Text>
              </View>
              {individuals.map((individual) => {
                const individualResponses = fitnessResponses.filter((r) => {
                  const [individualId] = r.questionId.split("::");
                  return individualId === individual.id;
                }).length;

                return (
                  <View key={individual.id} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{individual.name}</Text>
                    <Text style={styles.tableCell}>{individual.smfRoles.join(", ")}</Text>
                    <Text style={styles.tableCell}>{individualResponses} recorded</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Risk Assessment */}
        {riskAssessments.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Fitness & Propriety Risk Assessment</Text>

            {/* Firm-wide Risk Summary */}
            <Text style={styles.subsectionHeader}>Firm-wide Risk Summary</Text>
            <View style={styles.gridContainer}>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Total Individuals</Text>
                <Text style={styles.value}>{firmRiskSummary.total}</Text>
              </View>
              {firmRiskSummary.high > 0 && (
                <View style={styles.gridItem}>
                  <Text style={styles.label}>High Risk</Text>
                  <Text style={[styles.value, { color: "#DC2626" }]}>{firmRiskSummary.high}</Text>
                </View>
              )}
              {firmRiskSummary.medium > 0 && (
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Medium Risk</Text>
                  <Text style={[styles.value, { color: "#F59E0B" }]}>{firmRiskSummary.medium}</Text>
                </View>
              )}
              {firmRiskSummary.low > 0 && (
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Low Risk</Text>
                  <Text style={[styles.value, { color: "#EAB308" }]}>{firmRiskSummary.low}</Text>
                </View>
              )}
              {firmRiskSummary.clear > 0 && (
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Clear</Text>
                  <Text style={[styles.value, { color: "#059669" }]}>{firmRiskSummary.clear}</Text>
                </View>
              )}
            </View>

            {/* Individual Risk Assessments */}
            <Text style={styles.subsectionHeader}>Individual Risk Assessments</Text>
            {riskAssessments.map((assessment) => (
              <View key={assessment.individualId} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A1B26" }}>
                    {assessment.individualName}
                  </Text>
                  <Text style={getRiskBadgeStyle(assessment.riskLevel)}>
                    {assessment.riskLevel} Risk ({assessment.overallScore} pts)
                  </Text>
                </View>

                {/* Section Breakdown */}
                {assessment.sectionBreakdown.some((section) => section.score > 0) && (
                  <View style={{ marginTop: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 9, color: "#6B7280", marginBottom: 4 }}>Section Breakdown:</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {assessment.sectionBreakdown
                        .filter((section) => section.score > 0)
                        .map((section) => (
                          <View key={section.sectionRef} style={{ backgroundColor: "#F9FAFB", padding: 6, borderRadius: 4, flex: 1 }}>
                            <Text style={{ fontSize: 8, color: "#6B7280" }}>{section.sectionRef}</Text>
                            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1A1B26" }}>
                              {section.score} pts
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                )}

                {/* Flagged Questions */}
                {assessment.allFlaggedQuestions.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 9, color: "#6B7280", marginBottom: 4 }}>Flagged Concerns:</Text>
                    {assessment.allFlaggedQuestions.map((flagged, idx) => (
                      <View key={idx} style={styles.riskItem}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={{ fontSize: 8, color: "#1A1B26", flex: 1 }}>{flagged.questionText}</Text>
                          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#F59E0B" }}>
                            {flagged.riskWeight} pts
                          </Text>
                        </View>
                        {flagged.details && (
                          <Text style={{ fontSize: 7, color: "#6B7280", fontStyle: "italic", marginTop: 2 }}>
                            {flagged.details}
                          </Text>
                        )}
                        {flagged.date && (
                          <Text style={{ fontSize: 7, color: "#6B7280", marginTop: 2 }}>
                            Date: {flagged.date}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated with MEMA SMCR Tool | www.memaconsultants.com</Text>
          <Text>Page 1 of 1</Text>
          <Text>{today}</Text>
        </View>
      </Page>
    </Document>
  );
}
