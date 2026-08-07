const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
  console.log('Admin user:', admin.username);
  console.log('Email:', admin.email);
  console.log('passwordHash (full):', admin.passwordHash);
  
  // Try common passwords the user might have used
  const candidates = [
    'Js121473164*',
    'js121473164*',
    'Js121473164',
    'Admin123*',
    'admin',
    'Johan1214*',
    'jsadr123',
    'Jsadr1214*',
    'Js121473164!',
    'JSA121473164*',
    'Johan121473164*',
  ];
  
  console.log('\n=== Verificando contraseñas candidatas ===');
  for (const pwd of candidates) {
    const ok = await bcrypt.compare(pwd, admin.passwordHash);
    if (ok) {
      console.log(`✅ MATCH: "${pwd}"`);
      break;
    } else {
      console.log(`❌ "${pwd}"`);
    }
  }
  
  // Also check the abogado
  console.log('\n=== Abogado (portal jurídico) ===');
  const abogados = await prisma.usuario.findMany({ where: { rol: 'ABOGADO' } });
  for (const a of abogados) {
    console.log(`\nAbogado: ${a.username} (cedula: ${a.cedula})`);
    if (a.claveHash) {
      for (const pwd of ['Js121473164*', 'Js121473164', 'Johan1214*', 'Abogado123*', 'jsadr123']) {
        const ok = await bcrypt.compare(pwd, a.claveHash);
        if (ok) {
          console.log(`✅ claveHash MATCH: "${pwd}"`);
          break;
        }
      }
    }
  }
  
  await prisma.$disconnect();
})().catch(e => {
  console.error('ERR:', e.message);
  process.exit(1);
});
