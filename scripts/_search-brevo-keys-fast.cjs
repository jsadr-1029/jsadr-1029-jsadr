/**
 * Búsqueda focalizada: solo en tablas conocidas con campos de texto.
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
  console.log('Buscando en tablas clave...\n');
  const tables = [
    ['AuditLog', ['detalle', 'metadata', 'accion', 'descripcion']],
    ['BitacoraPrestamo', ['descripcion', 'metadata']],
    ['EnvioCorreo', ['metadata', 'cuerpo', 'mensajeError']],
    ['VariableGlobal', ['clave', 'valor']],
    ['Configuracion', ['clave', 'valor']],
    ['NotificacionInterna', ['mensaje', 'metadata']],
    ['ConversacionChat', ['metadata', 'notas']],
    ['MensajeChat', ['contenido', 'metadata']],
  ];
  const patterns = ['xkeysib', 'xsmtpsib', 'mixIF1', 'AuEQHE'];

  for (const [table, cols] of tables) {
    for (const col of cols) {
      for (const pat of patterns) {
        try {
          const rows = await prisma.$queryRawUnsafe(`
            SELECT id::text, LEFT("${col}"::text, 250) as val
            FROM "${table}"
            WHERE "${col}"::text ILIKE $1
            LIMIT 3
          `, '%' + pat + '%');
          if (rows.length > 0) {
            console.log(`✓ ${table}.${col} (patrón "${pat}"): ${rows.length} filas`);
            for (const r of rows) {
              console.log(`  id=${r.id}`);
              console.log(`  valor=${r.val?.substring(0, 250)}`);
              console.log('');
            }
          }
        } catch (e) {}
      }
    }
  }
  console.log('Búsqueda focalizada completada.');
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
