import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { firms, responsibilities, individuals, fitnessAssessments } from "@/lib/schema";
import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";
import type { Individual, FitnessResponse } from "@/lib/validation";

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

    // Insert individuals (SMFs)
    if (indivs && indivs.length > 0) {
      const individualRows = indivs.map((ind) => ({
        firmId,
        fullName: ind.name,
        smfRole: ind.smfRole,
        email: ind.email || null,
      }));
      await db.insert(individuals).values(individualRows);
    }

    // Insert responsibilities with ownership
    if (responsibilityRefs?.length) {
      const rows = responsibilityRefs
        .filter((ref) => responsibilityMap.has(ref))
        .map((ref) => ({
          firmId,
          reference: ref,
          title: responsibilityMap.get(ref) ?? ref,
          status: "assigned",
          ownerId: responsibilityOwners?.[ref] || null,
        }));

      if (rows.length) {
        await db.insert(responsibilities).values(rows);
      }
    }

    // Insert fitness assessments
    if (fitnessResponses && fitnessResponses.length > 0) {
      const fitnessRows = fitnessResponses.map((resp) => {
        // New format: questionId is "individualId::sectionId::questionIndex"
        const [individualId, sectionId] = resp.questionId.split("::");
        return {
          individualId,
          fitSection: resp.questionId, // Store full questionId for later retrieval
          response: resp.response,
          evidenceLinks: resp.evidence ? [resp.evidence] : [],
        };
      });
      await db.insert(fitnessAssessments).values(fitnessRows);
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
 * GET /api/firms - List all firms (simplified, no auth yet)
 */
export async function GET() {
  const db = getDb();

  try {
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
