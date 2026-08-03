/**
 * Restaurar TODOS los datos de la BD previa (/tmp/my-project/db/custom.db del 1/08)
 * - 8 clientes, 30 prestamos (20 PENDIENTE_ACEPTACION + 10 ACTIVO), 16 pagos, 4 categorias
 * - Borra datos actuales y restaura completos
 *
 * Uso: node /home/z/my-project/scripts/restore-from-prev-db.js
 */
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

// BD previa (source) - lectura
process.env.DATABASE_URL = 'file:/tmp/prev_db.db'
const prevDb = new PrismaClient()

// BD actual (target) - escritura
const targetDb = new PrismaClient({
  datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } },
})

function toDate(v) {
  if (!v) return null
  return new Date(v)
}
function toBool(v) {
  return v === true || v === 'true' || v === 1
}

async function wipeTarget() {
  console.log('>> Borrando datos actuales...')
  // Orden por FKs: primero hijos
  const r1 = await targetDb.pago.deleteMany({})
  console.log(`  pagos borrados: ${r1.count}`)
  const r2 = await targetDb.bitacoraPrestamo.deleteMany({})
  console.log(`  bitacoras borradas: ${r2.count}`)
  const r3 = await targetDb.prestamo.deleteMany({})
  console.log(`  prestamos borrados: ${r3.count}`)
  const r4 = await targetDb.cliente.deleteMany({})
  console.log(`  clientes borrados: ${r4.count}`)
  const r5 = await targetDb.categoriaCliente.deleteMany({})
  console.log(`  categorias borradas: ${r5.count}`)
  const r6 = await targetDb.cuentaRecaudo.deleteMany({})
  console.log(`  cuentas recaudo borradas: ${r6.count}`)
}

async function restoreCuentas() {
  console.log('\n>> Restaurando cuentas de recaudo...')
  const items = await prevDb.cuentaRecaudo.findMany()
  for (const c of items) {
    await targetDb.cuentaRecaudo.create({ data: c })
    console.log(`  + ${c.codigo} | ${c.banco} ${c.numeroCuenta}`)
  }
  return items.length
}

async function restoreCategorias() {
  console.log('\n>> Restaurando categorias...')
  const items = await prevDb.categoriaCliente.findMany()
  for (const c of items) {
    await targetDb.categoriaCliente.create({ data: c })
    console.log(`  + ${c.codigo} | ${c.nombre} | tasa ${c.tasaInteresAnual}%`)
  }
  return items.length
}

async function restoreClientes() {
  console.log('\n>> Restaurando clientes...')
  const items = await prevDb.cliente.findMany({ orderBy: { createdAt: 'asc' } })

  // PASADA 1: crear sin referidoPorId ni categoriaId (para evitar FK violations)
  for (const c of items) {
    const data = { ...c }
    // Quitar FKs que pueden no existir aun
    data.referidoPorId = null
    data.categoriaId = null
    data.cuentaRecaudoId = null
    data.instruccionCuentaId = null
    // Asegurar que fechas sean Date
    for (const k of Object.keys(data)) {
      if (typeof data[k] === 'string' && data[k].match(/^\d{4}-\d{2}-\d{2}T/)) {
        data[k] = new Date(data[k])
      }
    }
    await targetDb.cliente.create({ data })
    console.log(`  + ${c.nombre} | cc ${c.cedula} | tel ${c.telefono}`)
  }

  // PASADA 2: actualizar FKs ahora que todos existen
  console.log('\n>> Actualizando FKs (referidos, categorias)...')
  for (const c of items) {
    if (c.referidoPorId || c.categoriaId || c.cuentaRecaudoId || c.instruccionCuentaId) {
      await targetDb.cliente.update({
        where: { id: c.id },
        data: {
          referidoPorId: c.referidoPorId || null,
          categoriaId: c.categoriaId || null,
          cuentaRecaudoId: c.cuentaRecaudoId || null,
          instruccionCuentaId: c.instruccionCuentaId || null,
        },
      })
      if (c.referidoPorId) {
        const ref = items.find(x => x.id === c.referidoPorId)
        console.log(`  ~ ${c.nombre} -> referidoPor: ${ref?.nombre || '?'}`)
      }
    }
  }
  return items.length
}

async function restorePrestamos() {
  console.log('\n>> Restaurando prestamos...')
  const items = await prevDb.prestamo.findMany({ orderBy: { createdAt: 'asc' }, include: { cliente: true } })
  for (const p of items) {
    const data = { ...p }
    // Quitar relaciones anidadas
    delete data.cliente
    // Convertir fechas string a Date
    for (const k of Object.keys(data)) {
      if (typeof data[k] === 'string' && data[k].match(/^\d{4}-\d{2}-\d{2}T/)) {
        data[k] = new Date(data[k])
      }
    }
    await targetDb.prestamo.create({ data })
    console.log(`  + ${p.codigo} | ${p.cliente.nombre} | $${p.montoPrincipal.toLocaleString()} | ${p.frecuencia} | ${p.estado}`)
  }
  return items.length
}

async function restorePagos() {
  console.log('\n>> Restaurando pagos...')
  const items = await prevDb.pago.findMany({ orderBy: { createdAt: 'asc' } })
  for (const pg of items) {
    const data = { ...pg }
    for (const k of Object.keys(data)) {
      if (typeof data[k] === 'string' && data[k].match(/^\d{4}-\d{2}-\d{2}T/)) {
        data[k] = new Date(data[k])
      }
    }
    await targetDb.pago.create({ data })
    console.log(`  + pago cuota ${pg.numeroCuota} | prestamo ${pg.prestamoId.slice(-8)} | $${pg.montoTotal.toLocaleString()} | ${pg.estado}`)
  }
  return items.length
}

async function restoreBitacoras() {
  console.log('\n>> Restaurando bitacoras...')
  try {
    const items = await prevDb.bitacoraPrestamo.findMany()
    for (const b of items) {
      const data = { ...b }
      for (const k of Object.keys(data)) {
        if (typeof data[k] === 'string' && data[k].match(/^\d{4}-\d{2}-\d{2}T/)) {
          data[k] = new Date(data[k])
        }
      }
      await targetDb.bitacoraPrestamo.create({ data })
      console.log(`  + ${b.titulo?.slice(0, 60)}`)
    }
    return items.length
  } catch (e) {
    console.log(`  ! Error: ${e.message.slice(0, 100)}`)
    return 0
  }
}

async function main() {
  console.log('=== Restauracion desde BD previa (1/08) ===\n')
  console.log('Fuente: /tmp/prev_db.db (del 1/08, 8 clientes, 30 prestamos)')
  console.log('Destino: /home/z/my-project/db/custom.db\n')

  await wipeTarget()
  await restoreCuentas()
  await restoreCategorias()
  await restoreClientes()
  await restorePrestamos()
  await restorePagos()
  await restoreBitacoras()

  console.log('\n=== Verificacion ===')
  console.log(`  clientes:     ${await targetDb.cliente.count()}`)
  console.log(`  prestamos:    ${await targetDb.prestamo.count()}`)
  console.log(`  pagos:        ${await targetDb.pago.count()}`)
  console.log(`  categorias:   ${await targetDb.categoriaCliente.count()}`)
  console.log(`  cuentas:      ${await targetDb.cuentaRecaudo.count()}`)
  console.log(`  bitacoras:    ${await targetDb.bitacoraPrestamo.count()}`)

  console.log('\n=== Desglose por estado ===')
  const estados = await targetDb.$queryRaw`SELECT estado, COUNT(*) as n FROM Prestamo GROUP BY estado ORDER BY n DESC`
  for (const e of estados) {
    console.log(`  ${e.estado}: ${e.n}`)
  }

  console.log('\n=== Clientes finales ===')
  const cls = await targetDb.cliente.findMany({ orderBy: { createdAt: 'asc' }, select: { nombre: true, cedula: true, telefono: true } })
  for (const c of cls) {
    console.log(`  - ${c.nombre} | cc ${c.cedula} | tel ${c.telefono}`)
  }
  console.log('\n=== Restauracion completada ===')
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
}).finally(async () => {
  await prevDb.$disconnect()
  await targetDb.$disconnect()
})
