// =====================================================
// Backfill de Prestamo.fechaCancelacion
// =====================================================
// Para cada préstamo en estado CANCELADO sin fechaCancelacion seteada,
// deriva la fecha real de cancelación usando:
//   1. RenovacionPrestamo.renovacionFechaCancelacionAnterior (más confiable)
//   2. AuditLog.detalles con estado=CANCELADO (parse JSON)
//   3. Como último recurso, Prestamo.updatedAt
//
// Ejecutar: npx tsx scripts/backfill-fecha-cancelacion.ts
// =====================================================
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando backfill de fechaCancelacion...')

  const cancelados = await db.prestamo.findMany({
    where: {
      estado: 'CANCELADO',
      fechaCancelacion: null,
    },
    select: {
      id: true,
      codigo: true,
      updatedAt: true,
      renovacionFechaCancelacionAnterior: true,
    },
  })

  console.log(`📊 Préstamos CANCELADOS sin fechaCancelacion: ${cancelados.length}`)

  let porRenovacion = 0
  let porAuditLog = 0
  let porUpdatedAt = 0
  let errores = 0

  for (const p of cancelados) {
    let fechaCancelacion: Date | null = null

    // 1. RenovacionPrestamo (si fue cancelado por renovación)
    if (p.renovacionFechaCancelacionAnterior) {
      fechaCancelacion = p.renovacionFechaCancelacionAnterior
      porRenovacion++
    }

    // 2. AuditLog con estado=CANCELADO
    if (!fechaCancelacion) {
      try {
        const auditLogs = await db.auditLog.findMany({
          where: {
            modulo: 'prestamos',
            entidadId: p.id,
            accion: { in: ['UPDATE', 'ESTADO_CHANGE', 'CANCELAR'] },
            fecha: { lte: p.updatedAt },
          },
          orderBy: { fecha: 'desc' },
          take: 30,
          select: { fecha: true, detalles: true },
        })

        for (const log of auditLogs) {
          if (!log.detalles) continue
          try {
            const d = JSON.parse(log.detalles)
            //Buscar cualquier campo que indique transición a CANCELADO
            const estados = [d.estado, d.estadoNuevo, d.estado_nuevo, d.nuevoEstado, d.to]
            if (estados.includes('CANCELADO')) {
              fechaCancelacion = log.fecha
              porAuditLog++
              break
            }
          } catch {
            // no es JSON válido, ignorar
          }
        }
      } catch (e) {
        // continuar
      }
    }

    // 3. Fallback a updatedAt
    if (!fechaCancelacion) {
      fechaCancelacion = p.updatedAt
      porUpdatedAt++
    }

    try {
      await db.prestamo.update({
        where: { id: p.id },
        data: { fechaCancelacion },
      })
    } catch (e: any) {
      console.error(`❌ Error actualizando ${p.codigo}:`, e?.message)
      errores++
    }
  }

  console.log('\n✅ Backfill completado:')
  console.log(`   Total procesados: ${cancelados.length}`)
  console.log(`   Por RenovacionPrestamo: ${porRenovacion}`)
  console.log(`   Por AuditLog: ${porAuditLog}`)
  console.log(`   Por updatedAt (fallback): ${porUpdatedAt}`)
  if (errores) console.log(`   Errores: ${errores}`)
}

main()
  .catch((e) => {
    console.error('💥 Error fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
