"use client";

import { LoadingPanel, PageHeader, cx } from "@/components/ui";
import { useHydrated } from "@/stores/useWorkspace";
import { BoardTab } from "./BoardTab";
import { MrmTab } from "./MrmTab";
import { SorTab } from "./SorTab";
import { useDocParams, type DocTab } from "./shared";

const TABS: { id: DocTab; label: string }[] = [
  { id: "sor", label: "Statements of Responsibilities" },
  { id: "mrm", label: "Responsibilities map" },
  { id: "board", label: "Board pack & exports" },
];

export function DocumentsPage() {
  const hydrated = useHydrated();
  const { tab, setParams } = useDocParams();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documents"
        title="SM&CR documents"
        description="Statements of Responsibilities, the management responsibilities map and a board pack, generated from your workspace. Review everything before relying on it."
      />
      <div role="tablist" aria-label="Document type" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`doc-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`doc-panel-${t.id}`}
              onClick={() => setParams({ tab: t.id })}
              className={cx(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald",
                selected ? "border-emerald bg-emerald/15 text-emerald" : "border-white/15 text-sand/70 hover:border-white/30 hover:text-sand",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`doc-panel-${tab}`} aria-labelledby={`doc-tab-${tab}`}>
        {!hydrated ? <LoadingPanel /> : tab === "mrm" ? <MrmTab /> : tab === "board" ? <BoardTab /> : <SorTab />}
      </div>
    </div>
  );
}
