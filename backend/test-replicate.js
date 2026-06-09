import 'dotenv/config';
import Replicate from 'replicate';

console.log('\n🔍 Testing Replicate connection...\n');

const token = process.env.REPLICATE_API_KEY;
console.log(`   Token present: ${token ? '✅ Yes' : '❌ No'}`);
console.log(`   Token starts with: ${token ? token.slice(0, 5) + '...' : 'N/A'}`);
console.log(`   Token length: ${token ? token.length : 0} chars\n`);

if (!token) {
  console.error('❌ REPLICATE_API_KEY not found in .env');
  process.exit(1);
}

const replicate = new Replicate({ auth: token });

try {
  console.log('   Fetching your account info...');
  const account = await replicate.accounts.current();
  console.log('\n✅ Replicate connection successful!');
  console.log(`   Account: ${account.username} (${account.type})`);
  console.log('\n🎉 Your token is valid and billing is active!\n');
} catch (err) {
  console.error('\n❌ Replicate connection FAILED:');
  console.error(`   Status: ${err.response?.status || 'unknown'}`);
  console.error(`   Message: ${err.message}\n`);

  if (err.message.includes('401') || err.response?.status === 401) {
    console.error('💡 401 Unauthorized means one of these:');
    console.error('   1. The token in .env is wrong or has extra spaces/quotes');
    console.error('   2. The token was deleted/regenerated on replicate.com');
    console.error('   3. Billing is not yet active on your Replicate account');
    console.error('\n   Go to replicate.com → Account → API Tokens → create a fresh one');
    console.error('   Then paste it EXACTLY into backend/.env (no quotes)\n');
  }
}