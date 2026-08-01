import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, calcularDiasMora, getTasaMoraAnual, calcularMoraCompuesta, debeIrAJuridico } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'

export async function GET() {
  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const finHoy = new Date()
    finHoy.setHours(23, 59, 59, 999)

    const [
      totalClientes,
      totalPrestamos,
      prestamosActivos,
      prestamosMora,
      prestamosJuridico,
      pagosHoy,
      todosPrestamos,
      casosJuridicos,
      cajas,
      categorias,
      cuentas,
      totalMovimientos,
    ] = await Promise.all([
      db.cliente.count(),
      db.prestamo.count(),
      db.prestamo.findMany({ where: { estado: { in: ['ACTIVO', 'EN_MORA'] } } }),
      db.prestamo.findMany({ where: { estado: 'EN_MORA' } }),
      db.prestamo.count({ where: { estado: 'JURIDICO' } }),
      db.pago.findMany({ where: { fechaPago: { gte: hoy, lte: finHoy }, estado: 'APLICADO' } }),
      db.prestamo.findMany({
        where: { estado: 'ACTIVO' },
        include: { cliente: true, pagos: true },
      }),
      db.casoJuridico.findMany({ where: { estado: { not: 'CERRADO' } } }),
      db.cajaMenor.findMany({
        include: {
          movimientos: { orderBy: { fechaMovimiento: 'desc' }, take: 10 },
          _count: { select: { movimientos: true } },
        },
      }),
      db.categoriaCliente.findMany({ include: { _count: { select: { clientes: true } } } }),
      db.cuentaRecaudo.findMany({ include: { _count: { select: { pagos: true } } } }),
      db.movimientoCaja.count(),
    ])

    const carteraTotal = prestamosActivos.reduce((sum, p) => sum + p.saldoTotal, 0)
    const montoEnMora = prestamosMora.reduce((sum, p) => sum + p.saldoTotal, 0)
    const recaudoHoy = pagosHoy.reduce((sum, p) => sum + p.montoTotal, 0)

    // Proyección 30 días
    const proyeccion30Dias: { fecha: string; monto: number }[] = []
    for (let i = 0; i < 30; i++) {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + i)
      const fechaStr = fecha.toISOString().split('T')[0]
      let montoDia = 0

      for (const prestamo of todosPrestamos) {
        const calculo = calcularPrestamo({
          montoPrincipal: prestamo.montoPrincipal,
          tasaInteresAnual: prestamo.tasaInteresAnual,
          tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
          plazoMeses: prestamo.plazoMeses,
          frecuencia: prestamo.frecuencia as any,
          fechaDesembolso: prestamo.fechaDesembolso || undefined,
        })

        for (const cuota of calculo.tablaAmortizacion) {
          const fechaCuotaStr = cuota.fechaVencimiento.toISOString().split('T')[0]
          if (fechaCuotaStr === fechaStr) {
            const yaPagada = prestamo.pagos.some((p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO')
            if (!yaPagada) montoDia += cuota.montoCuota
          }
        }
      }

      if (montoDia > 0) proyeccion30Dias.push({ fecha: fechaStr, monto: montoDia })
    }

    const resumenEstados = await db.prestamo.groupBy({
      by: ['estado'],
      _count: true,
      _sum: { saldoTotal: true },
    })

    const casosJuridicosDetalle = await db.casoJuridico.findMany({
      where: { estado: { not: 'CERRADO' } },
      include: { prestamo: { include: { cliente: true } } },
      take: 5,
      orderBy: { createdAt: 'desc' },
    })

    // Identificar préstamos que deben ir a jurídico (60 días mora)
    const prestanosParaJuridico: any[] = []
    for (const p of prestamosMora) {
      const diasMora = await calcularDiasMoraPrestamo(p.id)
      if (debeIrAJuridico(diasMora)) {
        prestanosParaJuridico.push({ id: p.id, codigo: p.codigo, diasMora })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalClientes,
          totalPrestamos,
          carteraTotal,
          montoEnMora,
          cantidadEnMora: prestamosMora.length,
          recaudoHoy,
          cantidadPagosHoy: pagosHoy.length,
          casosJuridicos: prestamosJuridico,
          casosJuridicosActivos: casosJuridicos.length,
          totalMovimientosCajas: totalMovimientos,
        },
        cajas,
        categorias,
        cuentas,
        proyeccion30Dias,
        resumenEstados,
        casosJuridicosRecientes: casosJuridicosDetalle,
        alertasJuridico: prestanosParaJuridico,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

async function calcularDiasMoraPrestamo(prestamoId: string): Promise<number> {
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { pagos: true },
  })
  if (!prestamo) return 0

  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: prestamo.fechaDesembolso || undefined,
  })

  let maxDiasMora = 0
  for (const cuota of calculo.tablaAmortizacion) {
    const pagada = prestamo.pagos.some((p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO')
    if (!pagada) {
      const dias = calcularDiasMora(cuota.fechaVencimiento)
      if (dias > maxDiasMora) maxDiasMora = dias
    }
  }
  return maxDiasMora
}
