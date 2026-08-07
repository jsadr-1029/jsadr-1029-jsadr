// Buscar en TODA la BD si existe alguna fila con valor xkeysib-... (parcial o completo)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});

(async () => {
  try {
    // 1) VariableGlobal con clave parecida a BREVO
    const vars = await prisma.variableGlobal.findMany({
      where: { OR: [{ clave: { contains: 'BREVO', mode: 'insensitive' } }, { clave: { contains: 'API', mode: 'insensitive' } }] }
    });
    console.log('=== VariableGlobal (BREVO/API) ===');
    for (const v of vars) {
      console.log(`  ${v.clave}: ${v.valor ? v.valor.substring(0, 50) + (v.valor.length > 50 ? '...' : '') : 'null'} (${v.valor?.length || 0} chars)`);
    }

    // 2) Configuración con BREVO
    const configs = await prisma.configuracion.findMany({
      where: { clave: { contains: 'BREVO', mode: 'insensitive' } }
    });
    console.log('\n=== Configuración (BREVO) ===');
    for (const c of configs) {
      console.log(`  ${c.clave}: ${c.valor ? c.valor.substring(0, 50) + (c.valor.length > 50 ? '...' : '') : 'null'} (${c.valor?.length || 0} chars)`);
    }

    // 3) Buscar en ConfigBot
    const bots = await prisma.configBot.findMany();
    console.log('\n=== ConfigBot ===');
    for (const b of bots) {
      const str = JSON.stringify(b);
      if (str.toLowerCase().includes('xkeysib') || str.toLowerCase().includes('brevo')) {
        console.log(`  Bot ${b.id}: contiene referencia a Brevo/xkeysib`);
      }
    }

    // 4) Buscar ConexionAPI por tipo
    const conexiones = await prisma.conexionAPI.findMany();
    console.log('\n=== ConexionAPI (todas) ===');
    for (const c of conexiones) {
      console.log(`  ${c.tipo} | ${c.nombre} | activa=${c.activa}`);
      console.log(`    apiKey: ${c.apiKey ? c.apiKey.substring(0, 30) + '...' : 'null'}`);
      console.log(`    password: ${c.password ? c.password.substring(0, 30) + '...' : 'null'}`);
    }

    console.log('\n=== CONCLUSIÓN ===');
    console.log('Si en ConexionAPI solo hay EMAIL_SMTP con xsmtpsib- en apiKey,');
    console.log('NO hay forma de obtener la API key HTTPS sin pedirla al usuario.');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
