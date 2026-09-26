"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Field, Select, cx } from "@/components/ui";
import { personLabel } from "@/lib/workspace/derive";
import type { Person } from "@/lib/workspace/schema";

/* --------------------------------- Helpers --------------------------------- */

/** Empty string from a date input -> undefined for optional schema fields. */
export function optDate(v: string): string | undefined {
  return v ? v : undefined;
}

export function sortByDateDesc<T>(items: T[], get: (t: T) => string | undefined): T[] {
  return [...items].sort((a, b) => (get(b) ?? "").localeCompare(get(a) ?? ""));
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------- Person picker ------------------------------ */

export function PersonSelect({
  label,
  value,
  onChange,
  people,
  placeholder = "Select a person…",
  hint,
  error,
  className,
  allowEmpty = true,
}: {
  label: string;
  value: string | undefined;
  onChange: (id: string) => void;
  people: Person[];
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">{placeholder}</option>}
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {personLabel(p) || "Unnamed person"}
            {p.status === "left" ? " — left" : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/* ------------------------------ Register table ------------------------------ */

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide this column's label in the mobile card (e.g. for action buttons). */
  hideLabelOnMobile?: boolean;
}

/** Table on md+ screens, stacked cards on mobile (no horizontal scroll). */
export function RegisterTable<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
}) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-sand/50">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cx("px-3 py-2 font-medium", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={cx("border-b border-white/5 align-top", rowClassName?.(r))}>
                {columns.map((c) => (
                  <td key={c.header} className={cx("px-3 py-3", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className={cx("rounded-2xl border border-white/10 bg-white/5 p-4", rowClassName?.(r))}>
            <dl className="space-y-2 text-sm">
              {columns.map((c) => (
                <div key={c.header} className="min-w-0">
                  {!c.hideLabelOnMobile && <dt className="text-xs uppercase tracking-wide text-sand/50">{c.header}</dt>}
                  <dd className="break-words">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ------------------------------ Handbook refs ------------------------------- */

export function Refs({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-xs text-sand/50">Handbook: {children}</span>;
}

/* --------------------------------- Printing --------------------------------- */

const PRINT_CSS = `
.smcr-print-root { display: none; }
@media print {
  body > *:not(.smcr-print-root) { display: none !important; }
  body { background: #fff !important; }
  .smcr-print-root { display: block !important; color: #111; background: #fff; font-family: Georgia, 'Times New Roman', serif; padding: 12mm; }
  .smcr-print-root h1 { font-size: 22pt; margin: 0 0 6pt; }
  .smcr-print-root h2 { font-size: 13pt; margin: 14pt 0 4pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
  .smcr-print-root p, .smcr-print-root li, .smcr-print-root td, .smcr-print-root th { font-size: 10.5pt; line-height: 1.45; }
  .smcr-print-root table { border-collapse: collapse; width: 100%; }
  .smcr-print-root td, .smcr-print-root th { border: 1px solid #bbb; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  .smcr-print-root .muted { color: #555; }
  .smcr-print-root pre { white-space: pre-wrap; font-family: inherit; font-size: 10.5pt; }
}`;

/**
 * Print a specific block of content. Renders it into a body-level portal that is
 * the only thing visible when printing, then opens the browser print dialog.
 */
export function usePrintable() {
  const [content, setContent] = useState<ReactNode>(null);
  useEffect(() => {
    if (!content) return;
    const timer = window.setTimeout(() => window.print(), 60);
    const done = () => setContent(null);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [content]);
  const portal =
    content && typeof document !== "undefined"
      ? createPortal(
          <div className="smcr-print-root">
            <style>{PRINT_CSS}</style>
            {content}
          </div>,
          document.body,
        )
      : null;
  return { print: (node: ReactNode) => setContent(node), portal };
}

/* ------------------------------ Inline message ------------------------------ */

export function useFlash(ms = 3000): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), ms);
    return () => window.clearTimeout(t);
  }, [msg, ms]);
  return [msg, setMsg];
}

export function FlashMessage({ message }: { message: string | null }) {
  return (
    <p role="status" aria-live="polite" className={cx("text-sm text-emerald", !message && "sr-only")}>
      {message ?? ""}
    </p>
  );
}
