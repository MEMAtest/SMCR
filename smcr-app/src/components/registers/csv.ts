import { downloadFile } from "@/components/ui";

export type CsvCell = string | number | boolean | null | undefined;

/**
 * Escape a single CSV cell (RFC 4180) with a spreadsheet formula-injection guard:
 * text starting with = + - @ tab or CR is prefixed with an apostrophe so Excel /
 * Sheets treat it as text rather than a formula.
 */
export function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

/** Download a CSV with a UTF-8 BOM so Excel opens accented characters correctly. */
export function downloadCSV(filename: string, headers: string[], rows: CsvCell[][]) {
  downloadFile(`﻿${toCSV(headers, rows)}\r\n`, filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv;charset=utf-8");
}
