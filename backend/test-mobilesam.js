// Verify MobileSAM ONNX models — run: node test-mobilesam.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENC = path.resolve(__dirname, 'models/mobilesam.encoder.onnx');
const DEC = path.resolve(__dirname, 'models/mobilesam.decoder.onnx');

console.log('\n🔍 Testing MobileSAM ONNX models…\n');

for (const [name, p] of [['encoder', ENC], ['decoder', DEC]]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ${name} not found at backend/models/mobilesam.${name}.onnx`);
    console.error('   Download both files (see setup instructions) into backend/models/\n');
    process.exit(1);
  }
  console.log(`✅ ${name} found (${(fs.statSync(p).size/1024/1024).toFixed(0)} MB)`);
}

let ort;
try { ort = await import('onnxruntime-node'); console.log('✅ onnxruntime-node installed'); }
catch { console.error('❌ run: npm install onnxruntime-node\n'); process.exit(1); }

console.log('   Loading encoder…');
const enc = await ort.InferenceSession.create(ENC, { executionProviders: ['cpu'] });
console.log(`   encoder inputs:  ${enc.inputNames.join(', ')}`);
console.log(`   encoder outputs: ${enc.outputNames.join(', ')}`);

console.log('   Loading decoder…');
const dec = await ort.InferenceSession.create(DEC, { executionProviders: ['cpu'] });
console.log(`   decoder inputs:  ${dec.inputNames.join(', ')}`);
console.log(`   decoder outputs: ${dec.outputNames.join(', ')}`);

// Synthetic 1024x1024 image — HWC raw [0,255]
const S = 1024;
const input = new Float32Array(S*S*3);
for (let i = 0; i < input.length; i++) input[i] = Math.floor(Math.random()*256);

console.log('\n   Running encoder…');
let t = Date.now();
// This encoder expects HWC [1024,1024,3] raw RGB (normalizes internally)
const encFeeds = {}; encFeeds[enc.inputNames[0]] = new ort.Tensor('float32', input, [S,S,3]);
const encOut = await enc.run(encFeeds);
let emb = encOut[enc.outputNames[0]];
console.log(`✅ encoder ran in ${Date.now()-t}ms → embedding shape [${emb.dims.join(', ')}]`);

// Decoder wants image_embeddings as [1,256,64,64]; add batch dim if encoder dropped it
let embData = emb.data, embDims = emb.dims;
if (embDims.length === 3) embDims = [1, ...embDims];
console.log(`   using embedding shape [${embDims.join(', ')}] for decoder`);

console.log('   Running decoder…');
t = Date.now();
const decOut = await dec.run({
  image_embeddings: new ort.Tensor('float32', embData, embDims),
  point_coords:     new ort.Tensor('float32', new Float32Array([512,512,0,0]), [1,2,2]),
  point_labels:     new ort.Tensor('float32', new Float32Array([1,-1]), [1,2]),
  mask_input:       new ort.Tensor('float32', new Float32Array(256*256), [1,1,256,256]),
  has_mask_input:   new ort.Tensor('float32', new Float32Array([0]), [1]),
  orig_im_size:     new ort.Tensor('float32', new Float32Array([800,1200]), [2]),
});
const masks = decOut.masks || decOut[dec.outputNames[0]];
console.log(`✅ decoder ran in ${Date.now()-t}ms → masks shape [${masks.dims.join(', ')}]`);

console.log('\n🎉 MobileSAM is working! Click-to-detect is ready.\n');