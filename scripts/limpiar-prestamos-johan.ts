// Limpia todos los préstamos, pagos, firmas, casos jurídicos del cliente Johan Alvarez
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const db = new PrismaClient()

async function main() {
  const cliente = await db.cliente.findUnique({ where: { cedula: '1214731649' } })
  if (!cliente) {
    console.log('Cliente no encontrado')
    return
  }

  // Buscar todos los préstamos del cliente
  const prestamos = await db.prestamo.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, codigo: true },
  })
  console.log(`Préstamos a eliminar: ${prestamos.length}`)

  const prestamoIds = prestamos.map((p) => p.id)

  if (prestamoIds.length === 0) {
    console.log('No hay datos que limpiar.')
    return
  }

  // Eliminar en orden de dependencias
  // 1. AlertaLegal (depende de CasoJuridico que depende de Prestamo)
  const alertas = await db.alertaLegal.deleteMany({
    where: { caso: { prestamoId: { in: prestamoIds } } },
  })
  console.log(`Alertas legales eliminadas: ${alertas.count}`)

  // 2. DocumentoLegal
  const documentosLegales = await db.documentoLegal.deleteMany({
    where: { caso: { prestamoId: { in: prestamoIds } } },
  })
  console.log(`Documentos legales eliminados: ${documentosLegales.count}`)

  // 3. CronologiaCaso
  const cronologias = await db.cronologiaCaso.deleteMany({
    where: { caso: { prestamoId: { in: prestamoIds } } },
  })
  console.log(`Cronologías eliminadas: ${cronologias.count}`)

  // 4. CasoJuridico
  const casos = await db.casoJuridico.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Casos jurídicos eliminados: ${casos.count}`)

  // 5. TokenFirma
  const tokensFirma = await db.tokenFirma.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Tokens de firma eliminados: ${tokensFirma.count}`)

  // 6. FirmaElectronica
  const firmas = await db.firmaElectronica.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Firmas electrónicas eliminadas: ${firmas.count}`)

  // 7. OtroSiCambioFecha
  const otrosSi = await db.otroSiCambioFecha.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Otros sí eliminados: ${otrosSi.count}`)

  // 8. NotificacionLog
  const notifs = await db.notificacionLog.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Notificaciones eliminadas: ${notifs.count}`)

  // 9. Refinanciacion
  const refinanciaciones = await db.refinanciacion.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Refinanciaciones eliminadas: ${refinanciaciones.count}`)

  // 10. PagoProgramado
  const pagosProg = await db.pagoProgramado.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Pagos programados eliminados: ${pagosProg.count}`)

  // 11. Pago
  const pagos = await db.pago.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Pagos eliminados: ${pagos.count}`)

  // 12. BitacoraPrestamo
  const bitacora = await db.bitacoraPrestamo.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Bitácora eliminada: ${bitacora.count}`)

  // 13. MovimientoCaja (relacionado con préstamo)
  const movsCaja = await db.movimientoCaja.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Movimientos de caja eliminados: ${movsCaja.count}`)

  // 14. CodigoConfirmacion
  const codigos = await db.codigoConfirmacion.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Códigos de confirmación eliminados: ${codigos.count}`)

  // 15. DocumentoGestor (documentos del préstamo)
  const docsGestor = await db.documentoGestor.deleteMany({
    where: { prestamoId: { in: prestamoIds } },
  })
  console.log(`Documentos del gestor eliminados: ${docsGestor.count}`)

  // 16. Finalmente, préstamos
  const prestamosDel = await db.prestamo.deleteMany({
    where: { id: { in: prestamoIds } },
  })
  console.log(`Préstamos eliminados: ${prestamosDel.count}`)

  // Verificar
  const totalFinal = await db.prestamo.count({ where: { clienteId: cliente.id } })
  console.log(`\nTotal préstamos del cliente después de limpieza: ${totalFinal}`)
}

main()
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
