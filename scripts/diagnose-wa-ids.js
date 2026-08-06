// Diagnóstico: obtener IDs correctos de WABA y phone number
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

async function checkUrl(url, label) {
  console.log(`\n=== ${label} ===`);
  console.log('URL:', url);
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 2000));
}

async function main() {
  console.log('Token (primeros 50):', process.env.WHATSAPP_TOKEN.substring(0, 50) + '...');
  console.log('Phone Number ID (.env):', process.env.WHATSAPP_PHONE_NUMBER_ID);
  console.log('WABA ID (.env):', process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);

  // 1. Verificar el token: info del usuario
  await checkUrl(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/me`,
    '1. Info del token (/me)'
  );

  // 2. Listar businesses del usuario
  await checkUrl(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/me/businesses`,
    '2. Businesses del usuario'
  );

  // 3. Verificar el WABA ID que tenemos
  await checkUrl(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}?fields=name,id,verification_status`,
    '3. Verificar WABA ID actual'
  );

  // 4. Listar phone numbers del WABA
  await checkUrl(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/phone_numbers`,
    '4. Phone numbers del WABA'
  );

  // 5. Verificar el Phone Number ID que tenemos
  await checkUrl(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating`,
    '5. Verificar Phone Number ID actual'
  );
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
