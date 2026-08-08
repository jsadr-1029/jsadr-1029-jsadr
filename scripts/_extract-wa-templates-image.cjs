/**
 * Extract ALL text visible in the WhatsApp templates image using ZAI VLM.
 * Uses base64 encoding (recommended approach) to pass the local image to the model.
 */
const fs = require('fs');
const path = require('path');

const IMAGE_PATH = '/home/z/my-project/upload/pasted_image_1786157528357.png';
const OUTPUT_PATH = '/home/z/my-project/scripts/_wa-templates-extracted.txt';

const PROMPT = `You are performing OCR + structured extraction on a screenshot that shows a list of WhatsApp message templates the user was about to create in the Meta Business Platform.

Your task: Extract EVERY piece of text visible in the image with MAXIMUM detail and fidelity. Do NOT summarize, do NOT paraphrase, do NOT skip anything. Reproduce text verbatim, including all punctuation, accents, special characters, emojis, and variable placeholders like {{1}}, {{2}}, {{3}}, etc.

For EACH template you can identify in the image, reproduce its full content. If you can see structure, organize each template like this:

TEMPLATE N
- Name: <name>
- Category: <marketing | utility | authentication>
- Language: <language code, e.g. es, en, es_AR>
- Header: <type and content, e.g. TEXT/IMAGE/VIDEO/DOCUMENT and its content>
- Body: <full body text verbatim, including all {{n}} placeholders and line breaks>
- Footer: <footer text if any>
- Buttons: <list each button with its type and text>
- Any other fields visible (e.g. phone number / URL / coupon code examples)

Also extract:
- Any column headers (if it is a spreadsheet)
- Any UI labels, tabs, buttons or instructions visible on the screen
- Any surrounding notes, comments or annotations
- Any brand/domain/WhatsApp number identifiers visible

If the image is a spreadsheet or table, reproduce it row by row, column by column, preserving cell content exactly.

If text is partially cut off or unclear, indicate it with [unclear: <best guess>] and provide your best-effort reading.

Output ONLY the extracted content, clearly organized. Do not add introductions or conclusions.`;

async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;

  if (!fs.existsSync(IMAGE_PATH)) {
    console.error('Image not found:', IMAGE_PATH);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64Image = imageBuffer.toString('base64');
  const ext = path.extname(IMAGE_PATH).toLowerCase();
  const mimeType =
    ext === '.png' ? 'image/png' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    ext === '.bmp' ? 'image/bmp' :
    'image/jpeg';

  console.log('Image size:', imageBuffer.length, 'bytes');
  console.log('MIME type:', mimeType);
  console.log('Base64 length:', base64Image.length);
  console.log('Initializing ZAI...');

  const zai = await ZAI.create();

  console.log('Calling vision model...');

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  });

  const content = response.choices?.[0]?.message?.content || '(no content returned)';

  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
  console.log('\n================ EXTRACTED CONTENT ================');
  console.log(content);
  console.log('==================================================');
  console.log('\nSaved to:', OUTPUT_PATH);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
