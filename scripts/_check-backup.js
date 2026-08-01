require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true }
  });
  if (!c) { console.log('No SMTP config'); return; }
  console.log('All fields:');
  for (const [key, val] of Object.entries(c)) {
    if (val === null || val === undefined) {
      console.log(`  ${key}: ${val}`);
    } else if (typeof val === 'string' && val.length > 80) {
      console.log(`  ${key}: <${val.length} chars> ${val.substring(0,30)}...`);
    } else {
      console.log(`  ${key}: ${val}`);
    }
  }
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
