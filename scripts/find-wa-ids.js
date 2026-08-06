// Buscar IDs correctos de WABA y phone numbers
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

async function tryFetch(url, label) {
  console.log(`\n=== ${label} ===`);
  console.log('URL:', url);
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 3000));
  return data;
}

async function main() {
  // 1. /me/accounts (apps)
  await tryFetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/me/accounts`,
    'Apps del usuario'
  );

  // 2. /me/owned_whatsapp_business_accounts
  await tryFetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/me/owned_whatsapp_business_accounts`,
    'WABAs owned'
  );

  // 3. Probar si el WABA ID actual tiene 1 dígito menos (15 dígitos)
  const waba15 = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID.slice(0, -1); // 194649988603400
  await tryFetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${waba15}?fields=name,id,verification_status`,
    `Probar WABA ID con 15 dígitos (${waba15})`
  );

  // 4. Probar phone numbers con el WABA ID de 15 dígitos
  await tryFetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${waba15}/phone_numbers`,
    `Phone numbers del WABA (${waba15})`
  );

  // 5. Probar mensaje con el WABA de 15 dígitos en la URL (a veces el endpoint cambia)
  await tryFetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${waba15}/message_templates?limit=10`,
    `Plantillas del WABA (${waba15})`
  );
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
