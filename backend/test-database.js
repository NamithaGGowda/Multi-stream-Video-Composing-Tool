import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('\n🔍 Testing PostgreSQL connection...');
console.log(`   URL: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@')}\n`);

try {
  // Test 1 — Basic connection
  await prisma.$connect();
  console.log('✅ Connected to PostgreSQL successfully!\n');

  // Test 2 — Check all tables exist
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;

  console.log('📋 Tables in database:');
  if (tables.length === 0) {
    console.log('   ❌ No tables found — run: npx prisma migrate dev --name init');
  } else {
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));
  }

  // Test 3 — Count records
  console.log('\n📊 Record counts:');
  const userCount    = await prisma.user.count();
  const projectCount = await prisma.project.count();
  const mediaCount   = await prisma.mediaAsset.count();
  const exportCount  = await prisma.exportJob.count();

  console.log(`   Users:        ${userCount}`);
  console.log(`   Projects:     ${projectCount}`);
  console.log(`   Media Assets: ${mediaCount}`);
  console.log(`   Export Jobs:  ${exportCount}`);

  // Test 4 — Write + Read + Delete test
  console.log('\n🧪 Write/Read/Delete test...');
  const testUser = await prisma.user.create({
    data: {
      email:       `test_${Date.now()}@test.com`,
      displayName: 'DB Test User',
      plan:        'FREE',
    },
  });
  console.log(`   ✅ Write: Created user ${testUser.id}`);

  const readUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  console.log(`   ✅ Read:  Found user ${readUser.email}`);

  await prisma.user.delete({ where: { id: testUser.id } });
  console.log(`   ✅ Delete: Removed test user`);

  console.log('\n🎉 PostgreSQL is fully working!\n');

} catch (err) {
  console.error('❌ PostgreSQL connection FAILED:');
  console.error(`   ${err.message}\n`);

  if (err.message.includes('connect ECONNREFUSED')) {
    console.error('💡 Fix: PostgreSQL is not running. Start it from Services or pgAdmin.');
  } else if (err.message.includes('password authentication failed')) {
    console.error('💡 Fix: Wrong password in DATABASE_URL inside backend/.env');
  } else if (err.message.includes('database') && err.message.includes('does not exist')) {
    console.error('💡 Fix: Database not created. Run:');
    console.error('        & "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -U postgres -c "CREATE DATABASE editframe;"');
  } else if (err.message.includes('Environment variable not found')) {
    console.error('💡 Fix: DATABASE_URL not set in backend/.env');
  }
} finally {
  await prisma.$disconnect();
}