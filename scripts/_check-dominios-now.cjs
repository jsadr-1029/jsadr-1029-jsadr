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
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  console.log('=== Dominios en BD ===');
  const dominios = await prisma.dominio.findMany({ orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(dominios, null, 2));
  console.log('\n=== CertificadoSSL en BD ===');
  const ssl = await prisma.certificadoSSL.findMany();
  console.log(JSON.stringify(ssl, null, 2));
  await prisma.$disconnect();
})();
