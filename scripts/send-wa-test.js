// Envía un mensaje de WhatsApp usando la plantilla hello_world
const fs = require('fs');

// Cargar .env manualmente
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
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const to = process.env.WHATSAPP_TEST_RECIPIENT;

  console.log('=== Enviando mensaje WhatsApp de prueba ===');
  console.log('To:', to);
  console.log('From (Phone Number ID):', process.env.WHATSAPP_PHONE_NUMBER_ID);
  console.log('API Version:', process.env.WHATSAPP_API_VERSION);
  console.log('Plantilla: hello_world');
  console.log('');

  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const status = res.status;
  console.log('HTTP Status:', status);

  const data = await res.json();
  if (data.error) {
    console.error('ERROR:', JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  console.log('\n=== RESPUESTA DE META ===');
  console.log(JSON.stringify(data, null, 2));

  if (data.messages && data.messages[0]) {
    console.log('\n✅ MENSAJE ENVIADO OK');
    console.log('Message ID:', data.messages[0].id);
    console.log('Espera ~5 segundos y revisa tu WhatsApp');
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
