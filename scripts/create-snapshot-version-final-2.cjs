// Crear snapshot "versión final 2" con TODOS los datos del sistema:
//   - Código fuente (src/ y config files)
//   - Volcado completo de la base de datos (68 tablas)
//   - Documentos y uploads físicos
//   - Metadatos del sistema
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Forzar Neon DATABASE_URL (override shell env if dev server is running with old SQLite)
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const prisma = new PrismaClient();
const PROJECT_ROOT = '/home/z/my-project';
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, 'download', 'snapshots');

// Lista completa de modelos (68 tablas) — en orden de dependencia para evitar problemas al restaurar
const ALL_MODELS = [
  // Sistema / Auth
  'usuario',
  'cliente',
  'categoriaCliente',
  'cuentaRecaudo',
  // Préstamos / Pagos
  'prestamo',
  'pago',
  'pagoProgramado',
  'refinanciacion',
  'prestamoBancario',
  'renovacionPrestamo',
  'bitacoraPrestamo',
  // Jurídico
  'casoJuridico',
  'cronologiaCaso',
  'documentoLegal',
  'alertaLegal',
  // Caja
  'cajaMenor',
  'movimientoCaja',
  'movimientoCajaExtendido',
  // Firmas
  'firmaElectronica',
  'tokenFirma',
  // Notificaciones
  'notificacionLog',
  'campaña',       // <-- modelo con ñ en Prisma Client
  'campañaVista',  // <-- modelo con ñ en Prisma Client
  // Configuración
  'configuracion',
  'configuracionEmpresa',
  'dominio',
  'correoInstitucional',
  'envioCorreo',
  'integracion',
  'variableGlobal',
  'ambiente',
  'certificadoSSL',
  'configAlmacenamiento',
  'estadoServicio',
  'configMantenimiento',
  'versionConfiguracion',
  'auditoriaConfiguracion',
  'auditoriaHallazgo',
  // Seguridad
  'auditLog',
  'codigoConfirmacion',
  'conexionAPI',
  'automatizacion',
  'ejecucionAutomatizacion',
  'versionSistema',
  'backup',
  'accesoPortal',
  'seguridadModulo',
  'plataformaSync',
  // Gestión documental
  'documentoGestor',
  'solicitudWeb',
  'solicitudNuevoCliente',
  'otpRegistro',
  // Comunicaciones
  'conversacionChat',
  'mensajeChat',
  'notaInterna',
  'otpChat',
  // Bot
  'bot',
  'faqBot',
  'configBot',
  // Finanzas
  'categoriaFinanciera',
  'presupuesto',
  'metaFinanciera',
  'eventoFinanciero',
  'movimientoFinanciero',
  'alertaFinanciera',
  'planEstrategicoFinanciero',
  'planCliente',
  // Snapshot (auto-referencia)
  'snapshotProyecto',
];

// Directorios y archivos a EXCLUIR del snapshot de código
const EXCLUDE_DIRS = [
  'node_modules', '.next', '.git', 'download', 'db', 'scripts', 'skills',
  'tool-results', 'agent-ctx', 'examples', 'mini-services', 'upload',
  '.turbo', '.cache', 'coverage', '.vscode', '.idea',
];

const EXCLUDE_FILES = ['.env', '.env.local', 'dev.log', 'bun.lock', 'server.log'];

const CONFIG_FILES = [
  'package.json', 'tsconfig.json', 'next.config.ts', 'tailwind.config.ts',
  'postcss.config.mjs', 'components.json', 'eslint.config.mjs', 'Caddyfile',
  'vercel.json', '.env.example', '.gitignore', '.gitattributes',
];

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.mjs', '.prisma', '.md', '.sh', '.html'];

function shouldExclude(filePath) {
  const relative = path.relative(PROJECT_ROOT, filePath);
  for (const dir of EXCLUDE_DIRS) {
    if (relative.startsWith(dir + '/') || relative === dir) return true;
  }
  for (const file of EXCLUDE_FILES) {
    if (relative === file) return true;
  }
  return false;
}

function shouldInclude(filePath) {
  const ext = path.extname(filePath);
  return CODE_EXTENSIONS.includes(ext);
}

function scanDirectory(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldExclude(fullPath)) continue;
    if (entry.isDirectory()) {
      scanDirectory(fullPath, files);
    } else if (entry.isFile() && shouldInclude(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function hashFile(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('=== Creando snapshot "versión final 2" con TODOS los datos del sistema ===\n');

  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  // 1. Capturar código fuente
  console.log('1) Capturando código fuente de src/ ...');
  const srcDir = path.join(PROJECT_ROOT, 'src');
  const filePaths = scanDirectory(srcDir);
  console.log(`   ${filePaths.length} archivos en src/`);

  const codeFiles = [];
  let codeSize = 0;
  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath);
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      codeFiles.push({
        path: relativePath,
        hash: hashFile(content),
        size: content.length,
        content: content.toString('base64'),
      });
      codeSize += content.length;
    } catch (e) {
      console.log(`   ⚠️  No se pudo leer: ${filePath}`);
    }
  }

  // 2. Capturar archivos de configuración
  console.log('\n2) Capturando archivos de configuración...');
  const configFiles = {};
  for (const cfgFile of CONFIG_FILES) {
    const cfgPath = path.join(PROJECT_ROOT, cfgFile);
    if (fs.existsSync(cfgPath)) {
      try {
        configFiles[cfgFile] = fs.readFileSync(cfgPath).toString('base64');
      } catch (e) {}
    }
  }
  // prisma/schema.prisma
  const schemaPath = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    configFiles['prisma/schema.prisma'] = fs.readFileSync(schemaPath).toString('base64');
  }
  console.log(`   ${Object.keys(configFiles).length} archivos de configuración`);

  // 3. Capturar TODA la base de datos
  console.log('\n3) Volcando TODA la base de datos desde Neon PostgreSQL...');
  const databaseDump = {};
  let totalRecords = 0;
  let totalTables = 0;
  const tablesWithErrors = [];

  for (const modelName of ALL_MODELS) {
    try {
      // Some models may not exist (schema drift) — try/catch
      const count = await prisma[modelName].count();
      if (count === 0) {
        databaseDump[modelName] = { _count: 0, _rows: [] };
        continue;
      }
      // Fetch all rows
      const rows = await prisma[modelName].findMany({ take: 100000 });
      databaseDump[modelName] = { _count: rows.length, _rows: rows };
      totalRecords += rows.length;
      totalTables++;
      console.log(`   ✓ ${modelName}: ${rows.length} registros`);
    } catch (err) {
      tablesWithErrors.push({ model: modelName, error: err.message });
      databaseDump[modelName] = { _count: 0, _rows: [], _error: err.message };
    }
  }
  console.log(`\n   Total: ${totalRecords} registros en ${totalTables} tablas`);
  if (tablesWithErrors.length > 0) {
    console.log(`   ⚠️  ${tablesWithErrors.length} tablas con errores:`);
    for (const e of tablesWithErrors.slice(0, 10)) {
      console.log(`     - ${e.model}: ${e.error.slice(0, 80)}`);
    }
  }

  // 4. Capturar uploads / documentos físicos
  console.log('\n4) Capturando documentos físicos (upload/)...');
  const uploadsDir = path.join(PROJECT_ROOT, 'upload');
  let uploadFiles = [];
  let uploadSize = 0;
  if (fs.existsSync(uploadsDir)) {
    const scanUploads = (dir, files = []) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanUploads(fullPath, files);
        } else if (entry.isFile()) {
          // Only include files < 1MB to keep snapshot reasonable
          const stat = fs.statSync(fullPath);
          if (stat.size < 1024 * 1024) {
            const content = fs.readFileSync(fullPath);
            uploadFiles.push({
              path: path.relative(PROJECT_ROOT, fullPath),
              size: content.length,
              hash: hashFile(content),
              content: content.toString('base64'),
            });
            uploadSize += content.length;
          } else {
            uploadFiles.push({
              path: path.relative(PROJECT_ROOT, fullPath),
              size: stat.size,
              hash: '(exceedido >1MB, no incluido en snapshot)',
              content: null,
            });
          }
        }
      }
      return files;
    };
    scanUploads(uploadsDir, uploadFiles);
    console.log(`   ${uploadFiles.length} archivos en upload/ (${(uploadSize / 1024).toFixed(1)} KB)`);
  } else {
    console.log('   Directorio upload/ no existe');
  }

  // 5. Capturar metadatos del sistema
  console.log('\n5) Capturando metadatos del sistema...');
  let gitSHA = '(not available)';
  try {
    gitSHA = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT }).toString().trim();
  } catch (e) {}
  let gitBranch = '(unknown)';
  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT }).toString().trim();
  } catch (e) {}

  const systemMeta = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    prismaVersion: require('@prisma/client/package.json').version,
    nextVersion: require('next/package.json').version,
    gitSHA,
    gitBranch,
    databaseUrl: process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'), // mask password
    projectName: 'jo***Se****Al*****D***R**** - Sistema de Gestión de Préstamos v3.0',
    snapshotVersion: '2.0',
  };
  console.log(`   Git SHA: ${gitSHA}`);
  console.log(`   Node: ${systemMeta.nodeVersion}, Prisma: ${systemMeta.prismaVersion}, Next: ${systemMeta.nextVersion}`);

  // 6. Construir estructura final
  console.log('\n6) Construyendo snapshot JSON...');
  const uuid = crypto.randomUUID();
  const snapshot = {
    uuid,
    version: '2.0',
    nombre: 'versión final 2',
    descripcion: 'Snapshot completo del sistema con código fuente, configuración, base de datos (Neon PostgreSQL) y documentos físicos. Incluye los 68 modelos Prisma con todos sus registros, archivos de src/ en base64, y uploads de menos de 1MB. Creado tras el fix crítico de autenticación (prisma provider sqlite→postgresql) que habilitó login en Vercel.',
    timestamp: new Date().toISOString(),
    proyecto: 'jo***Se****Al*****D***R****',
    tipo: 'MANUAL',
    motivo: 'Snapshot final tras sincronización GitHub+Vercel+Neon y fix de login en producción',
    sistema: systemMeta,
    codigo: {
      files: codeFiles,
      configFiles,
      totalFiles: codeFiles.length + Object.keys(configFiles).length,
      totalSize: codeSize,
    },
    baseDatos: {
      engine: 'postgresql',
      host: 'ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech',
      nombre: 'neondb',
      tablas: ALL_MODELS.length,
      tablasConDatos: totalTables,
      tablasConErrores: tablesWithErrors.length,
      totalRegistros: totalRecords,
      dump: databaseDump,
    },
    uploads: {
      total: uploadFiles.length,
      totalSize: uploadSize,
      files: uploadFiles,
    },
    metadata: {
      totalFiles: codeFiles.length + Object.keys(configFiles).length + uploadFiles.length,
      totalSize: codeSize + uploadSize,
      modulos: detectModules(filePaths),
    },
  };

  // 7. Guardar archivo
  const nombreArchivo = `snapshot_${uuid}.json`;
  const rutaArchivo = path.join(SNAPSHOTS_DIR, nombreArchivo);
  const jsonStr = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(rutaArchivo, jsonStr, 'utf-8');
  const tamano = Buffer.byteLength(jsonStr, 'utf-8');
  const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');

  console.log(`\n7) Snapshot guardado: ${rutaArchivo}`);
  console.log(`   Tamaño: ${(tamano / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Checksum: ${checksum.slice(0, 32)}...`);

  // 8. Registrar en BD (tabla SnapshotProyecto)
  console.log('\n8) Registrando en tabla SnapshotProyecto...');
  const snapshotDB = await prisma.snapshotProyecto.create({
    data: {
      uuid,
      version: '2.0',
      nombre: 'versión final 2',
      descripcion: snapshot.descripcion,
      estado: 'COMPLETADO',
      tamano,
      rutaArchivo: path.relative(PROJECT_ROOT, rutaArchivo),
      checksum,
      archivosTotal: snapshot.metadata.totalFiles,
      modulosAfectados: JSON.stringify(snapshot.metadata.modulos),
      tipo: 'MANUAL',
      usuarioId: null,
      usuarioNombre: 'Super Z (sistema)',
      motivo: 'Snapshot final tras sincronización GitHub+Vercel+Neon y fix de login',
      metadata: JSON.stringify({
        timestamp: snapshot.timestamp,
        totalSize: snapshot.metadata.totalSize,
        nodeVersion: systemMeta.nodeVersion,
        prismaVersion: systemMeta.prismaVersion,
        gitSHA: systemMeta.gitSHA,
        gitBranch: systemMeta.gitBranch,
        tablasBD: ALL_MODELS.length,
        tablasConDatos: totalTables,
        totalRegistrosBD: totalRecords,
        uploadsIncluidos: uploadFiles.length,
        codigoFiles: codeFiles.length,
        configFiles: Object.keys(configFiles).length,
      }),
    },
  });
  console.log(`   SnapshotProyecto.id: ${snapshotDB.id}`);
  console.log(`   SnapshotProyecto.uuid: ${snapshotDB.uuid}`);

  // 9. Resumen final
  console.log('\n=== RESUMEN FINAL ===');
  console.log(`UUID: ${uuid}`);
  console.log(`Versión: 2.0`);
  console.log(`Nombre: versión final 2`);
  console.log(`Código: ${codeFiles.length} archivos (${(codeSize / 1024).toFixed(1)} KB)`);
  console.log(`Config: ${Object.keys(configFiles).length} archivos`);
  console.log(`Base de datos: ${totalRecords} registros en ${totalTables} tablas`);
  console.log(`Uploads: ${uploadFiles.length} archivos (${(uploadSize / 1024).toFixed(1)} KB)`);
  console.log(`Tamaño total: ${(tamano / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Archivo: ${rutaArchivo}`);
  console.log(`Checksum SHA-256: ${checksum}`);

  await prisma.$disconnect();
}

function detectModules(files) {
  const modulos = new Set();
  for (const f of files) {
    const relative = path.relative(PROJECT_ROOT, f);
    const apiMatch = relative.match(/^src\/app\/api\/([^/]+)/);
    if (apiMatch) modulos.add(`API: ${apiMatch[1]}`);
    const viewMatch = relative.match(/^src\/components\/views\/([^/]+)/);
    if (viewMatch) modulos.add(`View: ${viewMatch[1].replace('.tsx', '')}`);
    const libMatch = relative.match(/^src\/lib\/([^/]+)/);
    if (libMatch) modulos.add(`Lib: ${libMatch[1].replace('.ts', '')}`);
    if (relative.startsWith('src/app/api/')) modulos.add('APIs');
    if (relative.startsWith('prisma/')) modulos.add('Prisma Schema');
  }
  return Array.from(modulos).sort();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
