"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { RULES_META } from "@/lib/rules/fca-solo";
import { useHydrated, useWorkspace } from "@/stores/useWorkspace";
import { cx } from "@/components/ui";
import { SaveControls, WorkspaceSync } from "./WorkspaceSync";

export const NAV_ITEMS = [
  { href: "/builder", label: "Setup" },
  { href: "/workspace", label: "Dashboard" },
  { href: "/workspace/documents", label: "Documents" },
  { href: "/workspace/certification", label: "Certification" },
  { href: "/workspace/conduct", label: "Conduct Rules" },
  { href: "/workspace/references", label: "References" },
  { href: "/workspace/reasonable-steps", label: "Reasonable steps" },
  { href: "/workspace/handover", label: "Handover" },
  { href: "/workspace/calendar", label: "Calendar" },
  { href: "/workspace/assistant", label: "Assistant" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const firmName = useWorkspace((s) => s.ws.firm.name);

  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        <WorkspaceSync />
      </Suspense>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-midnight/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-display text-lg text-sand">SM&amp;CR Studio</span>
              {hydrated && firmName && <span className="text-sm text-sand/60">· {firmName}</span>}
            </Link>
            <SaveControls />
          </div>
          <nav aria-label="Workspace" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/workspace" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition",
                    active ? "bg-emerald/15 text-emerald" : "text-sand/70 hover:bg-white/5 hover:text-sand",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-sand/50 sm:px-6">
        Rules pack {RULES_META.id} · as of {RULES_META.asOf}. {RULES_META.caveat} This tool supports, but does not replace, professional
        compliance advice.
      </footer>
    </div>
  );
}
