const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    // Desbloquear ambos clientes
    const cedulas = ['1214726347', '1214731649'];
    for (const cedula of cedulas) {
      const c = await prisma.cliente.findFirst({ where: { cedula }, select: { id: true, nombre: true, cedula: true, pinIntentos: true, pinBloqueadoHasta: true, claveIntentos: true, claveBloqueadoHasta: true, pinHash: true, claveHash: true, activo: true }});
      if (!c) {
        console.log(`❌ cedula=${cedula} → no encontrada`);
        continue;
      }
      console.log(`\nANTES: ${c.nombre} (cc ${c.cedula})`);
      console.log(`   pinIntentos=${c.pinIntentos} pinBloqueadoHasta=${c.pinBloqueadoHasta||'no'}`);
      console.log(`   claveIntentos=${c.claveIntentos} claveBloqueadoHasta=${c.claveBloqueadoHasta||'no'}`);
      console.log(`   pinHash=${c.pinHash ? c.pinHash.substring(0,20)+'...' : 'NULL'}`);
      console.log(`   claveHash=${c.claveHash ? c.claveHash.substring(0,20)+'...' : 'NULL'}`);
      console.log(`   activo=${c.activo}`);
      
      // Reset intentos y bloqueos
      const updated = await prisma.cliente.update({
        where: { id: c.id },
        data: {
          pinIntentos: 0,
          pinBloqueadoHasta: null,
          claveIntentos: 0,
          claveBloqueadoHasta: null,
        }
      });
      console.log(`DESPUÉS: pinIntentos=${updated.pinIntentos} pinBloqueadoHasta=${updated.pinBloqueadoHasta||'no'}`);
      console.log(`         claveIntentos=${updated.claveIntentos} claveBloqueadoHasta=${updated.claveBloqueadoHasta||'no'}`);
      console.log(`✅ Desbloqueado.`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
