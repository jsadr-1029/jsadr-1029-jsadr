// Prueba Z.AI (GLM-4.6) como proveedor de IA para el chatbot de WhatsApp
const fs = require('fs');

const envPath = '/home/z/my-project/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = value;
});

async function main() {
  console.log('=== Probando Z.AI (GLM-4.6) ===');
  console.log('Proveedor:', process.env.AI_PROVIDER);
  console.log('Modelo:', process.env.ZAI_MODEL);
  console.log('');

  const ZAI = require('z-ai-web-dev-sdk').default;
  const zai = await ZAI.create();

  const testMessages = [
    { role: 'system', content: process.env.AI_SYSTEM_PROMPT },
    { role: 'user', content: 'Hola, ¿cómo solicito un código de verificación por WhatsApp?' },
  ];

  console.log('User: Hola, ¿cómo solicito un código de verificación por WhatsApp?');
  console.log('\nEnviando a GLM-4.6...');

  const startTime = Date.now();
  const response = await zai.chat.completions.create({
    model: process.env.ZAI_MODEL,
    messages: testMessages,
    temperature: 0.7,
    max_tokens: 300,
  });
  const elapsed = Date.now() - startTime;

  console.log(`\n=== RESPUESTA DE GLM-4.6 (${elapsed}ms) ===`);
  console.log('Assistant:', response.choices[0].message.content);

  if (response.usage) {
    console.log('\nTokens:');
    console.log('  Prompt:', response.usage.prompt_tokens);
    console.log('  Respuesta:', response.usage.completion_tokens);
    console.log('  Total:', response.usage.total_tokens);
  }

  console.log('\n✅ Z.AI FUNCIONA OK');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
