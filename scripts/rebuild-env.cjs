/**
 * rebuild-env.cjs — reconstruye .env desde Vercel artifact + BD Neon
 * 1. Lee /tmp/vercel-envs/env-production.txt (descargado de Vercel)
 * 2. Descifra PlataformaSync con API_ENCRYPTION_KEY (tokens NEON, GITHUB, VERCEL)
 * 3. Lee VariableGlobal (CRON_SECRET, BREVO_API_KEY, etc.)
 * 4. Escribe .env completo
 */
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const VERCEL_ENV_PATH = '/tmp/vercel-envs/env-production.txt';

// 1. Cargar .env de Vercel (recién descargado)
const vercelEnvContent = fs.readFileSync(VERCEL_ENV_PATH, 'utf8');
const env = {};
for (const line of vercelEnvContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}

console.log('✓ .env de Vercel cargado:', Object.keys(env).length, 'claves');

const DATABASE_URL = env.DATABASE_URL;
const API_ENCRYPTION_KEY = env.API_ENCRYPTION_KEY;
const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL + (DATABASE_URL.includes('?') ? '&' : '?') + 'connect_timeout=60&pool_timeout=60' } },
});

function decryptSensitive(encText, keyHex) {
  if (!encText) return '';
  const key = Buffer.from(keyHex, 'hex');
  const parts = encText.split(':');
  if (parts.length !== 2) return encText;
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) {
    return '[decrypt failed]';
  }
}

(async () => {
  // 2. Descifrar PlataformaSync
  console.log('\n▶ Descifrando PlataformaSync...');
  const ps = await prisma.plataformaSync.findMany();
  const decrypted = {};
  for (const row of ps) {
    const token = row.tokenCifrado ? decryptSensitive(row.tokenCifrado, API_ENCRYPTION_KEY) : '';
    const webhookSecret = row.webhookSecret ? decryptSensitive(row.webhookSecret, API_ENCRYPTION_KEY) : '';
    decrypted[row.plataforma] = { token, webhookSecret, projectId: row.projectId, teamId: row.teamId, alias: row.alias };
    console.log(`  ${row.plataforma}: token=${token.substring(0, 12)}...${token.slice(-6)} (${token.length} chars)  webhook=${webhookSecret ? 'sí' : 'no'}`);
  }

  // 3. Leer VariableGlobal
  console.log('\n▶ Leyendo VariableGlobal...');
  const gv = await prisma.variableGlobal.findMany();
  const globalVars = {};
  for (const v of gv) globalVars[v.clave] = (v.valor || '').toString();
  console.log(`  ${gv.length} claves cargadas`);

  // 4. Reconstruir .env completo
  // GitHub token: priorizar el del remote URL si no está en PlataformaSync
  const ghTokenFromRemote = fs.readFileSync('/tmp/ghtoken.txt', 'utf8').trim();
  
  const finalEnv = {
    // === 1. BD ===
    DATABASE_URL: DATABASE_URL,
    // === 2. SECRETOS ===
    API_ENCRYPTION_KEY: env.API_ENCRYPTION_KEY,
    JWT_SECRET: env.JWT_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    OTP_CHAT_SECRET: env.OTP_CHAT_SECRET,
    PORTAL_SESSION_SECRET: env.PORTAL_SESSION_SECRET,
    ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET,
    CHAT_DYN_SECRET: env.CHAT_DYN_SECRET,
    // === 3. CORS ===
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS + ',https://localhost:3000,https://preview-*.space-z.ai',
    // === 4. URL ===
    NEXT_PUBLIC_APP_URL: 'https://jsadr.com.co',
    // === 5. PLATAFORMAS ===
    GITHUB_TOKEN: decrypted.GITHUB?.token || ghTokenFromRemote,
    GITHUB_OWNER: 'jsadr-1029',
    GITHUB_REPO: 'jsadr-1029-jsadr',
    GITHUB_WEBHOOK_SECRET: decrypted.GITHUB?.webhookSecret || '',
    VERCEL_TOKEN: env.VERCEL_TOKEN || decrypted.VERCEL?.token || '',
    VERCEL_PROJECT_ID: 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj',
    VERCEL_TEAM_ID: 'team_RgKIQ16ZqHOh3cpZ5WgzXtop',
    VERCEL_WEBHOOK_SECRET: decrypted.VERCEL?.webhookSecret || '',
    NEON_API_KEY: decrypted.NEON?.token || '',
    NEON_PROJECT_ID: 'rapid-darkness-56995142',
    NEON_BRANCH: 'main',
    NEON_WEBHOOK_SECRET: decrypted.NEON?.webhookSecret || '',
    // === 6. WHATSAPP ===
    WHATSAPP_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_BUSINESS_ID: '',
    WHATSAPP_WEBHOOK_SECRET: '',
    // === 7. SMTP (Brevo) ===
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'b3e8df001@smtp-brevo.com',
    SMTP_PASS: env.BREVO_SMTP_KEY || env.BREVO_API_KEY || '',
    SMTP_FROM: 'jsa@jsadr.com.co',
    SMTP_FROM_NAME: 'JSADR Plataforma',
    BREVO_API_KEY: env.BREVO_API_KEY || globalVars.BREVO_API_KEY || '',
    // === 8. BANCOLOMBIA ===
    BANCOLOMBIA_CLIENT_ID: '',
    BANCOLOMBIA_CLIENT_SECRET: '',
    BANCOLOMBIA_COMMERCE_ID: '',
    BANCOLOMBIA_AMBIENTE: 'sandbox',
    // === 9. ENTORNO ===
    NODE_ENV: 'development',
    // === 10. OPCIONALES ===
    SENTRY_DSN: '',
    NEXT_PUBLIC_GA_ID: '',
    // === 11. CRON ===
    CRON_SECRET: globalVars.CRON_SECRET || '',
  };

  // Generar contenido
  const now = new Date().toISOString();
  let content = `# =====================================================
# .env — JSADR Plataforma de Gestión de Préstamos
# Reconstruido el ${now}
# Fuentes: Vercel envs (production) + PlataformaSync (BD) + VariableGlobal
# =====================================================

`;
  const sections = [
    ['1. BASE DE DATOS (Neon PostgreSQL)', ['DATABASE_URL']],
    ['2. SECRETOS DE AUTENTICACIÓN', ['API_ENCRYPTION_KEY', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'OTP_CHAT_SECRET', 'PORTAL_SESSION_SECRET', 'ADMIN_SESSION_SECRET', 'CHAT_DYN_SECRET']],
    ['3. CORS / ORÍGENES PERMITIDOS', ['ALLOWED_ORIGINS']],
    ['4. URL PÚBLICA', ['NEXT_PUBLIC_APP_URL']],
    ['5. PLATAFORMAS DE SINCRONIZACIÓN', ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'GITHUB_WEBHOOK_SECRET', 'VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID', 'VERCEL_WEBHOOK_SECRET', 'NEON_API_KEY', 'NEON_PROJECT_ID', 'NEON_BRANCH', 'NEON_WEBHOOK_SECRET']],
    ['6. WHATSAPP CLOUD API', ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ID', 'WHATSAPP_WEBHOOK_SECRET']],
    ['7. SMTP (Brevo)', ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_FROM_NAME', 'BREVO_API_KEY']],
    ['8. BANCOLOMBIA', ['BANCOLOMBIA_CLIENT_ID', 'BANCOLOMBIA_CLIENT_SECRET', 'BANCOLOMBIA_COMMERCE_ID', 'BANCOLOMBIA_AMBIENTE']],
    ['9. ENTORNO', ['NODE_ENV']],
    ['10. OPCIONALES', ['SENTRY_DSN', 'NEXT_PUBLIC_GA_ID']],
    ['11. CRON', ['CRON_SECRET']],
  ];
  for (const [sectionName, keys] of sections) {
    content += `\n# === ${sectionName} ===\n`;
    for (const k of keys) {
      const v = finalEnv[k];
      if (v === undefined || v === null) {
        content += `${k}=""\n`;
      } else if (v === '') {
        content += `${k}=""\n`;
      } else {
        content += `${k}="${v}"\n`;
      }
    }
  }

  // Backup del .env actual (roto)
  const currentEnv = fs.readFileSync('/home/z/my-project/.env', 'utf8');
  fs.writeFileSync('/home/z/my-project/.env.broken.bak', currentEnv);
  console.log('\n✓ .env roto respaldado en .env.broken.bak');

  // Escribir nuevo .env
  fs.writeFileSync('/home/z/my-project/.env', content);
  console.log('✓ .env reconstruido en /home/z/my-project/.env');
  console.log(`  Tamaño: ${content.length} bytes, ${content.split('\n').length} líneas`);
  console.log(`  Claves: ${Object.keys(finalEnv).length}`);

  // Verificar que el nuevo .env carga correctamente
  console.log('\n▶ Verificando nuevo .env...');
  const testEnv = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (m) testEnv[m[1]] = m[2];
  }
  const checks = [
    ['DATABASE_URL', v => v && v.startsWith('postgresql://')],
    ['API_ENCRYPTION_KEY', v => v && /^[0-9a-f]{64}$/.test(v)],
    ['JWT_SECRET', v => v && v.length >= 32],
    ['BREVO_API_KEY', v => v && v.startsWith('xkeysib-')],
    ['VERCEL_TOKEN', v => v && v.startsWith('vcp_')],
    ['CRON_SECRET', v => v && v.length >= 32],
  ];
  let allOk = true;
  for (const [k, check] of checks) {
    const v = testEnv[k];
    const ok = check(v);
    console.log(`  ${ok ? '✅' : '❌'} ${k}: ${ok ? 'OK' : 'INVALIDO'} (${v ? v.substring(0, 20) + '...' : '(vacío)'})`);
    if (!ok) allOk = false;
  }
  if (allOk) {
    console.log('\n✅ .env reconstruido correctamente');
  } else {
    console.log('\n⚠ Algunas claves no validan — revisar antes de usar');
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  await prisma.$disconnect();
  process.exit(1);
});
