import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
  formatearFecha,
} from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// GET - próximos pagos (con esperado vs recaudado + mora diaria en tiempo real)
// v4.0: auth + soporte para cuotas APLAZADAS (pago solo intereses)
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const diasAdelante = parseInt(searchParams.get('dias') || '30')

    const fechaInicio = new Date()
    fechaInicio.setHours(0, 0, 0, 0)
    const fechaFin = new Date()
    fechaFin.setDate(fechaFin.getDate() + diasAdelante)
    fechaFin.setHours(23, 59, 59, 999)

    // Buscar solicitudes activos o en mora
    const prestamos = await db.prestamo.findMany({
      where: {
        estado: { in: ['ACTIVO', 'EN_MORA'] },
      },
      include: {
        cliente: true,
        categoria: true,
        pagos: {
          where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } },
          orderBy: { numeroCuota: 'asc' },
        },
        pagosProgramados: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const proximosPagos: any[] = []
    let totalEsperado = 0
    let totalRecaudado = 0
    let totalPendiente = 0
    let totalMoraAcumulada = 0

    for (const p of prestamos) {
      const calculo = calcularPrestamo({
        montoPrincipal: p.montoPrincipal,
        tasaInteresAnual: p.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(p), // convertir diaria a anual para la función
        plazoMeses: p.plazoMeses,
        frecuencia: p.frecuencia as any,
        fechaDesembolso: p.fechaDesembolso || p.fechaSolicitud,
      })

      const cuotasPagadasCompletamente = new Set(
        p.pagos.filter(pg => pg.estado === 'APLICADO' && !pg.esSoloIntereses).map(pg => pg.numeroCuota)
      ).size

      // Buscar la próxima cuota pendiente (no completamente pagada)
      const proximaCuotaNum = cuotasPagadasCompletamente + 1
      const cuotaPendiente = calculo.tablaAmortizacion.find((c) => c.numero === proximaCuotaNum)
      if (!cuotaPendiente) continue

      // === v4.0: si la cuota está APLAZADA (pago solo intereses), usar la nueva fecha ===
      const pagoProgramado = p.pagosProgramados.find((pp) => pp.numeroCuota === proximaCuotaNum)
      const cuotaAplazada = pagoProgramado?.aplazado && pagoProgramado?.estado === 'APLAZADO'
      const fechaVenc = cuotaAplazada
        ? new Date(pagoProgramado!.fechaVencimiento)
        : new Date(cuotaPendiente.fechaVencimiento)

      // === Calcular lo ya pagado para ESTA cuota (parcial) ===
      const pagosCuota = p.pagos.filter(pg => pg.numeroCuota === proximaCuotaNum)
      const capitalPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoCapital, 0)
      const interesPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoInteres, 0)
      const moraPagadaCuota = pagosCuota.reduce((s, pg) => s + pg.montoMora, 0)
      const totalPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoTotal, 0)

      // === Calcular mora en tiempo real (si está vencida) ===
      // v4.0: si la cuota está APLAZADA, NO se cobra mora mientras tanto
      // (el cliente ya pagó los intereses).
      const diasMora = cuotaAplazada ? 0 : calcularDiasMora(cuotaPendiente.fechaVencimiento)
      // Mora compuesta diaria sobre capital inicial del solicitud
      const moraActual = diasMora > 0
        ? calcularMoraCompuesta(p.montoPrincipal, p.tasaMoraDiaria, diasMora)
        : 0

      // Mora pendiente = mora actual - mora ya pagada
      const moraPendiente = Math.max(0, moraActual - moraPagadaCuota)

      // Cuota base: si está APLAZADA, solo queda el capital (intereses ya pagados)
      const cuotaBase = cuotaAplazada
        ? (pagoProgramado?.montoCuota ?? cuotaPendiente.capital)
        : cuotaPendiente.montoCuota
      // Total a pagar HOY para ponerse al día con esta cuota
      const totalCuotaConMora = cuotaBase + moraPendiente
      // Pendiente después de restar lo ya pagado
      const montoPendiente = Math.max(0, totalCuotaConMora - totalPagadoCuota)

      // Tasa diaria de mora en pesos (cuánto crece por día)
      const moraDiariaPesos = (p.montoPrincipal * p.tasaMoraDiaria) / 100

      // Estado de la cuota
      const estado = cuotaAplazada
        ? 'APLAZADA'
        : diasMora > 0 ? 'VENCIDO' : fechaVenc.getTime() === fechaInicio.getTime() ? 'HOY' : 'PROXIMO'

      // Incluir si está dentro del rango de fechas o está vencida
      if ((fechaVenc >= fechaInicio && fechaVenc <= fechaFin) || diasMora > 0 || cuotaAplazada) {
        proximosPagos.push({
          prestamoId: p.id,
          codigo: p.codigo,
          cliente: {
            nombre: p.cliente.nombre,
            cedula: p.cliente.cedula,
            telefono: p.cliente.telefono,
          },
          proximaCuota: proximaCuotaNum,
          totalCuotas: p.numeroCuotas,
          frecuencia: p.frecuencia,
          fechaVencimiento: cuotaAplazada ? pagoProgramado!.fechaVencimiento : cuotaPendiente.fechaVencimiento,
          fechaOriginalVencimiento: cuotaAplazada ? pagoProgramado!.fechaOriginalVencimiento : null,
          esAplazada: cuotaAplazada,
          diasMora,
          // Desglose de la cuota
          cuotaBase, // capital + interés original
          capitalCuota: cuotaPendiente.capital,
          interesCuota: cuotaPendiente.interes,
          // Mora
          moraActual, // mora total acumulada hasta hoy
          moraPagadaCuota, // mora ya pagada en pagos parciales
          moraPendiente, // mora pendiente por pagar
          moraDiariaPesos, // cuánto crece la mora por cada día adicional
          tasaMoraDiaria: p.tasaMoraDiaria,
          // Pagos acumulados en esta cuota
          capitalPagadoCuota,
          interesPagadoCuota,
          totalPagadoCuota,
          // Totales
          totalCuotaConMora, // cuota + mora pendiente
          montoPendiente, // lo que falta pagar después de los pagos parciales
          estado,
        })

        totalEsperado += totalCuotaConMora
        totalRecaudado += totalPagadoCuota
        totalPendiente += montoPendiente
        totalMoraAcumulada += moraPendiente
      }
    }

    // Ordenar: vencidos primero, luego por fecha
    proximosPagos.sort((a, b) => {
      if (a.diasMora > 0 && b.diasMora === 0) return -1
      if (a.diasMora === 0 && b.diasMora > 0) return 1
      return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime()
    })

    return NextResponse.json({
      success: true,
      data: proximosPagos,
      resumen: {
        totalRegistros: proximosPagos.length,
        totalEsperado,
        totalRecaudado,
        totalPendiente,
        totalMoraAcumulada,
        vencidos: proximosPagos.filter((p) => p.estado === 'VENCIDO').length,
        hoy: proximosPagos.filter((p) => p.estado === 'HOY').length,
        proximos: proximosPagos.filter((p) => p.estado === 'PROXIMO').length,
        aplazadas: proximosPagos.filter((p) => p.estado === 'APLAZADA').length,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
