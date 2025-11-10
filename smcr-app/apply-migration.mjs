import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function applyMigration() {
  try {
    console.log('Starting database migration...\n');

    // Step 1: Check if certifications table exists
    console.log('1. Checking certifications table...');
    const certTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'certifications'
      )
    `;

    if (!certTable[0].exists) {
      console.log('   Creating certifications table...');
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
      console.log('   ✓ Certifications table created');
    } else {
      console.log('   ✓ Certifications table already exists');
    }

    // Step 2: Check if individuals table has smf_role column
    console.log('\n2. Checking individuals table structure...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'individuals'
      AND column_name IN ('smf_role', 'smf_roles')
    `;

    const hasOldColumn = columns.some(c => c.column_name === 'smf_role');
    const hasNewColumn = columns.some(c => c.column_name === 'smf_roles');

    if (hasOldColumn && !hasNewColumn) {
      console.log('   Migrating smf_role (text) to smf_roles (jsonb)...');

      // Add new column
      await sql`
        ALTER TABLE individuals
        ADD COLUMN smf_roles JSONB NOT NULL DEFAULT '[]'::jsonb
      `;

      // Migrate data: wrap single role string in array
      await sql`
        UPDATE individuals
        SET smf_roles = jsonb_build_array(smf_role)
        WHERE smf_role IS NOT NULL
      `;

      // Drop old column
      await sql`
        ALTER TABLE individuals
        DROP COLUMN smf_role
      `;

      console.log('   ✓ Column migrated successfully');
    } else if (hasNewColumn) {
      console.log('   ✓ Already using smf_roles column');
    } else {
      console.log('   ⚠ Neither column exists - this is unexpected!');
    }

    console.log('\n✅ Migration completed successfully!');

    // Show final structure
    console.log('\nFinal individuals table structure:');
    const finalColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'individuals'
      ORDER BY ordinal_position
    `;
    finalColumns.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

applyMigration();
