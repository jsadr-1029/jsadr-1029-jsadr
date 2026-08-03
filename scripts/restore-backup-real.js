/**
 * Restaurar datos reales del backup_manual_2026-07-20T19-33-23-029Z.json
 * - Borra datos demo creados por seed-demo-data.js
 * - Restaura 4 cuentas recaudo, 4 categorias, 5 clientes, 6 prestamos, 6 pagos
 * - Mantiene los IDs originales (cuidado con FKs)
 *
 * Uso: node /home/z/my-project/scripts/restore-backup-real.js
 */
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const p = new PrismaClient()

function loadBackup() {
  const fp = '/home/z/my-project/upload/backup_manual_2026-07-20T19-33-23-029Z.json'
  return JSON.parse(fs.readFileSync(fp, 'utf8'))
}

function toDate(v) {
  if (!v) return null
  return new Date(v)
}

function toBool(v) {
  if (v === true || v === 'true' || v === 1) return true
  return false
}

async function wipeDemo() {
  console.log('>> Borrando datos demo...')
  // Orden: primero hijos (pagos, bitacoras), luego prestamos, luego clientes, luego categorias, luego cuentas
  const r1 = await p.pago.deleteMany({})
  console.log(`  pagos borrados: ${r1.count}`)
  const r2 = await p.bitacoraPrestamo.deleteMany({})
  console.log(`  bitacoras borradas: ${r2.count}`)
  const r3 = await p.prestamo.deleteMany({})
  console.log(`  prestamos borrados: ${r3.count}`)
  const r4 = await p.cliente.deleteMany({})
  console.log(`  clientes borrados: ${r4.count}`)
  const r5 = await p.categoriaCliente.deleteMany({})
  console.log(`  categorias borradas: ${r5.count}`)
  const r6 = await p.cuentaRecaudo.deleteMany({})
  console.log(`  cuentas recaudo borradas: ${r6.count}`)
}

async function restoreCuentas(cuentas) {
  console.log('\n>> Restaurando cuentas de recaudo...')
  for (const c of cuentas) {
    await p.cuentaRecaudo.create({
      data: {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        banco: c.banco,
        tipoCuenta: c.tipoCuenta,
        numeroCuenta: c.numeroCuenta,
        titular: c.titular,
        activa: toBool(c.activa),
        createdAt: toDate(c.createdAt) || new Date(),
        updatedAt: toDate(c.updatedAt) || new Date(),
      },
    })
    console.log(`  + ${c.codigo} | ${c.banco} ${c.numeroCuenta} (${c.titular})`)
  }
}

async function restoreCategorias(categorias) {
  console.log('\n>> Restaurando categorias...')
  for (const c of categorias) {
    await p.categoriaCliente.create({
      data: {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        montoMinimo: c.montoMinimo,
        montoMaximo: c.montoMaximo,
        tasaInteresAnual: c.tasaInteresAnual,
        tasaMoraAnual: c.tasaMoraAnual,
        descripcion: c.descripcion || null,
        activa: toBool(c.activa),
        cuentaRecaudoId: c.cuentaRecaudoId || null,
        createdAt: toDate(c.createdAt) || new Date(),
        updatedAt: toDate(c.updatedAt) || new Date(),
      },
    })
    console.log(`  + ${c.codigo} | ${c.nombre} | tasa ${c.tasaInteresAnual}%`)
  }
}

async function restoreClientes(clientes) {
  console.log('\n>> Restaurando clientes...')
  for (const c of clientes) {
    await p.cliente.create({
      data: {
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        telefono: c.telefono,
        email: c.email || null,
        departamento: c.departamento || null,
        municipio: c.municipio || null,
        salario: c.salario !== null ? c.salario : null,
        fechaIngreso: c.fechaIngreso ? toDate(c.fechaIngreso) : null,
        direccion: c.direccion || null,
        ciudad: c.ciudad || null,
        barrio: c.barrio || null,
        notas: c.notas || null,
        bancoCliente: c.bancoCliente || null,
        tipoCuentaCliente: c.tipoCuentaCliente || null,
        numeroCuentaCliente: c.numeroCuentaCliente || null,
        activo: toBool(c.activo),
        pinHash: c.pinHash || null,
        pinCreatedAt: c.pinCreatedAt ? toDate(c.pinCreatedAt) : null,
        pinIntentos: c.pinIntentos ?? 0,
        pinBloqueadoHasta: c.pinBloqueadoHasta ? toDate(c.pinBloqueadoHasta) : null,
        claveHash: c.claveHash || null,
        claveCreatedAt: c.claveCreatedAt ? toDate(c.claveCreatedAt) : null,
        claveIntentos: c.claveIntentos ?? 0,
        claveBloqueadoHasta: c.claveBloqueadoHasta ? toDate(c.claveBloqueadoHasta) : null,
        claveResetToken: c.claveResetToken || null,
        claveResetExpira: c.claveResetExpira ? toDate(c.claveResetExpira) : null,
        tieneTasaPersonalizada: toBool(c.tieneTasaPersonalizada),
        tasaPersonalizada: c.tasaPersonalizada !== null ? c.tasaPersonalizada : null,
        tokenSesion: c.tokenSesion || null,
        tokenExpira: c.tokenExpira ? toDate(c.tokenExpira) : null,
        totpSecret: c.totpSecret || null,
        totpEnabled: toBool(c.totpEnabled),
        totpCreatedAt: c.totpCreatedAt ? toDate(c.totpCreatedAt) : null,
        totpLastUsed: c.totpLastUsed ? toDate(c.totpLastUsed) : null,
        referidoPorId: c.referidoPorId || null,
        categoriaId: c.categoriaId || null,
        cuentaRecaudoId: c.cuentaRecaudoId || null,
        instruccionCuentaId: c.instruccionCuentaId || null,
        instruccionCuentaNota: c.instruccionCuentaNota || null,
        instruccionCuentaExpira: c.instruccionCuentaExpira ? toDate(c.instruccionCuentaExpira) : null,
        ultimoAccesoPortal: c.ultimoAccesoPortal ? toDate(c.ultimoAccesoPortal) : null,
        createdAt: toDate(c.createdAt) || new Date(),
        updatedAt: new Date(),
      },
    })
    console.log(`  + ${c.nombre} | cc ${c.cedula} | tel ${c.telefono}`)
  }
}

async function restorePrestamos(prestamos) {
  console.log('\n>> Restaurando prestamos...')
  for (const p of prestamos) {
    const pr = p // alias para evitar shadow
    await db.prestamo.create({
      data: {
        id: pr.id,
        codigo: pr.codigo,
        clienteId: pr.clienteId,
        categoriaId: pr.categoriaId || null,
        montoPrincipal: pr.montoPrincipal,
        tasaInteresAnual: pr.tasaInteresAnual,
        tasaInteresMensual: pr.tasaInteresMensual,
        tasaMoraDiaria: pr.tasaMoraDiaria,
        plazoMeses: pr.plazoMeses,
        frecuencia: pr.frecuencia,
        numeroCuotas: pr.numeroCuotas,
        montoCuota: pr.montoCuota,
        totalInteres: pr.totalInteres,
        totalPagar: pr.totalPagar,
        tasaAplicada: pr.tasaAplicada,
        tasaMoraPersonalizada: pr.tasaMoraPersonalizada ?? null,
        moraCompuestaDiaria: toBool(pr.moraCompuestaDiaria),
        montoMoraAcumulado: pr.montoMoraAcumulado ?? 0,
        moraRenegociada: pr.moraRenegociada ?? null,
        moraRenegociadaAccion: pr.moraRenegociadaAccion || null,
        moraRenegociadaFecha: pr.moraRenegociadaFecha ? toDate(pr.moraRenegociadaFecha) : null,
        moraRenegociadaPorId: pr.moraRenegociadaPorId || null,
        moraRenegociadaPorNombre: pr.moraRenegociadaPorNombre || null,
        moraRenegociadaObservacion: pr.moraRenegociadaObservacion || null,
        moraRenegociadaMoraOriginal: pr.moraRenegociadaMoraOriginal ?? null,
        fechaSolicitud: toDate(pr.fechaSolicitud) || new Date(),
        fechaAprobacion: pr.fechaAprobacion ? toDate(pr.fechaAprobacion) : null,
        fechaDesembolso: pr.fechaDesembolso ? toDate(pr.fechaDesembolso) : null,
        fechaVencimiento: pr.fechaVencimiento ? toDate(pr.fechaVencimiento) : null,
        estado: pr.estado,
        tycEnviado: toBool(pr.tycEnviado),
        tycAceptado: toBool(pr.tycAceptado),
        tycFechaAceptacion: pr.tycFechaAceptacion ? toDate(pr.tycFechaAceptacion) : null,
        tycToken: pr.tycToken || null,
        metodoConfirmacion: pr.metodoConfirmacion || null,
        requiereDocumentos: toBool(pr.requiereDocumentos),
        generarPagare: toBool(pr.generarPagare),
        generarCarta: toBool(pr.generarCarta),
        docsDatosAdicionales: pr.docsDatosAdicionales || null,
        tieneCodeudor: toBool(pr.tieneCodeudor),
        codeudorId: pr.codeudorId || null,
        codeudorNombre: pr.codeudorNombre || null,
        codeudorCedula: pr.codeudorCedula || null,
        codeudorTelefono: pr.codeudorTelefono || null,
        codeudorEmail: pr.codeudorEmail || null,
        codeudorDireccion: pr.codeudorDireccion || null,
        codeudorFirmaId: pr.codeudorFirmaId || null,
        firmaId: pr.firmaId || null,
        saldoCapital: pr.saldoCapital,
        saldoInteres: pr.saldoInteres,
        saldoTotal: pr.saldoTotal,
        cuotasPagadas: pr.cuotasPagadas ?? 0,
        montoPagado: pr.montoPagado ?? 0,
        montoMora: pr.montoMora ?? 0,
        diasMora: pr.diasMora ?? 0,
        fondoGarantiaCargado: toBool(pr.fondoGarantiaCargado),
        fondoGarantiaMonto: pr.fondoGarantiaMonto ?? 0,
        notas: pr.notas || null,
        createdAt: toDate(pr.createdAt) || new Date(),
        updatedAt: new Date(),
      },
    })
    console.log(`  + ${pr.codigo} | $${pr.montoPrincipal.toLocaleString()} | ${pr.frecuencia} | ${pr.estado}`)
  }
}

async function restorePagos(pagos) {
  console.log('\n>> Restaurando pagos...')
  for (const pg of pagos) {
    await db.pago.create({
      data: {
        id: pg.id,
        codigo: pg.codigo || null,
        prestamoId: pg.prestamoId,
        numeroCuota: pg.numeroCuota ?? null,
        montoCapital: pg.montoCapital ?? 0,
        montoInteres: pg.montoInteres ?? 0,
        montoMora: pg.montoMora ?? 0,
        montoTotal: pg.montoTotal ?? 0,
        fechaPago: toDate(pg.fechaPago) || new Date(),
        fechaVencimiento: pg.fechaVencimiento ? toDate(pg.fechaVencimiento) : null,
        metodoPago: pg.metodoPago || null,
        referencia: pg.referencia || null,
        cuentaRecaudoId: pg.cuentaRecaudoId || null,
        estado: pg.estado || 'PENDIENTE',
        linkPago: pg.linkPago || null,
        linkExpira: pg.linkExpira ? toDate(pg.linkExpira) : null,
        notas: pg.notas || null,
        reversadoPorId: pg.reversadoPorId || null,
        fechaReversion: pg.fechaReversion ? toDate(pg.fechaReversion) : null,
        motivoReversion: pg.motivoReversion || null,
        createdAt: toDate(pg.createdAt) || new Date(),
      },
    })
    console.log(`  + pago ${pg.id.slice(-8)} | prestamo ${pg.prestamoId.slice(-8)} | cuota ${pg.numeroCuota} | $${pg.montoTotal.toLocaleString()} | ${pg.estado}`)
  }
}

async function restoreBitacoras(bitacoras) {
  if (!bitacoras || bitacoras.length === 0) {
    console.log('\n>> No hay bitacoras que restaurar')
    return
  }
  console.log(`\n>> Restaurando ${bitacoras.length} bitacoras...`)
  for (const b of bitacoras) {
    try {
      await p.bitacoraPrestamo.create({
        data: {
          id: b.id,
          prestamoId: b.prestamoId,
          prestamoCodigo: b.prestamoCodigo || null,
          usuarioNombre: b.usuarioNombre || 'Sistema',
          tipo: b.tipo || 'OTRO',
          titulo: b.titulo || 'Evento',
          descripcion: b.descripcion || '',
          resultado: b.resultado || null,
          fechaEvento: toDate(b.fechaEvento) || new Date(),
          createdAt: b.createdAt ? toDate(b.createdAt) : new Date(),
        },
      })
      console.log(`  + bitacora ${b.id.slice(-8)} | ${b.titulo?.slice(0, 50)}`)
    } catch (e) {
      console.log(`  ! bitacora ${b.id}: ${e.message.slice(0, 100)}`)
    }
  }
}

const db = p

async function main() {
  console.log('=== Restauracion de backup real (2026-07-20) ===\n')
  const backup = loadBackup()
  const d = backup.data

  await wipeDemo()

  await restoreCuentas(d.cuentas || [])
  await restoreCategorias(d.categorias || [])
  await restoreClientes(d.clientes || [])
  await restorePrestamos(d.prestamos || [])
  await restorePagos(d.pagos || [])
  await restoreBitacoras(d.bitacoras || [])

  console.log('\n=== Verificacion ===')
  console.log(`  clientes:  ${await p.cliente.count()}`)
  console.log(`  prestamos: ${await p.prestamo.count()}`)
  console.log(`  pagos:     ${await p.pago.count()}`)
  console.log(`  categorias: ${await p.categoriaCliente.count()}`)
  console.log(`  cuentas:   ${await p.cuentaRecaudo.count()}`)
  console.log(`  bitacoras: ${await p.bitacoraPrestamo.count()}`)

  console.log('\n=== Listado final de clientes ===')
  const cls = await p.cliente.findMany({ orderBy: { createdAt: 'asc' } })
  for (const c of cls) {
    console.log(`  - ${c.nombre} | cc ${c.cedula} | tel ${c.telefono}`)
  }

  console.log('\n=== Restauracion completada ===')
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
}).finally(async () => {
  await p.$disconnect()
})
