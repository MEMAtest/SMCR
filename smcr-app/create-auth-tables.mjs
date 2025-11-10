import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function createAuthTables() {
  try {
    console.log('Creating NextAuth tables...\n');

    // Check and create users table
    console.log('1. Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        email TEXT NOT NULL UNIQUE,
        email_verified TIMESTAMPTZ,
        image TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('   ✓ Users table created\n');

    // Check and create accounts table
    console.log('2. Creating accounts table...');
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        PRIMARY KEY (provider, provider_account_id)
      )
    `;
    console.log('   ✓ Accounts table created\n');

    // Check and create sessions table
    console.log('3. Creating sessions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        session_token TEXT NOT NULL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMPTZ NOT NULL
      )
    `;
    console.log('   ✓ Sessions table created\n');

    // Check and create verification_tokens table
    console.log('4. Creating verification_tokens table...');
    await sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (identifier, token)
      )
    `;
    console.log('   ✓ Verification tokens table created\n');

    console.log('✅ All NextAuth tables created successfully!\n');

    // Show all tables
    console.log('Current tables in database:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log(`  - ${t.table_name}`));

  } catch (error) {
    console.error('\n❌ Error creating tables:', error.message);
    throw error;
  }
}

createAuthTables();
