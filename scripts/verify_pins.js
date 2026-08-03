const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const cedulas = ['1214726347', '1214731649', '123456789', '888888888', '999999999'];
    const pins = ['1234', '0000', '12345', '123456', '1111', '9999', '4321'];
    for (const cedula of cedulas) {
      const c = await prisma.cliente.findFirst({ where: { cedula }, select: { nombre: true, cedula: true, pinHash: true, activo: true }});
      if (!c) {
        console.log(`❌ cedula=${cedula} → no encontrada`);
        continue;
      }
      console.log(`\n${c.nombre} (cc ${c.cedula}, activo=${c.activo})`);
      let found = false;
      for (const pin of pins) {
        if (!c.pinHash) continue;
        const ok = await bcrypt.compare(pin, c.pinHash);
        if (ok) {
          console.log(`  ✅ PIN = ${pin}`);
          found = true;
          break;
        }
      }
      if (!found && c.pinHash) {
        console.log(`  ❌ Ninguno de [${pins.join(',')}] coincide con el hash ${c.pinHash.substring(0,20)}...`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
