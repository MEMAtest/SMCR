import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function createAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Please provide an email address');
    console.log('\nUsage: node create-admin.mjs your-email@example.com');
    process.exit(1);
  }

  try {
    console.log(`\nSetting admin role for: ${email}...\n`);

    // Check if user exists
    const existingUsers = await sql`
      SELECT id, email, role FROM users WHERE email = ${email}
    `;

    if (existingUsers.length === 0) {
      console.log('❌ User not found. They need to sign in first before being made admin.');
      console.log('\n📧 Steps:');
      console.log('   1. User should visit /auth/signin and request a magic link');
      console.log('   2. User clicks the link in their email to create account');
      console.log('   3. Then run this script again to grant admin access');
      process.exit(1);
    }

    const user = existingUsers[0];

    if (user.role === 'admin') {
      console.log('✓ User is already an admin!');
      console.log(`\nUser details:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      process.exit(0);
    }

    // Update user to admin
    await sql`
      UPDATE users
      SET role = 'admin'
      WHERE email = ${email}
    `;

    console.log('✅ Successfully granted admin access!');
    console.log(`\nUser details:`);
    console.log(`  Email: ${email}`);
    console.log(`  Role: admin`);
    console.log('\n🎉 This user can now access admin-only endpoints like /api/migrate');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
