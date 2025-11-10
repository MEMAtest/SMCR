import { NextResponse } from "next/server";
import { eq, sql, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { firms, responsibilities, individuals, fitnessAssessments } from "@/lib/schema";
import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";
import { requireAuth } from "@/lib/auth-helpers";

const responsibilityMap = new Map(
  PRESCRIBED_RESPONSIBILITIES.map((item) => [item.ref, item.text])
);

/**
 * GET /api/firms/[id] - Retrieve a specific firm with all related data
 * SECURITY: Requires authentication
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Require authentication with rate limiting
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const db = getDb();
  const firmId = params.id;

  try {
    // Get firm
    const [firm] = await db.select().from(firms).where(eq(firms.id, firmId));

    if (!firm) {
      return NextResponse.json({ error: "Firm not found" }, { status: 404 });
    }

    // Get responsibilities
    const resp = await db
      .select()
      .from(responsibilities)
      .where(eq(responsibilities.firmId, firmId));

    // Get individuals
    const indivs = await db
      .select()
      .from(individuals)
      .where(eq(individuals.firmId, firmId));

    // Get fitness assessments for all individuals
    const individualIds = indivs.map((i) => i.id);
    const fitness =
      individualIds.length > 0
        ? await db
            .select()
            .from(fitnessAssessments)
            .where(inArray(fitnessAssessments.individualId, individualIds))
        : [];

    return NextResponse.json({
      id: firm.id,
      firmName: firm.name,
      firmType: firm.firmType,
      smcrCategory: firm.smcrCategory,
      jurisdictions: firm.jurisdictions,
      isCASSFirm: firm.isCassFirm,
      optUp: firm.optUp,
      responsibilities: resp.map((r) => ({
        ref: r.reference,
        title: r.title,
        ownerId: r.ownerId,
      })),
      individuals: indivs.map((i) => ({
        id: i.id,
        name: i.fullName,
        smfRoles: i.smfRoles,
        email: i.email,
      })),
      fitnessResponses: fitness.map((f) => {
        // fitSection now stores the full questionId in format "individualId::sectionId::questionIndex"
        const [individualId, sectionId] = f.fitSection.split("::");
        return {
          sectionId: sectionId || f.fitSection, // Fallback for old data
          questionId: f.fitSection, // Full questionId
          response: f.response || "",
          evidence: f.evidenceLinks && f.evidenceLinks.length > 0 ? f.evidenceLinks[0] : "",
        };
      }),
    });
  } catch (error) {
    console.error("Failed to retrieve firm", error);
    return NextResponse.json(
      { error: "Failed to retrieve firm" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/firms/[id] - Update an existing firm
 * SECURITY: Requires authentication
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Require authentication with rate limiting
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const db = getDb();
  const firmId = params.id;

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { firmProfile, responsibilityRefs, responsibilityOwners, individuals: indivs, fitnessResponses } = payload;

  try {
    // Update firm
    if (firmProfile) {
      await db
        .update(firms)
        .set({
          name: firmProfile.firmName,
          firmType: firmProfile.firmType,
          smcrCategory: firmProfile.smcrCategory,
          isCassFirm: firmProfile.isCASSFirm ?? false,
          optUp: firmProfile.optUp ?? false,
          jurisdictions: firmProfile.jurisdictions || ["UK"],
        })
        .where(eq(firms.id, firmId));
    }

    // Get existing individuals to delete their fitness assessments
    const existingIndividuals = await db.select().from(individuals).where(eq(individuals.firmId, firmId));
    const existingIndividualIds = existingIndividuals.map((i) => i.id);

    // Delete fitness assessments for existing individuals
    if (existingIndividualIds.length > 0) {
      await db.delete(fitnessAssessments).where(inArray(fitnessAssessments.individualId, existingIndividualIds));
    }

    // Delete existing data
    await db.delete(responsibilities).where(eq(responsibilities.firmId, firmId));
    await db.delete(individuals).where(eq(individuals.firmId, firmId));

    // Insert individuals FIRST and capture UUID mapping
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

    // Now insert responsibilities with mapped owner IDs
    if (responsibilityRefs && responsibilityRefs.length > 0) {
      const rows = responsibilityRefs
        .filter((ref: string) => responsibilityMap.has(ref))
        .map((ref: string) => {
          const tempOwnerId = responsibilityOwners?.[ref];
          const mappedOwnerId = tempOwnerId ? newIndividualIds[tempOwnerId] : null;

          return {
            firmId,
            reference: ref,
            title: responsibilityMap.get(ref) ?? ref,
            status: "assigned",
            ownerId: mappedOwnerId || null,
          };
        });

      if (rows.length > 0) {
        await db.insert(responsibilities).values(rows);
      }
    }

    // Insert fitness assessments with corrected individual IDs
    if (fitnessResponses && fitnessResponses.length > 0 && Object.keys(newIndividualIds).length > 0) {
      const fitnessRows = fitnessResponses
        .map((resp: any) => {
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

    return NextResponse.json({ id: firmId, message: "Updated successfully" });
  } catch (error) {
    console.error("Failed to update firm", error);
    return NextResponse.json(
      { error: "Failed to update firm" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/firms/[id] - Delete a firm and all related data
 * SECURITY: Requires authentication
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Require authentication with rate limiting
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const db = getDb();
  const firmId = params.id;

  try {
    // Delete related data first (foreign key constraints)
    // Note: fitness assessments and certifications will cascade delete when individuals are deleted
    await db.delete(responsibilities).where(eq(responsibilities.firmId, firmId));
    await db.delete(individuals).where(eq(individuals.firmId, firmId));
    await db.delete(firms).where(eq(firms.id, firmId));

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Failed to delete firm", error);
    return NextResponse.json(
      { error: "Failed to delete firm" },
      { status: 500 }
    );
  }
}
