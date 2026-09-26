/** Lightweight FG19/2 quality hints for free-text SoR responsibilities. Guidance only. */

const VAGUE = ["assist", "assists", "assisting", "support", "supports", "supporting", "involved in", "help", "helps", "contribute", "contributes", "as required", "as appropriate", "various", "etc", "general"];
const SKILLS = ["experienced", "experience in", "expertise", "skilled", "qualified", "knowledge of"];

export interface QualityHint {
  tone: "warn" | "info";
  message: string;
}

function findTerms(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((t) => new RegExp(`\\b${t.replace(/ /g, "\\s+")}\\b`).test(lower));
}

export function sorQualityHints(text: string): QualityHint[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const hints: QualityHint[] = [];
  const words = trimmed.split(/\s+/).length;
  if (words < 15)
    hints.push({ tone: "warn", message: "Very short. FG19/2 expects each responsibility to be specific and self-contained, so a reader understands it without other documents." });
  const vague = findTerms(trimmed, VAGUE);
  if (vague.length)
    hints.push({
      tone: "warn",
      message: `Vague wording: ${vague.map((v) => `“${v}”`).join(", ")}. Say what the senior manager is accountable for, rather than that they assist or support others.`,
    });
  const skills = findTerms(trimmed, SKILLS);
  if (skills.length)
    hints.push({ tone: "info", message: `Mentions ${skills.map((v) => `“${v}”`).join(", ")}. SoRs describe accountability, not skills or experience.` });
  if (/\b(see|refer to|as set out in)\b.*\b(policy|manual|terms of reference|handbook)\b/i.test(trimmed))
    hints.push({ tone: "info", message: "Refers to another document. The SoR should be self-contained; summarise what matters instead." });
  return hints;
}
