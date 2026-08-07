// _search-tokens-deep.cjs
// Busca tokens en tablas especificas: AuditLog, VariableGlobal, ConfigBot,
// Configuracion, VersionConfiguracion, AuditoriaConfiguracion.

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL + '&connect_timeout=60&pool_timeout=60' } },
});

(async () => {
  // 1. AuditLog completo (sin filtros del ORM, usando raw query)
  console.log('=== AuditLog (buscando token-related) ===');
  const audits = await prisma.$queryRaw`
    SELECT "createdAt", accion, modulo, detalles, "usuarioId"
    FROM "AuditLog"
    WHERE detalles::text ILIKE '%token%'
       OR detalles::text ILIKE '%ghp_%'
       OR detalles::text ILIKE '%vcp_%'
       OR detalles::text ILIKE '%github_pat_%'
       OR accion ILIKE '%token%'
       OR accion ILIKE '%plataforma%'
       OR modulo ILIKE '%plataforma%'
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;
  console.log(`Encontrados: ${audits.length}`);
  for (const a of audits) {
    const ts = a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt);
    console.log(`\n>>> ${ts} | ${a.accion} | ${a.modulo || ''}`);
    const d = typeof a.detalles === 'object' ? JSON.stringify(a.detalles) : String(a.detalles || '');
    console.log(`    ${d.substring(0, 400)}`);
  }

  // 2. VariableGlobal completa
  console.log('\n\n=== VariableGlobal (todas) ===');
  const vars = await prisma.$queryRaw`
    SELECT * FROM "VariableGlobal"
    ORDER BY nombre
  `;
  console.log(`Total: ${vars.length}`);
  for (const v of vars) {
    const valorStr = typeof v.valor === 'object' ? JSON.stringify(v.valor) : String(v.valor || '');
    const nombreLower = (v.nombre || '').toLowerCase();
    if (
      nombreLower.includes('token') ||
      nombreLower.includes('vercel') ||
      nombreLower.includes('github') ||
      nombreLower.includes('neon') ||
      nombreLower.includes('pat') ||
      nombreLower.includes('api') ||
      nombreLower.includes('secret') ||
      valorStr.toLowerCase().includes('ghp_') ||
      valorStr.toLowerCase().includes('vcp_') ||
      valorStr.toLowerCase().includes('github_pat_')
    ) {
      console.log(`\n>>> ${v.nombre} (${v.clave || v.categoria || ''})`);
      console.log(`    valor: ${valorStr.substring(0, 400)}`);
    } else {
      console.log(`  - ${v.nombre}`);
    }
  }

  // 3. ConfigBot completa
  console.log('\n\n=== ConfigBot (todas) ===');
  try {
    const bots = await prisma.$queryRaw`SELECT * FROM "ConfigBot"`;
    console.log(`Total: ${bots.length}`);
    for (const b of bots) {
      const valor = typeof b.valor === 'object' ? JSON.stringify(b.valor) : String(b.valor || '');
      if (
        valor.toLowerCase().includes('token') ||
        valor.toLowerCase().includes('ghp_') ||
        valor.toLowerCase().includes('vcp_') ||
        valor.toLowerCase().includes('api_key') ||
        valor.toLowerCase().includes('apikey')
      ) {
        console.log(`\n>>> ${b.clave || b.id || ''}`);
        console.log(`    ${valor.substring(0, 400)}`);
      } else {
        console.log(`  - ${b.clave || b.id}: ${valor.substring(0, 80)}`);
      }
    }
  } catch (e) {
    console.log('ConfigBot error:', e.message.substring(0, 100));
  }

  // 4. Configuracion (todas)
  console.log('\n\n=== Configuracion ===');
  try {
    const confs = await prisma.$queryRaw`SELECT * FROM "Configuracion" LIMIT 50`;
    console.log(`Total: ${confs.length}`);
    for (const c of confs) {
      const valor = typeof c.valor === 'object' ? JSON.stringify(c.valor) : String(c.valor || '');
      if (valor.toLowerCase().includes('token') || valor.toLowerCase().includes('ghp_') || valor.toLowerCase().includes('vcp_')) {
        console.log(`>>> ${c.clave || c.id}: ${valor.substring(0, 400)}`);
      }
    }
  } catch (e) {
    console.log('Configuracion error:', e.message.substring(0, 100));
  }

  // 5. VersionConfiguracion - snapshots historicos
  console.log('\n\n=== VersionConfiguracion (snapshots historicos) ===');
  try {
    const versions = await prisma.$queryRaw`
      SELECT id, descripcion, "createdAt", "configJson"
      FROM "VersionConfiguracion"
      WHERE "configJson"::text ILIKE '%token%'
         OR "configJson"::text ILIKE '%ghp_%'
         OR "configJson"::text ILIKE '%vcp_%'
         OR "configJson"::text ILIKE '%github_pat_%'
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;
    console.log(`Encontrados: ${versions.length}`);
    for (const v of versions) {
      const ts = v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt);
      console.log(`\n>>> ${ts} | ${v.descripcion || ''} | ${v.id}`);
      const cj = typeof v.configJson === 'object' ? JSON.stringify(v.configJson) : String(v.configJson || '');
      console.log(`    ${cj.substring(0, 800)}`);
    }
  } catch (e) {
    console.log('VersionConfiguracion error:', e.message.substring(0, 100));
  }

  // 6. AuditoriaConfiguracion - cambios historicos
  console.log('\n\n=== AuditoriaConfiguracion (cambios historicos) ===');
  try {
    const auditConf = await prisma.$queryRaw`
      SELECT id, modulo, campo, "valorAnterior", "valorNuevo", "createdAt"
      FROM "AuditoriaConfiguracion"
      WHERE "valorAnterior"::text ILIKE '%token%'
         OR "valorNuevo"::text ILIKE '%token%'
         OR "valorAnterior"::text ILIKE '%ghp_%'
         OR "valorNuevo"::text ILIKE '%ghp_%'
         OR "valorAnterior"::text ILIKE '%vcp_%'
         OR "valorNuevo"::text ILIKE '%vcp_%'
         OR "valorAnterior"::text ILIKE '%github_pat_%'
         OR "valorNuevo"::text ILIKE '%github_pat_%'
         OR modulo ILIKE '%plataforma%'
         OR modulo ILIKE '%token%'
         OR campo ILIKE '%token%'
      ORDER BY "createdAt" DESC
      LIMIT 30
    `;
    console.log(`Encontrados: ${auditConf.length}`);
    for (const a of auditConf) {
      const ts = a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt);
      const va = typeof a.valorAnterior === 'object' ? JSON.stringify(a.valorAnterior) : String(a.valorAnterior || '');
      const vn = typeof a.valorNuevo === 'object' ? JSON.stringify(a.valorNuevo) : String(a.valorNuevo || '');
      console.log(`\n>>> ${ts} | ${a.modulo} | ${a.campo}`);
      console.log(`    anterior: ${va.substring(0, 200)}`);
      console.log(`    nuevo:    ${vn.substring(0, 200)}`);
    }
  } catch (e) {
    console.log('AuditoriaConfiguracion error:', e.message.substring(0, 100));
  }

  // 7. Vercel env vars — intentar leerlas desde la API (con token vacio no funcionara,
  // pero puede haber tokens guardados en BD que si funcionen)
  console.log('\n\n=== Tokens en PlataformaSync — info detallada ===');
  const plat = await prisma.plataformaSync.findMany();
  for (const p of plat) {
    console.log(`\n>>> ${p.plataforma}`);
    console.log(`    tokenCifrado (primeros 50): ${p.tokenCifrado?.substring(0, 50)}`);
    console.log(`    webhookSecret: ${p.webhookSecret || '(null)'}`);
    console.log(`    configJson: ${p.configJson || '(null)'}`);
    console.log(`    ultimoSync: ${p.ultimoSync}`);
    console.log(`    ultimoEstado: ${p.ultimoEstado}`);
    console.log(`    ultimoError: ${p.ultimoError}`);
    console.log(`    eventosRecibidos: ${p.eventosRecibidos}`);
    console.log(`    updatedAt: ${p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt}`);
  }

  await prisma.$disconnect();
})().catch(e => {
  console.error('ERR:', e.message);
  process.exit(1);
});
