/**
 * Backup automático de custom.db → /home/z/my-project/backups/
 * - Copia física del archivo .db
 * - Exporta JSON completo de todas las tablas
 * - Mantiene últimos 7 backups (rotación)
 *
 * Uso:
 *   node scripts/backup-automatico.js              # backup manual
 *   cron: 0 3 * * * cd /home/z/my-project && node scripts/backup-automatico.js >> logs/backup.log 2>&1
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const BACKUP_DIR = '/home/z/my-project/backups';
const MAX_BACKUPS = 7;

function ts() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

(async () => {
  console.log(`\n=== BACKUP AUTOMÁTICO ${new Date().toISOString()} ===`);
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`+ Creado directorio: ${BACKUP_DIR}`);
  }

  const stamp = ts();
  const dbPath = '/home/z/my-project/db/custom.db';
  const dbBak = path.join(BACKUP_DIR, `custom-${stamp}.db.bak`);
  const jsonBak = path.join(BACKUP_DIR, `custom-${stamp}.json`);

  // 1) Copia física del .db
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, dbBak);
    const size = fs.statSync(dbBak).size;
    console.log(`✓ DB copiada: ${dbBak} (${(size / 1024).toFixed(1)} KB)`);
  } else {
    console.error(`✗ No existe ${dbPath}`);
    process.exit(1);
  }

  // 2) Export JSON completo
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$') && typeof prisma[k]?.findMany === 'function');
  const dump = { metadata: { fechaGeneracion: new Date().toISOString(), schemaVersion: 'current' }, counts: {}, data: {} };
  for (const m of models) {
    try {
      const rows = await prisma[m].findMany();
      dump.data[m] = rows;
      dump.counts[m] = rows.length;
      console.log(`  ✓ ${m}: ${rows.length} registros`);
    } catch (e) {
      console.log(`  ! ${m}: error ${e.message.split('\n')[0]}`);
      dump.data[m] = [];
      dump.counts[m] = 0;
    }
  }
  fs.writeFileSync(jsonBak, JSON.stringify(dump, null, 2));
  console.log(`✓ JSON exportado: ${jsonBak} (${(fs.statSync(jsonBak).size / 1024).toFixed(1)} KB)`);

  // 3) Rotación: mantener solo últimos MAX_BACKUPS
  const all = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('custom-')).sort().reverse();
  if (all.length > MAX_BACKUPS * 2) { // *2 porque cada backup tiene .db.bak + .json
    const toDelete = all.slice(MAX_BACKUPS * 2);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`  - Rotación eliminó: ${f}`);
    }
  }

  console.log(`\n=== BACKUP COMPLETO ===\n`);
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
