// Compare Usuario and Cliente credentials between local SQLite and Neon PostgreSQL
// Uses pg directly (already installed)
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await neonClient.connect();

  // === USUARIOS ===
  console.log('=== USUARIOS (admin/gestor/consultor/abogado) ===\n');
  const localUsers = await prisma.usuario.findMany({
    select: { id: true, username: true, email: true, rol: true, activo: true, passwordHash: true, claveHash: true, mustChangePassword: true, updatedAt: true },
  });
  const { rows: neonUsers } = await neonClient.query('SELECT id, username, email, rol, activo, "passwordHash", "claveHash", "mustChangePassword", "updatedAt" FROM "Usuario"');

  console.log(`Usuarios locales: ${localUsers.length}`);
  console.log(`Usuarios en Neon: ${neonUsers.length}\n`);

  console.log('USERNAME'.padEnd(20) + ' | ' + 'LOCAL hash (60 chars)'.padEnd(64) + ' | ' + 'NEON hash (60 chars)'.padEnd(64) + ' | MATCH');
  console.log('-'.repeat(160));
  const neonUserMap = new Map(neonUsers.map(u => [u.username.toLowerCase(), u]));
  let userMismatches = 0;
  for (const lu of localUsers) {
    const nu = neonUserMap.get(lu.username.toLowerCase());
    if (!nu) {
      console.log(`${lu.username.padEnd(20)} | ${lu.passwordHash.slice(0, 60).padEnd(64)} | (no existe en Neon)${''.padEnd(46)} | ❌ NO EXISTE`);
      userMismatches++;
      continue;
    }
    const match = lu.passwordHash === nu.passwordHash;
    if (!match) userMismatches++;
    console.log(`${lu.username.padEnd(20)} | ${lu.passwordHash.slice(0, 60).padEnd(64)} | ${(nu.passwordHash || '').slice(0, 60).padEnd(64)} | ${match ? '✅' : '❌ DIFIEREN'}`);
    if (!match) {
      console.log(`   LOCAL updatedAt: ${lu.updatedAt.toISOString()}`);
      console.log(`   NEON  updatedAt: ${nu.updatedAt ? new Date(nu.updatedAt).toISOString() : 'null'}`);
    }
  }
  console.log(`\nMismatches de usuario: ${userMismatches}/${localUsers.length}`);

  // === CLIENTES (con pinHash / claveHash) ===
  console.log('\n=== CLIENTES (cédula → pinHash/claveHash) ===\n');
  const localClientes = await prisma.cliente.findMany({
    select: { id: true, cedula: true, nombre: true, pinHash: true, claveHash: true, activo: true },
  });
  const { rows: neonClientes } = await neonClient.query('SELECT id, cedula, nombre, "pinHash", "claveHash", activo FROM "Cliente"');
  console.log(`Clientes locales: ${localClientes.length}`);
  console.log(`Clientes en Neon: ${neonClientes.length}`);

  const neonClienteMap = new Map(neonClientes.map(c => [c.cedula, c]));
  let pinMismatches = 0;
  let claveMismatches = 0;
  let notInNeon = 0;
  for (const lc of localClientes) {
    const nc = neonClienteMap.get(lc.cedula);
    if (!nc) { notInNeon++; continue; }
    if (lc.pinHash && nc.pinHash && lc.pinHash !== nc.pinHash) pinMismatches++;
    if (lc.claveHash && nc.claveHash && lc.claveHash !== nc.claveHash) claveMismatches++;
  }
  console.log(`  pinHash que difieren: ${pinMismatches}`);
  console.log(`  claveHash que difieren: ${claveMismatches}`);
  console.log(`  Clientes locales no presentes en Neon: ${notInNeon}`);

  // === CONFIGURACIÓN — PORTAL_PIN_ ===
  console.log('\n=== PORTAL_PIN_* (Configuracion) ===\n');
  const localConfig = await prisma.configuracion.findMany({
    where: { clave: { startsWith: 'PORTAL_PIN_' } },
    select: { clave: true, valor: true, updatedAt: true },
  });
  const { rows: neonConfig } = await neonClient.query(`SELECT clave, valor, "updatedAt" FROM "Configuracion" WHERE clave LIKE 'PORTAL_PIN_%'`);
  console.log(`PINs locales: ${localConfig.length}`);
  console.log(`PINs en Neon: ${neonConfig.length}`);
  const neonCfgMap = new Map(neonConfig.map(c => [c.clave, c]));
  let cfgMismatches = 0;
  for (const lc of localConfig) {
    const nc = neonCfgMap.get(lc.clave);
    if (!nc) { console.log(`  ❌ ${lc.clave} no está en Neon`); cfgMismatches++; continue; }
    if (lc.valor !== nc.valor) {
      console.log(`  ⚠️  ${lc.clave} difiere`);
      cfgMismatches++;
    }
  }
  console.log(`\nMismatches de PIN config: ${cfgMismatches}/${localConfig.length}`);

  await neonClient.end();
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
