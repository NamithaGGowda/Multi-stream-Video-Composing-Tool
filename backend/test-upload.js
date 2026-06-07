import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import os from 'os';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

console.log('\n🔍 Testing Cloudinary upload...\n');

try {
  // Create a tiny test image (1x1 red pixel PNG)
  const testImagePath = path.join(os.tmpdir(), 'test-upload.png');
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(testImagePath, pngBuffer);
  console.log('✅ Created test image at:', testImagePath);

  // Upload to Cloudinary
  console.log('⬆️  Uploading to Cloudinary...');
  const result = await cloudinary.uploader.upload(testImagePath, {
    folder:        'editframe/test',
    public_id:     'connection-test',
    resource_type: 'image',
    overwrite:     true,
  });

  console.log('✅ Upload successful!');
  console.log(`   Public ID: ${result.public_id}`);
  console.log(`   URL:       ${result.secure_url}`);
  console.log(`   Size:      ${result.bytes} bytes`);

  // Clean up — delete the test image from Cloudinary
  await cloudinary.uploader.destroy('editframe/test/connection-test');
  console.log('✅ Test image cleaned up from Cloudinary');

  // Clean up local temp file
  fs.unlinkSync(testImagePath);

  console.log('\n🎉 Cloudinary upload is fully working!\n');

} catch (err) {
  console.error('❌ Upload test FAILED:');
  console.error('  ', err.message || JSON.stringify(err));
}