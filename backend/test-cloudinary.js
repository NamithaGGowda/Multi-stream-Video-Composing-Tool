import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

console.log('\n🔍 Testing Cloudinary connection...');
console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
console.log(`   API Key:    ${process.env.CLOUDINARY_API_KEY}`);
console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set (' + process.env.CLOUDINARY_API_SECRET.length + ' chars)' : '❌ Missing'}\n`);

try {
  const result = await cloudinary.api.ping();
  console.log('✅ Cloudinary connection successful!');
  console.log('   Response:', JSON.stringify(result));

  const usage = await cloudinary.api.usage();
  console.log('\n📊 Account Info:');
  console.log(`   Plan:         ${usage.plan}`);
  console.log(`   Storage used: ${(usage.storage.usage / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Total assets: ${usage.resources}`);
  console.log('\n🎉 Ready to upload files!\n');

} catch (err) {
  console.error('❌ Cloudinary connection FAILED');
  console.error('   Full error:', JSON.stringify(err, null, 2));
  console.error('   Error type:', typeof err);
  console.error('   Message:', err.message);
  console.error('   HTTP Status:', err.http_code || err.status || 'unknown');
  console.error('   Error string:', String(err));
}