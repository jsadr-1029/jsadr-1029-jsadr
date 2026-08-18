// scripts/inspeccionar-johan-neon.cjs
// Lista TODOS los préstamos del cliente 1214731649 y tablas relacionadas para
// decidir exactamente qué eliminar. Solo lectura.
const { PrismaClient } = require('@prisma/client')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const CEDULA = '1214731649'

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { cedula: CEDULA },
      select: { id: true, nombre: true, cedula: true, esPrueba: true },
    })
    if (!cliente) {
      console.log('Cliente no encontrado con cédula', CEDULA)
      return
    }
    console.log('=== CLIENTE ===')
    console.log(JSON.stringify(cliente, null, 2))

    const prestamos = await prisma.prestamo.findMany({
      where: { clienteId: cliente.id },
      select: {
        id: true, codigo: true, estado: true, saldoCapital: true, saldoTotal: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    console.log(`\n=== PRÉSTAMOS (${prestamos.length}) ===`)
    let totalSaldo = 0
    for (const p of prestamos) {
      const activo = ['ACTIVO','EN_MORA','JURIDICO','PENDIENTE_ACEPTACION','SOLICITUD'].includes(p.estado)
      if (activo) totalSaldo += Number(p.saldoTotal)
      console.log(`- ${p.codigo} | estado=${p.estado} | saldoCapital=${p.saldoCapital} | saldoTotal=${p.saldoTotal} | ${p.createdAt.toISOString()}`)
    }
    console.log(`\nSaldo total (estados no finales): $${totalSaldo.toLocaleString('es-CO')}`)

    const prestamoIds = prestamos.map(p => p.id)

    // Conteos relacionados
    const counts = {
      pagos: await prisma.pago.count({ where: { prestamoId: { in: prestamoIds } } }),
      pagosProgramados: await prisma.pagoProgramado.count({ where: { prestamoId: { in: prestamoIds } } }),
      firmasElectronicas: await prisma.firmaElectronica.count({ where: { prestamoId: { in: prestamoIds } } }),
      tokensFirma: await prisma.tokenFirma.count({ where: { prestamoId: { in: prestamoIds } } }),
      otrosSi: await prisma.otroSiCambioFecha.count({ where: { prestamoId: { in: prestamoIds } } }),
      notificacionLogs: await prisma.notificacionLog.count({ where: { prestamoId: { in: prestamoIds } } }),
      refinanciaciones: await prisma.refinanciacion.count({ where: { prestamoId: { in: prestamoIds } } }),
      bitacoras: await prisma.bitacoraPrestamo.count({ where: { prestamoId: { in: prestamoIds } } }),
      movimientosCaja: await prisma.movimientoCaja.count({ where: { prestamoId: { in: prestamoIds } } }),
      codigosConfirmacion: await prisma.codigoConfirmacion.count({ where: { prestamoId: { in: prestamoIds } } }),
      documentosGestor: await prisma.documentoGestor.count({ where: { prestamoId: { in: prestamoIds } } }),
      casosJuridicos: await prisma.casoJuridico.count({ where: { prestamoId: { in: prestamoIds } } }),
      cronologiasCaso: await prisma.cronologiaCaso.count({ where: { caso: { prestamoId: { in: prestamoIds } } } }),
      alertasLegales: await prisma.alertaLegal.count({ where: { caso: { prestamoId: { in: prestamoIds } } } }),
      documentosLegales: await prisma.documentoLegal.count({ where: { caso: { prestamoId: { in: prestamoIds } } } }),
    }

    console.log('\n=== REGISTROS RELACIONADOS (a eliminar) ===')
    for (const [k, v] of Object.entries(counts)) {
      console.log(`- ${k}: ${v}`)
    }

    // Tablas a nivel cliente (no por préstamo)
    const clienteCounts = {
      accesosPortal: await prisma.accesoPortal.count({ where: { clienteId: cliente.id } }),
      conversacionesChat: await prisma.conversacionChat.count({ where: { clienteId: cliente.id } }),
      mensajesChat: await prisma.mensajeChat.count({ where: { conversacion: { clienteId: cliente.id } } }),
      notasInternas: await prisma.notaInterna.count({ where: { conversacion: { clienteId: cliente.id } } }),
      otpChat: await prisma.otpChat.count({ where: { clienteId: cliente.id } }),
      otpRegistro: await prisma.otpRegistro.count({ where: { clienteId: cliente.id } }),
      solicitudesWeb: await prisma.solicitudWeb.count({ where: { clienteId: cliente.id } }),
      solicitudesNuevoCliente: await prisma.solicitudNuevoCliente.count({ where: { cedula: CEDULA } }),
      pasaporteAuditoria: await prisma.pasaporteAuditoria.count({ where: { clienteId: cliente.id } }),
      campañasVistas: await prisma.campanaVista.count({ where: { clienteId: cliente.id } }),
      compromisosPago: await prisma.compromisoPago.count({ where: { clienteId: cliente.id } }),
    }

    console.log('\n=== REGISTROS A NIVEL CLIENTE ===')
    for (const [k, v] of Object.entries(clienteCounts)) {
      console.log(`- ${k}: ${v}`)
    }

    const totalEliminar = Object.values(counts).reduce((a,b)=>a+b,0) + Object.values(clienteCounts).reduce((a,b)=>a+b,0) + prestamos.length
    console.log(`\n=== TOTAL REGISTROS A ELIMINAR: ${totalEliminar} ===`)
    console.log(`=== Préstamos a eliminar: ${prestamos.length} ===`)
  } catch (e) {
    console.error('ERROR:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
