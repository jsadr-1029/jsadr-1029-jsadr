import pkg from 'pg';
const { Client } = pkg;

// The Neon database was WIPED by `prisma migrate reset --force`
// We need to restore from the local SQLite backup

// First check what's in the SQLite backup
import fs from 'fs';
import { Database } from 'sqlite3';

const sqlitePath = '/home/z/my-project/db/custom.db';
if (!fs.existsSync(sqlitePath)) {
  console.log('❌ SQLite file not found:', sqlitePath);
  console.log('Checking for backup...');
  const backups = fs.readdirSync('/home/z/my-project/db/').filter(f => f.endsWith('.db'));
  console.log('Available db files:', backups);
  process.exit(1);
}

console.log('✅ Found SQLite database:', sqlitePath);
console.log('Size:', fs.statSync(sqlitePath).size, 'bytes');

// Connect to SQLite
const sqliteDb = new Database(sqlitePath, sqlite3.OPEN_READONLY);

// Count tables
sqliteDb.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) { console.error('SQLite error:', err); process.exit(1); }
  console.log('\nSQLite tables:', tables.length);
  
  // Check key tables
  const keyTables = ['Prestamo', 'Cliente', 'Pago', 'Usuario', 'CajaMenor', 'CategoriaCliente', 'CuentaRecaudo'];
  let checked = 0;
  
  keyTables.forEach(tableName => {
    sqliteDb.get(`SELECT COUNT(*) as c FROM "${tableName}"`, (err, row) => {
      checked++;
      if (err) {
        console.log(`  ${tableName}: ❌ ${err.message.substring(0, 50)}`);
      } else {
        console.log(`  ${tableName}: ${row.c} rows`);
      }
      
      if (checked === keyTables.length) {
        sqliteDb.close();
        console.log('\n✅ SQLite has data. Need to restore to Neon.');
      }
    });
  });
});
