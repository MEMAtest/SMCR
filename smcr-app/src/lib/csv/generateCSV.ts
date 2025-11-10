import type { Individual } from "@/lib/validation";
import type { PrescribedResponsibility } from "@/lib/smcr-data";

/**
 * Generates CSV content for the responsibilities matrix
 * @param assignedResponsibilities - List of assigned prescribed responsibilities
 * @param responsibilityOwners - Mapping of PR ref to individual ID
 * @param individuals - List of SMF individuals
 * @returns CSV content as string
 */
export function generateResponsibilitiesCSV(
  assignedResponsibilities: PrescribedResponsibility[],
  responsibilityOwners: Record<string, string>,
  individuals: Individual[]
): string {
  // CSV headers
  const headers = [
    "PR Reference",
    "Responsibility",
    "Category",
    "Mandatory",
    "Owner Name",
    "Owner SMF Role",
    "Owner Email",
    "Status",
  ];

  // Generate CSV rows
  const rows = assignedResponsibilities.map((resp) => {
    const ownerId = responsibilityOwners[resp.ref];
    const owner = individuals.find((ind) => ind.id === ownerId);

    return [
      resp.ref,
      `"${resp.text.replace(/"/g, '""')}"`, // Escape quotes in text
      resp.cat,
      resp.mandatory ? "Yes" : "No",
      owner ? `"${owner.name.replace(/"/g, '""')}"` : "Unassigned",
      owner ? `"${owner.smfRole.replace(/"/g, '""')}"` : "–",
      owner?.email ? `"${owner.email.replace(/"/g, '""')}"` : "–",
      owner ? "Assigned" : "Pending Assignment",
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Downloads CSV content as a file
 * @param csvContent - The CSV content string
 * @param filename - The filename for the download
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create blob with UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  // Create download link and trigger it
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
 * Generates a filename for the CSV export based on firm name and date
 * @param firmName - The firm name
 * @returns A sanitized filename
 */
export function generateCSVFilename(firmName: string | undefined): string {
  const sanitizedFirmName = (firmName || "firm")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);

  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `smcr-responsibilities-${sanitizedFirmName}-${dateStr}.csv`;
}

/**
 * All-in-one function to generate and download responsibilities CSV
 * @param assignedResponsibilities - List of assigned prescribed responsibilities
 * @param responsibilityOwners - Mapping of PR ref to individual ID
 * @param individuals - List of SMF individuals
 * @param firmName - The firm name for filename generation
 */
export function exportResponsibilitiesCSV(
  assignedResponsibilities: PrescribedResponsibility[],
  responsibilityOwners: Record<string, string>,
  individuals: Individual[],
  firmName?: string
): void {
  const csvContent = generateResponsibilitiesCSV(
    assignedResponsibilities,
    responsibilityOwners,
    individuals
  );
  const filename = generateCSVFilename(firmName);
  downloadCSV(csvContent, filename);
}
