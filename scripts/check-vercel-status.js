const { PrismaClient } = require('@prisma/client');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  console.log('=== ESTADO PLATAFORMAS VINCULADAS (desde BD local) ===\n');

  // 1. PlataformaSync
  const plataformas = await prisma.plataformaSync.findMany({ orderBy: { plataforma: 'asc' } });
  console.log('▶ PlataformaSync:');
  plataformas.forEach(p => {
    console.log(`   • plataforma=${p.plataforma} | nombreMostrar=${p.nombreMostrar}`);
    console.log(`     sincronizado=${p.sincronizado} | tiempoReal=${p.tiempoReal}`);
    console.log(`     endpoint=${p.endpoint || '-'}`);
    console.log(`     proyectoRef=${p.proyectoRef || '-'}`);
    console.log(`     region=${p.region || '-'} | ramaPrincipal=${p.ramaPrincipal || '-'}`);
    console.log(`     webhookUrl=${p.webhookUrl || '-'}`);
    console.log(`     ultimoSync=${p.ultimoSync ? p.ultimoSync.toISOString() : '-'}`);
    console.log(`     ultimoEstado=${p.ultimoEstado || '-'} | ultimoError=${p.ultimoError || '-'}`);
    console.log(`     eventosRecibidos=${p.eventosRecibidos}`);
    console.log(`     tokenCifrado=${p.tokenCifrado ? '[CIFRADO:' + p.tokenCifrado.length + ' chars]' : 'NULL'}`);
    console.log(`     webhookSecret=${p.webhookSecret ? '[SET:' + p.webhookSecret.length + ' chars]' : 'NULL'}`);
    if (p.configJson) console.log(`     configJson=${p.configJson.slice(0, 250)}`);
    console.log('');
  });

  // 2. Variables globales relacionadas a plataformas
  const vars = await prisma.variableGlobal.findMany({ orderBy: { clave: 'asc' } });
  const platVars = vars.filter(v => /vercel|neon|github|brevo|smtp/i.test(v.clave));
  console.log('▶ Variables relacionadas a plataformas:');
  platVars.forEach(v => {
    const val = String(v.valor || '');
    const masked = /key|token|secret|password|api/i.test(v.clave) && val.length > 20
      ? val.slice(0, 8) + '...' + val.slice(-8)
      : val;
    console.log(`   • ${v.clave} = ${masked}`);
  });

  // 3. ConexionAPI
  const conexiones = await prisma.conexionAPI.findMany();
  console.log('\n▶ ConexionAPI (SMTP/Email):');
  conexiones.forEach(c => {
    const pass = String(c.password || '');
    console.log(`   • tipo=${c.tipo} | nombre=${c.nombre}`);
    console.log(`     host=${c.host} | port=${c.puerto} | user=${c.usuario}`);
    console.log(`     pass=${pass.slice(0,8)}...${pass.slice(-6)} (${pass.length} chars)`);
    console.log(`     desdeEmail=${c.desdeEmail || '-'} | desdeNombre=${c.desdeNombre || '-'}`);
    console.log(`     activo=${c.activo} | cifrado=${c.cifrado || false}`);
  });

  // 4. CorreoInstitucional
  const correos = await prisma.correoInstitucional.findMany();
  console.log('\n▶ CorreoInstitucional:');
  correos.forEach(c => {
    console.log(`   • ${c.email} | esPrincipal=${c.esPrincipal} | verificado=${c.verificado}`);
  });

  // 5. Auditoría reciente
  const audit = await prisma.auditoriaConfiguracion.findMany({
    orderBy: { createdAt: 'desc' }, take: 5
  });
  console.log('\n▶ Últimos 5 AuditoríaConfiguracion:');
  audit.forEach(a => {
    console.log(`   • ${a.createdAt.toISOString().slice(0,19)} | ${a.seccion}.${a.campo} | user=${a.usuarioNombre || '-'} | motivo=${a.motivo || '-'}`);
  });

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
