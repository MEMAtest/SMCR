import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/sendEmail";
import { SmcrReportPDF } from "@/lib/pdf/SmcrReportPDF";
import { FIT_SECTIONS, getApplicablePRs } from "@/lib/smcr-data";
import { pdf } from "@react-pdf/renderer";
import type { FitnessResponse } from "@/lib/validation";

export const runtime = "nodejs";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type TemplateRequestBody = {
  to?: string;
  which?: "smcr" | "psd" | "both";
};

function buildFitnessResponses(params: {
  individuals: Array<{ id: string }>;
  overrides?: Record<string, Partial<Pick<FitnessResponse, "response" | "details" | "date">>>;
}): FitnessResponse[] {
  const responses: FitnessResponse[] = [];

  for (const individual of params.individuals) {
    for (const section of FIT_SECTIONS) {
      for (const question of section.questions) {
        const key = `${individual.id}::${section.id}::${question.id}`;
        const override = params.overrides?.[key];
        responses.push({
          sectionId: section.id,
          questionId: key,
          response: override?.response ?? "no",
          details: override?.details,
          date: override?.date,
        });
      }
    }
  }

  return responses;
}

async function renderPdfBuffer(input: Parameters<typeof SmcrReportPDF>[0]): Promise<Buffer> {
  const blob = await pdf(SmcrReportPDF(input)).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  if (process.env.DISABLE_AUTH === "true" && process.env.ALLOW_DEV_EMAIL !== "true") {
    return NextResponse.json(
      {
        error:
          "Outbound email is disabled when DISABLE_AUTH=true. Set ALLOW_DEV_EMAIL=true to allow sending in this environment.",
      },
      { status: 403 }
    );
  }

  const limiter = rateLimit(`share-template:${auth.userId}`, { maxRequests: 5, windowSeconds: 60 });
  if (limiter.limited) {
    return limiter.response!;
  }

  let body: TemplateRequestBody = {};
  try {
    body = (await request.json()) as TemplateRequestBody;
  } catch {
    // Allow empty body.
  }

  const to = (body.to || "ademola@memaconsultants.com").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
  }

  const which = body.which || "both";
  if (which !== "smcr" && which !== "psd" && which !== "both") {
    return NextResponse.json({ error: "Invalid 'which' value" }, { status: 400 });
  }

  const now = new Date();
  const todayIso = now.toISOString().split("T")[0];

  try {
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    // ---------------------------------------------------------------------
    // Sample 1: SMCR (Investment / Enhanced) board pack
    // ---------------------------------------------------------------------
    const smcrFirmProfile = {
      firmName: "Example Investment Firm Ltd",
      firmType: "Investment" as const,
      smcrCategory: "enhanced",
      jurisdictions: ["UK"],
      isCASSFirm: true,
      optUp: false,
    };

    const smcrIndividuals = [
      { id: "smcr-1", name: "Alex Morgan", smfRoles: ["SMF1", "SMF3"] },
      { id: "smcr-2", name: "Bianca Patel", smfRoles: ["SMF16"] },
      { id: "smcr-3", name: "Chris Shaw", smfRoles: ["SMF24"] },
    ];

    const smcrApplicable = getApplicablePRs(smcrFirmProfile.firmType, smcrFirmProfile.smcrCategory, smcrFirmProfile.isCASSFirm);
    const smcrSelectedRefs = smcrApplicable.slice(0, 9).map((r) => r.ref);

    const smcrResponsibilityAssignments: Record<string, boolean> = {};
    for (const ref of smcrSelectedRefs) smcrResponsibilityAssignments[ref] = true;

    const smcrResponsibilityOwners: Record<string, string> = {
      [smcrSelectedRefs[0]]: "smcr-1",
      [smcrSelectedRefs[1]]: "smcr-2",
      [smcrSelectedRefs[2]]: "smcr-2",
      [smcrSelectedRefs[3]]: "smcr-3",
      [smcrSelectedRefs[4]]: "smcr-1",
      [smcrSelectedRefs[5]]: "smcr-3",
      // Leave some unassigned to demonstrate the action list.
    };

    const smcrResponsibilityEvidence: Record<string, string> = {
      [smcrSelectedRefs[0]]: "SoR pack v1 (internal) · Feb 2026",
      [smcrSelectedRefs[1]]: "Certification policy v3 · Jan 2026",
      [smcrSelectedRefs[3]]: "Ops controls register · Feb 2026",
    };

    const smcrAssignedResponsibilities = smcrApplicable.filter((r) => smcrResponsibilityAssignments[r.ref]);

    const smcrFitnessResponses = buildFitnessResponses({
      individuals: smcrIndividuals,
      overrides: {
        "smcr-2::honesty::regulatory_investigations": {
          response: "yes",
          details: "Historic FCA supervisory review (no enforcement outcome).",
          date: todayIso,
        },
        "smcr-3::financial::ccj_orders": {
          response: "yes",
          details: "Resolved CCJ from 2019 (paid in full).",
          date: "2019-06-15",
        },
      },
    });

    if (which === "smcr" || which === "both") {
      console.log("[board-pack-template] Rendering SMCR sample PDF...");
      const start = Date.now();
      const smcrBuffer = await renderPdfBuffer({
        firmProfile: smcrFirmProfile,
        individuals: smcrIndividuals,
        responsibilityAssignments: smcrResponsibilityAssignments,
        responsibilityEvidence: smcrResponsibilityEvidence,
        assignedResponsibilities: smcrAssignedResponsibilities,
        responsibilityOwners: smcrResponsibilityOwners,
        fitnessResponses: smcrFitnessResponses,
      });
      console.log("[board-pack-template] SMCR PDF rendered in", Date.now() - start, "ms", "bytes", smcrBuffer.length);

      attachments.push({
        filename: `board-pack-smcr-sample-${todayIso}.pdf`,
        content: smcrBuffer,
        contentType: "application/pdf",
      });
    }

    // ---------------------------------------------------------------------
    // Sample 2: PSD/EMR (Payments) governance board pack
    // ---------------------------------------------------------------------
    const psdFirmProfile = {
      firmName: "Example Payments Firm Ltd",
      firmType: "Payments" as const,
      smcrCategory: "api",
      jurisdictions: ["UK"],
      isCASSFirm: false,
      optUp: false,
    };

    const psdIndividuals = [
      { id: "psd-1", name: "Demi Clarke", smfRoles: ["PSD-CEO"] },
      { id: "psd-2", name: "Elliot Reed", smfRoles: ["PSD-MLRO"] },
      { id: "psd-3", name: "Farah Khan", smfRoles: ["PSD-OPS"] },
    ];

    const psdApplicable = getApplicablePRs(psdFirmProfile.firmType, psdFirmProfile.smcrCategory, psdFirmProfile.isCASSFirm);
    const psdSelectedRefs = psdApplicable.slice(0, 6).map((r) => r.ref);

    const psdResponsibilityAssignments: Record<string, boolean> = {};
    for (const ref of psdSelectedRefs) psdResponsibilityAssignments[ref] = true;

    const psdResponsibilityOwners: Record<string, string> = {
      [psdSelectedRefs[0]]: "psd-1",
      [psdSelectedRefs[1]]: "psd-3",
      [psdSelectedRefs[2]]: "psd-2",
      [psdSelectedRefs[3]]: "psd-3",
      // Leave at least one unassigned.
    };

    const psdResponsibilityEvidence: Record<string, string> = {
      [psdSelectedRefs[0]]: "FCA communications log · Feb 2026",
      [psdSelectedRefs[2]]: "ML/TF risk assessment · Jan 2026",
    };

    const psdAssignedResponsibilities = psdApplicable.filter((r) => psdResponsibilityAssignments[r.ref]);

    const psdFitnessResponses = buildFitnessResponses({
      individuals: psdIndividuals,
      overrides: {
        "psd-2::honesty::money_laundering": {
          response: "yes",
          details: "SAR escalation oversight role (no personal issues reported).",
          date: todayIso,
        },
      },
    });

    if (which === "psd" || which === "both") {
      console.log("[board-pack-template] Rendering PSD sample PDF...");
      const start = Date.now();
      const psdBuffer = await renderPdfBuffer({
        firmProfile: psdFirmProfile,
        individuals: psdIndividuals,
        responsibilityAssignments: psdResponsibilityAssignments,
        responsibilityEvidence: psdResponsibilityEvidence,
        assignedResponsibilities: psdAssignedResponsibilities,
        responsibilityOwners: psdResponsibilityOwners,
        fitnessResponses: psdFitnessResponses,
      });
      console.log("[board-pack-template] PSD PDF rendered in", Date.now() - start, "ms", "bytes", psdBuffer.length);

      attachments.push({
        filename: `board-pack-payments-sample-${todayIso}.pdf`,
        content: psdBuffer,
        contentType: "application/pdf",
      });
    }

    if (attachments.length === 0) {
      return NextResponse.json({ error: "No templates selected" }, { status: 400 });
    }

    console.log("[board-pack-template] Sending email to", to, "with", attachments.length, "attachment(s)...");
    const sendStart = Date.now();
    await sendEmail({
      to: [to],
      subject:
        which === "both"
          ? "New board pack PDF template (SMCR + Payments samples)"
          : which === "psd"
          ? "New board pack PDF template (Payments sample)"
          : "New board pack PDF template (SMCR sample)",
      text:
        which === "both"
          ? [
              "Attached are two sample board packs generated from the updated MEMA SMCR tool PDF template.",
              "",
              "1) SMCR sample (Investment / Enhanced)",
              "2) Payments sample (PSD/EMR)",
              "",
              `Generated: ${now.toLocaleString("en-GB")}.`,
            ].join("\n")
          : [
              "Attached is a sample board pack generated from the updated MEMA SMCR tool PDF template.",
              "",
              which === "psd"
                ? "Template: Payments sample (PSD/EMR)"
                : "Template: SMCR sample (Investment / Enhanced)",
              "",
              `Generated: ${now.toLocaleString("en-GB")}.`,
            ].join("\n"),
      attachments,
    });
    console.log("[board-pack-template] Email sent in", Date.now() - sendStart, "ms");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send board pack template email", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send template email" },
      { status: 500 }
    );
  }
}
