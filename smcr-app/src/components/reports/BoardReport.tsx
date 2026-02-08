"use client";

import { useSmcrStore } from "@/stores/useSmcrStore";
import { getApplicablePRs, getFirmRegime } from "@/lib/smcr-data";
import { FileText, Download, Share2, CheckCircle2, AlertCircle, Users, Shield, Loader2, ShieldAlert, Link2, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { generateAndDownloadPDF, generatePDFBlob, generatePDFFilename } from "@/lib/pdf/generatePDF";
import { exportResponsibilitiesCSV } from "@/lib/csv/generateCSV";
import { calculateAllRisks, getRiskColorClass, getFirmRiskSummary } from "@/lib/fitness-risk-rating";
import { sharePdfFile } from "@/lib/share/shareReport";
import { buildNextActions } from "@/lib/insights/nextActions";
import { calculateBoardReadiness } from "@/lib/insights/boardReadiness";
import { saveDraft } from "@/lib/services/draftService";

export function BoardReport() {
  const firmProfile = useSmcrStore((state) => state.firmProfile);
  const individuals = useSmcrStore((state) => state.individuals);
  const responsibilityAssignments = useSmcrStore((state) => state.responsibilityAssignments);
  const responsibilityOwners = useSmcrStore((state) => state.responsibilityOwners);
  const responsibilityEvidence = useSmcrStore((state) => state.responsibilityEvidence);
  const fitnessResponses = useSmcrStore((state) => state.fitnessResponses);
  const validateStep = useSmcrStore((state) => state.validateStep);
  const draftId = useSmcrStore((state) => state.draftId);
  const setDraftId = useSmcrStore((state) => state.setDraftId);
  const setActiveStep = useSmcrStore((state) => state.setActiveStep);

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);
  const [showShareFallback, setShowShareFallback] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);

  // Calculate completeness
  const firmValidation = validateStep("firm");
  const respValidation = validateStep("responsibilities");
  const fitnessValidation = validateStep("fitness");

  const answeredFitnessResponses = useMemo(
    () => fitnessResponses.filter((r) => r.response && r.response.trim().length > 0).length,
    [fitnessResponses]
  );

  const regime = firmProfile.firmType ? getFirmRegime(firmProfile.firmType) : "SMCR";
  const reportTitle = regime === "PSD" ? "Board-ready Governance Report" : "Board-ready SMCR Report";

  const applicableResponsibilities = useMemo(() => {
    if (!firmProfile.firmType) return [];
    return getApplicablePRs(
      firmProfile.firmType,
      firmProfile.smcrCategory,
      firmProfile.isCASSFirm ?? false
    );
  }, [firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm]);

  const assignedResponsibilities = useMemo(
    () => applicableResponsibilities.filter((pr) => responsibilityAssignments[pr.ref]),
    [applicableResponsibilities, responsibilityAssignments]
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
      const baseFilename = generatePDFFilename(firmProfile.firmName);
      const filename =
        regime === "PSD"
          ? baseFilename.replace(/^smcr-report-/, "governance-report-")
          : baseFilename;
      await generateAndDownloadPDF(
        {
          firmProfile,
          individuals,
          responsibilityAssignments,
          responsibilityEvidence,
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
        responsibilityEvidence,
        firmProfile.firmName
      );
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setIsExportingCSV(false);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  };

  const ensureDraftId = async (): Promise<string | null> => {
    if (draftId) return draftId;

    const result = await saveDraft({
      firmProfile,
      responsibilityAssignments,
      responsibilityOwners,
      responsibilityEvidence,
      individuals,
      fitnessResponses,
    });

    if (result.success && result.draftId) {
      setDraftId(result.draftId);
      try {
        localStorage.setItem("smcr_current_draft_id", result.draftId);
      } catch {}
      return result.draftId;
    }

    setShareNotice({
      tone: "error",
      message: result.error || "Unable to save a draft link. Please try again.",
    });
    return null;
  };

  const handleCopyDraftLink = async () => {
    setShareNotice(null);
    const id = await ensureDraftId();
    if (!id) return;

    const url = `${window.location.origin}/builder?draftId=${id}`;
    const ok = await copyToClipboard(url);

    setShareNotice({
      tone: ok ? "success" : "error",
      message: ok ? "Draft link copied to clipboard." : "Unable to copy link. Please copy it manually.",
    });
  };

  const handleEmailDraftLink = async () => {
    setShareNotice(null);
    const id = await ensureDraftId();
    if (!id) return;

    const url = `${window.location.origin}/builder?draftId=${id}`;
    const subject = encodeURIComponent(`${firmProfile.firmName || "Firm"} — board pack link`);
    const body = encodeURIComponent(`Draft link:\n${url}\n\nIf sharing is not supported on this device, export the PDF from the Reports step and attach it to your email.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareWithBoard = async () => {
    try {
      setIsSharing(true);
      setShareNotice({ tone: "info", message: "Preparing PDF for sharing..." });
      setShowShareFallback(false);

      const baseFilename = generatePDFFilename(firmProfile.firmName);
      const filename =
        regime === "PSD"
          ? baseFilename.replace(/^smcr-report-/, "governance-report-")
          : baseFilename;

      const blob = await generatePDFBlob({
        firmProfile,
        individuals,
        responsibilityAssignments,
        responsibilityEvidence,
        assignedResponsibilities,
        responsibilityOwners,
        fitnessResponses,
      });

      const result = await sharePdfFile({
        blob,
        filename,
        title: `${firmProfile.firmName || "Firm"} board pack`,
        text: "Board pack PDF generated from the MEMA tool.",
      });

      if (result.ok) {
        setShareNotice({ tone: "success", message: "Shared successfully." });
        return;
      }

      if (result.reason === "canceled") {
        setShareNotice({ tone: "info", message: "Share cancelled." });
        return;
      }

      if (result.reason === "unsupported") {
        setShareNotice({
          tone: "info",
          message: "Sharing is not supported in this browser. Export the PDF or share a draft link instead.",
        });
        setShowShareFallback(true);
        return;
      }

      setShareNotice({
        tone: "error",
        message: "Unable to open the share sheet. Export the PDF or share a draft link instead.",
      });
      setShowShareFallback(true);
    } catch (error) {
      console.error("Share failed:", error);
      setShareNotice({
        tone: "error",
        message: "Share failed. Export the PDF or share a draft link instead.",
      });
      setShowShareFallback(true);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSendEmailPDF = async () => {
    try {
      setEmailNotice(null);

      if (!emailTo.trim()) {
        setEmailNotice({ tone: "error", message: "Enter a recipient email address." });
        return;
      }

      setIsSendingEmail(true);
      setEmailNotice({ tone: "info", message: "Generating PDF..." });

      const baseFilename = generatePDFFilename(firmProfile.firmName);
      const filename =
        regime === "PSD"
          ? baseFilename.replace(/^smcr-report-/, "governance-report-")
          : baseFilename;

      const blob = await generatePDFBlob({
        firmProfile,
        individuals,
        responsibilityAssignments,
        responsibilityEvidence,
        assignedResponsibilities,
        responsibilityOwners,
        fitnessResponses,
      });

      const formData = new FormData();
      formData.set("to", emailTo.trim());
      formData.set("subject", `${firmProfile.firmName || "Firm"} — board pack`);
      formData.set(
        "message",
        [
          `${firmProfile.firmName || "Firm"} board pack attached.`,
          `Generated: ${today}.`,
          "Sent from the MEMA SMCR tool.",
        ].join("\n")
      );
      formData.set("filename", filename);
      formData.set("file", new File([blob], filename, { type: "application/pdf" }));

      const response = await fetch("/api/share/email", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setEmailNotice({ tone: "error", message: result.error || "Failed to send email." });
        return;
      }

      setEmailNotice({ tone: "success", message: "Email sent." });
    } catch (error) {
      console.error("Email send failed:", error);
      setEmailNotice({ tone: "error", message: "Failed to send email. Check email configuration and try again." });
    } finally {
      setIsSendingEmail(false);
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

  const boardReadiness = useMemo(
    () =>
      calculateBoardReadiness({
        firmProfile,
        individuals,
        responsibilityAssignments,
        responsibilityOwners,
        responsibilityEvidence,
        fitnessResponses,
      }),
    [
      firmProfile,
      individuals,
      responsibilityAssignments,
      responsibilityOwners,
      responsibilityEvidence,
      fitnessResponses,
    ]
  );

  const nextActions = useMemo(
    () =>
      buildNextActions({
        firmProfile,
        individuals,
        responsibilityAssignments,
        responsibilityOwners,
        responsibilityEvidence,
        fitnessResponses,
      }),
    [
      firmProfile,
      individuals,
      responsibilityAssignments,
      responsibilityOwners,
      responsibilityEvidence,
      fitnessResponses,
    ]
  );

  return (
    <div className="glass-panel p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 04</p>
          <h3 className="text-3xl font-display mt-2">{reportTitle}</h3>
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
	              <p className="text-xs text-emerald/80">
	                {regime === "PSD"
	                  ? "Your governance framework is complete and ready for board submission."
	                  : "Your SMCR compliance framework is complete and ready for board submission."}
	              </p>
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

      {/* Board Readiness Score */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-semibold">Board readiness score</h4>
          <span
            className={`text-xs font-semibold ${
              boardReadiness.label === "Board-ready"
                ? "text-emerald"
                : boardReadiness.label === "In progress"
                ? "text-warning"
                : "text-sand/60"
            }`}
          >
            {boardReadiness.label}
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-4xl font-bold text-emerald">{boardReadiness.score}</p>
            <p className="text-xs text-sand/60">out of {boardReadiness.maxScore}</p>
          </div>
          <div className="w-full sm:w-2/3">
            <div className="relative h-3 rounded-full bg-midnight/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald to-emerald/60 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, boardReadiness.score))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.values(boardReadiness.components).map((component) => (
            <div key={component.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-sand">{component.label}</p>
                <p className="text-xs font-semibold text-sand/70">
                  {component.points}/{component.maxPoints}
                </p>
              </div>
              <p className="text-xs text-sand/60 mt-1">{component.detail}</p>
            </div>
          ))}
        </div>
      </div>

	      {/* Gaps & Next Actions */}
	      {nextActions.length > 0 && (
	        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
	          <div className="flex items-center justify-between">
	            <h4 className="text-xl font-semibold">Gaps & Next Actions</h4>
	            <span className="text-xs text-sand/60">{nextActions.length} items</span>
	          </div>
	          <div className="space-y-3">
	            {nextActions.map((action) => (
	              <div
	                key={action.id}
	                className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-4 ${
	                  action.severity === "blocker"
	                    ? "border-warning/40 bg-warning/5"
	                    : action.severity === "warning"
	                    ? "border-white/15 bg-white/5"
	                    : "border-white/10 bg-white/0"
	                }`}
	              >
	                <div className="min-w-0">
	                  <p className="text-sm font-semibold text-sand">{action.title}</p>
	                  <p className="text-xs text-sand/60 mt-0.5">{action.detail}</p>
	                </div>
	                {action.ctaStep && (
	                  <button
	                    type="button"
	                    onClick={() => setActiveStep(action.ctaStep!)}
	                    className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-sand/80 hover:bg-white/5 transition"
	                  >
	                    Go
	                  </button>
	                )}
	              </div>
	            ))}
	          </div>
	        </div>
	      )}

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
	            <p className="text-xs text-sand/60 uppercase tracking-wider">
	              {regime === "PSD" ? "Payments Category" : "SMCR Category"}
	            </p>
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
	          <h4 className="text-xl font-semibold">
	            {regime === "PSD" ? "Key Roles" : "Senior Manager Functions"}
	          </h4>
	        </div>
	        {individuals.length === 0 ? (
	          <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
	            <p className="text-sm text-warning">
	              {regime === "PSD" ? "No individuals added" : "No SMF individuals added"}
	            </p>
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
	          <h4 className="text-xl font-semibold">
	            {regime === "PSD" ? "Governance Responsibilities" : "Prescribed Responsibilities"}
	          </h4>
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
	              <p className="text-2xl font-semibold text-sand">{answeredFitnessResponses}</p>
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
            className="col-span-2 rounded-full bg-emerald/90 text-midnight px-6 py-3 font-semibold hover:bg-emerald transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleShareWithBoard}
            disabled={isSharing}
          >
            {isSharing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Preparing share...
              </>
            ) : (
              <>
                <Share2 className="size-4" />
                Share with Board
              </>
            )}
          </button>
          {showShareFallback && (
            <>
              <button
                type="button"
                className="rounded-full border border-white/20 px-6 py-3 text-sand hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={handleCopyDraftLink}
              >
                <Link2 className="size-4" />
                Copy draft link
              </button>
              <button
                type="button"
                className="rounded-full border border-white/20 px-6 py-3 text-sand hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={handleEmailDraftLink}
              >
                <Mail className="size-4" />
                Email link
              </button>
            </>
          )}
        </div>
        {shareNotice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              shareNotice.tone === "success"
                ? "border-emerald/40 bg-emerald/10 text-emerald"
                : shareNotice.tone === "error"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-white/15 bg-white/5 text-sand/80"
            }`}
          >
            {shareNotice.message}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-sand/70">Send via email (PDF attachment)</p>
            <span className="text-xs text-sand/50">Resend/SES/SMTP required</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="ademola@memaconsultants.com"
              className="flex-1 rounded-full border border-white/15 bg-midnight px-4 py-2.5 text-sm text-sand placeholder:text-sand/40 focus:border-emerald focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendEmailPDF}
              disabled={isSendingEmail}
              className="rounded-full bg-emerald/90 text-midnight px-5 py-2.5 text-sm font-semibold hover:bg-emerald transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="size-4" />
                  Send PDF
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-sand/60">
            Uses Resend if `RESEND_API_KEY` is set, otherwise Amazon SES if AWS credentials are present, otherwise SMTP (`EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`). Always requires `EMAIL_FROM` (or `SES_FROM_EMAIL`).
          </p>
        </div>

        {emailNotice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              emailNotice.tone === "success"
                ? "border-emerald/40 bg-emerald/10 text-emerald"
                : emailNotice.tone === "error"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-white/15 bg-white/5 text-sand/80"
            }`}
          >
            {emailNotice.message}
          </div>
        )}
      </div>
    </div>
  );
}
