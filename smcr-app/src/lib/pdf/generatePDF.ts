import type { SmcrReportPDFProps } from "./SmcrReportPDF";

/**
 * Generates an SMCR report PDF blob.
 * Kept separate so callers can either download it or share it via Web Share API.
 */
export async function generatePDFBlob(props: SmcrReportPDFProps): Promise<Blob> {
  try {
    // Dynamically import PDF library only when needed (lazy loading)
    const [{ pdf }, { SmcrReportPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./SmcrReportPDF"),
    ]);

    // Generate the PDF blob
    return await pdf(SmcrReportPDF(props)).toBlob();
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw new Error("Failed to generate PDF report");
  }
}

/**
 * Generates and downloads an SMCR report PDF
 * @param props - The data to include in the PDF report
 * @param filename - The filename for the downloaded PDF (default: "smcr-report.pdf")
 */
export async function generateAndDownloadPDF(
  props: SmcrReportPDFProps,
  filename: string = "smcr-report.pdf"
): Promise<void> {
  const blob = await generatePDFBlob(props);

  // Create a download link and trigger it
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a filename for the SMCR report PDF based on firm name and date
 * @param firmName - The firm name
 * @returns A sanitized filename
 */
export function generatePDFFilename(firmName: string | undefined): string {
  const sanitizedFirmName = (firmName || "firm")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);

  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `smcr-report-${sanitizedFirmName}-${dateStr}.pdf`;
}
