// =====================================================
// REGISTRAR DOMINIO jsadr.com.co EN BD
// =====================================================
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
  console.log('=== Registrando dominios en Configuración Global ===\n');

  const dominiosData = [
    {
      nombre: 'jsadr.com.co',
      url: 'https://jsadr.com.co',
      tipo: 'PRINCIPAL',
      estado: 'activo',
      ambiente: 'produccion',
      usuarioResp: 'admin-jsadr',
    },
    {
      nombre: 'www.jsadr.com.co',
      url: 'https://www.jsadr.com.co',
      tipo: 'SUBDOMINIO',
      estado: 'activo',
      ambiente: 'produccion',
      usuarioResp: 'admin-jsadr',
    },
    {
      nombre: 'jsadr-jsadr.vercel.app',
      url: 'https://jsadr-jsadr.vercel.app',
      tipo: 'PREVIEW',
      estado: 'activo',
      ambiente: 'preview',
      sslValido: true,
      usuarioResp: 'vercel-auto',
    },
  ];

  for (const d of dominiosData) {
    const existente = await prisma.dominio.findFirst({ where: { nombre: d.nombre } });
    if (existente) {
      const actualizado = await prisma.dominio.update({
        where: { id: existente.id },
        data: { ...d, ultimoCheck: new Date() },
      });
      console.log(`✅ Actualizado: ${actualizado.nombre} (${actualizado.tipo})`);
    } else {
      const creado = await prisma.dominio.create({
        data: { ...d, ultimoCheck: new Date() },
      });
      console.log(`✅ Creado: ${creado.nombre} (${creado.tipo})`);
    }
  }

  // SSL placeholder
  const sslExistente = await prisma.certificadoSSL.findFirst({ where: { dominio: 'jsadr.com.co' } });
  if (!sslExistente) {
    const ssl = await prisma.certificadoSSL.create({
      data: {
        dominio: 'jsadr.com.co',
        estado: 'pendiente',
        emisor: "Vercel (Let's Encrypt)",
      }
    });
    console.log(`\n✅ SSL placeholder creado: ${ssl.id}`);
  } else {
    console.log(`\nℹ️  SSL ya existe para jsadr.com.co`);
  }

  // Listar
  const todos = await prisma.dominio.findMany({ orderBy: { createdAt: 'desc' } });
  console.log('\n=== DOMINIOS FINALES EN BD ===');
  for (const d of todos) {
    console.log(`  ${d.nombre.padEnd(30)} | ${d.tipo.padEnd(12)} | ${d.estado.padEnd(8)} | ${d.ambiente}`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Registro completo.');
})().catch(e => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});
