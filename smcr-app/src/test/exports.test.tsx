import { describe, expect, it } from "vitest";
import { buildSorModel } from "@/lib/workspace/derive";
import { buildBoardPackModel, buildMrmModel, docMeta } from "@/lib/export/models";
import { escapeCsvCell, peopleRegisterCsv, responsibilitiesMatrixCsv } from "@/lib/export/csv";
import { generateBoardPackPdf, generateMrmPdf, generateSorPdf } from "@/lib/pdf/generate";
import { richWorkspace } from "./fixture";

const TODAY = "2026-09-26";

async function pdfInfo(blob: Blob) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const head = bytes.subarray(0, 5).toString("latin1");
  const pages = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  return { head, pages, size: bytes.length };
}

describe("PDF exports", () => {
  const ws = richWorkspace();

  it("renders a multi-section SoR PDF", async () => {
    const model = buildSorModel(ws, "ceo")!;
    const blob = await generateSorPdf({ meta: docMeta(ws, "Statement of Responsibilities", TODAY), model, categoryLabel: "Enhanced", status: "approved", version: 2, history: ws.sors.ceo.history, smfStatusLabels: {} });
    const info = await pdfInfo(blob);
    expect(info.head).toBe("%PDF-");
    expect(info.pages).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it("renders the MRM and board pack PDFs, paginating long content", async () => {
    const mrm = await pdfInfo(await generateMrmPdf({ meta: docMeta(ws, "Management responsibilities map", TODAY), model: buildMrmModel(ws) }));
    expect(mrm.head).toBe("%PDF-");
    const board = await pdfInfo(await generateBoardPackPdf({ meta: docMeta(ws, "Board pack", TODAY), model: buildBoardPackModel(ws, TODAY, true) }));
    expect(board.head).toBe("%PDF-");
    expect(board.pages).toBeGreaterThan(1);
  }, 30_000);
});

describe("CSV exports", () => {
  it("escapes cells and neutralises formula injection", () => {
    expect(escapeCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(escapeCsvCell("=HYPERLINK(\"x\")").startsWith('"\'=') || escapeCsvCell("=1+1").startsWith("'=")).toBe(true);
    expect(escapeCsvCell("@SUM(A1)")).toContain("'@");
  });

  it("exports the responsibilities matrix and people register with names", () => {
    const ws = richWorkspace();
    const matrix = responsibilitiesMatrixCsv(ws);
    expect(matrix.charCodeAt(0)).toBe(0xfeff);
    expect(matrix).toContain("Alex Morgan");
    expect(matrix).toContain("Financial crime");
    const people = peopleRegisterCsv(ws);
    expect(people).toContain("Priya Shah");
    expect(people).toContain("Sam O'Neill");
  });
});
