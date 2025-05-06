// test_ocr.js
const path = require('path');
const { ImageAnnotatorClient } = require('@google-cloud/vision');

async function runTest() {
  const client = new ImageAnnotatorClient();
  // Adjust filename if yours differs
  const filePath = path.join(__dirname, '1745783036350_20250416_155952.jpg');
  
  console.log(`Running OCR on ${filePath}...`);
  const [result] = await client.textDetection({ image: { source: { filename: filePath } } });
  
  console.log('=== FULL OCR RESPONSE ===');
  console.log(JSON.stringify(result, null, 2));

  const fullText = result.fullTextAnnotation?.text
    || result.textAnnotations?.[0]?.description
    || '';
  console.log('\n=== EXTRACTED TEXT ===\n', fullText);
}

runTest().catch(err => {
  console.error('OCR test failed:', err);
  process.exit(1);
});
