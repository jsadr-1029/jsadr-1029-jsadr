// =====================================================
// BUILD COMPLETE .env — JSADR Plataforma
// Genera TODOS los secretos faltantes con openssl rand -hex
// Mantiene DATABASE_URL (Neon) y cualquier valor pre-existente
// =====================================================
const fs = require('fs');
const crypto = require('crypto');

const ENV_PATH = '/home/z/my-project/.env';
const envContent = fs.readFileSync(ENV_PATH, 'utf8');

// Parse existing
const existing = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    existing[m[1]] = v;
  }
}

const genHex = (bytes) => crypto.randomBytes(bytes).toString('hex');
const genKey = () => genHex(32); // 64 hex chars = 32 bytes

// === Required secrets (generate if missing) ===
const secrets = {
  API_ENCRYPTION_KEY: { gen: genKey, desc: 'Cifrado AES-256 de credenciales en BD' },
  JWT_SECRET: { gen: () => genHex(48), desc: 'JWT access tokens (15 min)' },
  JWT_REFRESH_SECRET: { gen: () => genHex(48), desc: 'JWT refresh tokens (7 días)' },
  OTP_CHAT_SECRET: { gen: genKey, desc: 'Sesiones OTP del chat del portal' },
  PORTAL_SESSION_SECRET: { gen: genKey, desc: 'Sesiones del portal del cliente' },
  ADMIN_SESSION_SECRET: { gen: genKey, desc: 'Sesiones de administración' },
  CHAT_DYN_SECRET: { gen: genKey, desc: 'Claves dinámicas del chat del portal' },
  GITHUB_WEBHOOK_SECRET: { gen: genKey, desc: 'Webhook GitHub' },
  VERCEL_WEBHOOK_SECRET: { gen: genKey, desc: 'Webhook Vercel' },
  NEON_WEBHOOK_SECRET: { gen: genKey, desc: 'Webhook Neon' },
  WHATSAPP_WEBHOOK_SECRET: { gen: genKey, desc: 'Webhook WhatsApp' },
};

// === Static values (already known) ===
const static = {
  DATABASE_URL: existing.DATABASE_URL || 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  GITHUB_OWNER: 'jsadr-1029',
  GITHUB_REPO: 'jsadr-1029-jsadr',
  VERCEL_PROJECT_ID: 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj',
  VERCEL_TEAM_ID: 'team_RgKIQ16ZqHOh3cpZ5WgzXtop',
  NEON_PROJECT_ID: 'rapid-darkness-56995142',
  NEON_BRANCH: 'main',
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '587',
  SMTP_USER: 'b3e8df001@smtp-brevo.com',
  SMTP_FROM: 'jsa@jsadr.com.co',
  SMTP_FROM_NAME: 'JSADR Plataforma',
  ALLOWED_ORIGINS: 'https://localhost:3000,https://preview-*.space-z.ai,https://jsadr.com.co,https://www.jsadr.com.co,https://jsadr-jsadr.vercel.app',
  NEXT_PUBLIC_APP_URL: 'https://jsadr.com.co',
  NODE_ENV: 'development',
  BANCOLOMBIA_AMBIENTE: 'sandbox',
};

// Preserve existing token values (VERCEL_TOKEN, GITHUB_TOKEN, NEON_API_KEY, WHATSAPP_TOKEN, etc.)
// Even though they may be invalid, we keep them so the user can identify what needs to be refreshed
const preservedTokens = [
  'VERCEL_TOKEN', 'GITHUB_TOKEN', 'NEON_API_KEY',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ID',
  'SMTP_PASS', 'BANCOLOMBIA_CLIENT_ID', 'BANCOLOMBIA_CLIENT_SECRET', 'BANCOLOMBIA_COMMERCE_ID',
  'SENTRY_DSN', 'NEXT_PUBLIC_GA_ID',
];

// Build final env object
const finalEnv = {};
for (const [k, v] of Object.entries(static)) finalEnv[k] = v;
for (const [k, conf] of Object.entries(secrets)) {
  finalEnv[k] = existing[k] || conf.gen();
}
for (const k of preservedTokens) {
  if (existing[k]) finalEnv[k] = existing[k];
}

// Write .env file
const lines = [
  '# =====================================================',
  '# .env — JSADR Plataforma de Gestión de Préstamos',
  '# Generado automáticamente el ' + new Date().toISOString(),
  '# =====================================================',
  '',
  '# === 1. BASE DE DATOS (Neon PostgreSQL) ===',
  `DATABASE_URL="${finalEnv.DATABASE_URL}"`,
  '',
  '# === 2. SECRETOS DE AUTENTICACIÓN ===',
  `API_ENCRYPTION_KEY="${finalEnv.API_ENCRYPTION_KEY}"`,
  `JWT_SECRET="${finalEnv.JWT_SECRET}"`,
  `JWT_REFRESH_SECRET="${finalEnv.JWT_REFRESH_SECRET}"`,
  `OTP_CHAT_SECRET="${finalEnv.OTP_CHAT_SECRET}"`,
  `PORTAL_SESSION_SECRET="${finalEnv.PORTAL_SESSION_SECRET}"`,
  `ADMIN_SESSION_SECRET="${finalEnv.ADMIN_SESSION_SECRET}"`,
  `CHAT_DYN_SECRET="${finalEnv.CHAT_DYN_SECRET}"`,
  '',
  '# === 3. CORS / ORÍGENES PERMITIDOS ===',
  `ALLOWED_ORIGINS="${finalEnv.ALLOWED_ORIGINS}"`,
  '',
  '# === 4. URL PÚBLICA ===',
  `NEXT_PUBLIC_APP_URL="${finalEnv.NEXT_PUBLIC_APP_URL}"`,
  '',
  '# === 5. PLATAFORMAS DE SINCRONIZACIÓN ===',
  '# GitHub',
  `GITHUB_TOKEN="${finalEnv.GITHUB_TOKEN || ''}"`,
  `GITHUB_OWNER="${finalEnv.GITHUB_OWNER}"`,
  `GITHUB_REPO="${finalEnv.GITHUB_REPO}"`,
  `GITHUB_WEBHOOK_SECRET="${finalEnv.GITHUB_WEBHOOK_SECRET}"`,
  '',
  '# Vercel',
  `VERCEL_TOKEN="${finalEnv.VERCEL_TOKEN || ''}"`,
  `VERCEL_PROJECT_ID="${finalEnv.VERCEL_PROJECT_ID}"`,
  `VERCEL_TEAM_ID="${finalEnv.VERCEL_TEAM_ID}"`,
  `VERCEL_WEBHOOK_SECRET="${finalEnv.VERCEL_WEBHOOK_SECRET}"`,
  '',
  '# Neon',
  `NEON_API_KEY="${finalEnv.NEON_API_KEY || ''}"`,
  `NEON_PROJECT_ID="${finalEnv.NEON_PROJECT_ID}"`,
  `NEON_BRANCH="${finalEnv.NEON_BRANCH}"`,
  `NEON_WEBHOOK_SECRET="${finalEnv.NEON_WEBHOOK_SECRET}"`,
  '',
  '# === 6. WHATSAPP CLOUD API ===',
  `WHATSAPP_TOKEN="${finalEnv.WHATSAPP_TOKEN || ''}"`,
  `WHATSAPP_PHONE_NUMBER_ID="${finalEnv.WHATSAPP_PHONE_NUMBER_ID || ''}"`,
  `WHATSAPP_BUSINESS_ID="${finalEnv.WHATSAPP_BUSINESS_ID || ''}"`,
  `WHATSAPP_WEBHOOK_SECRET="${finalEnv.WHATSAPP_WEBHOOK_SECRET}"`,
  '',
  '# === 7. SMTP (Brevo) ===',
  `SMTP_HOST="${finalEnv.SMTP_HOST}"`,
  `SMTP_PORT="${finalEnv.SMTP_PORT}"`,
  `SMTP_USER="${finalEnv.SMTP_USER}"`,
  `SMTP_PASS="${finalEnv.SMTP_PASS || ''}"`,
  `SMTP_FROM="${finalEnv.SMTP_FROM}"`,
  `SMTP_FROM_NAME="${finalEnv.SMTP_FROM_NAME}"`,
  '',
  '# === 8. BANCOLOMBIA ===',
  `BANCOLOMBIA_CLIENT_ID="${finalEnv.BANCOLOMBIA_CLIENT_ID || ''}"`,
  `BANCOLOMBIA_CLIENT_SECRET="${finalEnv.BANCOLOMBIA_CLIENT_SECRET || ''}"`,
  `BANCOLOMBIA_COMMERCE_ID="${finalEnv.BANCOLOMBIA_COMMERCE_ID || ''}"`,
  `BANCOLOMBIA_AMBIENTE="${finalEnv.BANCOLOMBIA_AMBIENTE}"`,
  '',
  '# === 9. ENTORNO ===',
  `NODE_ENV="${finalEnv.NODE_ENV}"`,
  '',
  '# === 10. OPCIONALES ===',
  `SENTRY_DSN="${finalEnv.SENTRY_DSN || ''}"`,
  `NEXT_PUBLIC_GA_ID="${finalEnv.NEXT_PUBLIC_GA_ID || ''}"`,
  '',
];

// Backup current .env
fs.writeFileSync(ENV_PATH + '.pre-sync.bak', envContent);
fs.writeFileSync(ENV_PATH, lines.join('\n'));

console.log('✅ .env regenerado');
console.log(`   Backup: ${ENV_PATH}.pre-sync.bak`);
console.log(`   API_ENCRYPTION_KEY: ${finalEnv.API_ENCRYPTION_KEY.slice(0, 12)}... (64 hex chars)`);
console.log(`   JWT_SECRET: ${finalEnv.JWT_SECRET.slice(0, 12)}... (96 hex chars)`);
console.log(`   ALLOWED_ORIGINS: ${finalEnv.ALLOWED_ORIGINS}`);
console.log(`   NEXT_PUBLIC_APP_URL: ${finalEnv.NEXT_PUBLIC_APP_URL}`);
console.log(`   Secretos nuevos generados: ${Object.keys(secrets).filter(k => !existing[k]).length}`);
console.log(`   Secretos preservados: ${Object.keys(secrets).filter(k => existing[k]).length}`);
