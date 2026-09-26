/**
 * Serialises the rules pack into a stable, citable text block for the AI
 * features. Every item gets a source ID such as `[PR:b-1]`, `[SMF:SMF16]`,
 * `[DEADLINE:temporaryCover]` or `[META:PS26/6]` so answers can cite it and the
 * server can reject citations that do not exist in the pack.
 *
 * Deterministic by design (no timestamps, fixed ordering) so the text can be
 * prompt-cached. Pure data — safe to import on the client (for citation chips).
 */
import {
  CATEGORY_LABELS,
  CERTIFICATION_FUNCTIONS,
  CONDUCT_RULES,
  DEADLINES,
  DEADLINE_SOURCES,
  ENHANCED_THRESHOLDS,
  EXPECTED_SMFS,
  FIT_SECTIONS,
  LIMITED_SCOPE_BASES,
  NON_FINANCIAL_MISCONDUCT_NOTE,
  OUT_OF_SCOPE,
  PRESCRIBED_RESPONSIBILITIES,
  RULES_META,
  SMF_DEFINITIONS,
  prLabel,
} from "@/lib/rules/fca-solo";

export interface RuleSource {
  /** Source ID without brackets, e.g. "PR:b-1". */
  id: string;
  /** Short human label for citation chips. */
  label: string;
  /** Handbook / publication reference, where known. */
  ref?: string;
  /** Not confirmed against the live Handbook. */
  verify: boolean;
  /** Full text placed in the prompt. */
  text: string;
}

function metaKey(label: string, fallback: string): string {
  const m = label.match(/(PS\d+\/\d+|FG\d+\/\d+|SYSC \d+|SUP \d+[A-Z]*)/);
  if (m) return m[1].replace(/\s+/g, "");
  if (/solo-regulated firms/i.test(label)) return "solo-guide";
  return fallback;
}

function buildSources(): RuleSource[] {
  const out: RuleSource[] = [];

  /* ---- META ---- */
  out.push({
    id: "META:pack",
    label: `Rules pack ${RULES_META.id}`,
    verify: false,
    text: `${RULES_META.title}. Version ${RULES_META.id}, as of ${RULES_META.asOf}. Caveat: ${RULES_META.caveat}`,
  });
  const metaByKey = new Map<string, RuleSource>();
  RULES_META.includes.forEach((inc, i) => {
    const key = `META:${metaKey(inc, `include-${i + 1}`)}`;
    const src: RuleSource = { id: key, label: inc.split(" (")[0], verify: false, text: `Included in this pack: ${inc}.` };
    metaByKey.set(key, src);
    out.push(src);
  });
  RULES_META.pending.forEach((p, i) => {
    out.push({ id: `META:pending-${i + 1}`, label: "Pending reform (Phase 2)", verify: true, text: `Pending, not yet in force: ${p}.` });
  });
  RULES_META.sources.forEach((s, i) => {
    const key = `META:${metaKey(s.label, `source-${i + 1}`)}`;
    const existing = metaByKey.get(key);
    if (existing) {
      existing.text += ` Publication: ${s.label} (${s.url}).`;
      existing.ref = s.label;
    } else {
      const src: RuleSource = { id: key, label: s.label, ref: s.label, verify: false, text: `Reference source: ${s.label} (${s.url}).` };
      metaByKey.set(key, src);
      out.push(src);
    }
  });

  /* ---- Scope and categories ---- */
  for (const [k, v] of Object.entries(OUT_OF_SCOPE)) {
    out.push({ id: `SCOPE:${k}`, label: `Out of scope: ${v.label}`, verify: false, text: `${v.label} — ${v.message}` });
  }
  const t = ENHANCED_THRESHOLDS;
  out.push({
    id: "CAT:thresholds",
    label: "Enhanced firm thresholds",
    ref: "PS26/6",
    verify: true,
    text:
      `A firm is Enhanced if any applies: CASS large firm; 3-year average AUM ≥ £${t.aumGbpBn}bn; 3-year average intermediary regulated revenue ≥ £${t.intermediaryRevenueGbpM}m; ` +
      `3-year average consumer credit lending revenue ≥ £${t.consumerCreditRevenueGbpM}m; ≥ ${t.mortgagesOutstanding} regulated mortgages outstanding (verify threshold); significant SYSC firm (verify current test); or the firm opts up. ` +
      `Thresholds as amended by PS26/6 from 10 July 2026 (approx. 30% uplift).`,
  });
  out.push({
    id: "CAT:limited",
    label: `${CATEGORY_LABELS.limited} firms`,
    verify: false,
    text:
      `Limited Scope firms include: ${Object.entries(LIMITED_SCOPE_BASES)
        .filter(([k]) => k !== "none")
        .map(([, v]) => v)
        .join("; ")}. Prescribed responsibilities do not apply to Limited Scope firms. ` +
      `Expected SMFs: ${EXPECTED_SMFS.limited.map((e) => `${e.id} (${e.condition})`).join("; ")}.`,
  });
  out.push({
    id: "CAT:core",
    label: `${CATEGORY_LABELS.core} firms`,
    verify: EXPECTED_SMFS.core.some((e) => e.condition.includes("verify")),
    text:
      "Core is the default category for FCA solo-regulated firms that are not Limited Scope or Enhanced. " +
      `Expected SMFs: ${EXPECTED_SMFS.core.map((e) => `${e.id} (${e.condition})`).join("; ")}.`,
  });
  out.push({
    id: "CAT:enhanced",
    label: `${CATEGORY_LABELS.enhanced} firms`,
    verify: false,
    text:
      "Enhanced firms meet a threshold in [CAT:thresholds] or opt up. They must also keep a management responsibilities map (SYSC 25), allocate overall responsibility for every activity, business area and management function (SYSC 26), and hold the additional Enhanced prescribed responsibilities. " +
      `Expected SMFs: ${EXPECTED_SMFS.enhanced.map((e) => `${e.id} (${e.condition})`).join("; ")}.`,
  });

  /* ---- Prescribed responsibilities ---- */
  for (const pr of PRESCRIBED_RESPONSIBILITIES) {
    const verify = !!pr.verify || !pr.letterConfirmed;
    const conditions = [
      pr.requiresCass ? "only if the firm holds client money or custody assets" : "",
      pr.requiresAfm ? "only for authorised fund managers" : "",
      pr.id === "enh-outsourced-ia" ? "only if internal audit is outsourced" : "",
    ].filter(Boolean);
    out.push({
      id: `PR:${pr.id}`,
      label: `${prLabel(pr)}${pr.letter ? ` ${pr.title}` : ""}`,
      ref: pr.handbookRef,
      verify,
      text:
        `${pr.letter ? `Prescribed responsibility letter (${pr.letter})${pr.letterConfirmed ? "" : " — letter NOT confirmed"}` : "Prescribed responsibility (letter not confirmed)"}: ${pr.title}. ` +
        `Text: "${pr.text}" Applies to: ${pr.categories.map((c) => CATEGORY_LABELS[c]).join(", ")} firms${conditions.length ? ` (${conditions.join("; ")})` : ""}. ` +
        `Why: ${pr.why} Typical holders (guidance, not a rule): ${pr.typicalHolders.join(", ")}.${pr.nedExpected ? " Normally held by a non-executive." : ""} ` +
        `Handbook: ${pr.handbookRef}.`,
    });
  }

  /* ---- SMFs ---- */
  for (const s of SMF_DEFINITIONS) {
    out.push({
      id: `SMF:${s.id}`,
      label: `${s.id} ${s.title}`,
      ref: "SUP 10C",
      verify: !!s.verify,
      text:
        `${s.id} ${s.title} (${s.kind.replace("_", "-")}): ${s.description} Applies to: ${s.categories.map((c) => CATEGORY_LABELS[c]).join(", ")} firms. ` +
        `${s.requiresApproval ? "Requires FCA pre-approval (Phase 2 may make some SMFs notification-only)." : "Notification only."}`,
    });
  }

  /* ---- Certification functions ---- */
  for (const cf of CERTIFICATION_FUNCTIONS) {
    out.push({ id: `CF:${cf.id}`, label: `Certification function: ${cf.title}`, ref: "SYSC 27", verify: !!cf.verify, text: `${cf.title}: ${cf.description}` });
  }
  out.push({
    id: "CF:regime",
    label: "Certification Regime",
    ref: "SYSC 27",
    verify: true,
    text: `Certified staff must be assessed as fit and proper and issued a certificate at least every ${DEADLINES.annualAssessmentMonths} months. Pending: ${RULES_META.pending[0]}.`,
  });

  /* ---- Conduct Rules ---- */
  for (const r of CONDUCT_RULES) {
    out.push({
      id: `COCON:${r.id}`,
      label: `Conduct Rule ${r.id}`,
      ref: r.tier === "senior" ? "COCON 2.2" : "COCON 2.1",
      verify: false,
      text: `${r.tier === "senior" ? "Senior Manager Conduct Rule" : "Individual Conduct Rule"} ${r.id}: ${r.text}`,
    });
  }
  out.push({ id: "COCON:NFM", label: "Non-financial misconduct", ref: "COCON 1.1.7FR; PS25/23", verify: false, text: NON_FINANCIAL_MISCONDUCT_NOTE });

  /* ---- FIT ---- */
  for (const s of FIT_SECTIONS) {
    out.push({
      id: `FIT:${s.id}`,
      label: `${s.handbookRef} ${s.title}`,
      ref: s.handbookRef,
      verify: false,
      text: `${s.handbookRef} ${s.title}: the firm's fitness and propriety assessment covers ${s.questions.length} matters in this section.`,
    });
  }

  /* ---- Deadlines ---- */
  const d = DEADLINES;
  const deadlineText: Record<string, string> = {
    temporaryCover: `When someone provides temporary cover for an SMF, the SMF application must be SUBMITTED within ${d.temporaryCoverWeeks} weeks of cover starting (PS26/6).`,
    criminalRecordCheck: `A criminal records check must be no more than ${d.criminalRecordCheckValidityMonths} months old when the SMF application is submitted (PS26/6).`,
    formC: `Form C must be submitted within ${d.formCBusinessDays} business days of an SMF ceasing to perform the function.`,
    smfConductBreach: `Disciplinary action against an SMF for a Conduct Rule breach must be notified to the FCA (Form D) within ${d.smfConductBreachBusinessDays} business days.`,
    directory: `FCA Directory updates must be made within ${d.directoryUpdateWorkingDays} working days (PS26/6).`,
    regulatoryReference: `Regulatory references cover the previous ${d.regulatoryReferenceLookbackYears} years; PS26/6 guidance is to respond to requests within ${d.regulatoryReferenceResponseWeeks} weeks.`,
    annualAssessment: `Fitness and propriety of SMFs and certified staff must be re-assessed, and certificates renewed, at least every ${d.annualAssessmentMonths} months.`,
    sorBatch: `Under PS26/6 revised Statements of Responsibilities can be submitted in batches, at least every ${d.sorBatchMonths} months.`,
    rep008: `Annual Conduct Rules breach report (REP008): period ends ${d.rep008PeriodEnd.day}/${d.rep008PeriodEnd.month}, due by ${d.rep008Due.day}/${d.rep008Due.month}. Nil returns are required.`,
  };
  for (const [key, source] of Object.entries(DEADLINE_SOURCES)) {
    out.push({
      id: `DEADLINE:${key}`,
      label: `Deadline: ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
      ref: source,
      verify: /verify/i.test(source) || key === "rep008",
      text: `${deadlineText[key] ?? ""} Source: ${source}.`.trim(),
    });
  }
  out.push({
    id: "DEADLINE:fcaDecision",
    label: "Deadline: FCA decision period",
    ref: "FSMA s61",
    verify: true,
    text: `The FCA must decide a complete SMF application within ${d.fcaDecisionMonthsComplete} months (${d.fcaDecisionMonthsIncomplete} months if incomplete). Source: FSMA s61 (verify).`,
  });

  return out;
}

export const RULE_SOURCES: RuleSource[] = buildSources();

export const RULE_SOURCE_INDEX: ReadonlyMap<string, RuleSource> = new Map(RULE_SOURCES.map((s) => [s.id, s]));

/** Accepts "PR:b-1", "[PR:b-1]" or " pr:b-1 " style IDs and returns the canonical ID if it exists. */
export function normaliseSourceId(raw: string): string | null {
  const cleaned = raw.trim().replace(/^\[|\]$/g, "").trim();
  if (RULE_SOURCE_INDEX.has(cleaned)) return cleaned;
  const [prefix, ...rest] = cleaned.split(":");
  if (!rest.length) return null;
  const candidate = `${prefix.toUpperCase()}:${rest.join(":")}`;
  if (RULE_SOURCE_INDEX.has(candidate)) return candidate;
  // SMF IDs are upper case (SMF:smf16 -> SMF:SMF16)
  const upper = `${prefix.toUpperCase()}:${rest.join(":").toUpperCase()}`;
  return RULE_SOURCE_INDEX.has(upper) ? upper : null;
}

export function resolveSource(id: string): RuleSource | undefined {
  const n = normaliseSourceId(id);
  return n ? RULE_SOURCE_INDEX.get(n) : undefined;
}

/** The complete, deterministic rules pack text used as the cached system block. */
export const RULES_CONTEXT_TEXT: string = [
  `<rules_pack id="${RULES_META.id}" as_of="${RULES_META.asOf}">`,
  "Each entry starts with its source ID in square brackets. Cite entries by that ID (without brackets) in the citations field.",
  "Entries marked VERIFY have not been confirmed against the live FCA Handbook and must be presented as uncertain.",
  "",
  ...RULE_SOURCES.map((s) => `[${s.id}]${s.verify ? " (VERIFY)" : ""}${s.ref ? ` {ref: ${s.ref}}` : ""} ${s.text}`),
  "</rules_pack>",
].join("\n");
