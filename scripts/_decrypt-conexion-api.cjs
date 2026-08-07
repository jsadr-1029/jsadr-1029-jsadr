/**
 * Intenta descifrar las credenciales de ConexionAPI (Brevo, Bancolombia)
 * usando:
 *   - API_ENCRYPTION_KEY actual (hex 64)
 *   - API_ENCRYPTION_KEY actual (sha256 derivada)
 *   - BACKUP_KEY_SEED (constante en src/lib/security.ts) — siempre disponible
 *   - dev-temp-encryption-key (fallback en dev)
 */
const fs = require('fs');
const crypto = require('crypto');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-cbc';
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';

const candidateKeys = [
  { name: 'API_ENCRYPTION_KEY (hex)', buf: Buffer.from(process.env.API_ENCRYPTION_KEY, 'hex') },
  { name: 'API_ENCRYPTION_KEY (sha256)', buf: crypto.createHash('sha256').update(process.env.API_ENCRYPTION_KEY).digest() },
  { name: 'BACKUP_KEY_SEED (sha256)', buf: crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest() },
  { name: 'dev-temp-encryption-key (sha256)', buf: crypto.createHash('sha256').update('dev-temp-encryption-key').digest() },
];

function tryDecrypt(encrypted, keyBuf) {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const data = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) {
    return null;
  }
}

(async () => {
  console.log('\n========================================');
  console.log(' DESCIFRADO DE CREDENCIALES ConexionAPI');
  console.log('========================================\n');

  const conns = await prisma.conexionAPI.findMany();
  console.log(`Total conexiones: ${conns.length}\n`);

  for (const c of conns) {
    console.log(`=== ${c.tipo} — ${c.nombre} ===`);
    const fields = ['apiKey', 'apiSecret', 'password'];
    for (const f of fields) {
      const val = c[f];
      if (!val || !val.includes(':')) {
        console.log(`  ${f}: (vacio o no cifrado) "${val || ''}"`);
        continue;
      }
      let decrypted = null;
      let usedKey = null;
      for (const k of candidateKeys) {
        const d = tryDecrypt(val, k.buf);
        if (d !== null) { decrypted = d; usedKey = k.name; break; }
      }
      if (decrypted !== null) {
        console.log(`  ${f}: "${decrypted}"  [descifrado con: ${usedKey}]`);
      } else {
        console.log(`  ${f}: NO DESCIFRABLE con ninguna llave candidata. Valor cifrado: ${val.substring(0,40)}...`);
      }
    }
    console.log('');
  }

  // Tambien intentar descifrar los tokens de PlataformaSync con BACKUP_KEY_SEED
  console.log('=== INTENTO EXTRA: PlataformaSync con BACKUP_KEY_SEED ===\n');
  const plats = await prisma.plataformaSync.findMany();
  for (const p of plats) {
    console.log(`--- ${p.plataforma} ---`);
    const val = p.tokenCifrado;
    if (!val) { console.log('  (sin token)'); continue; }
    let decrypted = null;
    for (const k of candidateKeys) {
      const d = tryDecrypt(val, k.buf);
      if (d !== null) { decrypted = d; console.log(`  [OK con ${k.name}] token = ${d}`); break; }
    }
    if (!decrypted) console.log(`  NO descifrable. (valor cifrado: ${val.substring(0,50)}...)`);
    console.log('');
  }

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
