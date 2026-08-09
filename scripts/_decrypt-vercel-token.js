// Try common encryption key candidates from prior project state
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});

function tryDecrypt(encText, keyBuf) {
  try {
    const parts = encText.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) { return null; }
}

(async () => {
  const ps = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } });
  const enc = ps.tokenCifrado;
  console.log('Encrypted token length:', enc.length);
  
  // Get JWT_SECRET etc from Neon vars and try them as keys
  const globals = await prisma.variableGlobal.findMany();
  console.log('Found', globals.length, 'global vars');
  for (const g of globals) {
    const val = g.valor || g.valorTexto || '';
    if (val.length < 8) continue;
    // Try raw value (if 64-hex)
    let key = null;
    if (/^[0-9a-fA-F]{64}$/.test(val)) key = Buffer.from(val, 'hex');
    else key = crypto.createHash('sha256').update(val).digest();
    const dec = tryDecrypt(enc, key);
    if (dec && dec.startsWith('vcp_')) {
      console.log(`✅ KEY FOUND in VariableGlobal.${g.clave}: ${g.clave}=${val.slice(0,8)}***`);
      console.log(`Token: ${dec.slice(0,16)}...${dec.slice(-6)} (${dec.length} chars)`);
      await prisma.$disconnect();
      return;
    }
  }
  
  // Also try common defaults
  const candidates = [
    'jsadr-secret-key-2024',
    'jsadr-encryption-key-2026',
    'jsadr-encryption-key',
    'jsadr-prod-encryption',
    'jsadr-prod',
    'jsadr',
    'secret',
    'change-me',
    'jsadr.com.co',
    'production-encryption-key',
  ];
  for (const c of candidates) {
    const key = crypto.createHash('sha256').update(c).digest();
    const dec = tryDecrypt(enc, key);
    if (dec && dec.startsWith('vcp_')) {
      console.log(`✅ KEY FOUND with candidate: ${c}`);
      console.log(`Token: ${dec.slice(0,16)}...${dec.slice(-6)} (${dec.length} chars)`);
      await prisma.$disconnect();
      return;
    }
  }
  
  console.log('❌ No key found in VariableGlobal or candidates');
  console.log('VariableGlobal keys:', globals.map(g => g.clave).join(', '));
  await prisma.$disconnect();
})();
