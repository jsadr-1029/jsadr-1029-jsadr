const fs = require('fs');
const crypto = require('crypto');

// Load .env manually
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const ALGORITHM = 'aes-256-cbc';
function tryDecrypt(encryptedText, keyBuf) {
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

// Candidate keys
const candidates = [
  ['dev-temp-encryption-key', crypto.createHash('sha256').update('dev-temp-encryption-key').digest()],
];

// If API_ENCRYPTION_KEY exists in .env, add it
if (process.env.API_ENCRYPTION_KEY) {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    candidates.push(['API_ENCRYPTION_KEY(hex)', Buffer.from(raw, 'hex')]);
  } else {
    candidates.push(['API_ENCRYPTION_KEY(sha256)', crypto.createHash('sha256').update(raw).digest()]);
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const all = await prisma.plataformaSync.findMany();
  for (const p of all) {
    console.log(`\n=== ${p.plataforma} ===`);
    if (p.tokenCifrado) {
      for (const [name, key] of candidates) {
        const decrypted = tryDecrypt(p.tokenCifrado, key);
        if (decrypted) {
          console.log(`✅ Decrypted with ${name}`);
          console.log('Token (first 15):', decrypted.slice(0, 15) + '...');
          console.log('Token length:', decrypted.length);
          break;
        } else {
          console.log(`❌ Failed with ${name}`);
        }
      }
    }
  }
  await prisma.$disconnect();
})();
