require('dotenv').config({ path: '.env', override: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'FirmaElectronica'
    AND column_name LIKE 'foto%'
    ORDER BY column_name;
  `
  console.log('Columnas foto en FirmaElectronica:')
  rows.forEach(r => console.log('  -', r.column_name))
}
main().finally(() => prisma.$disconnect())
