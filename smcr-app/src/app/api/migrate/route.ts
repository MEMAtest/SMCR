import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * POST /api/migrate - Run database migrations
 * This endpoint migrates the database schema to support multiple SMF roles
 */
export async function POST(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const results: string[] = [];

    // Step 1: Check if certifications table exists
    results.push("1. Checking certifications table...");
    const certTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'certifications'
      )
    `;

    if (!certTable[0].exists) {
      results.push("   Creating certifications table...");
      await sql`
        CREATE TABLE certifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
          individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
          valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          valid_to TIMESTAMPTZ,
          status TEXT NOT NULL DEFAULT 'draft',
          document_url TEXT
        )
      `;
      results.push("   ✓ Certifications table created");
    } else {
      results.push("   ✓ Certifications table already exists");
    }

    // Step 2: Check if individuals table has smf_role or smf_roles column
    results.push("\n2. Checking individuals table structure...");
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'individuals'
      AND column_name IN ('smf_role', 'smf_roles')
    `;

    const hasOldColumn = columns.some((c: any) => c.column_name === "smf_role");
    const hasNewColumn = columns.some((c: any) => c.column_name === "smf_roles");

    if (hasOldColumn && !hasNewColumn) {
      results.push("   Migrating smf_role (text) to smf_roles (jsonb)...");

      // Add new column
      await sql`
        ALTER TABLE individuals
        ADD COLUMN smf_roles JSONB NOT NULL DEFAULT '[]'::jsonb
      `;
      results.push("   ✓ Added smf_roles column");

      // Migrate existing data: wrap single role string in array
      await sql`
        UPDATE individuals
        SET smf_roles = jsonb_build_array(smf_role)
        WHERE smf_role IS NOT NULL
      `;
      results.push("   ✓ Migrated existing data");

      // Drop old column
      await sql`
        ALTER TABLE individuals
        DROP COLUMN smf_role
      `;
      results.push("   ✓ Dropped old smf_role column");

      results.push("   ✓ Migration completed successfully!");
    } else if (hasNewColumn) {
      results.push("   ✓ Already using smf_roles column");
    } else {
      results.push("   ⚠ Neither column exists - unexpected state!");
    }

    // Show final structure
    results.push("\n3. Final individuals table structure:");
    const finalColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'individuals'
      ORDER BY ordinal_position
    `;
    finalColumns.forEach((col: any) => results.push(`   ${col.column_name}: ${col.data_type}`));

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      results,
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
