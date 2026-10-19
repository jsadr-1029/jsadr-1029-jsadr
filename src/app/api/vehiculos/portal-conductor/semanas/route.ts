// =====================================================
// /api/vehiculos/portal-conductor/semanas
// Devuelve las obligaciones agrupadas por semana (L-S).
// Para cada semana muestra:
//  - Días incluidos (Lun, Mar, Mié, Jue, Vie, Sáb)
//  - Estado (PENDIENTE, PARCIAL, PAGADA)
//  - Total a pagar (tarifa × 6)
//  - Multa pendiente si pasó el día 6 (sábado) sin pagar
//  - Botón "Pagar semana completa" o "Pagar día individual"
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']

// Multa fija $50.000 si pasa del día 6 (sábado) sin pagar la semana
const MULTA_SEMANA_ATRASADA = 50000

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }

    const conductor = await db.conductorVehiculo.findFirst({
      where: {
        tokenSesion: token,
        tokenExpira: { gt: new Date() },
        activo: true,
      },
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
          take: 1,
        },
      },
    })

    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    const contrato = conductor.contratos[0]
    if (!contrato) {
      return NextResponse.json({ success: false, error: 'No tienes contrato activo' }, { status: 400 })
    }

    // Cargar todas las obligaciones del contrato
    const obligaciones = await db.obligacionVehiculo.findMany({
      where: { contratoId: contrato.id },
      orderBy: { fechaVencimiento: 'asc' },
      include: {
        pagos: {
          where: { estado: { in: ['APROBADO', 'PENDIENTE', 'EN_REVISION'] } },
        },
      },
    })

    // Agrupar por semana: cada semana empieza en Lunes (1) y termina en Sábado (6)
    // Domingo (0) queda excluido de las semanas (es el día de descanso)
    const semanasMap = new Map<number, any[]>()

    for (const oblig of obligaciones) {
      const dia = oblig.fechaVencimiento.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
      if (dia === 0) continue // domingo no se incluye

      // Calcular el lunes de esa semana
      const lunes = new Date(oblig.fechaVencimiento)
      const diasDesdeLunes = dia - 1 // 0 si es lunes, 5 si es sábado
      lunes.setDate(lunes.getDate() - diasDesdeLunes)
      lunes.setHours(0, 0, 0, 0)

      // Calcular número de semana relativo al inicio del contrato
      const diffMs = lunes.getTime() - contrato.fechaInicio.getTime()
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const semanaNumero = Math.floor(diffDias / 7) + 1

      if (!semanasMap.has(semanaNumero)) {
        semanasMap.set(semanaNumero, [])
      }
      semanasMap.get(semanaNumero)!.push(oblig)
    }

    // Construir respuesta
    const ahora = new Date()
    const semanas = Array.from(semanasMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([semanaNum, obligs]) => {
        // Ordenar por fecha
        obligs.sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())

        const total = obligs.reduce((s, o) => s + o.monto, 0)
        const totalPagado = obligs.reduce((s, o) => s + o.montoPagado, 0)
        const totalMulta = obligs.reduce((s, o) => s + o.multa, 0)
        const totalPendiente = obligs.reduce((s, o) => s + o.montoPendiente, 0)

        // ¿Está pagada toda la semana?
        const todasPagadas = obligs.every(o => o.estado === 'PAGADA')
        const algunasPagadas = obligs.some(o => o.montoPagado > 0)

        // Último día de la semana (sábado)
        const sabado = obligs[obligs.length - 1]?.fechaVencimiento
        const diasDesdeSabado = sabado
          ? Math.floor((ahora.getTime() - sabado.getTime()) / (1000 * 60 * 60 * 24))
          : 0

        // ¿Ya pasó el sábado y no está pagada? → multa $50.000
        const semanaAtrasada = !todasPagadas && diasDesdeSabado > 0
        const multaAtraso = semanaAtrasada ? MULTA_SEMANA_ATRASADA : 0

        // Estado de la semana
        let estadoSemana = 'PENDIENTE'
        if (todasPagadas) estadoSemana = 'PAGADA'
        else if (algunasPagadas) estadoSemana = 'PARCIAL'
        else if (semanaAtrasada) estadoSemana = 'ATRASADA'

        // Día actual (para resaltar)
        const hoyEs = ahora.toDateString()
        const diaActual = obligs.find(o => o.fechaVencimiento.toDateString() === hoyEs)

        return {
          semana: semanaNum,
          estado: estadoSemana,
          dias: obligs.map(o => ({
            id: o.id,
            numeroCuota: o.numeroCuota,
            fechaVencimiento: o.fechaVencimiento,
            diaSemana: DIAS_SEMANA[o.fechaVencimiento.getDay()],
            esHoy: o.fechaVencimiento.toDateString() === hoyEs,
            monto: o.monto,
            montoPagado: o.montoPagado,
            montoPendiente: o.montoPendiente,
            multa: o.multa,
            estado: o.estado,
            diasRetraso: o.diasRetraso,
          })),
          total,
          totalPagado,
          totalPendiente: totalPendiente + multaAtraso,
          multaPorMora: totalMulta,
          multaAtrasoSemana: multaAtraso,
          sabadoFecha: sabado,
          diasDesdeSabado,
          diaActual: diaActual?.id || null,
          mensaje: semanaAtrasada
            ? `⚠️ Esta semana venció el sábado y no se ha pagado completo. Multa de $${MULTA_SEMANA_ATRASADA.toLocaleString('es-CO')} aplicada.`
            : estadoSemana === 'PARCIAL'
            ? '✅ Pago parcial. Completa el resto para evitar multas.'
            : estadoSemana === 'PAGADA'
            ? '✅ Semana pagada completamente.'
            : `💳 Paga antes del sábado para evitar multa de $${MULTA_SEMANA_ATRASADA.toLocaleString('es-CO')}.`,
        }
      })

    // Resumen general
    const semanaActual = semanas.find(s => {
      return s.dias.some(d => d.esHoy)
    }) || semanas.find(s => s.estado !== 'PAGADA')

    return NextResponse.json({
      success: true,
      data: {
        semanas,
        semanaActual: semanaActual?.semana || null,
        multaAtraso: MULTA_SEMANA_ATRASADA,
        recordatorio: 'Recuerda: todos los sábados debes reportar el pago de la semana. Si pagas después del día 6 (sábado), se cobrarán $50.000 de multa.',
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/semanas] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
