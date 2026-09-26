import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { BoardPackDocumentProps } from "./BoardPackDocument";
import type { MrmDocumentProps } from "./MrmDocument";
import type { SorDocumentProps } from "./SorDocument";

/**
 * PDF entry points. This module has NO runtime import of @react-pdf/renderer —
 * the renderer and the document components are pulled in with dynamic import()
 * only when a user clicks an export button. Callers should themselves
 * `await import("@/lib/pdf/generate")` inside the click handler.
 */

// Characters outside WinAnsi (the encoding of the built-in Helvetica) render as garbage.
const REPLACEMENTS: Record<string, string> = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "✓": "", "✔": "", "×": "x", "−": "-", " ": " " };
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

export function pdfSafeText(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch in REPLACEMENTS) out += REPLACEMENTS[ch];
    else if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.includes(ch)) out += ch;
    else out += "?";
  }
  return out;
}

function sanitize<T>(value: T): T {
  if (typeof value === "string") return pdfSafeText(value) as T;
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitize(v);
    return out as T;
  }
  return value;
}

type AsDoc = ReactElement<DocumentProps>;

export async function generateSorPdf(props: SorDocumentProps): Promise<Blob> {
  const [{ pdf }, { SorDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./SorDocument")]);
  const el = <SorDocument {...sanitize(props)} />;
  return pdf(el as unknown as AsDoc).toBlob();
}

export async function generateMrmPdf(props: MrmDocumentProps): Promise<Blob> {
  const [{ pdf }, { MrmDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./MrmDocument")]);
  const el = <MrmDocument {...sanitize(props)} />;
  return pdf(el as unknown as AsDoc).toBlob();
}

export async function generateBoardPackPdf(props: BoardPackDocumentProps): Promise<Blob> {
  const [{ pdf }, { BoardPackDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./BoardPackDocument")]);
  const el = <BoardPackDocument {...sanitize(props)} />;
  return pdf(el as unknown as AsDoc).toBlob();
}
