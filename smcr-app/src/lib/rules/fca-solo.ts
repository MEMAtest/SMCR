/**
 * FCA SM&CR rules pack for FCA solo-regulated firms.
 *
 * All regulated content lives here as data so it can be versioned, reviewed and
 * replaced without touching UI code. Anything not confirmed against the live
 * FCA Handbook carries `verify: true` and is surfaced in the UI as such.
 *
 * IMPORTANT: this pack must be signed off by a compliance professional against
 * the Handbook (SYSC 24-27, SUP 10C, COCON, FIT, SYSC 22) before being relied on.
 */

export const RULES_META = {
  id: "fca-solo-2026.09",
  asOf: "2026-09-26",
  title: "FCA SM&CR — solo-regulated firms",
  includes: [
    "PS26/6 Phase 1 reforms (in force 24 April – 1 September 2026)",
    "PS25/23 non-financial misconduct (COCON 1.1.7FR, from 1 September 2026)",
  ],
  pending: [
    "Phase 2: Certification Regime to move from statute into FCA rules (HMT confirmed April 2026; no commencement date)",
    "Phase 2: some SMFs may become notification-only (no pre-approval)",
  ],
  caveat:
    "Reference data to be confirmed against the live FCA Handbook before reliance. Items marked 'verify' could not be confirmed at build time.",
  sources: [
    { label: "SYSC 24 – Prescribed responsibilities", url: "https://handbook.fca.org.uk/handbook/sysc24" },
    { label: "SUP 10C – Senior managers regime", url: "https://handbook.fca.org.uk/handbook/sup10c" },
    { label: "FCA PS26/6 – SM&CR review Phase 1", url: "https://www.fca.org.uk/publications/policy-statements/ps26-6-senior-managers-certification-regime-review" },
    { label: "FG19/2 – SoRs and responsibilities maps", url: "https://www.fca.org.uk/publications/finalised-guidance/fg19-2-smcr-guidance-statements-responsibilities-and-responsibilities-maps" },
    { label: "FCA guide for solo-regulated firms", url: "https://www.fca.org.uk/publication/policy/guide-for-fca-solo-regulated-firms.pdf" },
  ],
} as const;

/* ------------------------------------------------------------------------ */
/* Firm scope & categorisation                                               */
/* ------------------------------------------------------------------------ */

export type SmcrCategory = "limited" | "core" | "enhanced";

export const CATEGORY_LABELS: Record<SmcrCategory, string> = {
  limited: "Limited Scope",
  core: "Core",
  enhanced: "Enhanced",
};

export type FirmSector =
  | "investment"
  | "asset_manager"
  | "financial_adviser"
  | "insurance_intermediary"
  | "mortgage"
  | "consumer_credit"
  | "other_fca";

/** Firm types that are NOT covered by this solo-regulated rules pack. */
export type OutOfScopeType = "dual_regulated" | "payments_emoney";

export const FIRM_SECTORS: Record<FirmSector, { label: string; description: string }> = {
  investment: { label: "Investment firm", description: "MiFID / investment services (e.g. brokers, dealers, arrangers)." },
  asset_manager: { label: "Asset / fund manager", description: "Portfolio management, including authorised fund managers (AFMs)." },
  financial_adviser: { label: "Financial adviser / wealth", description: "Advice and wealth management firms." },
  insurance_intermediary: { label: "Insurance intermediary", description: "Brokers and other insurance distributors." },
  mortgage: { label: "Mortgage broker / lender", description: "Regulated mortgage activities." },
  consumer_credit: { label: "Consumer credit", description: "Consumer credit lending and broking." },
  other_fca: { label: "Other FCA solo-regulated", description: "Any other FSMA Part 4A firm regulated solely by the FCA." },
};

export const OUT_OF_SCOPE: Record<OutOfScopeType, { label: string; message: string }> = {
  dual_regulated: {
    label: "Bank, building society, insurer or PRA-designated investment firm",
    message:
      "Dual-regulated firms follow the PRA/FCA banking or insurance SM&CR, which has different SMFs and prescribed responsibilities. This tool covers FCA solo-regulated firms only.",
  },
  payments_emoney: {
    label: "Payment or e-money institution (PSRs / EMRs only)",
    message:
      "Firms authorised only under the Payment Services or E-Money Regulations are generally outside SM&CR. Check your permissions — if you also hold Part 4A permissions, choose your sector instead.",
  },
};

export type LimitedScopeBasis =
  | "none"
  | "limited_permission_consumer_credit"
  | "insurance_ancillary"
  | "not_for_profit_debt_advice"
  | "other_limited";

export const LIMITED_SCOPE_BASES: Record<LimitedScopeBasis, string> = {
  none: "Not a limited scope firm",
  limited_permission_consumer_credit: "Limited permission consumer credit firm",
  insurance_ancillary: "Insurance distribution is ancillary to a non-financial main business",
  not_for_profit_debt_advice: "Not-for-profit debt advice body",
  other_limited: "Other limited scope type (e.g. certain service companies, oil market participants)",
};

/** Enhanced thresholds as amended by PS26/6 from 10 July 2026 (≈30% uplift). */
export const ENHANCED_THRESHOLDS = {
  aumGbpBn: 65,
  intermediaryRevenueGbpM: 45,
  consumerCreditRevenueGbpM: 130,
  mortgagesOutstanding: 10000,
} as const;

export interface CategorisationInput {
  outOfScope?: OutOfScopeType | null;
  limitedScopeBasis?: LimitedScopeBasis;
  isCassLarge?: boolean;
  aumGbpBn?: number | null;
  intermediaryRevenueGbpM?: number | null;
  consumerCreditRevenueGbpM?: number | null;
  mortgagesOutstanding?: number | null;
  isSignificantIfprFirm?: boolean;
  optUpToEnhanced?: boolean;
}

export interface CategorisationResult {
  category: SmcrCategory | null;
  reasons: string[];
  outOfScope?: OutOfScopeType;
}

export function categoriseFirm(input: CategorisationInput): CategorisationResult {
  if (input.outOfScope) {
    return { category: null, outOfScope: input.outOfScope, reasons: [OUT_OF_SCOPE[input.outOfScope].message] };
  }
  const t = ENHANCED_THRESHOLDS;
  const enhancedReasons: string[] = [];
  if (input.isCassLarge) enhancedReasons.push("CASS large firm");
  if ((input.aumGbpBn ?? 0) >= t.aumGbpBn) enhancedReasons.push(`3-year average AUM ≥ £${t.aumGbpBn}bn`);
  if ((input.intermediaryRevenueGbpM ?? 0) >= t.intermediaryRevenueGbpM)
    enhancedReasons.push(`3-year average intermediary regulated revenue ≥ £${t.intermediaryRevenueGbpM}m`);
  if ((input.consumerCreditRevenueGbpM ?? 0) >= t.consumerCreditRevenueGbpM)
    enhancedReasons.push(`3-year average consumer credit lending revenue ≥ £${t.consumerCreditRevenueGbpM}m`);
  if ((input.mortgagesOutstanding ?? 0) >= t.mortgagesOutstanding)
    enhancedReasons.push(`≥ ${t.mortgagesOutstanding.toLocaleString("en-GB")} regulated mortgages outstanding (verify threshold)`);
  if (input.isSignificantIfprFirm) enhancedReasons.push("Significant SYSC firm (verify current test)");

  if (enhancedReasons.length) return { category: "enhanced", reasons: enhancedReasons };
  if (input.optUpToEnhanced) return { category: "enhanced", reasons: ["Firm has opted up to Enhanced"] };
  if (input.limitedScopeBasis && input.limitedScopeBasis !== "none") {
    return { category: "limited", reasons: [LIMITED_SCOPE_BASES[input.limitedScopeBasis]] };
  }
  return { category: "core", reasons: ["Default category for FCA solo-regulated firms that are not limited scope or enhanced"] };
}

/* ------------------------------------------------------------------------ */
/* Prescribed responsibilities (SYSC 24.2.6R)                                */
/* ------------------------------------------------------------------------ */

export interface PrescribedResponsibility {
  /** Stable internal key. Equals the handbook letter where confirmed. */
  id: string;
  /** Handbook letter, e.g. "b-1". */
  letter: string;
  /** False where the letter could not be confirmed at build time. */
  letterConfirmed: boolean;
  title: string;
  text: string;
  categories: SmcrCategory[];
  /** Only applies if the firm holds client money / custody assets. */
  requiresCass?: boolean;
  /** Only applies to authorised fund managers. */
  requiresAfm?: boolean;
  /** Plain-English explanation of why it applies. */
  why: string;
  /** SMFs this is commonly allocated to (guidance, not a rule). */
  typicalHolders: string[];
  /** PR is normally held by a non-executive. */
  nedExpected?: boolean;
  handbookRef: string;
  verify?: boolean;
}

export const PRESCRIBED_RESPONSIBILITIES: PrescribedResponsibility[] = [
  {
    id: "a",
    letter: "a",
    letterConfirmed: true,
    title: "Senior Managers Regime",
    text: "Responsibility for the firm's performance of its obligations under the senior managers regime.",
    categories: ["core", "enhanced"],
    why: "Someone must own the firm's SMF approvals, Statements of Responsibilities and (for Enhanced firms) the responsibilities map.",
    typicalHolders: ["SMF1", "SMF3", "SMF27"],
    handbookRef: "SYSC 24.2.6R",
  },
  {
    id: "b",
    letter: "b",
    letterConfirmed: true,
    title: "Certification Regime",
    text: "Responsibility for the firm's performance of its obligations under the employee certification regime.",
    categories: ["core", "enhanced"],
    why: "The firm must identify certified staff, assess their fitness and propriety and issue certificates at least annually.",
    typicalHolders: ["SMF1", "SMF3", "SMF16"],
    handbookRef: "SYSC 24.2.6R",
  },
  {
    id: "b-1",
    letter: "b-1",
    letterConfirmed: true,
    title: "Conduct Rules training and reporting",
    text: "Responsibility for the firm's performance of its obligations in respect of notifications and training of the Conduct Rules.",
    categories: ["core", "enhanced"],
    why: "Staff must be told which Conduct Rules apply to them and trained on them; breaches must be notified to the FCA.",
    typicalHolders: ["SMF1", "SMF3", "SMF16"],
    handbookRef: "SYSC 24.2.6R; COCON 2; SUP 15.11",
  },
  {
    id: "d",
    letter: "d",
    letterConfirmed: true,
    title: "Financial crime",
    text: "Responsibility for the firm's policies and procedures for countering the risk that the firm might be used to further financial crime.",
    categories: ["core", "enhanced"],
    why: "Every Core and Enhanced firm needs a senior manager accountable for anti-financial-crime systems and controls.",
    typicalHolders: ["SMF16", "SMF17", "SMF1", "SMF3"],
    handbookRef: "SYSC 24.2.6R; SYSC 6.3",
  },
  {
    id: "z",
    letter: "z",
    letterConfirmed: true,
    title: "Client assets (CASS)",
    text: "Responsibility for the firm's compliance with CASS.",
    categories: ["core", "enhanced"],
    requiresCass: true,
    why: "Applies because the firm holds client money or safe-custody assets. CASS must be owned by an SMF (SMF18 may also hold it).",
    typicalHolders: ["SMF3", "SMF24", "SMF18"],
    handbookRef: "SYSC 24.2.6R; CASS 1A.3",
  },
  {
    id: "za",
    letter: "za",
    letterConfirmed: true,
    title: "Authorised fund manager duties",
    text: "Responsibility for an authorised fund manager's value for money assessments, independent director representation and acting in the best interests of fund investors.",
    categories: ["core", "enhanced"],
    requiresAfm: true,
    why: "Applies to authorised fund managers — usually allocated to the Chair of the AFM board.",
    typicalHolders: ["SMF9"],
    nedExpected: true,
    handbookRef: "SYSC 24.2.6R; COLL 6.6",
  },
  {
    id: "c",
    letter: "c",
    letterConfirmed: false,
    title: "Management responsibilities map",
    text: "Responsibility for the firm's compliance with the requirements of the regulatory system about the management responsibilities map.",
    categories: ["enhanced"],
    why: "Enhanced firms must keep a single, up-to-date responsibilities map (SYSC 25).",
    typicalHolders: ["SMF1", "SMF3"],
    handbookRef: "SYSC 24.2.6R; SYSC 25",
    verify: true,
  },
  {
    id: "enh-internal-audit",
    letter: "",
    letterConfirmed: false,
    title: "Internal audit independence",
    text: "Responsibility for safeguarding the independence and oversight of the performance of the internal audit function.",
    categories: ["enhanced"],
    why: "Enhanced firms must protect the independence of internal audit — usually the Chair of the Audit Committee.",
    typicalHolders: ["SMF11"],
    nedExpected: true,
    handbookRef: "SYSC 24.2.6R",
    verify: true,
  },
  {
    id: "enh-compliance",
    letter: "",
    letterConfirmed: false,
    title: "Compliance function independence",
    text: "Responsibility for safeguarding the independence and oversight of the performance of the compliance function.",
    categories: ["enhanced"],
    why: "Enhanced firms must protect the independence of compliance — usually a non-executive (e.g. SMF9 or SMF14).",
    typicalHolders: ["SMF9", "SMF14", "SMF10"],
    nedExpected: true,
    handbookRef: "SYSC 24.2.6R",
    verify: true,
  },
  {
    id: "enh-risk",
    letter: "",
    letterConfirmed: false,
    title: "Risk function independence",
    text: "Responsibility for safeguarding the independence and oversight of the performance of the risk function.",
    categories: ["enhanced"],
    why: "Enhanced firms must protect the independence of the risk function — usually the Chair of the Risk Committee.",
    typicalHolders: ["SMF10"],
    nedExpected: true,
    handbookRef: "SYSC 24.2.6R",
    verify: true,
  },
  {
    id: "enh-outsourced-ia",
    letter: "",
    letterConfirmed: false,
    title: "Outsourced internal audit",
    text: "If the firm outsources its internal audit function, responsibility for taking reasonable steps to ensure that every person involved in the performance of the service is independent from the persons who perform external audit.",
    categories: ["enhanced"],
    why: "Only relevant if internal audit is outsourced — the provider must be independent from the external auditor.",
    typicalHolders: ["SMF11"],
    nedExpected: true,
    handbookRef: "SYSC 24.2.6R",
    verify: true,
  },
  {
    id: "enh-business-model",
    letter: "",
    letterConfirmed: false,
    title: "Business model",
    text: "Responsibility for developing and maintaining the firm's business model.",
    categories: ["enhanced"],
    why: "Enhanced firms must have a senior manager accountable for the business model — usually the CEO.",
    typicalHolders: ["SMF1"],
    handbookRef: "SYSC 24.2.6R",
    verify: true,
  },
  {
    id: "enh-stress-tests",
    letter: "",
    letterConfirmed: false,
    title: "Internal stress tests",
    text: "Responsibility for managing the firm's internal stress-tests and ensuring the accuracy and timeliness of information provided to the FCA for the purposes of stress-testing.",
    categories: ["enhanced"],
    why: "Enhanced firms must own internal stress testing — usually the CFO or CRO.",
    typicalHolders: ["SMF2", "SMF4"],
    handbookRef: "SYSC 24.2.6R",
    verify: true,
  },
];

export function prLabel(pr: PrescribedResponsibility): string {
  return pr.letter ? `PR (${pr.letter})` : pr.title;
}

export function getPR(id: string): PrescribedResponsibility | undefined {
  return PRESCRIBED_RESPONSIBILITIES.find((pr) => pr.id === id);
}

export function getApplicablePRs(ctx: {
  category: SmcrCategory | null;
  holdsClientAssets?: boolean;
  isAfm?: boolean;
  outsourcesInternalAudit?: boolean;
}): PrescribedResponsibility[] {
  if (!ctx.category || ctx.category === "limited") return [];
  return PRESCRIBED_RESPONSIBILITIES.filter((pr) => {
    if (!pr.categories.includes(ctx.category as SmcrCategory)) return false;
    if (pr.requiresCass && !ctx.holdsClientAssets) return false;
    if (pr.requiresAfm && !ctx.isAfm) return false;
    if (pr.id === "enh-outsourced-ia" && !ctx.outsourcesInternalAudit) return false;
    return true;
  });
}

/* ------------------------------------------------------------------------ */
/* Senior Management Functions (SUP 10C)                                     */
/* ------------------------------------------------------------------------ */

export interface SmfDefinition {
  id: string;
  title: string;
  description: string;
  categories: SmcrCategory[];
  kind: "executive" | "non_executive" | "required";
  /** Needs FCA pre-approval (Phase 2 may make some notification-only). */
  requiresApproval: boolean;
  verify?: boolean;
}

export const SMF_DEFINITIONS: SmfDefinition[] = [
  { id: "SMF1", title: "Chief Executive", description: "Responsible, under the board, for conducting the whole business.", categories: ["core", "enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF2", title: "Chief Finance", description: "Responsible for management of the firm's financial resources and reporting.", categories: ["enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF3", title: "Executive Director", description: "Board member who is an employee or executive of the firm.", categories: ["core", "enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF4", title: "Chief Risk", description: "Overall responsibility for the risk management function.", categories: ["enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF5", title: "Head of Internal Audit", description: "Responsible for the internal audit function.", categories: ["enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF7", title: "Group Entity Senior Manager", description: "Group employee with significant influence over the firm's management.", categories: ["core", "enhanced"], kind: "executive", requiresApproval: true, verify: true },
  { id: "SMF9", title: "Chair", description: "Chair of the governing body.", categories: ["core", "enhanced"], kind: "non_executive", requiresApproval: true },
  { id: "SMF10", title: "Chair of the Risk Committee", description: "Chairs the board risk committee.", categories: ["enhanced"], kind: "non_executive", requiresApproval: true },
  { id: "SMF11", title: "Chair of the Audit Committee", description: "Chairs the board audit committee.", categories: ["enhanced"], kind: "non_executive", requiresApproval: true },
  { id: "SMF12", title: "Chair of the Remuneration Committee", description: "Chairs the board remuneration committee.", categories: ["enhanced"], kind: "non_executive", requiresApproval: true },
  { id: "SMF13", title: "Chair of the Nominations Committee", description: "Chairs the board nominations committee.", categories: ["enhanced"], kind: "non_executive", requiresApproval: true },
  { id: "SMF14", title: "Senior Independent Director", description: "Senior independent non-executive director.", categories: ["enhanced"], kind: "non_executive", requiresApproval: true },
  { id: "SMF16", title: "Compliance Oversight", description: "Oversight of the firm's compliance function.", categories: ["limited", "core", "enhanced"], kind: "required", requiresApproval: true },
  { id: "SMF17", title: "Money Laundering Reporting Officer", description: "Nominated officer for anti-money laundering (where the MLRs apply).", categories: ["limited", "core", "enhanced"], kind: "required", requiresApproval: true },
  { id: "SMF18", title: "Other Overall Responsibility", description: "Overall responsibility for an activity, business area or function not covered by another SMF. Since PS26/6 may hold any prescribed responsibility.", categories: ["enhanced"], kind: "executive", requiresApproval: true, verify: true },
  { id: "SMF24", title: "Chief Operations", description: "Responsible for internal operations and technology.", categories: ["enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF27", title: "Partner", description: "Partner in a partnership or member of an LLP with significant responsibility.", categories: ["core", "enhanced"], kind: "executive", requiresApproval: true },
  { id: "SMF29", title: "Limited Scope Function", description: "Senior manager of a limited scope firm with responsibility for its regulated activities.", categories: ["limited"], kind: "executive", requiresApproval: true, verify: true },
];

export function getSmf(id: string): SmfDefinition | undefined {
  return SMF_DEFINITIONS.find((s) => s.id === id);
}

export function getApplicableSmfs(category: SmcrCategory | null): SmfDefinition[] {
  if (!category) return [];
  return SMF_DEFINITIONS.filter((s) => s.categories.includes(category));
}

/** SMFs every firm in the category is expected to have, where relevant. */
export const EXPECTED_SMFS: Record<SmcrCategory, { id: string; condition: string }[]> = {
  limited: [{ id: "SMF29", condition: "at least one person performing the limited scope function" }],
  core: [
    { id: "SMF16", condition: "if the firm carries on designated investment business or is otherwise required (verify)" },
    { id: "SMF17", condition: "if the firm is subject to the Money Laundering Regulations" },
  ],
  enhanced: [
    { id: "SMF16", condition: "compliance oversight" },
    { id: "SMF17", condition: "if subject to the Money Laundering Regulations" },
  ],
};

/* ------------------------------------------------------------------------ */
/* Certification Regime (SYSC 27)                                            */
/* ------------------------------------------------------------------------ */

export interface CertificationFunction {
  id: string;
  title: string;
  description: string;
  verify?: boolean;
}

export const CERTIFICATION_FUNCTIONS: CertificationFunction[] = [
  { id: "significant_management", title: "Significant management", description: "Senior managers of significant business units who are not SMFs.", verify: true },
  { id: "qualification", title: "Functions requiring qualifications", description: "Roles subject to qualification requirements in the Training and Competence sourcebook (e.g. retail advisers)." },
  { id: "client_dealing", title: "Client-dealing", description: "Dealing with clients in connection with regulated activities." },
  { id: "manager_of_certified", title: "Manager of certification employees", description: "Managing or supervising a certified person (directly or indirectly)." },
  { id: "proprietary_trader", title: "Proprietary trader", description: "Proprietary trading in investments." },
  { id: "cass_oversight", title: "CASS oversight", description: "CASS oversight at a CASS medium/large firm where not performed by an SMF." },
  { id: "material_risk_taker", title: "Material risk taker", description: "Material risk takers under the applicable remuneration code." },
  { id: "algorithmic_trading", title: "Algorithmic trading", description: "Approving or deploying algorithmic trading strategies." },
  { id: "benchmark", title: "Benchmark functions", description: "Benchmark submission and administration functions.", verify: true },
];

/* ------------------------------------------------------------------------ */
/* Conduct Rules (COCON)                                                     */
/* ------------------------------------------------------------------------ */

export const CONDUCT_RULES = [
  { id: "IR1", tier: "individual", text: "You must act with integrity." },
  { id: "IR2", tier: "individual", text: "You must act with due skill, care and diligence." },
  { id: "IR3", tier: "individual", text: "You must be open and cooperative with the FCA, the PRA and other regulators." },
  { id: "IR4", tier: "individual", text: "You must pay due regard to the interests of customers and treat them fairly." },
  { id: "IR5", tier: "individual", text: "You must observe proper standards of market conduct." },
  { id: "IR6", tier: "individual", text: "You must act to deliver good outcomes for retail customers." },
  { id: "SC1", tier: "senior", text: "You must take reasonable steps to ensure that the business of the firm for which you are responsible is controlled effectively." },
  { id: "SC2", tier: "senior", text: "You must take reasonable steps to ensure that the business of the firm for which you are responsible complies with the relevant requirements and standards of the regulatory system." },
  { id: "SC3", tier: "senior", text: "You must take reasonable steps to ensure that any delegation of your responsibilities is to an appropriate person and that you oversee the discharge of the delegated responsibility effectively." },
  { id: "SC4", tier: "senior", text: "You must disclose appropriately any information of which the FCA or PRA would reasonably expect notice." },
] as const;

export type ConductRuleId = (typeof CONDUCT_RULES)[number]["id"];

export const NON_FINANCIAL_MISCONDUCT_NOTE =
  "From 1 September 2026 (PS25/23, COCON 1.1.7FR) serious non-financial misconduct such as bullying, harassment and violence can be a Conduct Rule breach and is relevant to fitness and propriety.";

/* ------------------------------------------------------------------------ */
/* Fitness & propriety (FIT)                                                 */
/* ------------------------------------------------------------------------ */

export type FitAnswer = "yes" | "no" | "na";

export interface FitQuestion {
  id: string;
  text: string;
  /** Which answer is a potential concern that must be explained and reviewed. */
  adverseAnswer: "yes" | "no";
  allowNA?: boolean;
  /** Ask for a date when the adverse answer is given. */
  askDate?: boolean;
  help?: string;
}

export interface FitSection {
  id: "fit21" | "fit22" | "fit23";
  title: string;
  handbookRef: string;
  questions: FitQuestion[];
}

export const FIT_SECTIONS: FitSection[] = [
  {
    id: "fit21",
    title: "Honesty, integrity and reputation",
    handbookRef: "FIT 2.1",
    questions: [
      { id: "criminal_conviction", text: "Has the individual ever been convicted of a criminal offence (other than spent convictions that need not be disclosed)?", adverseAnswer: "yes", askDate: true, help: "Include offences involving dishonesty, fraud, financial crime or violence. Check against the DBS/Disclosure Scotland/AccessNI certificate." },
      { id: "pending_proceedings", text: "Is the individual currently the subject of any criminal proceedings or investigation?", adverseAnswer: "yes", askDate: true },
      { id: "civil_findings", text: "Has any civil court made an adverse finding against the individual in connection with financial services, fraud or misconduct?", adverseAnswer: "yes", askDate: true },
      { id: "regulatory_action", text: "Has the individual been the subject of disciplinary, enforcement or other action by the FCA, PRA or any other regulator?", adverseAnswer: "yes", askDate: true },
      { id: "professional_body", text: "Has any professional or trade body taken disciplinary action against the individual or refused membership?", adverseAnswer: "yes", askDate: true },
      { id: "dismissal", text: "Has the individual been dismissed, or asked to resign, from any employment or office?", adverseAnswer: "yes", askDate: true },
      { id: "refused_authorisation", text: "Has the individual (or a firm they managed) ever been refused authorisation, registration or a licence?", adverseAnswer: "yes", askDate: true },
      { id: "conduct_breach", text: "Has the individual been found to have breached the Conduct Rules, or been disciplined for conduct?", adverseAnswer: "yes", askDate: true },
      { id: "non_financial_misconduct", text: "Is there any finding or open investigation of serious non-financial misconduct (e.g. bullying, harassment, violence)?", adverseAnswer: "yes", askDate: true, help: "Relevant to FIT from 1 September 2026 (PS25/23)." },
      { id: "regulatory_references_clear", text: "Have regulatory references for the previous 6 years been obtained and are they free of adverse information?", adverseAnswer: "no", allowNA: true, help: "SYSC 22 — N/A only where no previous regulated employer exists." },
      { id: "disclosure_candour", text: "Has the individual been open and complete in all disclosures made to the firm and to regulators?", adverseAnswer: "no" },
    ],
  },
  {
    id: "fit22",
    title: "Competence and capability",
    handbookRef: "FIT 2.2",
    questions: [
      { id: "experience", text: "Does the individual have relevant experience for the role and responsibilities being allocated?", adverseAnswer: "no" },
      { id: "qualifications", text: "Does the individual hold any qualifications required for the role (e.g. T&C requirements)?", adverseAnswer: "no", allowNA: true },
      { id: "regulatory_knowledge", text: "Does the individual understand the regulatory requirements relevant to their responsibilities?", adverseAnswer: "no" },
      { id: "time_commitment", text: "Can the individual commit sufficient time to the role, taking account of other roles?", adverseAnswer: "no" },
      { id: "cpd", text: "Has the individual completed continuing professional development over the last 12 months?", adverseAnswer: "no" },
      { id: "conduct_rules_training", text: "Has the individual completed Conduct Rules training, including the Senior Manager Conduct Rules?", adverseAnswer: "no" },
      { id: "health_capacity", text: "Is there any health or other matter that would prevent the individual performing the role?", adverseAnswer: "yes", help: "Consider reasonable adjustments; this is about capability, not disability." },
    ],
  },
  {
    id: "fit23",
    title: "Financial soundness",
    handbookRef: "FIT 2.3",
    questions: [
      { id: "ccj", text: "Has the individual had any county court judgments or similar judgments for debt?", adverseAnswer: "yes", askDate: true },
      { id: "bankruptcy", text: "Has the individual been declared bankrupt, had a sequestration order, or entered a debt relief order?", adverseAnswer: "yes", askDate: true },
      { id: "iva", text: "Has the individual entered an individual voluntary arrangement or other arrangement with creditors?", adverseAnswer: "yes", askDate: true },
      { id: "insolvent_company", text: "Has any company the individual directed or managed become insolvent while they were involved, or within a year of them leaving?", adverseAnswer: "yes", askDate: true },
      { id: "credit_check", text: "Has a credit check been completed with no material adverse findings?", adverseAnswer: "no" },
    ],
  },
];

export const FIT_QUESTION_COUNT = FIT_SECTIONS.reduce((n, s) => n + s.questions.length, 0);

export function isAdverse(question: FitQuestion, answer: FitAnswer | undefined): boolean {
  return answer === question.adverseAnswer;
}

/* ------------------------------------------------------------------------ */
/* Deadlines and recurring obligations                                       */
/* ------------------------------------------------------------------------ */

export const DEADLINES = {
  /** PS26/6: SMF application must be SUBMITTED within 12 weeks of temporary cover starting. */
  temporaryCoverWeeks: 12,
  /** FCA statutory decision period for a complete SMF application. */
  fcaDecisionMonthsComplete: 3,
  fcaDecisionMonthsIncomplete: 6,
  /** PS26/6: criminal records check valid for 6 months before application. */
  criminalRecordCheckValidityMonths: 6,
  /** Form C when an SMF ceases, business days. */
  formCBusinessDays: 7,
  /** Form D notification of SMF Conduct Rule disciplinary action, business days. */
  smfConductBreachBusinessDays: 7,
  /** PS26/6: Directory updates, working days. */
  directoryUpdateWorkingDays: 20,
  /** Regulatory references: look back (years). */
  regulatoryReferenceLookbackYears: 6,
  /** PS26/6 guidance: respond to reference requests within (weeks). */
  regulatoryReferenceResponseWeeks: 4,
  /** Certification and F&P re-assessment (months). */
  annualAssessmentMonths: 12,
  /** PS26/6: batch SoR/MRM updates at least every (months). */
  sorBatchMonths: 6,
  /** REP008: reporting period ends 31 Aug, due by 31 Oct (verify). */
  rep008PeriodEnd: { month: 8, day: 31 },
  rep008Due: { month: 10, day: 31 },
} as const;

export const DEADLINE_SOURCES: Record<string, string> = {
  temporaryCover: "SUP 10C.3.13R as amended by PS26/6",
  criminalRecordCheck: "SUP 10C / PS26/6",
  formC: "SUP 10C.14",
  smfConductBreach: "SUP 15.11",
  directory: "SUP 16 / PS26/6",
  regulatoryReference: "SYSC 22",
  annualAssessment: "SYSC 27; FIT 1.2",
  sorBatch: "SUP 10C.11 as amended by PS26/6",
  rep008: "SUP 15.11 / REP008 (verify dates)",
};
