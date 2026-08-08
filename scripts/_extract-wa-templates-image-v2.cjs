/**
 * Second VLM pass on the WhatsApp templates image - with thinking enabled
 * to maximize detail capture and catch anything missed in the first pass.
 */
const fs = require('fs');
const path = require('path');

const IMAGE_PATH = '/home/z/my-project/upload/pasted_image_1786157528357.png';
const OUTPUT_PATH = '/home/z/my-project/scripts/_wa-templates-extracted-v2.txt';

const PROMPT = `This is a screenshot of the Meta Business Platform / WhatsApp Business Manager UI (in Spanish).

I need you to act as a high-precision OCR engine. Carefully scan the ENTIRE image from top to bottom, left to right, pixel by pixel, and report EVERY single piece of text you can see, no matter how small, faint, or peripheral. This includes:

1. Browser chrome (URL bar, tabs, bookmarks, window controls)
2. Top navigation bar of the Meta Business Platform
3. Left sidebar menu items (all of them, including subsections)
4. Breadcrumb / page title
5. All form labels, inputs, dropdowns, character counters
6. All section headings and helper text
7. All radio button / option labels with their descriptions
8. All checkbox labels including any required-checkbox warnings
9. All hyperlinks and "learn more" text
10. All preview-pane content (including phone preview, message bubble, time stamps, page indicators like "2 de 4")
11. All action buttons (Cancelar, Anterior, Siguiente, Enviar, etc.)
12. Any footer text, tooltips, info icons (ⓘ) content
13. Any warnings, errors, or status messages
14. Any account/business identifier visible (e.g. "Test WhatsApp Business Account", business_id, phone number)
15. Any small print or fine text

Reproduce text VERBATIM with original Spanish accents and punctuation. Preserve the visual hierarchy using indentation. If something is partially obscured or cut off, indicate with [...].

Be exhaustive. Do not summarize. Do not omit anything.

Format as a structured list by screen region:
=== BROWSER ===
=== TOP NAV ===
=== LEFT SIDEBAR ===
=== BREADCRUMB / TITLE ===
=== MAIN CONTENT (every section, every field, every option) ===
=== PREVIEW PANE ===
=== ACTION BUTTONS ===
=== OTHER / FOOTER ===`;

async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;

  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64Image = imageBuffer.toString('base64');
  const ext = path.extname(IMAGE_PATH).toLowerCase();
  const mimeType =
    ext === '.png' ? 'image/png' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    ext === '.bmp' ? 'image/bmp' :
    'image/jpeg';

  console.log('Initializing ZAI...');
  const zai = await ZAI.create();
  console.log('Calling vision model WITH thinking enabled...');

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
    thinking: { type: 'enabled' }
  });

  const content = response.choices?.[0]?.message?.content || '(no content returned)';

  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
  console.log('\n================ EXTRACTED CONTENT (v2 with thinking) ================');
  console.log(content);
  console.log('========================================================================');
  console.log('\nSaved to:', OUTPUT_PATH);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
