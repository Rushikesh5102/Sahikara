import fs from 'fs';

const content = fs.readFileSync('C:/Users/Rushi/.gemini/antigravity-ide/brain/a340acf0-c542-4f7e-8282-3309ba68835d/.system_generated/steps/701/content.md', 'utf8');

// Find all 0x hex addresses in the file
const matches = content.match(/0x[a-fA-F0-9]{40}/g);
const unique = [...new Set(matches)];
console.log('Unique 0x addresses in page:', unique);

// Also look for Quoter occurrences with surrounding context
let pos = 0;
while ((pos = content.indexOf('Quoter', pos)) !== -1) {
  console.log('--- Quoter context ---');
  console.log(content.slice(Math.max(0, pos - 100), Math.min(content.length, pos + 200)));
  pos += 6;
}
