// =====================================================
// /api/vehiculos/obligaciones/recalcular-mora
// Recorre todas las obligaciones PENDIENTE/PARCIAL/VENCIDA y:
//  - Calcula días de retraso (si venció y no se ha pagado completo)
//  - Aplica multa según multaDiaria del contrato
//  - Marca como VENCIDA si está en mora
// Llamar vía cron diario o manualmente.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// Comparar fechas en zona horaria de Colombia (UTC-5)
function diasEntre(fecha1: Date, fecha2: Date): number {
  const f1 = new Date(fecha1.getTime() - (5 * 60 * 60 * 1000))
  const f2 = new Date(fecha2.getTime() - (5 * 60 * 60 * 1000))
  f1.setHours(0, 0, 0, 0)
  f2.setHours(0, 0, 0, 0)
  const diffMs = f2.getTime() - f1.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const ahora = new Date()
    // Tomar todas las obligaciones no pagadas
    const obligaciones = await db.obligacionVehiculo.findMany({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] } },
      include: { contrato: true },
    })

    let actualizadas = 0
    const alertasGeneradas: any[] = []

    for (const oblig of obligaciones) {
      const contrato = oblig.contrato
      if (!contrato) continue

      // Solo aplicar mora si la fecha de vencimiento ya pasó
      if (oblig.fechaVencimiento >= ahora) continue

      const diasGracia = contrato.diasGracia || 0
      const multaDiaria = contrato.multaDiaria || 0

      // Días de retraso reales (después de gracia)
      const diasRetrasoCrudo = diasEntre(oblig.fechaVencimiento, ahora)
      const diasRetraso = Math.max(0, diasRetrasoCrudo - diasGracia)

      // Multa = días de retraso × multaDiaria
      const multa = diasRetraso * multaDiaria
      const montoPendienteFinal = (oblig.monto + multa) - oblig.montoPagado

      const nuevoEstado = oblig.montoPagado > 0 ? 'PARCIAL' : (diasRetraso > 0 ? 'VENCIDA' : 'PENDIENTE')

      await db.obligacionVehiculo.update({
        where: { id: oblig.id },
        data: {
          diasRetraso,
          multa,
          montoPendiente: Math.max(0, montoPendienteFinal),
          estado: nuevoEstado,
        },
      })
      actualizadas++

      // Generar alerta si es crítica (mora > 3 días)
      if (diasRetraso > 3) {
        const alertaExistente = await db.alertaVehiculo.findFirst({
          where: {
            vehiculoId: oblig.vehiculoId,
            tipo: 'OBLIGACION_VENCIDA',
            descripcion: { contains: oblig.id },
            atendida: false,
          },
        })
        if (!alertaExistente) {
          const alerta = await db.alertaVehiculo.create({
            data: {
              vehiculoId: oblig.vehiculoId,
              tipo: 'OBLIGACION_VENCIDA',
              severidad: diasRetraso > 7 ? 'CRITICAL' : 'WARNING',
              titulo: `Obligación vencida ${diasRetraso} días`,
              descripcion: `Cuota #${oblig.numeroCuota} del contrato ${contrato.numeroContrato} tiene ${diasRetraso} días de retraso. Multa acumulada: $${multa.toLocaleString('es-CO')}. Obligación ID: ${oblig.id}`,
            },
          })
          alertasGeneradas.push(alerta)
        }
      }
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'OBLIGACION',
        entidadId: 'BATCH',
        accion: 'MODIFICAR',
        descripcion: `Recálculo de mora: ${actualizadas} obligaciones actualizadas, ${alertasGeneradas.length} alertas generadas`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        procesadas: obligaciones.length,
        actualizadas,
        alertasGeneradas: alertasGeneradas.length,
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/obligaciones/recalcular-mora] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
