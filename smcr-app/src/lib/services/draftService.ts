/**
 * Draft Service - Abstraction layer for SMCR draft persistence
 *
 * This service hides the actual storage backend (currently Neon Postgres,
 * but could be swapped for other providers) from the UI layer.
 *
 * The UI calls saveDraft() and loadDraft() without knowing the provider details.
 */

import type { FirmProfile, Individual, FitnessResponse } from "@/lib/validation";

export type DraftData = {
  firmProfile: FirmProfile;
  responsibilityAssignments: Record<string, boolean>;
  responsibilityOwners: Record<string, string>;
  individuals: Individual[];
  fitnessResponses: FitnessResponse[];
};

export type SaveDraftResult = {
  success: boolean;
  draftId?: string;
  error?: string;
};

export type LoadDraftResult = {
  success: boolean;
  data?: DraftData;
  error?: string;
};

/**
 * Saves the current wizard state to secure draft storage
 * @param data - The complete state to persist
 * @param existingDraftId - Optional ID to update existing draft
 * @returns Result with draft ID on success
 */
export async function saveDraft(
  data: DraftData,
  existingDraftId?: string
): Promise<SaveDraftResult> {
  try {
    const method = existingDraftId ? "PUT" : "POST";
    const url = existingDraftId ? `/api/firms/${existingDraftId}` : "/api/firms";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firmProfile: data.firmProfile,
        responsibilityRefs: Object.entries(data.responsibilityAssignments)
          .filter(([, value]) => value)
          .map(([ref]) => ref),
        responsibilityOwners: data.responsibilityOwners,
        individuals: data.individuals,
        fitnessResponses: data.fitnessResponses,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch((e) => {
        console.warn('Failed to parse error response:', e);
        return { error: "Unknown error" };
      });
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: Failed to save draft`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      draftId: result.id || existingDraftId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error while saving draft",
    };
  }
}

/**
 * Loads a draft by ID from secure storage
 * @param draftId - The draft ID to retrieve
 * @returns Result with draft data on success
 */
export async function loadDraft(draftId: string): Promise<LoadDraftResult> {
  try {
    const response = await fetch(`/api/firms/${draftId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch((e) => {
        console.warn('Failed to parse error response:', e);
        return { error: "Unknown error" };
      });
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: Failed to load draft`,
      };
    }

    const result = await response.json();

    // Import PRESCRIBED_RESPONSIBILITIES to initialize all responsibilities
    const { PRESCRIBED_RESPONSIBILITIES } = await import("@/lib/smcr-data");

    // Transform API response to match store structure
    // Initialize ALL responsibilities to false, then set loaded ones to true
    const responsibilityAssignments: Record<string, boolean> = {};
    PRESCRIBED_RESPONSIBILITIES.forEach((pr) => {
      responsibilityAssignments[pr.ref] = false;
    });

    // Set loaded responsibilities to true
    if (result.responsibilities && Array.isArray(result.responsibilities)) {
      result.responsibilities.forEach((resp: { ref: string }) => {
        responsibilityAssignments[resp.ref] = true;
      });
    }

    const responsibilityOwners: Record<string, string> = {};
    if (result.responsibilities && Array.isArray(result.responsibilities)) {
      result.responsibilities.forEach((resp: { ref: string; ownerId: string | null }) => {
        if (resp.ownerId) {
          responsibilityOwners[resp.ref] = resp.ownerId;
        }
      });
    }

    return {
      success: true,
      data: {
        firmProfile: {
          firmName: result.firmName,
          firmType: result.firmType,
          smcrCategory: result.smcrCategory,
          jurisdictions: result.jurisdictions || ["UK"],
          isCASSFirm: result.isCASSFirm,
          optUp: result.optUp,
        },
        responsibilityAssignments,
        responsibilityOwners,
        individuals: result.individuals || [],
        fitnessResponses: result.fitnessResponses || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error while loading draft",
    };
  }
}

/**
 * Lists all drafts for the current user
 * Note: This requires authentication to be implemented
 * @returns Array of draft metadata
 */
export async function listDrafts(): Promise<{
  success: boolean;
  drafts?: Array<{
    id: string;
    firmName: string;
    updatedAt: string;
  }>;
  error?: string;
}> {
  try {
    const response = await fetch("/api/firms", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: Failed to list drafts`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      drafts: result.drafts || [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error while listing drafts",
    };
  }
}

/**
 * Deletes a draft by ID
 * @param draftId - The draft ID to delete
 * @returns Success status
 */
export async function deleteDraft(draftId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/firms/${draftId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: Failed to delete draft`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error while deleting draft",
    };
  }
}
