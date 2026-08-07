import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

console.log('DATABASE_URL defined?', !!process.env.DATABASE_URL);
console.log('First 20 chars:', process.env.DATABASE_URL?.substring(0, 20));

const finalUrl = process.env.DATABASE_URL + '&connect_timeout=60&pool_timeout=60';
console.log('Final URL first 20 chars:', finalUrl.substring(0, 20));

const prisma = new PrismaClient({
  datasources: { db: { url: finalUrl } },
});

async function main() {
  try {
    const count = await prisma.cliente.count();
    console.log('✓ Cliente count:', count);
  } catch (e: any) {
    console.log('✗ Error:', e.message.substring(0, 200));
  } finally {
    await prisma.$disconnect();
  }
}
main();
