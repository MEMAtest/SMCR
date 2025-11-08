import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { firms, responsibilities } from "@/lib/schema";
import { PRESCRIBED_RESPONSIBILITIES } from "@/lib/smcr-data";

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
};

export async function POST(request: Request) {
  const db = getDb();
  let payload: FirmPayload;

  try {
    payload = (await request.json()) as FirmPayload;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { firmProfile, responsibilityRefs } = payload;

  if (!firmProfile?.firmName || !firmProfile?.firmType) {
    return NextResponse.json(
      { error: "firmName and firmType are required" },
      { status: 400 }
    );
  }

  try {
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

    if (record?.id && responsibilityRefs?.length) {
      const rows = responsibilityRefs
        .filter((ref) => responsibilityMap.has(ref))
        .map((ref) => ({
          firmId: record.id,
          reference: ref,
          title: responsibilityMap.get(ref) ?? ref,
          status: "assigned",
        }));

      if (rows.length) {
        await db.insert(responsibilities).values(rows);
      }
    }

    return NextResponse.json({ id: record.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to save firm", error);
    return NextResponse.json(
      { error: "Failed to save firm profile" },
      { status: 500 }
    );
  }
}
