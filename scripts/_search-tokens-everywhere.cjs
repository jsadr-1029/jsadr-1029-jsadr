// _search-tokens-everywhere.cjs
// Busca los tokens en TODAS las tablas de la BD Neon por si estan guardados en
// algun otro lugar (conexionAPI, auditLog, configuracion global, etc.)

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
  // 1. ConexionAPI — puede tener tokens guardados ahi
  console.log('=== ConexionAPI ===');
  const conexiones = await prisma.conexionAPI.findMany();
  for (const c of conexiones) {
    console.log(`\nTipo: ${c.tipo} | activa: ${c.activa}`);
    console.log(`  endpoint: ${c.endpoint || '(null)'}`);
    console.log(`  apiKey: ${c.apiKey ? `[${c.apiKey.length} chars]` : '(null)'}`);
    console.log(`  apiKeyPrefijo: ${c.apiKey?.substring(0, 30) || ''}`);
    console.log(`  password: ${c.password ? `[${c.password.length} chars]` : '(null)'}`);
    console.log(`  token: ${c.token ? `[${c.token.length} chars]` : '(null)'}`);
    console.log(`  username: ${c.username || '(null)'}`);
    if (c.configJson) {
      console.log(`  configJson: ${c.configJson.substring(0, 200)}`);
    }
  }

  // 2. VariableGlobal — buscar tokens guardados ahi
  console.log('\n\n=== VariableGlobal ===');
  try {
    const vars = await prisma.variableGlobal.findMany();
    console.log(`Total variables: ${vars.length}`);
    for (const v of vars) {
      const valorStr = typeof v.valor === 'string' ? v.valor : JSON.stringify(v.valor);
      const nombreLower = (v.nombre || '').toLowerCase();
      const valorLower = valorStr.toLowerCase();
      if (
        nombreLower.includes('token') ||
        nombreLower.includes('vercel') ||
        nombreLower.includes('github') ||
        nombreLower.includes('neon') ||
        nombreLower.includes('pat') ||
        nombreLower.includes('apikey') ||
        nombreLower.includes('api_key') ||
        valorLower.includes('ghp_') ||
        valorLower.includes('github_pat_') ||
        valorLower.includes('vcp_') ||
        valorLower.startsWith('"ghp_') ||
        valorStr.length === 64 // posible hex token neon
      ) {
        console.log(`\n>>> ${v.nombre} (${v.clave || v.categoria || ''})`);
        console.log(`    valor: ${valorStr.substring(0, 200)}`);
      }
    }
  } catch (e) {
    console.log('VariableGlobal no accesible:', e.message.substring(0, 100));
  }

  // 3. AuditLog — buscar entradas que mencionen tokens
  console.log('\n\n=== AuditLog ===');
  try {
    // Buscar entradas con menciones a token/vercel/github/neon
    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { accion: { contains: 'token', mode: 'insensitive' } },
          { accion: { contains: 'vercel', mode: 'insensitive' } },
          { accion: { contains: 'github', mode: 'insensitive' } },
          { accion: { contains: 'neon', mode: 'insensitive' } },
          { accion: { contains: 'plataforma', mode: 'insensitive' } },
          { modulo: { contains: 'Plataforma', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    console.log(`AuditLogs relacionadas con tokens: ${audits.length}`);
    for (const a of audits) {
      console.log(`\n>>> ${a.createdAt?.toISOString?.()} | ${a.accion} | ${a.modulo || ''}`);
      const detalle = typeof a.detalles === 'string' ? a.detalles : JSON.stringify(a.detalles || {});
      const detLower = detalle.toLowerCase();
      if (
        detLower.includes('ghp_') ||
        detLower.includes('github_pat_') ||
        detLower.includes('vcp_') ||
        detLower.includes('token:') ||
        detLower.includes('"token"')
      ) {
        console.log(`    detalles (con posible token): ${detalle.substring(0, 500)}`);
      } else {
        console.log(`    detalles: ${detalle.substring(0, 200)}`);
      }
    }
  } catch (e) {
    console.log('AuditLog no accesible:', e.message.substring(0, 100));
  }

  // 4. ConfiguracionGlobal — buscar tokens ahi
  console.log('\n\n=== ConfiguracionGlobal ===');
  try {
    const configs = await prisma.configuracionGlobal.findMany();
    console.log(`Total configs: ${configs.length}`);
    for (const c of configs) {
      const cStr = JSON.stringify(c);
      if (
        cStr.includes('ghp_') ||
        cStr.includes('github_pat_') ||
        cStr.includes('vcp_') ||
        cStr.toLowerCase().includes('token')
      ) {
        console.log(`\n>>> ${c.id || ''} | ${c.modulo || ''} | ${c.clave || ''}`);
        console.log(`    ${cStr.substring(0, 500)}`);
      }
    }
  } catch (e) {
    console.log('ConfiguracionGlobal no accesible:', e.message.substring(0, 100));
  }

  // 5. Inspeccionar TODAS las tablas buscando el patron ghp_/github_pat_/vcp_
  console.log('\n\n=== Escaneo completo de tablas ===');
  const tablas = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  console.log(`Total tablas: ${tablas.length}`);
  for (const t of tablas) {
    const tn = t.table_name;
    // Solo tablas que pueden tener tokens
    if (['__prisma_migrations', '_prisma_migrations'].includes(tn)) continue;
    try {
      const cols = await prisma.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='${tn}'
      `);
      const colNames = cols.map(c => c.column_name);
      const tokenCols = colNames.filter(n =>
        /token|apiKey|api_key|password|secret|cred|pat|cipher|cifrado|configjson|detalles|valor/i.test(n)
      );
      if (tokenCols.length === 0) continue;
      console.log(`\nTabla ${tn}: columnas candidatas = ${tokenCols.join(', ')}`);
      // Buscar valores que parezcan tokens
      for (const col of tokenCols) {
        try {
          const rows = await prisma.$queryRawUnsafe(`
            SELECT "${col}" as val FROM "${tn}"
            WHERE "${col}" IS NOT NULL
              AND ("${col}"::text LIKE '%ghp_%'
                   OR "${col}"::text LIKE '%github_pat_%'
                   OR "${col}"::text LIKE '%vcp_%'
                   OR "${col}"::text LIKE '%token%')
            LIMIT 5
          `);
          if (rows.length > 0) {
            console.log(`  Columna ${col}: ${rows.length} filas con posible token`);
            for (const r of rows) {
              const val = typeof r.val === 'object' ? JSON.stringify(r.val) : String(r.val);
              console.log(`    valor: ${val.substring(0, 200)}`);
            }
          }
        } catch (e) {
          // columnas que no son texto, ignorar
        }
      }
    } catch (e) {
      // tabla con esquema raro, ignorar
    }
  }

  await prisma.$disconnect();
})().catch(e => {
  console.error('ERR:', e.message);
  process.exit(1);
});
