/**
 * Analyze a Meta WhatsApp Business screenshot using the z-ai-web-dev-sdk VLM.
 *
 * Usage:  node scripts/analyze-meta-screenshot.js [path-to-image]
 *
 * The script reads the local image, encodes it to base64, and asks the vision
 * model to describe in detail what is shown on the screen (URLs, page title,
 * buttons, form fields, phone numbers, app IDs, business names, current step
 * of the WhatsApp Business API setup, and the next actionable UI elements).
 */

const fs = require('fs');
const path = require('path');

const IMAGE_PATH =
  process.argv[2] ||
  '/home/z/my-project/upload/pasted_image_1786500882439.png';

const PROMPT = `You are analyzing a screenshot taken by a user who is on the Meta / Facebook
platform (likely developers.facebook.com or business.facebook.com) and wants to
set up the WhatsApp Business API so they can send OTP codes via WhatsApp.

Please analyze the screenshot carefully and respond in the following structured
sections. Be VERY precise and literal - only report what you can actually see.
If something is not visible, say "not visible".

1) PAGE IDENTIFICATION
   - Exact URL visible in the browser address bar (if any).
   - Page title / heading text at the top of the page.
   - Which Meta product this is (Meta App Dashboard, WhatsApp Manager,
     Meta Business Suite, Meta Business Manager, WhatsApp Business Setup wizard,
     Cloud API quick start, etc.).
   - Name of the app or business selected, if any.

2) VISIBLE DATA
   - Any phone numbers (with country code) - copy them EXACTLY.
   - Any App IDs / API keys / tokens / Phone Number IDs / WABA IDs visible.
   - Any business name, display name, or verified business name.
   - Any email address, name, or account identifier.

3) CURRENT STEP OF WHATSAPP SETUP
   - Describe what step of the WhatsApp Business API onboarding/setup the user
     appears to be on (e.g. creating an app, adding WhatsApp product, adding a
     test number, verifying business, adding a payment method, sending a test
     message, requesting messaging access, adding a template, etc.).
   - Quote any status indicators, badges, green checks, warnings, or callouts.

4) ACTIONABLE UI ELEMENTS (be exhaustive)
   - List every button, link, tab, and form field visible, with the EXACT label.
   - For each, briefly state what would happen if clicked/filled.
   - Then recommend which element the user should interact with NEXT to advance
     toward sending OTP codes via WhatsApp.

5) RISKS / BLOCKERS
   - Anything that looks like it would block sending OTPs (unverified business,
     no test number, no template message, no permanent token, etc.).

Keep labels in their original language (often Spanish). Answer in English.
Do not invent information that is not in the image.`;

function detectMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'image/png';
  }
}

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error(`ERROR: image not found at ${IMAGE_PATH}`);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMime(IMAGE_PATH);
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  });

  const content = response.choices?.[0]?.message?.content ?? '(no content)';

  console.log('========================================================');
  console.log('VLM ANALYSIS OF:', IMAGE_PATH);
  console.log('========================================================\n');
  console.log(content);
  console.log('\n========================================================');
  console.log('END OF ANALYSIS');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('VLM analysis failed:', err);
  process.exit(1);
});
