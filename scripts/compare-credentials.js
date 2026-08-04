// Compare Usuario and Cliente credentials between local SQLite and Neon PostgreSQL
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import sql from '@neondatabase/serverless';

const localPrisma = new PrismaClient({
  datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } },
});

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = sql(NEON_URL);
const adapter = new PrismaNeon(pool);
const neonPrisma = new PrismaClient({ adapter });

async function compare() {
  console.log('=== Comparación de credenciales Local SQLite vs Neon PostgreSQL ===\n');

  // 1. USUARIOS (admin/gestor/consultor/abogado)
  const localUsers = await localPrisma.usuario.findMany({
    select: { id: true, username: true, email: true, rol: true, activo: true, passwordHash: true, claveHash: true, mustChangePassword: true, updatedAt: true },
  });
  const neonUsers = await neonPrisma.usuario.findMany({
    select: { id: true, username: true, email: true, rol: true, activo: true, passwordHash: true, claveHash: true, mustChangePassword: true, updatedAt: true },
  });

  console.log(`Usuarios locales: ${localUsers.length}`);
  console.log(`Usuarios en Neon: ${neonUsers.length}\n`);

  const neonUserMap = new Map(neonUsers.map(u => [u.username, u]));
  console.log('USERNAME'.padEnd(20) + ' | ' + 'LOCAL hash'.padEnd(15) + ' | ' + 'NEON hash'.padEnd(15) + ' | ' + 'MATCH?');
  console.log('-'.repeat(80));
  for (const lu of localUsers) {
    const nu = neonUserMap.get(lu.username);
    if (!nu) {
      console.log(`${lu.username.padEnd(20)} | ${lu.passwordHash.slice(0, 14)}... | (no existe)        | ❌ NO EXISTE EN NEON`);
      continue;
    }
    const localShort = lu.passwordHash.slice(0, 14) + '...';
    const neonShort = nu.passwordHash.slice(0, 14) + '...';
    const match = lu.passwordHash === nu.passwordHash;
    console.log(`${lu.username.padEnd(20)} | ${localShort.padEnd(15)} | ${neonShort.padEnd(15)} | ${match ? '✅' : '❌ DIFIEREN'}`);
    if (!match) {
      console.log(`   LOCAL updatedAt: ${lu.updatedAt.toISOString()}`);
      console.log(`   NEON  updatedAt: ${nu.updatedAt.toISOString()}`);
      console.log(`   LOCAL hash full: ${lu.passwordHash}`);
      console.log(`   NEON  hash full: ${nu.passwordHash}`);
    }
  }

  // 2. CLIENTES (con pinHash / claveHash)
  console.log('\n=== Clientes (cédula → pinHash/claveHash) ===\n');
  const localClientes = await localPrisma.cliente.findMany({
    select: { id: true, cedula: true, nombre: true, pinHash: true, claveHash: true, activo: true },
  });
  const neonClientes = await neonPrisma.cliente.findMany({
    select: { id: true, cedula: true, nombre: true, pinHash: true, claveHash: true, activo: true },
  });
  console.log(`Clientes locales: ${localClientes.length}`);
  console.log(`Clientes en Neon: ${neonClientes.length}\n`);

  const neonClienteMap = new Map(neonClientes.map(c => [c.cedula, c]));
  let mismatches = 0;
  for (const lc of localClientes.slice(0, 30)) { // first 30
    const nc = neonClienteMap.get(lc.cedula);
    if (!nc) {
      console.log(`❌ ${lc.cedula} (${lc.nombre}) — no existe en Neon`);
      mismatches++;
      continue;
    }
    const pinMatch = lc.pinHash === nc.pinHash;
    const claveMatch = lc.claveHash === nc.claveHash;
    if (!pinMatch || !claveMatch) {
      console.log(`⚠️  ${lc.cedula} (${lc.nombre}) — pinHash:${pinMatch ? 'OK' : 'DIFIERE'} claveHash:${claveMatch ? 'OK' : 'DIFIERE'}`);
      mismatches++;
    }
  }
  if (mismatches === 0) {
    console.log(`✅ Los primeros 30 clientes coinciden entre local y Neon`);
  }

  // 3. CONFIGURACIÓN — PIN portal
  console.log('\n=== Configuración PIN portal (PORTAL_PIN_<cedula>) ===\n');
  const localConfig = await localPrisma.configuracion.findMany({
    where: { clave: { startsWith: 'PORTAL_PIN_' } },
    select: { clave: true, valor: true, updatedAt: true },
  });
  const neonConfig = await neonPrisma.configuracion.findMany({
    where: { clave: { startsWith: 'PORTAL_PIN_' } },
    select: { clave: true, valor: true, updatedAt: true },
  });
  console.log(`PINs locales: ${localConfig.length}`);
  console.log(`PINs en Neon: ${neonConfig.length}`);

  await localPrisma.$disconnect();
  await neonPrisma.$disconnect();
}

compare().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
