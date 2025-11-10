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

export const PRESCRIBED_RESPONSIBILITIES = [
  {
    ref: "(a)",
    text: "Responsibility for performance of the firm's obligations under the senior managers regime",
    cat: "all",
  },
  {
    ref: "(b)",
    text: "Responsibility for the certification regime",
    cat: "all",
  },
  {
    ref: "(c)",
    text: "Responsibility for the management responsibilities map",
    cat: "enhanced",
  },
  {
    ref: "(d)",
    text: "Responsibility for countering the risk of the firm being used to further financial crime",
    cat: "all",
  },
];

export const FIT_SECTIONS = [
  {
    id: "honesty",
    title: "Honesty, Integrity & Reputation (FIT 2.1)",
    questions: [
      "Any criminal convictions (spent or unspent) relating to dishonesty or financial crime?",
      "Investigations or disciplinary actions by regulators or professional bodies?",
    ],
  },
  {
    id: "competence",
    title: "Competence & Capability (FIT 2.2)",
    questions: [
      "Demonstrable experience and training relevant to the SMF role?",
      "Sufficient time and resources to discharge the responsibilities?",
    ],
  },
  {
    id: "financial",
    title: "Financial Soundness (FIT 2.3)",
    questions: [
      "Outstanding judgments, bankruptcies, or arrangements with creditors?",
      "Any adverse financial events that could impact independence?",
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
