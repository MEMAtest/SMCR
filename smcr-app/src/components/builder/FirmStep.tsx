"use client";

import { useState } from "react";
import {
  CATEGORY_LABELS,
  ENHANCED_THRESHOLDS,
  FIRM_SECTORS,
  LIMITED_SCOPE_BASES,
  OUT_OF_SCOPE,
  RULES_META,
  type FirmSector,
  type LimitedScopeBasis,
  type OutOfScopeType,
  type SmcrCategory,
} from "@/lib/rules/fca-solo";
import { getCategorisation } from "@/lib/workspace/derive";
import type { Firm } from "@/lib/workspace/schema";
import { useWorkspace } from "@/stores/useWorkspace";
import { Badge, Callout, Checkbox, Field, Panel, SectionTitle, Select, TextInput, VerifyBadge, cx } from "@/components/ui";
import { numberValue, parseNumber } from "./shared";

const LEGAL_FORMS: { value: Firm["legalForm"]; label: string }[] = [
  { value: "company", label: "Limited company" },
  { value: "partnership", label: "Partnership" },
  { value: "llp", label: "Limited liability partnership (LLP)" },
  { value: "sole_trader", label: "Sole trader" },
  { value: "other", label: "Other" },
];

export const CATEGORY_MEANING: Record<SmcrCategory, string> = {
  limited:
    "A lighter version of the regime: usually one SMF29 (Limited Scope Function) plus SMF16/SMF17 where relevant. No prescribed responsibilities apply; Conduct Rules and Certification still do.",
  core:
    "The baseline regime: SMFs such as SMF1, SMF3, SMF9, SMF16 and SMF17 need FCA approval, each SMF needs a Statement of Responsibilities, and the core prescribed responsibilities must be allocated.",
  enhanced:
    "Everything in Core plus extra SMFs and prescribed responsibilities, a management responsibilities map (SYSC 25) and overall responsibility for every business area and function (SYSC 26).",
};

type ScopeChoice = "solo" | OutOfScopeType;

export function FirmStep() {
  const ws = useWorkspace((s) => s.ws);
  const firm = ws.firm;
  const setFirm = useWorkspace((s) => s.setFirm);
  const categorisation = getCategorisation(ws);
  const frnError = firm.frn && !/^\d{6,7}$/.test(firm.frn.trim()) ? "FRN should be 6 or 7 digits." : undefined;
  const scope: ScopeChoice = firm.outOfScope ?? "solo";

  return (
    <div className="space-y-6">
      <Panel>
        <SectionTitle title="About the firm" description="Used on Statements of Responsibilities, the responsibilities map and the board pack." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Firm name" className="sm:col-span-2" error={!firm.name.trim() ? "Required" : undefined}>
            <TextInput id="firm-name" value={firm.name} onChange={(e) => setFirm({ name: e.target.value })} autoComplete="organization" />
          </Field>
          <Field label="FCA Firm Reference Number (FRN)" hint="6 or 7 digits, from the FCA Register." error={frnError}>
            <TextInput id="firm-frn" inputMode="numeric" value={firm.frn} onChange={(e) => setFirm({ frn: e.target.value.replace(/\s/g, "") })} />
          </Field>
          <Field label="Legal form">
            <Select value={firm.legalForm} onChange={(e) => setFirm({ legalForm: e.target.value as Firm["legalForm"] })}>
              {LEGAL_FORMS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          title="Scope and categorisation"
          description={`Answer these to work out your SM&CR category. Rules pack ${RULES_META.id}, including PS26/6 threshold changes.`}
        />

        <fieldset id="firm-scope" className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-sand">1. How is the firm regulated?</legend>
          {(
            [
              { value: "solo", label: "FCA solo-regulated (FSMA Part 4A permission, not PRA-regulated)" },
              ...Object.entries(OUT_OF_SCOPE).map(([k, v]) => ({ value: k as ScopeChoice, label: v.label })),
            ] as { value: ScopeChoice; label: string }[]
          ).map((o) => (
            <label
              key={o.value}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm",
                scope === o.value ? "border-emerald/60 bg-emerald/10" : "border-white/10 bg-white/5 hover:border-white/25",
              )}
            >
              <input
                type="radio"
                name="firm-scope"
                className="mt-1 accent-emerald"
                checked={scope === o.value}
                onChange={() => setFirm({ outOfScope: o.value === "solo" ? null : o.value })}
              />
              <span className="text-sand">{o.label}</span>
            </label>
          ))}
        </fieldset>

        {firm.outOfScope ? (
          <div className="mt-4">
            <Callout tone="bad" title="This tool does not cover your firm type">
              {OUT_OF_SCOPE[firm.outOfScope].message}
            </Callout>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <fieldset id="firm-sector">
              <legend className="mb-2 text-sm font-semibold text-sand">2. Main sector</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(FIRM_SECTORS) as [FirmSector, { label: string; description: string }][]).map(([k, v]) => (
                  <label
                    key={k}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2",
                      firm.sector === k ? "border-emerald/60 bg-emerald/10" : "border-white/10 bg-white/5 hover:border-white/25",
                    )}
                  >
                    <input type="radio" name="firm-sector" className="mt-1 accent-emerald" checked={firm.sector === k} onChange={() => setFirm({ sector: k })} />
                    <span>
                      <span className="block text-sm text-sand">{v.label}</span>
                      <span className="block text-xs text-sand/60">{v.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!firm.sector && <p className="mt-1 text-xs text-danger">Choose a sector.</p>}
            </fieldset>

            <div>
              <p className="mb-2 text-sm font-semibold text-sand">3. Limited scope</p>
              <Field label="Is the firm a limited scope firm?" hint="Limited scope firms are listed in SYSC 23 Annex 1. If unsure, leave as 'Not a limited scope firm'.">
                <Select value={firm.limitedScopeBasis} onChange={(e) => setFirm({ limitedScopeBasis: e.target.value as LimitedScopeBasis })}>
                  {(Object.entries(LIMITED_SCOPE_BASES) as [LimitedScopeBasis, string][]).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-sand">4. What applies to the firm?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Checkbox
                  label="Holds client money or safe-custody assets"
                  hint="Brings PR (z) — CASS — into scope."
                  checked={firm.holdsClientAssets}
                  onChange={(v) => setFirm({ holdsClientAssets: v, isCassLarge: v ? firm.isCassLarge : false })}
                />
                <Checkbox
                  label="CASS large firm"
                  hint="Automatically makes the firm Enhanced (CASS 1A)."
                  checked={firm.isCassLarge}
                  disabled={!firm.holdsClientAssets}
                  onChange={(v) => setFirm({ isCassLarge: v })}
                />
                <Checkbox label="Authorised fund manager (AFM)" hint="Brings PR (za) — AFM duties — into scope." checked={firm.isAfm} onChange={(v) => setFirm({ isAfm: v })} />
                <Checkbox
                  label="Subject to the Money Laundering Regulations"
                  hint="If so, an SMF17 (MLRO) is expected."
                  checked={firm.subjectToMlr}
                  onChange={(v) => setFirm({ subjectToMlr: v })}
                />
                <Checkbox
                  label="Outsources internal audit"
                  hint="Enhanced firms only: adds the outsourced internal audit responsibility."
                  checked={firm.outsourcesInternalAudit}
                  onChange={(v) => setFirm({ outsourcesInternalAudit: v })}
                />
                <Checkbox
                  label={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      Significant SYSC firm <VerifyBadge />
                    </span>
                  }
                  hint="Makes the firm Enhanced. Check the current test before relying on it."
                  checked={firm.isSignificantIfprFirm}
                  onChange={(v) => setFirm({ isSignificantIfprFirm: v })}
                />
                <Checkbox
                  label="Opt up to Enhanced"
                  hint="Firms can choose to apply the Enhanced regime voluntarily."
                  checked={firm.optUpToEnhanced}
                  onChange={(v) => setFirm({ optUpToEnhanced: v })}
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-sand">5. Enhanced thresholds</p>
              <p className="mb-3 text-xs text-sand/60">
                Leave blank if not relevant. Thresholds reflect the PS26/6 uplift effective 10 July 2026. Meeting any threshold makes the firm Enhanced.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <ThresholdInput
                  label="3-year average assets under management (£bn)"
                  threshold={`Enhanced at £${ENHANCED_THRESHOLDS.aumGbpBn}bn or more`}
                  value={firm.aumGbpBn}
                  onChange={(v) => setFirm({ aumGbpBn: v })}
                />
                <ThresholdInput
                  label="3-year average intermediary regulated revenue (£m)"
                  threshold={`Enhanced at £${ENHANCED_THRESHOLDS.intermediaryRevenueGbpM}m or more`}
                  value={firm.intermediaryRevenueGbpM}
                  onChange={(v) => setFirm({ intermediaryRevenueGbpM: v })}
                />
                <ThresholdInput
                  label="3-year average consumer credit lending revenue (£m)"
                  threshold={`Enhanced at £${ENHANCED_THRESHOLDS.consumerCreditRevenueGbpM}m or more`}
                  value={firm.consumerCreditRevenueGbpM}
                  onChange={(v) => setFirm({ consumerCreditRevenueGbpM: v })}
                />
                <ThresholdInput
                  label="Regulated mortgages outstanding (number)"
                  threshold={`Enhanced at ${ENHANCED_THRESHOLDS.mortgagesOutstanding.toLocaleString("en-GB")} or more`}
                  verify
                  value={firm.mortgagesOutstanding}
                  onChange={(v) => setFirm({ mortgagesOutstanding: v })}
                />
              </div>
            </div>
          </div>
        )}
      </Panel>

      {!firm.outOfScope && (
        <Panel className="border-emerald/30">
          <div aria-live="polite" className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-sand/70">Your SM&amp;CR category</p>
              {categorisation.category && <Badge tone="plum" className="text-sm">{CATEGORY_LABELS[categorisation.category]}</Badge>}
              {categorisation.reasons.some((r) => r.includes("verify")) && <VerifyBadge />}
            </div>
            {categorisation.category && <p className="text-sm text-sand">{CATEGORY_MEANING[categorisation.category]}</p>}
            <p className="text-sm text-sand/70">
              <span className="font-semibold text-sand/90">Why: </span>
              {categorisation.reasons.join("; ")}.
            </p>
            {!firm.sector && <p className="text-xs text-sand/60">Choose a sector to confirm this result.</p>}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ThresholdInput({
  label,
  threshold,
  value,
  onChange,
  verify,
}: {
  label: string;
  threshold: string;
  value: number | null;
  onChange: (v: number | null) => void;
  verify?: boolean;
}) {
  // Local text lets people type intermediate values (e.g. "1.") without losing them.
  const [text, setText] = useState(numberValue(value));
  const [error, setError] = useState<string>();
  return (
    <Field
      label={label}
      error={error}
      hint={
        <span className="inline-flex flex-wrap items-center gap-2">
          {threshold} {verify && <VerifyBadge />}
        </span>
      }
    >
      <TextInput
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNumber(e.target.value);
          if (n === "invalid") setError("Enter a number of zero or more.");
          else {
            setError(undefined);
            onChange(n);
          }
        }}
      />
    </Field>
  );
}

