"use client";

import { prLabel, type PrescribedResponsibility } from "@/lib/rules/fca-solo";
import type { Person, Workspace } from "@/lib/workspace/schema";
import { useWorkspace } from "@/stores/useWorkspace";
import { Badge, cx } from "@/components/ui";

/**
 * People × PRs grid. Click a cell to make that person the owner (click the
 * owner's cell again to unassign). Scrolls horizontally inside its own box.
 */
export function ResponsibilityMatrix({ ws, prs, holders }: { ws: Workspace; prs: PrescribedResponsibility[]; holders: Person[] }) {
  const setPrOwner = useWorkspace((s) => s.setPrOwner);
  const owned = prs.filter((pr) => holders.some((h) => h.id === ws.responsibilities[pr.id]?.ownerId)).length;
  const unowned = prs.length - owned;
  const counts = holders.map((h) => ({ person: h, n: prs.filter((pr) => ws.responsibilities[pr.id]?.ownerId === h.id).length }));
  const max = counts.reduce((m, c) => (c.n > m.n ? c : m), { person: undefined as Person | undefined, n: 0 });
  const concentrated = prs.length >= 5 && max.n / prs.length > 0.6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone={unowned === 0 ? "good" : "bad"}>
          {owned}/{prs.length} owned
        </Badge>
        {unowned > 0 && <Badge tone="bad">{unowned} unowned</Badge>}
        {max.person && (
          <Badge tone={concentrated ? "warn" : "neutral"}>
            Most held: {max.person.name} ({max.n})
          </Badge>
        )}
      </div>

      {holders.length === 0 ? (
        <p className="text-sm text-sand/60">Add SMF holders in the Senior managers step to allocate responsibilities.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Responsibility map: click a cell to assign that responsibility to the person</caption>
            <thead>
              <tr className="bg-white/5">
                <th scope="col" className="sticky left-0 z-10 bg-deepTeal px-3 py-2 text-left font-semibold text-sand">
                  Person
                </th>
                {prs.map((pr) => (
                  <th key={pr.id} scope="col" className="max-w-[5.5rem] px-2 py-2 text-center align-bottom text-xs font-medium leading-tight text-sand/80" title={pr.title}>
                    <a href={`#pr-${pr.id}`} className="hover:text-emerald">
                      {pr.letter ? `(${pr.letter})` : pr.title.split(" ").slice(0, 2).join(" ")}
                    </a>
                    {(!pr.letterConfirmed || pr.verify) && (
                      <span className="text-warning" title="Not yet confirmed against the live FCA Handbook">
                        *
                      </span>
                    )}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-sand/80">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h) => {
                const total = counts.find((c) => c.person.id === h.id)?.n ?? 0;
                return (
                  <tr key={h.id} className="border-t border-white/10">
                    <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-deepTeal px-3 py-2 text-left font-normal">
                      <span className="block text-sand">{h.name}</span>
                      <span className="block text-xs text-sand/60">{h.smfs.map((s) => s.smfId).join(", ")}</span>
                    </th>
                    {prs.map((pr) => {
                      const alloc = ws.responsibilities[pr.id];
                      const isOwner = alloc?.ownerId === h.id;
                      const isShared = alloc?.sharedWithIds.includes(h.id);
                      return (
                        <td key={pr.id} className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => setPrOwner(pr.id, isOwner ? undefined : h.id)}
                            aria-pressed={isOwner}
                            aria-label={`${prLabel(pr)} ${pr.title}: ${isOwner ? `owned by ${h.name} — click to unassign` : `assign to ${h.name}`}`}
                            className={cx(
                              "size-8 rounded-lg border text-xs font-semibold transition",
                              isOwner
                                ? "border-emerald bg-emerald/25 text-emerald"
                                : isShared
                                  ? "border-cloud/40 bg-cloud/10 text-cloud"
                                  : "border-white/10 text-transparent hover:border-emerald/50 hover:text-sand/40",
                            )}
                          >
                            {isOwner ? "●" : isShared ? "◐" : "+"}
                          </button>
                        </td>
                      );
                    })}
                    <td className={cx("px-3 py-2 text-right tabular-nums", concentrated && max.person?.id === h.id ? "text-warning" : "text-sand/80")}>{total}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/10">
                <th scope="row" className="sticky left-0 z-10 bg-deepTeal px-3 py-2 text-left text-xs font-normal text-sand/60">
                  Owner
                </th>
                {prs.map((pr) => {
                  const ok = holders.some((h) => h.id === ws.responsibilities[pr.id]?.ownerId);
                  return (
                    <td key={pr.id} className={cx("px-1 py-2 text-center text-xs", ok ? "text-emerald" : "text-danger")}>
                      {ok ? "✓" : "none"}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-sand/60">● owner · ◐ shared · click an empty cell to assign, or the owner&apos;s cell to unassign.
        {prs.some((pr) => !pr.letterConfirmed || pr.verify) && <span className="text-warning"> * to verify against the live Handbook.</span>}
      </p>
    </div>
  );
}
