import { AlertTriangle, Award, CheckCircle2, FileText, Landmark, ShieldCheck, Users } from "lucide-react";
import type { ComponentType } from "react";

export type FirmTypeKey = "Bank" | "Investment" | "Insurance" | "Payments";

export interface FirmType {
  key: FirmTypeKey;
  label: string;
  description: string;
  regime: string;
  icon: ComponentType<{ className?: string }>;
  isSoloRegulated: boolean;
}

export const FIRM_TYPES: Record<FirmTypeKey, FirmType> = {
  Bank: {
    key: "Bank",
    label: "Bank",
    description: "Deposit-taking institutions under PRA & FCA supervision.",
    regime: "SMCR",
    icon: Landmark,
    isSoloRegulated: false,
  },
  Investment: {
    key: "Investment",
    label: "Investment Firm",
    description: "MiFID investment services with FCA solo regulation.",
    regime: "SMCR",
    icon: Users,
    isSoloRegulated: true,
  },
  Insurance: {
    key: "Insurance",
    label: "Insurance",
    description: "Insurance undertakings supervised by PRA/FCA.",
    regime: "SMCR",
    icon: ShieldCheck,
    isSoloRegulated: false,
  },
  Payments: {
    key: "Payments",
    label: "Payments",
    description: "Payment service providers operating under PSD2 perimeter.",
    regime: "PSD",
    icon: FileText,
    isSoloRegulated: true,
  },
};

export const SMCR_CATEGORIES = [
  { key: "limited", label: "Limited Scope" },
  { key: "core", label: "Core" },
  { key: "enhanced", label: "Enhanced" },
] as const;

export interface PrescribedResponsibility {
  ref: string;
  text: string;
  cat: "all" | "enhanced" | "core" | "limited";
  mandatory: boolean;
  firmTypes: FirmTypeKey[];
  cassOnly?: boolean;
  description?: string;
}

export interface SmfRole {
  ref: string;
  label: string;
  description: string;
  firmTypes: FirmTypeKey[];
  category: "all" | "enhanced" | "core" | "limited";
  isExecutive: boolean;
}

export const SMF_ROLES: SmfRole[] = [
  {
    ref: "SMF1",
    label: "Chief Executive",
    description: "Overall responsibility for the conduct of firm business",
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF2",
    label: "Chief Finance Officer",
    description: "Responsibility for management of firm finances including budgeting, financial controls and reporting",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF3",
    label: "Executive Director",
    description: "Significant responsibility for the firm's affairs (board member)",
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF4",
    label: "Chief Risk Officer",
    description: "Responsibility for risk management function",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF5",
    label: "Head of Internal Audit",
    description: "Responsibility for management and supervision of internal audit function",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF6",
    label: "Head of Key Business Area",
    description: "Significant responsibility for a key business area within the firm",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF7",
    label: "Group Entity Senior Manager",
    description: "Responsibility for a group entity's activities",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF9",
    label: "Chair of the Governing Body",
    description: "Chair of the board of directors",
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    category: "all",
    isExecutive: false,
  },
  {
    ref: "SMF10",
    label: "Chair of the Risk Committee",
    description: "Chair of the board risk committee",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: false,
  },
  {
    ref: "SMF11",
    label: "Chair of the Audit Committee",
    description: "Chair of the board audit committee",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: false,
  },
  {
    ref: "SMF12",
    label: "Chair of the Remuneration Committee",
    description: "Chair of the board remuneration committee",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: false,
  },
  {
    ref: "SMF13",
    label: "Chair of the Nomination Committee",
    description: "Chair of the board nomination committee",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: false,
  },
  {
    ref: "SMF14",
    label: "Senior Independent Director",
    description: "Senior independent non-executive board member",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "enhanced",
    isExecutive: false,
  },
  {
    ref: "SMF15",
    label: "Chair of the With-Profits Committee",
    description: "Chair of the with-profits committee (insurance only)",
    firmTypes: ["Insurance"],
    category: "enhanced",
    isExecutive: false,
  },
  {
    ref: "SMF16",
    label: "Compliance Oversight",
    description: "Responsibility for compliance function oversight",
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF17",
    label: "Money Laundering Reporting Officer (MLRO)",
    description: "Statutory MLRO responsibility for anti-money laundering",
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF18",
    label: "Other Overall Responsibility Function",
    description: "Other significant overall responsibility not covered by other SMF roles",
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF19",
    label: "Head of Actuarial Function",
    description: "Responsibility for actuarial function (insurance only)",
    firmTypes: ["Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF20",
    label: "Chief Actuary",
    description: "Chief actuary responsibility (insurance only)",
    firmTypes: ["Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF21",
    label: "With-Profits Actuary",
    description: "With-profits actuary (insurance only)",
    firmTypes: ["Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF22",
    label: "Lloyd's Syndicate Underwriter",
    description: "Lloyd's managing agent SMF (insurance only)",
    firmTypes: ["Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF23",
    label: "Chief Underwriting Officer",
    description: "Chief underwriting officer (insurance only)",
    firmTypes: ["Insurance"],
    category: "enhanced",
    isExecutive: true,
  },
  {
    ref: "SMF24",
    label: "Chief Operations Officer",
    description: "Responsibility for operational functions",
    firmTypes: ["Bank", "Investment", "Insurance"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF27",
    label: "Partner",
    description: "Partners in limited liability partnerships",
    firmTypes: ["Investment"],
    category: "all",
    isExecutive: true,
  },
  {
    ref: "SMF29",
    label: "Limited Scope Function",
    description: "For limited scope SMCR firms",
    firmTypes: ["Investment", "Payments"],
    category: "limited",
    isExecutive: true,
  },
];

export const PRESCRIBED_RESPONSIBILITIES: PrescribedResponsibility[] = [
  {
    ref: "A",
    text: "Responsibility for the firm's performance of its obligations under the senior management regime",
    cat: "all",
    mandatory: true,
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    description: "Overall responsibility for ensuring the firm complies with SMCR requirements",
  },
  {
    ref: "B",
    text: "Responsibility for the firm's performance of its obligations under the employee certification regime",
    cat: "all",
    mandatory: true,
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    description: "Ensuring certification of staff performing significant harm functions",
  },
  {
    ref: "C",
    text: "Responsibility for the firm's policies and procedures for the management responsibilities map",
    cat: "enhanced",
    mandatory: true,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Maintaining and updating the statement of responsibilities and management responsibilities map",
  },
  {
    ref: "D",
    text: "Responsibility for the firm's policies and procedures for countering the risk that the firm might be used to further financial crime",
    cat: "all",
    mandatory: true,
    firmTypes: ["Bank", "Investment", "Insurance", "Payments"],
    description: "Financial crime framework including anti-money laundering and counter-terrorist financing",
  },
  {
    ref: "E",
    text: "Responsibility for the firm's policies and procedures for ensuring compliance with the regulatory system",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Overall compliance monitoring programme and systems & controls framework",
  },
  {
    ref: "F",
    text: "Responsibility for the firm's compliance with CASS (Client Assets Sourcebook)",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Investment"],
    cassOnly: true,
    description: "CASS oversight for firms holding client money or custody assets",
  },
  {
    ref: "G",
    text: "Responsibility for the firm's policies and procedures for the identification, management and mitigation of conduct risk",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Conduct risk framework ensuring fair customer outcomes",
  },
  {
    ref: "H",
    text: "Responsibility for the firm's treasury management functions",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank"],
    description: "Treasury operations including funding, liquidity management, and asset-liability matching",
  },
  {
    ref: "I",
    text: "Responsibility for the firm's risk management function",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Enterprise risk management framework and risk appetite setting",
  },
  {
    ref: "J",
    text: "Responsibility for the firm's compliance with the requirements of the regulatory system about the management of actual and potential conflicts of interest",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Investment", "Insurance"],
    description: "Conflicts of interest policy and management",
  },
  {
    ref: "K",
    text: "Responsibility for safeguarding independence of, and oversight of, the performance of the internal audit function",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Internal audit independence and effectiveness oversight",
  },
  {
    ref: "L",
    text: "Responsibility for leading the development of the firm's culture by the governing body as a whole",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Board-level responsibility for firm culture and values",
  },
  {
    ref: "M",
    text: "Responsibility for the firm's policies and procedures for outsourcing arrangements",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Outsourcing governance including critical third-party oversight",
  },
  {
    ref: "N",
    text: "Responsibility for the firm's business model assessment and strategy",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Insurance"],
    description: "Strategic planning and business model sustainability",
  },
  {
    ref: "O",
    text: "Responsibility for the firm's policies and procedures for business continuity and disaster recovery",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Business continuity management and operational resilience",
  },
  {
    ref: "P",
    text: "Responsibility for the firm's policies and procedures relating to insurance distribution",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Insurance"],
    description: "Insurance distribution oversight including product governance",
  },
  {
    ref: "Q",
    text: "Responsibility for the firm's policies and procedures for the management of information security and IT infrastructure",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Investment", "Insurance"],
    description: "Cybersecurity, data protection, and technology risk management",
  },
  {
    ref: "R",
    text: "Responsibility for the firm's policies and procedures for the management of group-wide oversight",
    cat: "enhanced",
    mandatory: false,
    firmTypes: ["Bank", "Insurance"],
    description: "Group governance for firms that are part of larger corporate structures",
  },
];

/**
 * SMF to PR Mapping - Intelligent suggestions for responsibility assignment
 * Maps which prescribed responsibilities are typically owned by each SMF role
 */
export const SMF_PR_MAPPING: Record<string, string[]> = {
  SMF1: ["A", "C", "L", "N"], // CEO - Overall responsibility, MRM, Culture, Strategy
  SMF2: ["H", "N"], // CFO - Treasury, Business model
  SMF3: [], // Executive Director - varies by role
  SMF4: ["I", "J"], // CRO - Risk management, Conduct risk
  SMF5: ["K"], // Head of Internal Audit - Audit oversight
  SMF6: [], // Head of Key Business Area - varies
  SMF7: ["R"], // Group Entity SM - Group oversight
  SMF9: ["L"], // Chair - Culture
  SMF10: ["I"], // Chair Risk Committee - Risk oversight
  SMF11: ["K"], // Chair Audit Committee - Audit oversight
  SMF12: [], // Chair Remuneration Committee
  SMF13: [], // Chair Nomination Committee
  SMF14: [], // Senior Independent Director
  SMF15: [], // Chair With-Profits Committee
  SMF16: ["B", "E", "G"], // Compliance - Certification, Compliance monitoring, Conduct risk
  SMF17: ["D"], // MLRO - Financial crime
  SMF18: [], // Other - varies
  SMF19: [], // Head of Actuarial
  SMF20: [], // Chief Actuary
  SMF21: [], // With-Profits Actuary
  SMF22: [], // Lloyd's Syndicate Underwriter
  SMF23: [], // Chief Underwriting Officer
  SMF24: ["M", "O", "Q"], // COO - Outsourcing, Business continuity, IT security
  SMF27: [], // Partner
  SMF29: [], // Limited Scope
};

/**
 * Helper function to get applicable PRs based on firm profile
 */
export function getApplicablePRs(
  firmType: FirmTypeKey,
  smcrCategory: string,
  isCASSFirm: boolean
): PrescribedResponsibility[] {
  return PRESCRIBED_RESPONSIBILITIES.filter((pr) => {
    // Must apply to this firm type
    if (!pr.firmTypes.includes(firmType)) {
      return false;
    }

    // CASS-only PRs only shown if firm is CASS
    if (pr.cassOnly && !isCASSFirm) {
      return false;
    }

    // Category filtering
    if (pr.cat === "all") {
      return true; // All categories
    }
    if (pr.cat === "enhanced" && smcrCategory === "enhanced") {
      return true;
    }
    if (pr.cat === "core" && (smcrCategory === "core" || smcrCategory === "enhanced")) {
      return true;
    }
    if (pr.cat === "limited" && smcrCategory === "limited") {
      return true;
    }

    return false;
  });
}

/**
 * Helper function to get applicable SMF roles based on firm profile
 */
export function getApplicableSMFs(
  firmType: FirmTypeKey,
  smcrCategory: string
): SmfRole[] {
  return SMF_ROLES.filter((smf) => {
    // Must apply to this firm type
    if (!smf.firmTypes.includes(firmType)) {
      return false;
    }

    // Category filtering
    if (smf.category === "all") {
      return true;
    }
    if (smf.category === "enhanced" && smcrCategory === "enhanced") {
      return true;
    }
    if (smf.category === "core" && (smcrCategory === "core" || smcrCategory === "enhanced")) {
      return true;
    }
    if (smf.category === "limited" && smcrCategory === "limited") {
      return true;
    }

    return false;
  });
}

/**
 * Get suggested PRs for a given SMF role
 */
export function getSuggestedPRsForSMF(smfRef: string): string[] {
  return SMF_PR_MAPPING[smfRef] || [];
}

export interface FitQuestion {
  id: string;
  question: string;
  type: "yesno" | "text" | "date";
  requiresDetails?: boolean; // If yes, show follow-up text field
  requiresDate?: boolean; // If yes, show date field
  helpText?: string;
}

export interface FitSection {
  id: string;
  title: string;
  description: string;
  questions: FitQuestion[];
}

export const FIT_SECTIONS: FitSection[] = [
  {
    id: "honesty",
    title: "Honesty, Integrity & Reputation (FIT 2.1)",
    description: "Assessment of integrity, ethical conduct, and reputation in financial services",
    questions: [
      {
        id: "criminal_convictions",
        question: "Any criminal convictions (spent or unspent) relating to dishonesty, fraud, or financial crime?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
        helpText: "Include all convictions regardless of jurisdiction",
      },
      {
        id: "regulatory_investigations",
        question: "Subject to any regulatory investigations or disciplinary actions by the FCA, PRA, or other regulatory bodies?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
        helpText: "Include ongoing and completed investigations",
      },
      {
        id: "fiduciary_breach",
        question: "Any breach of fiduciary duty or trust in a professional capacity?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Consider duties owed to clients, employers, or beneficiaries",
      },
      {
        id: "director_disqualification",
        question: "Disqualified from acting as a director or been involved in company insolvency proceedings?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
        helpText: "Include director disqualification orders and voluntary disqualifications",
      },
      {
        id: "market_abuse",
        question: "Engaged in or investigated for market abuse, insider dealing, or market manipulation?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
      },
      {
        id: "money_laundering",
        question: "Any involvement in money laundering or terrorist financing offenses?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
        helpText: "Include suspicions, investigations, or proven offenses",
      },
      {
        id: "fraud_misrepresentation",
        question: "Allegations or findings of fraud, misrepresentation, or dishonest conduct?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Include civil and criminal proceedings",
      },
      {
        id: "civil_proceedings",
        question: "Civil proceedings with adverse findings related to financial services activity?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Include judgments, settlements, or ongoing cases",
      },
      {
        id: "overseas_sanctions",
        question: "Disciplinary actions or sanctions from overseas regulators or financial services bodies?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
      },
      {
        id: "professional_sanctions",
        question: "Sanctions or reprimands from professional bodies (e.g., accountancy, legal, actuarial)?",
        type: "yesno",
        requiresDetails: true,
      },
      {
        id: "adverse_media",
        question: "Adverse media reports or public information raising integrity concerns?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Consider reputation risk and public perception",
      },
      {
        id: "previous_refusal",
        question: "Previously refused, restricted, or withdrawn from FCA/PRA approved person status?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
      },
    ],
  },
  {
    id: "competence",
    title: "Competence & Capability (FIT 2.2)",
    description: "Assessment of skills, knowledge, and ability to perform the SMF role effectively",
    questions: [
      {
        id: "relevant_qualifications",
        question: "Hold relevant qualifications for the senior management function?",
        type: "yesno",
        requiresDetails: true,
        helpText: "List professional qualifications, certifications, and degrees",
      },
      {
        id: "relevant_experience",
        question: "Demonstrable experience in financial services relevant to the SMF role?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Describe previous roles, duration, and key responsibilities",
      },
      {
        id: "cpd_commitment",
        question: "Commitment to continuous professional development (CPD)?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Describe CPD activities, training plans, and professional memberships",
      },
      {
        id: "track_record",
        question: "Positive track record in previous senior management or equivalent roles?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Include references, performance reviews, or testimonials",
      },
      {
        id: "references",
        question: "Can provide satisfactory references from previous employers or regulators?",
        type: "yesno",
        requiresDetails: true,
      },
      {
        id: "technical_knowledge",
        question: "Sufficient technical knowledge of relevant regulations, products, and markets?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Consider SMCR, conduct rules, and sector-specific regulations",
      },
      {
        id: "time_commitment",
        question: "Sufficient time available to discharge the responsibilities effectively?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Consider other directorships, commitments, and time allocation",
      },
      {
        id: "regulatory_knowledge",
        question: "Understanding of FCA/PRA regulatory framework and conduct standards?",
        type: "yesno",
        requiresDetails: true,
      },
      {
        id: "conflicts_disclosure",
        question: "Any conflicts of interest that could impair independence or judgment?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Include financial interests, relationships, or external commitments",
      },
      {
        id: "language_proficiency",
        question: "Sufficient language proficiency to perform the role effectively?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Consider communication requirements with regulators and stakeholders",
      },
    ],
  },
  {
    id: "financial",
    title: "Financial Soundness (FIT 2.3)",
    description: "Assessment of financial soundness and independence from financial pressures",
    questions: [
      {
        id: "ccj_orders",
        question: "Any County Court Judgments (CCJs) or unsatisfied court orders?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
        helpText: "Include satisfied and unsatisfied judgments",
      },
      {
        id: "bankruptcy",
        question: "Ever been declared bankrupt or entered into bankruptcy proceedings?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
      },
      {
        id: "iva_dro",
        question: "Individual Voluntary Arrangement (IVA) or Debt Relief Order (DRO) in place or previously?",
        type: "yesno",
        requiresDetails: true,
        requiresDate: true,
      },
      {
        id: "creditor_arrangements",
        question: "Any arrangements with creditors, debt management plans, or outstanding debts?",
        type: "yesno",
        requiresDetails: true,
      },
      {
        id: "litigation_exposure",
        question: "Currently involved in any litigation with material financial exposure?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Consider potential impact on independence",
      },
      {
        id: "tax_compliance",
        question: "Fully compliant with all tax obligations in all relevant jurisdictions?",
        type: "yesno",
        requiresDetails: true,
        helpText: "Include HMRC investigations or settlements",
      },
      {
        id: "financial_stability",
        question: "Current financial position stable and free from pressures that could impair judgment?",
        type: "yesno",
        requiresDetails: true,
      },
      {
        id: "guarantees_liabilities",
        question: "Any personal guarantees or contingent liabilities that could create financial pressure?",
        type: "yesno",
        requiresDetails: true,
      },
    ],
  },
];

export const REPORT_INSIGHTS = [
  {
    label: "Responsibilities coverage",
    value: "92%",
    subLabel: "All mandatory PRs mapped",
    icon: CheckCircle2,
    tone: "positive" as const,
  },
  {
    label: "Outstanding attestations",
    value: "3",
    subLabel: "FIT evidence pending",
    icon: AlertTriangle,
    tone: "warning" as const,
  },
  {
    label: "Certification letters",
    value: "12",
    subLabel: "Ready for e-signature",
    icon: Award,
    tone: "positive" as const,
  },
];

export const SAMPLE_PIE = [
  { name: "Complete", value: 92 },
  { name: "Outstanding", value: 8 },
];

export const SAMPLE_BAR = [
  { name: "SMF1", complete: 100, outstanding: 0 },
  { name: "SMF3", complete: 90, outstanding: 10 },
  { name: "SMF16", complete: 60, outstanding: 40 },
];

export type JourneyStepKey = "firm" | "responsibilities" | "fitness" | "reports";

export type JourneyStep = {
  id: JourneyStepKey;
  title: string;
  description: string;
  status: "pending" | "active" | "done" | "partial";
};

export const DEFAULT_STEPS: JourneyStep[] = [
  { id: "firm", title: "Firm Profile", description: "Define firm perimeter & SMCR category", status: "active" },
  { id: "responsibilities", title: "Responsibilities", description: "Assign SMFs + PRs", status: "pending" },
  { id: "fitness", title: "Fitness & Propriety", description: "Capture attestations", status: "pending" },
  { id: "reports", title: "Reports", description: "Generate outputs", status: "pending" },
];
