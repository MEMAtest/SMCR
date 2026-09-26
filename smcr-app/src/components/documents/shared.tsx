"use client";

import { useCallback, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Button, cx } from "@/components/ui";

export type DocTab = "sor" | "mrm" | "board";

export function useDocParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: DocTab = raw === "mrm" || raw === "board" ? raw : "sor";
  const person = params.get("person") ?? undefined;
  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return { tab, person, setParams };
}

/** Button that runs an async export with a per-button loading state and inline error. */
export function ExportButton({
  label,
  run,
  variant = "secondary",
  icon,
  disabled,
}: {
  label: string;
  run: () => Promise<void>;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant={variant} size="sm" onClick={onClick} disabled={busy || disabled} aria-busy={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : (icon ?? <Download className="size-4" aria-hidden />)}
        {busy ? "Preparing…" : label}
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-danger">
          {label} failed: {error}
        </p>
      )}
    </div>
  );
}

/** Dark-UI table used on screen; scrolls horizontally inside its box on small screens. */
export function DataTable({ headers, rows, empty }: { headers: ReactNode[]; rows: ReactNode[][]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-sand/60">{empty ?? "Nothing recorded."}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-sand/60">
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx("border-t border-white/5 align-top", i % 2 === 1 && "bg-white/[0.02]")}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-sand/90">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
