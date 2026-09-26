import { CERTIFICATION_FUNCTIONS, getSmf } from "@/lib/rules/fca-solo";
import { activePeople, getPerson, getWorkspacePRs } from "@/lib/workspace/derive";
import type { Workspace } from "@/lib/workspace/schema";

/** UTF-8 byte order mark so Excel opens the file with the right encoding. */
export const CSV_BOM = "﻿";

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection:
 * cells starting with = + - @ (or tab / CR) are prefixed with an apostrophe.
 */
export function escapeCsvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  if (FORMULA_TRIGGERS.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV document (with BOM, CRLF line endings) from a header row and data rows. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCsvCell).join(","));
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

const SMF_STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  temporary_cover: "Temporary cover",
  application_submitted: "Application submitted",
  approved: "Approved",
};

export function smfStatusLabel(status: string): string {
  return SMF_STATUS_LABELS[status] ?? status;
}

const FIT_OUTCOME_LABELS: Record<string, string> = {
  fit: "Fit and proper",
  fit_with_conditions: "Fit with conditions",
  not_fit: "Not fit and proper",
};

export function fitOutcomeLabel(outcome: string | undefined): string {
  return outcome ? (FIT_OUTCOME_LABELS[outcome] ?? outcome) : "Not recorded";
}

/** Responsibilities matrix: one row per applicable prescribed responsibility. */
export function responsibilitiesMatrixCsv(ws: Workspace): string {
  const header = ["PR", "Title", "Responsibility text", "Owner", "Owner SMFs", "Shared with", "Notes", "Verify against Handbook"];
  const rows = getWorkspacePRs(ws).map((pr) => {
    const alloc = ws.responsibilities[pr.id];
    const owner = getPerson(ws, alloc?.ownerId);
    const shared = (alloc?.sharedWithIds ?? []).map((id) => getPerson(ws, id)?.name ?? "Unknown").join("; ");
    return [
      pr.letter ? `PR (${pr.letter})` : "PR (letter to confirm)",
      pr.title,
      pr.text,
      owner?.name ?? "Unallocated",
      owner ? owner.smfs.map((s) => s.smfId).join("; ") : "",
      shared,
      alloc?.notes ?? "",
      pr.verify || !pr.letterConfirmed ? "Yes" : "No",
    ];
  });
  return toCsv(header, rows);
}

/** People register: every person, active or not. */
export function peopleRegisterCsv(ws: Workspace): string {
  const header = [
    "Name",
    "Job title",
    "Status",
    "SMFs (approval status)",
    "Certification functions",
    "Criminal records check date",
    "F&P outcome",
    "F&P assessed on",
  ];
  const people = [...activePeople(ws), ...ws.people.filter((p) => p.status !== "active")];
  const rows = people.map((p) => {
    const fit = ws.fitness[p.id];
    return [
      p.name,
      p.jobTitle,
      p.status === "active" ? "Active" : `Left${p.leftDate ? ` ${p.leftDate}` : ""}`,
      p.smfs.map((s) => `${s.smfId} ${getSmf(s.smfId)?.title ?? ""}`.trim() + ` (${smfStatusLabel(s.status)})`).join("; "),
      p.certificationFunctions.map((id) => CERTIFICATION_FUNCTIONS.find((c) => c.id === id)?.title ?? id).join("; "),
      p.criminalRecordCheckDate ?? "",
      fitOutcomeLabel(fit?.outcome),
      fit?.assessedOn ?? "",
    ];
  });
  return toCsv(header, rows);
}
