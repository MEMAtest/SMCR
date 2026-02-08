import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { pdf } from "@react-pdf/renderer";

import { SmcrReportPDF } from "../src/lib/pdf/SmcrReportPDF";
import { FIT_SECTIONS, getApplicablePRs } from "../src/lib/smcr-data";
import { sendEmail } from "../src/lib/email/sendEmail";
import type { FitnessResponse } from "../src/lib/validation";

type Which = "smcr" | "psd" | "both";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const to = args.find((a) => a.startsWith("--to="))?.split("=", 2)[1] ?? "ademola@memaconsultants.com";
  const which = (args.find((a) => a.startsWith("--which="))?.split("=", 2)[1] ?? "both") as Which;

  if (!isValidEmail(to)) {
    throw new Error(`Invalid --to email: ${to}`);
  }
  if (which !== "smcr" && which !== "psd" && which !== "both") {
    throw new Error(`Invalid --which (expected smcr|psd|both): ${which}`);
  }

  return { to, which };
}

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

async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });

  // This is an explicit operator-invoked script. Allow email sending in DISABLE_AUTH mode by default.
  process.env.ALLOW_DEV_EMAIL = process.env.ALLOW_DEV_EMAIL || "true";

  // Force SES if available; avoids surprises when multiple providers are configured.
  process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "ses";

  const { to, which } = parseArgs();

  const now = new Date();
  const todayIso = now.toISOString().split("T")[0];

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

  if (which === "smcr" || which === "both") {
    const firmProfile = {
      firmName: "Example Investment Firm Ltd",
      firmType: "Investment" as const,
      smcrCategory: "enhanced",
      jurisdictions: ["UK"],
      isCASSFirm: true,
      optUp: false,
    };

    const individuals = [
      { id: "smcr-1", name: "Alex Morgan", smfRoles: ["SMF1", "SMF3"] },
      { id: "smcr-2", name: "Bianca Patel", smfRoles: ["SMF16"] },
      { id: "smcr-3", name: "Chris Shaw", smfRoles: ["SMF24"] },
    ];

    const applicable = getApplicablePRs(firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm);
    const selectedRefs = applicable.slice(0, 9).map((r) => r.ref);

    const responsibilityAssignments: Record<string, boolean> = {};
    for (const ref of selectedRefs) responsibilityAssignments[ref] = true;

    const responsibilityOwners: Record<string, string> = {
      [selectedRefs[0]]: "smcr-1",
      [selectedRefs[1]]: "smcr-2",
      [selectedRefs[2]]: "smcr-2",
      [selectedRefs[3]]: "smcr-3",
      [selectedRefs[4]]: "smcr-1",
      [selectedRefs[5]]: "smcr-3",
      // Leave some unassigned.
    };

    const responsibilityEvidence: Record<string, string> = {
      [selectedRefs[0]]: "SoR pack v1 (internal) · Feb 2026",
      [selectedRefs[1]]: "Certification policy v3 · Jan 2026",
      [selectedRefs[3]]: "Ops controls register · Feb 2026",
    };

    const assignedResponsibilities = applicable.filter((r) => responsibilityAssignments[r.ref]);
    const fitnessResponses = buildFitnessResponses({
      individuals,
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

    const t0 = Date.now();
    const buffer = await renderPdfBuffer({
      firmProfile,
      individuals,
      responsibilityAssignments,
      responsibilityEvidence,
      assignedResponsibilities,
      responsibilityOwners,
      fitnessResponses,
    });
    const ms = Date.now() - t0;

    const filename = `board-pack-smcr-sample-${todayIso}.pdf`;
    attachments.push({ filename, content: buffer, contentType: "application/pdf" });

    const outPath = path.join("/tmp", filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[smcr] rendered in ${ms}ms -> ${outPath}`);
  }

  if (which === "psd" || which === "both") {
    const firmProfile = {
      firmName: "Example Payments Firm Ltd",
      firmType: "Payments" as const,
      smcrCategory: "api",
      jurisdictions: ["UK"],
      isCASSFirm: false,
      optUp: false,
    };

    const individuals = [
      { id: "psd-1", name: "Demi Clarke", smfRoles: ["PSD-CEO"] },
      { id: "psd-2", name: "Elliot Reed", smfRoles: ["PSD-MLRO"] },
      { id: "psd-3", name: "Farah Khan", smfRoles: ["PSD-OPS"] },
    ];

    const applicable = getApplicablePRs(firmProfile.firmType, firmProfile.smcrCategory, firmProfile.isCASSFirm);
    const selectedRefs = applicable.slice(0, 6).map((r) => r.ref);

    const responsibilityAssignments: Record<string, boolean> = {};
    for (const ref of selectedRefs) responsibilityAssignments[ref] = true;

    const responsibilityOwners: Record<string, string> = {
      [selectedRefs[0]]: "psd-1",
      [selectedRefs[1]]: "psd-3",
      [selectedRefs[2]]: "psd-2",
      [selectedRefs[3]]: "psd-3",
      // Leave at least one unassigned.
    };

    const responsibilityEvidence: Record<string, string> = {
      [selectedRefs[0]]: "FCA communications log · Feb 2026",
      [selectedRefs[2]]: "ML/TF risk assessment · Jan 2026",
    };

    const assignedResponsibilities = applicable.filter((r) => responsibilityAssignments[r.ref]);
    const fitnessResponses = buildFitnessResponses({
      individuals,
      overrides: {
        "psd-2::honesty::money_laundering": {
          response: "yes",
          details: "SAR escalation oversight role (no personal issues reported).",
          date: todayIso,
        },
      },
    });

    const t0 = Date.now();
    const buffer = await renderPdfBuffer({
      firmProfile,
      individuals,
      responsibilityAssignments,
      responsibilityEvidence,
      assignedResponsibilities,
      responsibilityOwners,
      fitnessResponses,
    });
    const ms = Date.now() - t0;

    const filename = `board-pack-payments-sample-${todayIso}.pdf`;
    attachments.push({ filename, content: buffer, contentType: "application/pdf" });

    const outPath = path.join("/tmp", filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[psd] rendered in ${ms}ms -> ${outPath}`);
  }

  if (attachments.length === 0) {
    throw new Error("No templates selected.");
  }

  console.log(`Sending email to ${to} with ${attachments.length} attachment(s)...`);
  const t0 = Date.now();
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
            which === "psd" ? "Template: Payments sample (PSD/EMR)" : "Template: SMCR sample (Investment / Enhanced)",
            "",
            `Generated: ${now.toLocaleString("en-GB")}.`,
          ].join("\n"),
    attachments,
  });
  console.log(`Email sent in ${Date.now() - t0}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
