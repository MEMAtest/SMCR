import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  try {
    console.log('Checking individuals table structure...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'individuals'
      ORDER BY ordinal_position
    `;

    console.log('\nCurrent individuals table:');
    columns.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));

    console.log('\nAll tables in database:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log(`  ${t.table_name}`));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
