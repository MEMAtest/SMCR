import { SMF_ROLES, getSuggestedPRsForSMF } from "../smcr-data";
import type { Individual } from "../validation";

export type ResponsibilityOwnerSuggestion = {
  ref: string;
  title: string;
  mandatory: boolean;
  suggestedOwnerId: string;
  suggestedOwnerName: string;
  reasons: string[];
};

const roleLabelByRef = new Map(SMF_ROLES.map((role) => [role.ref, role.label]));

export function extractRoleRef(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Roles are stored as either "SMF1" or "SMF1 - Chief Executive".
  return trimmed.split(" - ")[0]!.trim();
}

export function buildSuggestedResponsibilityRefSet(individuals: Individual[]): Set<string> {
  const out = new Set<string>();
  for (const individual of individuals) {
    for (const rawRole of individual.smfRoles) {
      const roleRef = extractRoleRef(rawRole);
      for (const ref of getSuggestedPRsForSMF(roleRef)) {
        out.add(ref);
      }
    }
  }
  return out;
}

function formatRoleReason(roleRef: string): string {
  const label = roleLabelByRef.get(roleRef);
  return label ? `${roleRef} (${label})` : roleRef;
}

export function buildOwnerSuggestions(input: {
  assignedResponsibilities: Array<{ ref: string; text: string; mandatory: boolean }>;
  individuals: Individual[];
  responsibilityOwners: Record<string, string>;
}): ResponsibilityOwnerSuggestion[] {
  const { assignedResponsibilities, individuals, responsibilityOwners } = input;

  if (assignedResponsibilities.length === 0 || individuals.length === 0) return [];

  // Current load (already-owned responsibilities) to prefer balanced suggestions.
  const ownedCountByIndividual = new Map<string, number>();
  for (const ownerId of Object.values(responsibilityOwners)) {
    if (!ownerId) continue;
    ownedCountByIndividual.set(ownerId, (ownedCountByIndividual.get(ownerId) ?? 0) + 1);
  }

  const suggestions: ResponsibilityOwnerSuggestion[] = [];

  for (const responsibility of assignedResponsibilities) {
    const existingOwner = responsibilityOwners[responsibility.ref];
    if (existingOwner) continue;

    const candidates: Array<{ individual: Individual; matchedRoles: string[] }> = [];

    for (const individual of individuals) {
      const matchedRoles: string[] = [];
      for (const rawRole of individual.smfRoles) {
        const roleRef = extractRoleRef(rawRole);
        const suggestedRefs = getSuggestedPRsForSMF(roleRef);
        if (suggestedRefs.includes(responsibility.ref)) {
          matchedRoles.push(roleRef);
        }
      }
      if (matchedRoles.length > 0) {
        candidates.push({ individual, matchedRoles });
      }
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      // Prefer candidates with more matched roles.
      if (b.matchedRoles.length !== a.matchedRoles.length) {
        return b.matchedRoles.length - a.matchedRoles.length;
      }
      // Then prefer the person with fewer existing assignments (load balancing).
      const aLoad = ownedCountByIndividual.get(a.individual.id) ?? 0;
      const bLoad = ownedCountByIndividual.get(b.individual.id) ?? 0;
      if (aLoad !== bLoad) return aLoad - bLoad;
      // Stable fallback.
      return a.individual.name.localeCompare(b.individual.name);
    });

    const best = candidates[0]!;
    const reasons = best.matchedRoles.map(formatRoleReason);

    suggestions.push({
      ref: responsibility.ref,
      title: responsibility.text,
      mandatory: responsibility.mandatory,
      suggestedOwnerId: best.individual.id,
      suggestedOwnerName: best.individual.name,
      reasons,
    });
  }

  return suggestions;
}
