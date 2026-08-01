// Crear usuarios GESTOR y CONSULTOR para pruebas de perfiles
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();
const BCRYPT_ROUNDS = 12;

const NUEVOS_USUARIOS = [
  {
    nombre: 'Gestor de Préstamos',
    email: 'gestor@empresa.com',
    username: 'gestor-jsadr',
    password: process.env.GESTOR_PASS || 'CHANGE_ME',
    rol: 'GESTOR',
  },
  {
    nombre: 'Consultor del Sistema',
    email: 'consultor@empresa.com',
    username: 'consultor-jsadr',
    password: process.env.CONSULTOR_PASS || 'CHANGE_ME',
    rol: 'CONSULTOR',
  },
];

async function main() {
  for (const u of NUEVOS_USUARIOS) {
    // Verificar si ya existe
    const existente = await db.usuario.findUnique({ where: { username: u.username } });
    if (existente) {
      console.log(`[SKIP] Ya existe: ${u.username} (id=${existente.id})`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    const verify = await bcrypt.compare(u.password, passwordHash);
    if (!verify) {
      console.error(`Hash verification FAILED for ${u.username}`);
      continue;
    }

    const creado = await db.usuario.create({
      data: {
        nombre: u.nombre,
        email: u.email,
        username: u.username,
        passwordHash,
        rol: u.rol,
        activo: true,
        mfaEnabled: false,
        mfaSecret: null,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        mustChangePassword: false,
        sessionToken: null,
      },
    });

    console.log(`[OK] ${u.rol} creado: ${u.username} | id=${creado.id}`);
  }

  // Resumen final
  const todos = await db.usuario.findMany({
    select: { nombre: true, username: true, email: true, rol: true, activo: true },
    orderBy: { rol: 'asc' },
  });

  console.log('\n=== LISTADO FINAL DE USUARIOS ===');
  console.log('Total:', todos.length);
  for (const u of todos) {
    console.log(`  [${u.rol.padEnd(10)}] ${u.username.padEnd(20)} | ${u.email.padEnd(28)} | ${u.activo ? 'ACTIVO' : 'INACTIVO'} | ${u.nombre}`);
  }
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(1); })
  .finally(() => db.$disconnect());
