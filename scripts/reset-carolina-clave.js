// Resetear la clave de CAROLINA ALVAREZ a un valor conocido para probar el flujo T&C
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const nuevaClave = 'Js951029*';
  const hash = await bcrypt.hash(nuevaClave, 12);

  const result = await prisma.cliente.updateMany({
    where: { cedula: '1214726347' },
    data: {
      claveHash: hash,
      claveCreatedAt: new Date(),
      debeCambiarClave: false,
    },
  });

  console.log('Clave reseteada para Carolina:', result);
  console.log('Nueva clave temporal:', nuevaClave);
  console.log('Hash:', hash);
}
main().catch(console.error).finally(() => prisma.$disconnect());
