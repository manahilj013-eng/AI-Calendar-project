const fs = require('fs');
const Tesseract = require('tesseract.js');

async function testExtraction() {
  const imagePath = 'uploads/timetable_1788687987027_0z8ojs.jpeg';
  console.log('Running OCR on:', imagePath);
  
  const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
  console.log('\n--- EXTRACTED TEXT FROM TESSERACT ---');
  console.log(text);
  console.log('-------------------------------------\n');
}

testExtraction().catch(console.error);
