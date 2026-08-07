/**
 * Busca en TODAS las tablas de la BD Neon cualquier registro que contenga
 * las claves de Brevo (parciales "xkeysib-", "xsmtpsib-") o las terminaciones
 * conocidas "mixIF1" (API key) y "AuEQHE" (SMTP key).
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
  console.log('\n=== BÚSQUEDA DE CLAVES BREVO EN BD ===\n');

  // Patrones a buscar
  const patterns = ['xkeysib-', 'xsmtpsib-', 'mixIF1', 'AuEQHE', 'brevo'];

  // Obtener TODAS las tablas del schema public
  const tablas = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log(`Tablas a escanear: ${tablas.length}\n`);

  let found = 0;
  for (const { table_name } of tablas) {
    // Obtener columnas de tipo text/varchar/character
    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table_name}
      AND data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
    `;
    if (cols.length === 0) continue;

    for (const { column_name } of cols) {
      for (const pat of patterns) {
        try {
          // Búsqueda ILIKE
          const rows = await prisma.$queryRawUnsafe(`
            SELECT id::text, LEFT(${column_name}::text, 200) as val
            FROM "${table_name}"
            WHERE "${column_name}"::text ILIKE ${'%' + pat + '%'}
            LIMIT 5
          `);
          if (rows.length > 0) {
            console.log(`✓ ${table_name}.${column_name} (patrón "${pat}"): ${rows.length} coincidencias`);
            for (const r of rows) {
              console.log(`    id=${r.id}  valor=${r.val?.substring(0, 150)}`);
            }
            found++;
          }
        } catch (e) {
          // ignorar errores de tipo (algunas columnas json)
        }
      }
    }
  }
  console.log(`\nTotal coincidencias: ${found}`);
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
