import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
  responsibilityEvidence?: Record<string, string>;
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

  const { firmProfile, responsibilityRefs, responsibilityOwners, responsibilityEvidence, individuals: indivs, fitnessResponses } = payload;

  if (!firmProfile?.firmName || !firmProfile?.firmType) {
    return NextResponse.json(
      { error: "firmName and firmType are required" },
      { status: 400 }
    );
  }

  try {
    // Create everything in a single DB batch (Neon HTTP driver transaction).
    const firmId = randomUUID();

    // Pre-generate individual UUIDs so we can reference them in responsibilities + FIT rows.
    const newIndividualIds: Record<string, string> = {};
    const individualRows =
      indivs && indivs.length > 0
        ? indivs.map((ind) => {
            const id = randomUUID();
            newIndividualIds[ind.id] = id;
            return {
              id,
              firmId,
              fullName: ind.name,
              smfRoles: ind.smfRoles,
              email: ind.email || null,
            };
          })
        : [];

    const responsibilityRows =
      responsibilityRefs?.length
        ? responsibilityRefs
            .filter((ref) => responsibilityMap.has(ref))
            .map((ref) => {
              const tempOwnerId = responsibilityOwners?.[ref];
              const actualOwnerId = tempOwnerId ? newIndividualIds[tempOwnerId] : null;

              return {
                id: randomUUID(),
                firmId,
                reference: ref,
                title: responsibilityMap.get(ref) ?? ref,
                status: "assigned",
                ownerId: actualOwnerId || null,
                notes: responsibilityEvidence?.[ref] || null,
              };
            })
        : [];

    const fitnessRows =
      fitnessResponses && fitnessResponses.length > 0 && Object.keys(newIndividualIds).length > 0
        ? fitnessResponses
            .map((resp) => {
              // questionId is "individualId::sectionId::questionId"
              const [oldIndividualId, sectionId, questionId] = resp.questionId.split("::");
              const newIndividualId = newIndividualIds[oldIndividualId];

              if (!newIndividualId) {
                console.warn(`No mapping found for individual ID: ${oldIndividualId}`);
                return null;
              }

              // Reconstruct questionId with new UUID
              const newFitSection = `${newIndividualId}::${sectionId}::${questionId}`;

              return {
                id: randomUUID(),
                individualId: newIndividualId,
                fitSection: newFitSection,
                response: resp.response,
                evidenceLinks: resp.evidence ? [resp.evidence] : [],
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
        : [];

    const batchQueries = [
      db.insert(firms).values({
        id: firmId,
        name: firmProfile.firmName,
        firmType: firmProfile.firmType,
        smcrCategory: firmProfile.smcrCategory,
        isCassFirm: firmProfile.isCASSFirm ?? false,
        optUp: firmProfile.optUp ?? false,
        jurisdictions: firmProfile.jurisdictions?.length ? firmProfile.jurisdictions : ["UK"],
      }),
      ...(individualRows.length ? [db.insert(individuals).values(individualRows)] : []),
      ...(responsibilityRows.length ? [db.insert(responsibilities).values(responsibilityRows)] : []),
      ...(fitnessRows.length ? [db.insert(fitnessAssessments).values(fitnessRows)] : []),
    ];

    await db.batch(batchQueries as any);
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
