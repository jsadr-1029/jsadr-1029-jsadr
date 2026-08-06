// Lista los modelos disponibles en Gemini
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
  console.log('=== Listando modelos disponibles en Gemini ===');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url);
  console.log('HTTP Status:', res.status);
  const data = await res.json();
  if (data.error) {
    console.error('ERROR:', JSON.stringify(data.error, null, 2));
    process.exit(1);
  }
  console.log('\nModelos disponibles:');
  data.models.forEach(m => {
    const methods = (m.supportedGenerationMethods || []).join(', ');
    console.log(`- ${m.name}  [${methods}]`);
  });
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
