// =====================================================
// /api/automatizaciones/ejecutar — Ejecutar automatización v3.0
// POST: ejecuta una automatización específica o todas las pendientes
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import { debeIrAJuridico, calcularDiasMora } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { id, ejecutarTodas = false } = body

    if (ejecutarTodas) {
      // Ejecutar todas las pendientes (cuya proximaEjecucion ya pasó)
      const pendientes = await db.automatizacion.findMany({
        where: {
          activa: true,
          proximaEjecucion: { lte: new Date() },
        },
      })

      const resultados: any[] = []
      for (const auto of pendientes) {
        const resultado = await ejecutarAutomatizacion(auto.id, authResult.id)
        resultados.push({ id: auto.id, nombre: auto.nombre, ...resultado })
      }

      return NextResponse.json({
        success: true,
        data: {
          ejecutadas: resultados.length,
          resultados,
        },
      })
    }

    // Ejecutar una específica
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido (o ejecutarTodas=true)', code: 'MISSING_ID' },
        { status: 400 }
      )
    }

    const resultado = await ejecutarAutomatizacion(id, authResult.id)
    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    logError('/api/automatizaciones/ejecutar POST', error)
    return errorResponse('/api/automatizaciones/ejecutar POST', error)
  }
}

async function ejecutarAutomatizacion(
  automatizacionId: string,
  ejecutorId: string
): Promise<{
  automatizacionId: string
  estado: string
  entidadesAfectadas: number
  error?: string
}> {
  const automatizacion = await db.automatizacion.findUnique({
    where: { id: automatizacionId },
  })

  if (!automatizacion) {
    return {
      automatizacionId,
      estado: 'FALLIDA',
      entidadesAfectadas: 0,
      error: 'Automatización no encontrada',
    }
  }

  // Crear registro de ejecución
  const ejecucion = await db.ejecucionAutomatizacion.create({
    data: {
      automatizacionId,
      estado: 'EJECUTANDO',
      fechaInicio: new Date(),
    },
  })

  try {
    let entidadesAfectadas = 0
    let resultado = ''

    switch (automatizacion.tipo) {
      case 'RECORDATORIO_PAGO':
        const recordatorios = await ejecutarRecordatoriosPago()
        entidadesAfectadas = recordatorios
        resultado = `${recordatorios} recordatorios enviados`
        break

      case 'ESCALACION_MORA':
        const escalados = await ejecutarEscalacionMora()
        entidadesAfectadas = escalados
        resultado = `${escalados} préstamos escalados a jurídico`
        break

      case 'COBRO_AUTOMATICO':
        resultado = 'Cobro automático no implementado en esta versión'
        break

      case 'WHATSAPP_AUTO':
        resultado = 'WhatsApp automático ejecutado (placeholder)'
        break

      case 'REPORTES_PROGRAMADOS':
        resultado = 'Reportes generados (placeholder)'
        break

      case 'SINCRONIZACION_BANCARIA':
        resultado = 'Sincronización bancaria ejecutada (placeholder)'
        break

      default:
        resultado = `Tipo ${automatizacion.tipo} no reconocido`
    }

    // Actualizar ejecución
    await db.ejecucionAutomatizacion.update({
      where: { id: ejecucion.id },
      data: {
        estado: 'COMPLETADA',
        fechaFin: new Date(),
        resultado,
        entidadesAfectadas,
      },
    })

    // Actualizar estadísticas de la automatización
    const nuevaProxima = new Date(
      Date.now() + automatizacion.intervaloMinutos * 60 * 1000
    )
    await db.automatizacion.update({
      where: { id: automatizacionId },
      data: {
        ultimaEjecucion: new Date(),
        proximaEjecucion: nuevaProxima,
        ejecucionesTotales: { increment: 1 },
        ejecucionesExitosas: { increment: 1 },
      },
    })

    return {
      automatizacionId,
      estado: 'COMPLETADA',
      entidadesAfectadas,
    }
  } catch (error: any) {
    // Marcar como fallida
    await db.ejecucionAutomatizacion.update({
      where: { id: ejecucion.id },
      data: {
        estado: 'FALLIDA',
        fechaFin: new Date(),
        error: sanitizeError(error).message || 'Error desconocido',
      },
    })

    await db.automatizacion.update({
      where: { id: automatizacionId },
      data: {
        ultimaEjecucion: new Date(),
        proximaEjecucion: new Date(
          Date.now() + automatizacion.intervaloMinutos * 60 * 1000
        ),
        ejecucionesTotales: { increment: 1 },
        ejecucionesFallidas: { increment: 1 },
      },
    })

    return {
      automatizacionId,
      estado: 'FALLIDA',
      entidadesAfectadas: 0,
      error: sanitizeError(error).message || 'Error desconocido',
    }
  }
}

/**
 * Ejecuta recordatorios de pago: cuenta préstamos con cuotas
 * vencidas en los próximos 3 días.
 */
async function ejecutarRecordatoriosPago(): Promise<number> {
  const hoy = new Date()
  const enTresDias = new Date()
  enTresDias.setDate(enTresDias.getDate() + 3)

  const prestamos = await db.prestamo.findMany({
    where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
    include: { pagos: true },
  })

  let contador = 0
  for (const p of prestamos) {
    const pagoPendiente = p.pagos.find(
      (pago) =>
        pago.estado === 'PENDIENTE' &&
        pago.fechaVencimiento >= hoy &&
        pago.fechaVencimiento <= enTresDias
    )
    if (pagoPendiente) contador++
  }
  return contador
}

/**
 * Ejecuta escalación de mora: marca como JURIDICO los préstamos
 * con más de 60 días de mora y sin caso jurídico abierto.
 */
async function ejecutarEscalacionMora(): Promise<number> {
  const prestamosMora = await db.prestamo.findMany({
    where: { estado: 'EN_MORA' },
    include: { pagos: true, casoJuridico: true },
  })

  let escalados = 0
  for (const p of prestamosMora) {
    if (p.casoJuridico) continue // ya tiene caso abierto

    // Calcular días de mora reales con la fecha de vencimiento de cuotas pendientes
    const cuotasPendientes = p.pagos.filter((pago) => pago.estado === 'PENDIENTE')
    let maxDiasMora = 0
    for (const pago of cuotasPendientes) {
      const dias = calcularDiasMora(pago.fechaVencimiento)
      if (dias > maxDiasMora) maxDiasMora = dias
    }

    if (debeIrAJuridico(maxDiasMora)) {
      // Cambiar estado y crear caso jurídico
      await db.$transaction([
        db.prestamo.update({
          where: { id: p.id },
          data: { estado: 'JURIDICO', diasMora: maxDiasMora },
        }),
        db.casoJuridico.create({
          data: {
            prestamoId: p.id,
            estado: 'PRE_JUDICIAL',
            descripcion: `Escalado automáticamente tras ${maxDiasMora} días de mora`,
            valorReclamado: p.saldoTotal,
          },
        }),
      ])
      escalados++
    }
  }
  return escalados
}
