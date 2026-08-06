// Lista plantillas de WhatsApp disponibles en la WABA
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
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?limit=100`;
  console.log('Listing WhatsApp templates...');
  console.log('URL:', url);

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });

  const status = res.status;
  console.log('HTTP Status:', status);

  const data = await res.json();
  if (data.error) {
    console.error('ERROR:', JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  console.log('\n=== PLANTILLAS DISPONIBLES ===\n');
  if (!data.data || data.data.length === 0) {
    console.log('No hay plantillas en esta WABA.');
    return;
  }
  data.data.forEach((t, i) => {
    console.log(`[${i+1}] Nombre: ${t.name}`);
    console.log(`    Categoría: ${t.category}`);
    console.log(`    Estado: ${t.status}`);
    console.log(`    Idioma: ${t.language}`);
    if (t.components) {
      const body = t.components.find(c => c.type === 'BODY');
      if (body) console.log(`    Cuerpo: ${body.text}`);
      const buttons = t.components.find(c => c.type === 'BUTTONS');
      if (buttons) {
        console.log(`    Botones: ${JSON.stringify(buttons.buttons)}`);
      }
    }
    console.log('');
  });
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
