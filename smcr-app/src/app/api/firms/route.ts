import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { firms, responsibilities, individuals, fitnessAssessments } from "@/lib/schema";
import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";
import type { Individual, FitnessResponse } from "@/lib/validation";
import { requireAuth } from "@/lib/auth-helpers";

const responsibilityMap = new Map(
  PRESCRIBED_RESPONSIBILITIES.map((item) => [item.ref, item.text])
);

type FirmPayload = {
  firmProfile: {
    firmName?: string;
    firmType?: string;
    smcrCategory?: string;
    jurisdictions?: string[];
    isCASSFirm?: boolean;
    optUp?: boolean;
  };
  responsibilityRefs: string[];
  responsibilityOwners?: Record<string, string>;
  individuals?: Individual[];
  fitnessResponses?: FitnessResponse[];
};

export async function POST(request: Request) {
  // Require authentication with rate limiting
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const db = getDb();
  let payload: FirmPayload;

  try {
    payload = (await request.json()) as FirmPayload;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { firmProfile, responsibilityRefs, responsibilityOwners, individuals: indivs, fitnessResponses } = payload;

  if (!firmProfile?.firmName || !firmProfile?.firmType) {
    return NextResponse.json(
      { error: "firmName and firmType are required" },
      { status: 400 }
    );
  }

  try {
    // Insert firm
    const [record] = await db
      .insert(firms)
      .values({
        name: firmProfile.firmName,
        firmType: firmProfile.firmType,
        smcrCategory: firmProfile.smcrCategory,
        isCassFirm: firmProfile.isCASSFirm ?? false,
        optUp: firmProfile.optUp ?? false,
        jurisdictions: firmProfile.jurisdictions?.length
          ? firmProfile.jurisdictions
          : ["UK"],
      })
      .returning({ id: firms.id });

    const firmId = record.id;

    // Insert individuals (SMFs) and capture UUID mapping
    const newIndividualIds: Record<string, string> = {}; // Map payload ID to DB UUID

    if (indivs && indivs.length > 0) {
      for (const ind of indivs) {
        const [inserted] = await db
          .insert(individuals)
          .values({
            firmId,
            fullName: ind.name,
            smfRoles: ind.smfRoles,
            email: ind.email || null,
          })
          .returning({ id: individuals.id });

        if (inserted) {
          newIndividualIds[ind.id] = inserted.id; // Map old ID to new UUID
        }
      }
    }

    // Insert responsibilities with ownership (using mapped UUIDs)
    if (responsibilityRefs?.length) {
      const rows = responsibilityRefs
        .filter((ref) => responsibilityMap.has(ref))
        .map((ref) => {
          const tempOwnerId = responsibilityOwners?.[ref];
          const actualOwnerId = tempOwnerId ? newIndividualIds[tempOwnerId] : null;
          return {
            firmId,
            reference: ref,
            title: responsibilityMap.get(ref) ?? ref,
            status: "assigned",
            ownerId: actualOwnerId || null,
          };
        });

      if (rows.length) {
        await db.insert(responsibilities).values(rows);
      }
    }

    // Insert fitness assessments with corrected individual IDs
    if (fitnessResponses && fitnessResponses.length > 0 && Object.keys(newIndividualIds).length > 0) {
      const fitnessRows = fitnessResponses
        .map((resp) => {
          // New format: questionId is "individualId::sectionId::questionIndex"
          const [oldIndividualId, sectionId, questionIndex] = resp.questionId.split("::");
          const newIndividualId = newIndividualIds[oldIndividualId];

          if (!newIndividualId) {
            console.warn(`No mapping found for individual ID: ${oldIndividualId}`);
            return null;
          }

          // Reconstruct questionId with new UUID
          const newQuestionId = `${newIndividualId}::${sectionId}::${questionIndex}`;

          return {
            individualId: newIndividualId,
            fitSection: newQuestionId, // Store full questionId
            response: resp.response,
            evidenceLinks: resp.evidence ? [resp.evidence] : [],
          };
        })
        .filter((row: {
          individualId: string;
          fitSection: string;
          response: string;
          evidenceLinks: string[];
        } | null): row is {
          individualId: string;
          fitSection: string;
          response: string;
          evidenceLinks: string[];
        } => row !== null);

      if (fitnessRows.length > 0) {
        await db.insert(fitnessAssessments).values(fitnessRows);
      }
    }

    return NextResponse.json({ id: firmId }, { status: 201 });
  } catch (error) {
    console.error("Failed to save firm", error);
    return NextResponse.json(
      { error: "Failed to save firm profile" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/firms - List all firms for authenticated user
 * SECURITY: Requires authentication
 */
export async function GET(request: Request) {
  // Require authentication with rate limiting
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const db = getDb();

  try {
    // TODO: In future, filter firms by user ownership
    const allFirms = await db.select().from(firms).orderBy(firms.createdAt);

    return NextResponse.json({
      drafts: allFirms.map((f) => ({
        id: f.id,
        firmName: f.name,
        updatedAt: f.createdAt?.toISOString() || new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to list firms", error);
    return NextResponse.json(
      { error: "Failed to list drafts" },
      { status: 500 }
    );
  }
}
