import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { firms, responsibilities, individuals, fitnessAssessments } from "@/lib/schema";

/**
 * GET /api/firms/[id] - Retrieve a specific firm with all related data
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Get fitness assessments
    const fitness = await db
      .select()
      .from(fitnessAssessments)
      .where(eq(fitnessAssessments.individualId, indivs.length > 0 ? indivs[0].id : ""));

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
        smfRole: i.smfRole,
        email: i.email,
      })),
      fitnessResponses: fitness.map((f) => ({
        sectionId: f.fitSection,
        questionId: `${f.individualId}-${f.fitSection}`,
        response: f.response || "",
        evidence: f.evidenceLinks && f.evidenceLinks.length > 0 ? f.evidenceLinks[0] : "",
      })),
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
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Delete and re-insert responsibilities (simple approach for now)
    await db.delete(responsibilities).where(eq(responsibilities.firmId, firmId));
    if (responsibilityRefs && responsibilityRefs.length > 0) {
      const rows = responsibilityRefs.map((ref: string) => ({
        firmId,
        reference: ref,
        title: ref, // Could map to full title
        status: "assigned",
        ownerId: responsibilityOwners?.[ref] || null,
      }));
      await db.insert(responsibilities).values(rows);
    }

    // Delete and re-insert individuals
    await db.delete(individuals).where(eq(individuals.firmId, firmId));
    if (indivs && indivs.length > 0) {
      const individualRows = indivs.map((ind: any) => ({
        firmId,
        fullName: ind.name,
        smfRole: ind.smfRole,
        email: ind.email || null,
      }));
      await db.insert(individuals).values(individualRows);
    }

    // Delete and re-insert fitness assessments
    // Note: We need to delete by individualId since firmId doesn't exist on fitness_assessments
    // For simplicity, we'll skip this for now in PUT - fitness assessments should be managed separately
    if (fitnessResponses && fitnessResponses.length > 0 && indivs && indivs.length > 0) {
      // Delete existing assessments for all individuals in this firm
      for (const ind of indivs) {
        if (ind.id) {
          await db.delete(fitnessAssessments).where(eq(fitnessAssessments.individualId, ind.id));
        }
      }

      const fitnessRows = fitnessResponses.map((resp: any) => ({
        individualId: resp.questionId.split("-")[0],
        fitSection: resp.sectionId,
        response: resp.response,
        evidenceLinks: resp.evidence ? [resp.evidence] : [],
      }));
      await db.insert(fitnessAssessments).values(fitnessRows);
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
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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
