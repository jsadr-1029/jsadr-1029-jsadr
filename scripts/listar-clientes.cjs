require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const clientes = await prisma.cliente.findMany({
    take: 5,
    where: { activo: true },
    select: { id: true, nombre: true, cedula: true, telefono: true, activo: true }
  });
  console.log(JSON.stringify(clientes, null, 2));
  // También listar usuarios
  const usuarios = await prisma.usuario.findMany({
    take: 10,
    select: { id: true, nombre: true, username: true, cedula: true, rol: true, activo: true }
  });
  console.log('\n--- USUARIOS ---');
  console.log(JSON.stringify(usuarios, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
