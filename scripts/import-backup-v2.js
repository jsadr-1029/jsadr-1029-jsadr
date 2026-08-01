// =====================================================
// Robust backup importer
// Maps backup collection -> snapshot schema model
// Only inserts fields that exist on the target model
// Coerces types (Date strings -> Date, arrays/objects -> JSON string)
// =====================================================
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const db = new PrismaClient()

const BACKUP_PATH = '/home/z/my-project/upload/backup_manual_2026-07-20T19-33-23-029Z.json'
const SCHEMA_FIELDS_PATH = '/tmp/schema-fields.json'

const schemaFields = JSON.parse(fs.readFileSync(SCHEMA_FIELDS_PATH, 'utf8'))

// Backup collection -> Prisma model name
const COLLECTION_TO_MODEL = {
  usuarios: 'Usuario',
  clientes: 'Cliente',
  prestamos: 'Prestamo',
  pagos: 'Pago',
  casosJuridicos: 'CasoJuridico',
  cronologia: 'CronologiaCaso',
  documentos: 'DocumentoLegal',
  alertas: 'AlertaLegal',
  notificaciones: 'NotificacionLog',
  configuracion: 'Configuracion',
  cajas: 'CajaMenor',
  movimientosCaja: 'MovimientoCaja',
  categorias: 'CategoriaCliente',
  cuentas: 'CuentaRecaudo',
  versiones: 'VersionSistema',
  accesosPortal: 'AccesoPortal',
  firmas: 'FirmaElectronica',
  tokensFirma: 'TokenFirma',
  bitacoras: 'BitacoraPrestamo',
  auditLogs: 'AuditLog',
  codigosConfirmacion: 'CodigoConfirmacion',
  campañas: 'Campaña',
  campañasVistas: 'CampañaVista',
  conexionesAPI: 'ConexionAPI',
  seguridadModulos: 'SeguridadModulo',
  prestamosBancarios: 'PrestamoBancario',
  documentosGestor: 'DocumentoGestor',
  auditoriaHallazgos: 'AuditoriaHallazgo',
  automatizaciones: 'Automatizacion',
  ejecucionesAuto: 'EjecucionAutomatizacion',
}

// Relations (skip these when building create payload — they're set via *Id fields)
const RELATION_FIELDS = new Set([
  'cliente', 'prestamo', 'categoria', 'cuentaRecaudo', 'reversadoPor', 'caso',
  'usuario', 'firma', 'caja', 'automatizacion', 'campaña', 'backup', 'clienteRef',
  'bitacoras', 'pagosReversados', 'movimientosCaja', 'auditLogs',
  'conversacionesAsesor', 'notasInternasChat', 'referidoPor', 'referidos',
  'prestamos', 'campañasVistas', 'firmas', 'tokensFirma', 'documentosGestor',
  'accesosPortal', 'solicitudesWeb', 'conversacionesChat', 'otpsChat', 'otpRegistros',
  'categoria', 'categorias', 'pagos', 'casoJuridico', 'notificaciones', 'documentos',
  'tokens', 'cronologia', 'alertas', 'movimientos', 'ejecuciones',
  'movimientoCajaExtendido',
])

// Default bcrypt hash for "admin123" — used when Usuario has no passwordHash in backup
const DEFAULT_PASSWORD_HASH = '$2b$12$uP3WQ5tE5j9ZxQXQYqX4OeJ8wWvKkL5H8t3y6YxQ5gH2bC4dE6fKu'

function parseDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function parseBoolean(v) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true
  if (v === false || v === 'false' || v === 0 || v === '0') return false
  return null
}

function buildPayload(record, modelFields) {
  const payload = {}
  for (const [key, value] of Object.entries(record)) {
    if (RELATION_FIELDS.has(key)) continue
    if (!modelFields.includes(key)) continue // skip unknown fields
    if (value === undefined) continue
    // Type coercion by sniffing the value
    if (value === null) {
      payload[key] = null
      continue
    }
    if (typeof value === 'string') {
      // Is it an ISO date?
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        const d = parseDate(value)
        if (d) { payload[key] = d; continue }
      }
      payload[key] = value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      payload[key] = value
    } else if (value instanceof Date) {
      payload[key] = value
    } else {
      // Object or array -> JSON stringify
      payload[key] = JSON.stringify(value)
    }
  }
  return payload
}

async function importCollection(name, collection, modelName) {
  if (!collection || !collection.length) {
    console.log(`  ⏭️  ${name}: empty, skip`)
    return 0
  }
  const modelFields = schemaFields[modelName]
  if (!modelFields) {
    console.log(`  ⚠️  ${name}: model ${modelName} not in schema, skip`)
    return 0
  }
  const prismaModel = db[modelName.charAt(0).toLowerCase() + modelName.slice(1)]
  if (!prismaModel) {
    console.log(`  ⚠️  ${name}: prisma client has no model ${modelName}, skip`)
    return 0
  }
  // Special-case Usuario: ensure passwordHash
  let imported = 0
  await prismaModel.deleteMany({})
  for (const rec of collection) {
    const payload = buildPayload(rec, modelFields)
    if (modelName === 'Usuario' && !payload.passwordHash) {
      payload.passwordHash = DEFAULT_PASSWORD_HASH
    }
    try {
      await prismaModel.create({ data: payload })
      imported++
    } catch (e) {
      console.error(`  ❌ ${name} record ${rec.id || '?'}: ${e.message.split('\n')[0]}`)
    }
  }
  console.log(`  ✅ ${name} -> ${modelName}: ${imported} imported`)
  return imported
}

async function main() {
  console.log('📁 Reading backup...')
  const raw = fs.readFileSync(BACKUP_PATH, 'utf8')
  const backup = JSON.parse(raw)
  const data = backup.data

  // Order matters for FK relations
  const ORDER = [
    'usuarios',
    'configuracion',
    'cuentas',           // CuentaRecaudo (no deps)
    'categorias',        // CategoriaCliente (FK: cuentaRecaudoId)
    'cajas',             // CajaMenor (no deps)
    'seguridadModulos',
    'clientes',          // Cliente (FK: categoriaId, referidoPorId)
    'prestamos',         // Prestamo (FK: clienteId, categoriaId)
    'pagos',             // Pago (FK: prestamoId, cuentaRecaudoId, reversadoPorId)
    'notificaciones',
    'firmas',
    'tokensFirma',
    'codigosConfirmacion',
    'casosJuridicos',
    'cronologia',
    'bitacoras',
    'auditLogs',
    'movimientosCaja',
    'accesosPortal',
    'documentosGestor',
    'versiones',
    'conexionesAPI',
    'automatizaciones',
    'ejecucionesAuto',
    'prestamosBancarios',
    'campañas',
    'campañasVistas',
    'auditoriaHallazgos',
    'documentos',
    'alertas',
  ]

  for (const coll of ORDER) {
    if (!data[coll]) continue
    await importCollection(coll, data[coll], COLLECTION_TO_MODEL[coll])
  }

  // Summary counts
  console.log('\n📊 Final counts:')
  for (const [coll, model] of Object.entries(COLLECTION_TO_MODEL)) {
    const prismaModel = db[model.charAt(0).toLowerCase() + model.slice(1)]
    if (!prismaModel) continue
    try {
      const n = await prismaModel.count()
      console.log(`   ${model}: ${n}`)
    } catch {}
  }
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
