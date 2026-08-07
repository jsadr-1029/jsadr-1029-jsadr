const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); process.env[m[1]] = v; }
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + '&connect_timeout=60&pool_timeout=60' } } });
(async () => {
  const cols = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('AuditLog','AuditoriaConfiguracion','VersionConfiguracion','ConfigBot','Configuracion','VariableGlobal') ORDER BY table_name, ordinal_position`;
  console.log('Columnas:');
  for (const c of cols) console.log(`  ${c.column_name} (${c.data_type})`);
  await prisma.$disconnect();
})();
