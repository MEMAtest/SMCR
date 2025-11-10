"use client";

import { useSmcrStore } from "@/stores/useSmcrStore";
import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";
import { FileText, Download, Share2, CheckCircle2, AlertCircle, Users, Shield, Loader2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { generateAndDownloadPDF, generatePDFFilename } from "@/lib/pdf/generatePDF";
import { exportResponsibilitiesCSV } from "@/lib/csv/generateCSV";
import { calculateAllRisks, getRiskColorClass, getFirmRiskSummary } from "@/lib/fitness-risk-rating";

export function BoardReport() {
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const individuals = useSmcrStore((state) => state.individuals);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const validateStep = useSmcrStore((state) => state.validateStep);

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Calculate completeness
  const firmValidation = validateStep("firm");
  const respValidation = validateStep("responsibilities");
  const fitnessValidation = validateStep("fitness");

  const assignedResponsibilities = useMemo(
    () => PRESCRIBED_RESPONSIBILITIES.filter((pr) => responsibilityAssignments[pr.ref]),
    [responsibilityAssignments]
  );

  const ownedResponsibilities = useMemo(
    () => assignedResponsibilities.filter((pr) => responsibilityOwners[pr.ref]),
    [assignedResponsibilities, responsibilityOwners]
  );

  const completionStats = useMemo(() => {
    const total = 4; // 4 main sections
    let complete = 0;

    if (firmValidation.isValid) complete++;
    if (respValidation.isValid) complete++;
    if (fitnessValidation.isValid) complete++;
    if (individuals.length > 0 && ownedResponsibilities.length > 0) complete++;

    return {
      percentage: Math.round((complete / total) * 100),
      complete,
      total,
    };
  }, [firmValidation, respValidation, fitnessValidation, individuals.length, ownedResponsibilities.length]);

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      const filename = generatePDFFilename(firmProfile.firmName);
      await generateAndDownloadPDF(
        {
          firmProfile,
          individuals,
          assignedResponsibilities,
          responsibilityOwners,
          fitnessResponses,
        },
        filename
      );
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExportingCSV(true);
      exportResponsibilitiesCSV(
        assignedResponsibilities,
        responsibilityOwners,
        individuals,
        firmProfile.firmName
      );
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setIsExportingCSV(false);
    }
  };

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Calculate risk assessments for all individuals
  const riskAssessments = useMemo(() => {
    // Convert fitnessResponses array to nested object structure
    const fitnessData: Record<string, Record<string, any>> = {};

    fitnessResponses.forEach((response) => {
      // Parse questionId format: individualId::sectionId::questionId
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

    return calculateAllRisks(individuals, fitnessData);
  }, [individuals, fitnessResponses]);

  const firmRiskSummary = useMemo(() => {
    return getFirmRiskSummary(riskAssessments);
  }, [riskAssessments]);

  return (
    <div className="glass-panel p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 04</p>
          <h3 className="text-3xl font-display mt-2">Board-ready SMCR Report</h3>
          <p className="text-sm text-sand/70 mt-2">Generated {today}</p>
        </div>
        <FileText className="size-10 text-emerald" />
      </div>

      {/* Completion Overview */}
      <div className={`rounded-2xl border p-6 space-y-4 transition-all duration-500 ${
        completionStats.percentage === 100
          ? "border-emerald/50 bg-gradient-to-br from-emerald/10 via-emerald/5 to-transparent shadow-lg shadow-emerald/20"
          : "border-white/10 bg-white/5"
      }`}>
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-semibold">Journey Completion</h4>
          <div className={`text-3xl font-bold transition-all duration-500 ${
            completionStats.percentage === 100 ? "text-emerald scale-110" : "text-emerald"
          }`}>
            {completionStats.percentage}%
          </div>
        </div>
        <div className="relative h-3 rounded-full bg-midnight/60 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r transition-all duration-1000 ease-out ${
              completionStats.percentage === 100
                ? "from-emerald via-emerald to-emerald animate-pulse"
                : "from-emerald to-emerald/80"
            }`}
            style={{ width: `${completionStats.percentage}%` }}
          />
          {completionStats.percentage === 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>
        {completionStats.percentage === 100 ? (
          <div className="rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald animate-bounce" />
            <div>
              <p className="text-sm font-semibold text-emerald">Congratulations!</p>
              <p className="text-xs text-emerald/80">Your SMCR compliance framework is complete and ready for board submission.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-sand/70">
            {completionStats.complete} of {completionStats.total} key sections completed
            {completionStats.percentage >= 75 && (
              <span className="ml-2 text-emerald">• Almost there!</span>
            )}
          </p>
        )}
      </div>

      {/* Firm Profile Summary */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-emerald" />
          <h4 className="text-xl font-semibold">Firm Profile</h4>
          {firmValidation.isValid ? (
            <CheckCircle2 className="size-5 text-emerald" />
          ) : (
            <AlertCircle className="size-5 text-warning" />
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sand/60 uppercase tracking-wider">Firm Name</p>
            <p className="text-base text-sand">{firmProfile.firmName || "–"}</p>
          </div>
          <div>
            <p className="text-xs text-sand/60 uppercase tracking-wider">Firm Type</p>
            <p className="text-base text-sand">{firmProfile.firmType || "–"}</p>
          </div>
          <div>
            <p className="text-xs text-sand/60 uppercase tracking-wider">SMCR Category</p>
            <p className="text-base text-sand">{firmProfile.smcrCategory || "–"}</p>
          </div>
          <div>
            <p className="text-xs text-sand/60 uppercase tracking-wider">CASS Firm</p>
            <p className="text-base text-sand">{firmProfile.isCASSFirm ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>

      {/* SMF Roster */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-emerald" />
          <h4 className="text-xl font-semibold">Senior Manager Functions</h4>
        </div>
        {individuals.length === 0 ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
            <p className="text-sm text-warning">No SMF individuals added</p>
          </div>
        ) : (
          <div className="space-y-2">
            {individuals.map((individual) => {
              const ownedCount = Object.values(responsibilityOwners).filter(
                (id) => id === individual.id
              ).length;

              return (
                <div
                  key={individual.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-sand">{individual.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {individual.smfRoles.map((role, idx) => (
                        <span key={idx} className="text-xs text-sand/70 bg-white/5 px-2 py-0.5 rounded">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-emerald">{ownedCount} responsibilities</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Responsibility Assignment Matrix */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald" />
          <h4 className="text-xl font-semibold">Prescribed Responsibilities</h4>
          {respValidation.isValid ? (
            <CheckCircle2 className="size-5 text-emerald" />
          ) : (
            <AlertCircle className="size-5 text-warning" />
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-sand">{assignedResponsibilities.length}</p>
              <p className="text-xs text-sand/60">Assigned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-emerald">{ownedResponsibilities.length}</p>
              <p className="text-xs text-sand/60">With Owner</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-warning">
                {assignedResponsibilities.length - ownedResponsibilities.length}
              </p>
              <p className="text-xs text-sand/60">Unassigned</p>
            </div>
          </div>
          {assignedResponsibilities.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-white/10">
              {assignedResponsibilities.map((resp) => {
                const owner = individuals.find((ind) => ind.id === responsibilityOwners[resp.ref]);
                return (
                  <div key={resp.ref} className="flex items-start gap-3 text-sm">
                    <span className="inline-flex size-6 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs font-semibold flex-shrink-0">
                      {resp.ref}
                    </span>
                    <div className="flex-1">
                      <p className="text-sand/80">{resp.text}</p>
                      {owner && (
                        <p className="text-xs text-emerald mt-1">Owner: {owner.name} ({owner.smfRoles.join(", ")})</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fitness & Propriety Status */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-emerald" />
          <h4 className="text-xl font-semibold">Fitness & Propriety</h4>
          {fitnessValidation.isValid ? (
            <CheckCircle2 className="size-5 text-emerald" />
          ) : (
            <AlertCircle className="size-5 text-warning" />
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-sand/60 uppercase tracking-wider">Individuals Assessed</p>
              <p className="text-2xl font-semibold text-sand">{individuals.length}</p>
            </div>
            <div>
              <p className="text-xs text-sand/60 uppercase tracking-wider">Assessment Responses</p>
              <p className="text-2xl font-semibold text-sand">{fitnessResponses.length}</p>
            </div>
          </div>
          {fitnessValidation.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              {fitnessValidation.errors.map((error, idx) => (
                <p key={idx} className="text-sm text-warning flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  {error}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Risk Assessment */}
      {riskAssessments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-emerald" />
            <h4 className="text-xl font-semibold">Fitness & Propriety Risk Assessment</h4>
          </div>

          {/* Firm-wide Risk Summary */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-sand/70 mb-3">Firm-wide Risk Summary</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-2xl font-semibold text-sand">{firmRiskSummary.total}</p>
                <p className="text-xs text-sand/60">Total</p>
              </div>
              {firmRiskSummary.high > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-semibold text-red-500">{firmRiskSummary.high}</p>
                  <p className="text-xs text-sand/60">High Risk</p>
                </div>
              )}
              {firmRiskSummary.medium > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-semibold text-amber-500">{firmRiskSummary.medium}</p>
                  <p className="text-xs text-sand/60">Medium Risk</p>
                </div>
              )}
              {firmRiskSummary.low > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-semibold text-yellow-500">{firmRiskSummary.low}</p>
                  <p className="text-xs text-sand/60">Low Risk</p>
                </div>
              )}
              {firmRiskSummary.clear > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-semibold text-emerald">{firmRiskSummary.clear}</p>
                  <p className="text-xs text-sand/60">Clear</p>
                </div>
              )}
            </div>
          </div>

          {/* Individual Risk Assessments */}
          <div className="space-y-3">
            {riskAssessments.map((assessment) => (
              <div
                key={assessment.individualId}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                {/* Individual Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-sand">{assessment.individualName}</p>
                    <p className="text-xs text-sand/60 mt-0.5">Risk Score: {assessment.overallScore} points</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold border ${getRiskColorClass(assessment.riskLevel)}`}>
                    <div className="flex items-center gap-1">
                      <ShieldAlert className="size-3" />
                      {assessment.riskLevel} Risk
                    </div>
                  </div>
                </div>

                {/* Section Breakdown */}
                {assessment.sectionBreakdown.some((section) => section.score > 0) && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-sand/70 font-semibold">Section Breakdown:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {assessment.sectionBreakdown
                        .filter((section) => section.score > 0)
                        .map((section) => (
                          <div
                            key={section.sectionRef}
                            className="rounded-lg bg-midnight/40 border border-white/10 px-3 py-2"
                          >
                            <p className="text-xs text-sand/60">{section.sectionRef}</p>
                            <p className="text-sm font-semibold text-sand">{section.score} pts</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Flagged Questions */}
                {assessment.allFlaggedQuestions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-sand/70 font-semibold">Flagged Concerns:</p>
                    <div className="space-y-2">
                      {assessment.allFlaggedQuestions.map((flagged, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-midnight/40 border border-warning/20 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-sand flex-1">{flagged.questionText}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              flagged.riskWeight >= 10
                                ? "bg-red-500/10 text-red-500"
                                : flagged.riskWeight >= 5
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-yellow-500/10 text-yellow-500"
                            }`}>
                              {flagged.riskWeight} pts
                            </span>
                          </div>
                          {flagged.details && (
                            <p className="text-xs text-sand/60 mt-1 italic">{flagged.details}</p>
                          )}
                          {flagged.date && (
                            <p className="text-xs text-sand/60 mt-1">Date: {flagged.date}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-emerald" />
          <h4 className="text-xl font-semibold">Export Report</h4>
        </div>
        <p className="text-sm text-sand/70">
          Download this report in various formats for board submission or regulatory filing.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 px-6 py-3 text-sand hover:bg-white/5 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export PDF
              </>
            )}
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 px-6 py-3 text-sand hover:bg-white/5 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExportCSV}
            disabled={isExportingCSV}
          >
            {isExportingCSV ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating CSV...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export CSV
              </>
            )}
          </button>
          <button
            type="button"
            className="col-span-2 rounded-full bg-emerald/90 text-midnight px-6 py-3 font-semibold hover:bg-emerald transition flex items-center justify-center gap-2"
            onClick={() => alert("Share functionality coming soon")}
          >
            <Share2 className="size-4" />
            Share with Board
          </button>
        </div>
      </div>
    </div>
  );
}
