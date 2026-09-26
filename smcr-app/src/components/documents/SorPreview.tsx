"use client";

import type { ReactNode } from "react";
import type { SorModel } from "@/lib/workspace/derive";
import { formatDate } from "@/lib/workspace/dates";
import { smfStatusLabel } from "@/lib/export/csv";

function DocSection({ n, title, children }: { n?: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="border-b-2 border-forestGreen pb-1 font-sans text-sm font-bold uppercase tracking-wide text-ink">
        {n ? `Section ${n} — ` : ""}
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 text-sm">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-ink">{v || "—"}</dd>
    </div>
  );
}

function Para({ text, empty = "Not provided." }: { text: string; empty?: string }) {
  if (!text.trim()) return <p className="text-sm italic text-gray-400">{empty}</p>;
  return <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>;
}

/** Paper-style preview of the SoR, mirroring the PDF layout. */
export function SorPreview({ model, status, version, categoryLabel }: { model: SorModel; status: "draft" | "approved"; version: number; categoryLabel: string }) {
  const approved = status === "approved";
  const overall = model.other.filter((o) => o.kind === "overall");
  const additional = model.other.filter((o) => o.kind === "additional");
  return (
    <article aria-label="Statement of Responsibilities preview" className="relative overflow-hidden rounded-md bg-white px-5 py-6 font-sans text-ink shadow-card sm:px-8 sm:py-8">
      {!approved && (
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -rotate-[30deg] select-none text-7xl font-black tracking-widest text-gray-200/70 sm:text-8xl">
          DRAFT
        </span>
      )}
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-2 text-xs text-gray-500">
          <span className="font-semibold text-ink">{model.firmName || "Unnamed firm"}</span>
          <span>Statement of Responsibilities · v{version}</span>
        </div>
        <h2 className="mt-4 font-sans text-2xl font-bold text-ink">Statement of Responsibilities</h2>
        <p className="text-sm text-gray-600">
          {model.person.name} · {model.smfs.map((s) => s.id).join(", ") || "No SMF"}
        </p>
        <p className={approved ? "mt-2 inline-block rounded border border-forestGreen px-2 py-0.5 text-xs font-bold text-forestGreen" : "mt-2 inline-block rounded border border-amber-600 px-2 py-0.5 text-xs font-bold text-amber-700"}>
          {approved ? `APPROVED by ${model.approvedBy || "—"} on ${formatDate(model.approvedOn)}` : "DRAFT — not approved"}
        </p>

        <DocSection n="1" title="Personal and SMF details">
          <dl className="space-y-1">
            <Row k="Full name" v={model.person.name} />
            <Row k="Job title" v={model.person.jobTitle} />
            <Row k="Firm" v={model.firmName} />
            <Row k="FRN" v={model.frn} />
            <Row k="Category" v={categoryLabel} />
          </dl>
          <ul className="space-y-1 text-sm">
            {model.smfs.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-1">
                <span>
                  <strong>{s.id}</strong> {s.title}
                </span>
                <span className="text-gray-500">{smfStatusLabel(s.status)}</span>
              </li>
            ))}
          </ul>
        </DocSection>

        <DocSection n="2" title="Prescribed responsibilities">
          {model.prescribed.length === 0 ? (
            <p className="text-sm italic text-gray-400">
              {model.category === "limited" ? "Prescribed responsibilities do not apply to Limited Scope firms." : "None allocated."}
            </p>
          ) : (
            model.prescribed.map((pr) => (
              <div key={pr.id} className="rounded border border-gray-200 p-3 text-sm">
                <p className="font-bold">
                  {pr.label} — {pr.title}
                </p>
                <p className="mt-1">{pr.text}</p>
                {pr.shared && <p className="mt-1 text-xs text-gray-600">Shared with: {pr.sharedWith.join(", ") || "—"}</p>}
                {pr.notes && <p className="mt-1 text-xs text-gray-600">How this is split: {pr.notes}</p>}
              </div>
            ))
          )}
        </DocSection>

        <DocSection n="3" title="Other responsibilities and additional information">
          {overall.length > 0 && (
            <div>
              <h4 className="font-sans text-sm font-bold text-ink">Overall responsibilities (SYSC 26)</h4>
              <ul className="ml-5 list-disc text-sm">
                {overall.map((o, i) => (
                  <li key={i}>{o.description ? `${o.title}: ${o.description}` : o.title}</li>
                ))}
              </ul>
            </div>
          )}
          {additional.length > 0 && (
            <div>
              <h4 className="font-sans text-sm font-bold text-ink">Other responsibilities</h4>
              <ul className="ml-5 list-disc text-sm">
                {additional.map((o, i) => (
                  <li key={i}>{o.description ? `${o.title}: ${o.description}` : o.title}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className="font-sans text-sm font-bold text-ink">Additional responsibilities and information</h4>
            <Para text={model.additionalText} empty="None." />
          </div>
          <div>
            <h4 className="font-sans text-sm font-bold text-ink">Reporting line</h4>
            <Para text={model.reportingLine} />
          </div>
          <div>
            <h4 className="font-sans text-sm font-bold text-ink">Committee memberships</h4>
            <Para text={model.committees} empty="None recorded." />
          </div>
        </DocSection>

        <DocSection title="Version control">
          <dl className="space-y-1">
            <Row k="Version" v={`v${version}`} />
            <Row k="Status" v={approved ? "Approved" : "Draft"} />
            <Row k="Approved by" v={approved ? model.approvedBy : ""} />
            <Row k="Approved on" v={approved ? formatDate(model.approvedOn) : ""} />
          </dl>
        </DocSection>
      </div>
    </article>
  );
}
