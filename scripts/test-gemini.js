// Prueba la API de Gemini con la clave de Google AI Studio
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
  console.log('=== Probando Google AI Studio (Gemini) ===');
  console.log('API Key (primeros 20):', process.env.GEMINI_API_KEY.substring(0, 20) + '...');
  console.log('Modelo:', process.env.GEMINI_MODEL);
  console.log('');

  // Usar el endpoint REST de Gemini (compatible con API keys de AI Studio)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Hola, eres el asistente de JSADR. Saluda al usuario en una frase corta en español colombiano.' }],
      }
    ],
    systemInstruction: {
      parts: [{ text: process.env.GEMINI_SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
    }
  };

  console.log('Enviando petición a Gemini...');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  console.log('HTTP Status:', res.status);
  const data = await res.json();

  if (data.error) {
    console.error('ERROR:', JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  console.log('\n=== RESPUESTA DE GEMINI ===');
  if (data.candidates && data.candidates[0]) {
    const text = data.candidates[0].content.parts[0].text;
    console.log('Respuesta:', text);
    console.log('\nFinish reason:', data.candidates[0].finishReason);
    if (data.usageMetadata) {
      console.log('Tokens usados:');
      console.log('  - Prompt:', data.usageMetadata.promptTokenCount);
      console.log('  - Respuesta:', data.usageMetadata.candidatesTokenCount);
      console.log('  - Total:', data.usageMetadata.totalTokenCount);
    }
    console.log('\n✅ GEMINI FUNCIONA OK');
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
