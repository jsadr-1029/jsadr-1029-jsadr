// Verificar credenciales de CAROLINA ALVAREZ
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { cedula: '1214726347' },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      telefono: true,
      email: true,
      claveHash: true,
      claveCreatedAt: true,
      ultimoAccesoPortal: true,
    },
  });
  console.log('Cliente:', JSON.stringify(cliente, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
