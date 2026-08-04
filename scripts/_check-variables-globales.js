const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const vars = await prisma.variableGlobal.findMany();
  console.log('Variables globales:', vars.length);
  vars.forEach(v => {
    const val = (v.valor || '').toString();
    const masked = val.length > 20 ? val.substring(0, 8) + '...' + val.substring(val.length - 8) : val;
    console.log(`  ${v.clave} = ${masked}`);
  });
  // También configuracion
  const config = await prisma.configuracion.findFirst();
  if (config) {
    console.log('\nConfiguración (primer registro):');
    Object.keys(config).forEach(k => {
      const v = config[k];
      if (v === null || v === undefined) return;
      const s = v.toString();
      const masked = s.length > 30 ? s.substring(0, 12) + '...' + s.substring(s.length - 8) : s;
      console.log(`  ${k}: ${masked}`);
    });
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
