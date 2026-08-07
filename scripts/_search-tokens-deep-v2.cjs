// _search-tokens-deep-v2.cjs
// Busca tokens en tablas especificas usando los nombres de columna correctos.

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
  // 1. AuditLog completo - usar fecha en vez de createdAt
  console.log('=== AuditLog (buscando token-related) ===');
  const audits = await prisma.$queryRaw`
    SELECT fecha, accion, modulo, detalles, "usuarioId", "usuarioNombre", "exito", "errorMessage"
    FROM "AuditLog"
    WHERE detalles::text ILIKE '%token%'
       OR detalles::text ILIKE '%ghp_%'
       OR detalles::text ILIKE '%vcp_%'
       OR detalles::text ILIKE '%github_pat_%'
       OR accion ILIKE '%token%'
       OR accion ILIKE '%plataforma%'
       OR modulo ILIKE '%plataforma%'
       OR modulo ILIKE '%Token%'
    ORDER BY fecha DESC
    LIMIT 50
  `;
  console.log(`Encontrados: ${audits.length}`);
  for (const a of audits) {
    const ts = a.fecha instanceof Date ? a.fecha.toISOString() : String(a.fecha);
    console.log(`\n>>> ${ts} | ${a.accion} | ${a.modulo || ''} | exito=${a.exito}`);
    const d = typeof a.detalles === 'object' ? JSON.stringify(a.detalles) : String(a.detalles || '');
    console.log(`    detalles: ${d.substring(0, 500)}`);
    if (a.errorMessage) console.log(`    error: ${a.errorMessage.substring(0, 200)}`);
  }

  // 2. VariableGlobal completa
  console.log('\n\n=== VariableGlobal (todas) ===');
  const vars = await prisma.$queryRaw`
    SELECT clave, valor, categoria, descripcion, "createdAt", "updatedAt"
    FROM "VariableGlobal"
    ORDER BY clave
  `;
  console.log(`Total: ${vars.length}`);
  for (const v of vars) {
    const valorStr = typeof v.valor === 'object' ? JSON.stringify(v.valor) : String(v.valor || '');
    const claveLower = (v.clave || '').toLowerCase();
    const valorLower = valorStr.toLowerCase();
    if (
      claveLower.includes('token') ||
      claveLower.includes('vercel') ||
      claveLower.includes('github') ||
      claveLower.includes('neon') ||
      claveLower.includes('pat') ||
      claveLower.includes('api') ||
      claveLower.includes('secret') ||
      valorLower.includes('ghp_') ||
      valorLower.includes('vcp_') ||
      valorLower.includes('github_pat_')
    ) {
      console.log(`\n>>> ${v.clave} (${v.categoria || ''})`);
      console.log(`    valor: ${valorStr.substring(0, 400)}`);
    } else {
      console.log(`  - ${v.clave} = ${valorStr.substring(0, 80)}`);
    }
  }

  // 3. ConfigBot completa
  console.log('\n\n=== ConfigBot (todas) ===');
  try {
    const bots = await prisma.$queryRaw`SELECT clave, valor, descripcion, "updatedAt" FROM "ConfigBot"`;
    console.log(`Total: ${bots.length}`);
    for (const b of bots) {
      const valor = typeof b.valor === 'object' ? JSON.stringify(b.valor) : String(b.valor || '');
      const valorLower = valor.toLowerCase();
      if (
        valorLower.includes('token') ||
        valorLower.includes('ghp_') ||
        valorLower.includes('vcp_') ||
        valorLower.includes('api_key') ||
        valorLower.includes('apikey')
      ) {
        console.log(`\n>>> ${b.clave}`);
        console.log(`    ${valor.substring(0, 400)}`);
      } else {
        console.log(`  - ${b.clave}: ${valor.substring(0, 80)}`);
      }
    }
  } catch (e) {
    console.log('ConfigBot error:', e.message.substring(0, 100));
  }

  // 4. Configuracion (todas)
  console.log('\n\n=== Configuracion ===');
  try {
    const confs = await prisma.$queryRaw`SELECT clave, valor, descripcion, "updatedAt" FROM "Configuracion" LIMIT 100`;
    console.log(`Total: ${confs.length}`);
    for (const c of confs) {
      const valor = typeof c.valor === 'object' ? JSON.stringify(c.valor) : String(c.valor || '');
      const valorLower = valor.toLowerCase();
      const claveLower = (c.clave || '').toLowerCase();
      if (
        valorLower.includes('token') ||
        valorLower.includes('ghp_') ||
        valorLower.includes('vcp_') ||
        valorLower.includes('github_pat_') ||
        claveLower.includes('token') ||
        claveLower.includes('vercel') ||
        claveLower.includes('github') ||
        claveLower.includes('neon')
      ) {
        console.log(`>>> ${c.clave}: ${valor.substring(0, 400)}`);
      }
    }
  } catch (e) {
    console.log('Configuracion error:', e.message.substring(0, 100));
  }

  // 5. VersionConfiguracion - snapshots historicos
  console.log('\n\n=== VersionConfiguracion (snapshots historicos) ===');
  try {
    const versions = await prisma.$queryRaw`
      SELECT id, numero, seccion, descripcion, "configJson", "createdAt"
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
      console.log(`\n>>> ${ts} | #${v.numero} | ${v.seccion} | ${v.descripcion || ''}`);
      const cj = typeof v.configJson === 'object' ? JSON.stringify(v.configJson) : String(v.configJson || '');
      console.log(`    ${cj.substring(0, 1200)}`);
    }
  } catch (e) {
    console.log('VersionConfiguracion error:', e.message.substring(0, 100));
  }

  // 6. AuditoriaConfiguracion - cambios historicos de tokens
  console.log('\n\n=== AuditoriaConfiguracion (cambios historicos de tokens) ===');
  try {
    const auditConf = await prisma.$queryRaw`
      SELECT id, seccion, campo, "valorAnterior", "valorNuevo", "createdAt", "usuarioId", "usuarioNombre", motivo
      FROM "AuditoriaConfiguracion"
      WHERE "valorAnterior"::text ILIKE '%token%'
         OR "valorNuevo"::text ILIKE '%token%'
         OR "valorAnterior"::text ILIKE '%ghp_%'
         OR "valorNuevo"::text ILIKE '%ghp_%'
         OR "valorAnterior"::text ILIKE '%vcp_%'
         OR "valorNuevo"::text ILIKE '%vcp_%'
         OR "valorAnterior"::text ILIKE '%github_pat_%'
         OR "valorNuevo"::text ILIKE '%github_pat_%'
         OR seccion ILIKE '%plataforma%'
         OR seccion ILIKE '%token%'
         OR campo ILIKE '%token%'
         OR campo ILIKE '%plataforma%'
      ORDER BY "createdAt" DESC
      LIMIT 30
    `;
    console.log(`Encontrados: ${auditConf.length}`);
    for (const a of auditConf) {
      const ts = a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt);
      const va = typeof a.valorAnterior === 'object' ? JSON.stringify(a.valorAnterior) : String(a.valorAnterior || '');
      const vn = typeof a.valorNuevo === 'object' ? JSON.stringify(a.valorNuevo) : String(a.valorNuevo || '');
      console.log(`\n>>> ${ts} | ${a.seccion} | ${a.campo} | usuario: ${a.usuarioNombre || a.usuarioId || ''}`);
      console.log(`    anterior: ${va.substring(0, 300)}`);
      console.log(`    nuevo:    ${vn.substring(0, 300)}`);
    }
  } catch (e) {
    console.log('AuditoriaConfiguracion error:', e.message.substring(0, 100));
  }

  // 7. Tokens en PlataformaSync — info detallada
  console.log('\n\n=== PlataformaSync — info detallada ===');
  const plat = await prisma.plataformaSync.findMany();
  for (const p of plat) {
    console.log(`\n>>> ${p.plataforma}`);
    console.log(`    tokenCifrado (primeros 50): ${p.tokenCifrado?.substring(0, 50)}`);
    console.log(`    tokenCifrado (longitud total): ${p.tokenCifrado?.length}`);
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
