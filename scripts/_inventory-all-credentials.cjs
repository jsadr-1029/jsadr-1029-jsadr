/**
 * Inventario completo de credenciales del proyecto JSADR
 * Extrae TODAS las credenciales almacenadas en la BD Neon.
 */
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n========================================');
  console.log(' INVENTARIO DE CREDENCIALES — JSADR');
  console.log(' Fecha: ' + new Date().toISOString());
  console.log('========================================\n');

  // 1. Usuarios internos
  console.log('=== 1. USUARIOS INTERNOS (tabla Usuario) ===');
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true, username: true, nombre: true, email: true,
      rol: true, activo: true, cedula: true,
      passwordHash: true, claveHash: true,
      intentosFallidos: true, bloqueadoHasta: true,
      sessionToken: true, tokenSesion: true, tokenExpira: true,
      mfaEnabled: true, mfaSecret: true,
      mustChangePassword: true,
      ultimoAcceso: true, updatedAt: true, createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Total: ${usuarios.length} usuarios\n`);
  usuarios.forEach((u, i) => {
    console.log(`[${i+1}] ${u.username} — rol: ${u.rol}`);
    console.log(`    Nombre: ${u.nombre}`);
    console.log(`    Email: ${u.email}`);
    console.log(`    Cedula: ${u.cedula || '(sin cedula)'}`);
    console.log(`    Estado: ${u.activo ? 'ACTIVO' : 'INACTIVO'}`);
    console.log(`    passwordHash (bcrypt 12): ${u.passwordHash || '(vacio)'}`);
    if (u.claveHash) console.log(`    claveHash (portal juridico): ${u.claveHash}`);
    console.log(`    Intentos fallidos: ${u.intentosFallidos}`);
    console.log(`    Bloqueado hasta: ${u.bloqueadoHasta || 'no'}`);
    console.log(`    MFA: ${u.mfaEnabled ? 'ON' : 'OFF'}${u.mfaSecret ? ' (secret: '+u.mfaSecret.substring(0,20)+'...)' : ''}`);
    console.log(`    mustChangePassword: ${u.mustChangePassword}`);
    console.log(`    sessionToken: ${u.sessionToken ? u.sessionToken.substring(0,40)+'...' : '(vacio)'}`);
    if (u.tokenSesion) console.log(`    tokenSesion (portal): ${u.tokenSesion.substring(0,40)}... (expira: ${u.tokenExpira})`);
    console.log(`    Ultimo acceso: ${u.ultimoAcceso || 'nunca'}`);
    console.log(`    Creado: ${u.createdAt} | Actualizado: ${u.updatedAt}`);
    console.log('');
  });

  // 2. Clientes
  console.log('=== 2. CLIENTES (tabla Cliente) ===');
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true, cedula: true, nombre: true, email: true, telefono: true,
      activo: true,
      pinHash: true, pinIntentos: true, pinBloqueadoHasta: true,
      claveHash: true, claveIntentos: true, claveBloqueadoHasta: true,
      claveResetToken: true, claveResetExpira: true,
      tokenSesion: true,
      bancoCliente: true, tipoCuentaCliente: true, numeroCuentaCliente: true,
      ultimoAccesoPortal: true, updatedAt: true
    },
    orderBy: { cedula: 'asc' }
  });
  console.log(`Total: ${clientes.length} clientes\n`);
  clientes.forEach((c, i) => {
    console.log(`[${i+1}] CC ${c.cedula} — ${c.nombre}`);
    console.log(`    Email: ${c.email || '(sin email)'}`);
    console.log(`    Tel: ${c.telefono || '(sin tel)'}`);
    console.log(`    Estado: ${c.activo ? 'ACTIVO' : 'INACTIVO'}`);
    console.log(`    pinHash: ${c.pinHash || '(vacio - PIN numerico)'}`);
    console.log(`    pinIntentos: ${c.pinIntentos} | Bloqueado hasta: ${c.pinBloqueadoHasta || 'no'}`);
    console.log(`    claveHash (portal alfanumerica): ${c.claveHash || '(vacio - usa cedula)'}`);
    console.log(`    claveIntentos: ${c.claveIntentos} | Bloqueado hasta: ${c.claveBloqueadoHasta || 'no'}`);
    if (c.claveResetToken) console.log(`    claveResetToken: ${c.claveResetToken.substring(0,30)}... (expira: ${c.claveResetExpira})`);
    console.log(`    tokenSesion: ${c.tokenSesion ? c.tokenSesion.substring(0,40)+'...' : '(vacio)'}`);
    console.log(`    Banco: ${c.bancoCliente || 'N/A'} | ${c.tipoCuentaCliente || ''} ${c.numeroCuentaCliente || ''}`);
    console.log(`    Ultimo acceso portal: ${c.ultimoAccesoPortal || 'nunca'}`);
    console.log(`    Actualizado: ${c.updatedAt}`);
    console.log('');
  });

  // 3. PlataformaSync (tokens cifrados)
  console.log('=== 3. PLATAFORMA SYNC (tokens cifrados) ===');
  const plataformas = await prisma.plataformaSync.findMany();
  console.log(`Total: ${plataformas.length} plataformas\n`);
  plataformas.forEach((p, i) => {
    console.log(`[${i+1}] ${p.plataforma} (${p.nombreMostrar})`);
    console.log(`    Descripcion: ${p.descripcion || ''}`);
    console.log(`    sincronizado: ${p.sincronizado} | tiempoReal: ${p.tiempoReal}`);
    console.log(`    endpoint: ${p.endpoint || '(no set)'}`);
    console.log(`    proyectoRef: ${p.proyectoRef || '(no set)'}`);
    console.log(`    region: ${p.region || '(no set)'}`);
    console.log(`    ramaPrincipal: ${p.ramaPrincipal}`);
    console.log(`    tokenCifrado (${p.tokenCifrado?.length || 0} chars): ${p.tokenCifrado ? p.tokenCifrado.substring(0,80)+'...' : '(VACIO - sin token)'}`);
    console.log(`    webhookSecret: ${p.webhookSecret || '(vacio)'}`);
    console.log(`    webhookUrl: ${p.webhookUrl || '(vacio)'}`);
    console.log(`    ultimoSync: ${p.ultimoSync || 'nunca'}`);
    console.log(`    ultimoEstado: ${p.ultimoEstado || 'n/a'}`);
    console.log(`    ultimoError: ${p.ultimoError || 'sin errores'}`);
    console.log(`    eventosRecibidos: ${p.eventosRecibidos}`);
    console.log(`    configJson: ${p.configJson ? p.configJson.substring(0,200) : '(vacio)'}`);
    console.log(`    updatedAt: ${p.updatedAt}`);
    console.log('');
  });

  // 4. ConexionAPI
  console.log('=== 4. CONEXIONES API (tabla ConexionAPI) ===');
  const conns = await prisma.conexionAPI.findMany();
  console.log(`Total: ${conns.length} conexiones\n`);
  if (conns.length === 0) console.log('(no hay conexiones API registradas)\n');
  conns.forEach((c, i) => {
    console.log(`[${i+1}] tipo: ${c.tipo} | nombre: ${c.nombre}`);
    console.log(`    descripcion: ${c.descripcion || ''}`);
    console.log(`    url: ${c.url || '(no set)'}`);
    console.log(`    apiKey: ${c.apiKey || '(vacio)'}`);
    console.log(`    apiSecret: ${c.apiSecret ? c.apiSecret.substring(0,15)+'...[MASKED]' : '(vacio)'}`);
    console.log(`    usuario: ${c.usuario || '(vacio)'}`);
    console.log(`    password: ${c.password ? c.password.substring(0,15)+'...[MASKED]' : '(vacio)'}`);
    console.log(`    accountId: ${c.accountId || '(vacio)'}`);
    console.log(`    telefonoOrigen: ${c.telefonoOrigen || '(vacio)'}`);
    console.log(`    configuracionExtra: ${c.configuracionExtra ? c.configuracionExtra.substring(0,200) : '(vacio)'}`);
    console.log(`    activa: ${c.activa ? 'SI' : 'NO'} | probada: ${c.probada ? 'SI' : 'NO'}`);
    console.log(`    fechaUltimaPrueba: ${c.fechaUltimaPrueba || 'nunca'}`);
    console.log(`    resultadoUltimaPrueba: ${c.resultadoUltimaPrueba || 'n/a'}`);
    console.log(`    updatedAt: ${c.updatedAt}`);
    console.log('');
  });

  // 5. Variables globales
  console.log('=== 5. VARIABLES GLOBALES (tabla VariableGlobal) ===');
  try {
    const vars = await prisma.variableGlobal.findMany();
    console.log(`Total: ${vars.length} variables\n`);
    if (vars.length === 0) console.log('(no hay variables globales)\n');
    vars.forEach((v, i) => {
      const valStr = typeof v.valor === 'string' ? v.valor : JSON.stringify(v.valor);
      console.log(`[${i+1}] ${v.clave} = ${valStr.substring(0, 200)}`);
      console.log(`    updatedAt: ${v.updatedAt}`);
    });
    console.log('');
  } catch (e) {
    console.log(`(No se pudo leer VariableGlobal: ${e.message})\n`);
  }

  // 6. ConfigBot
  console.log('=== 6. CONFIG BOT (tabla ConfigBot) ===');
  try {
    const bots = await prisma.configBot.findMany();
    console.log(`Total: ${bots.length} bots\n`);
    if (bots.length === 0) console.log('(no hay bots configurados)\n');
    bots.forEach((b, i) => {
      console.log(`[${i+1}] tipo: ${b.tipo} | nombre: ${b.nombre}`);
      console.log(`    activo: ${b.activo ? 'SI' : 'NO'}`);
      console.log(`    config: ${b.config ? JSON.stringify(b.config).substring(0,300) : '(vacio)'}`);
      console.log(`    updatedAt: ${b.updatedAt}`);
      console.log('');
    });
  } catch (e) {
    console.log(`(No se pudo leer ConfigBot: ${e.message})\n`);
  }

  await prisma.$disconnect();
  console.log('\n=== INVENTARIO COMPLETADO ===\n');
})().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
