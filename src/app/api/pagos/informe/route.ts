import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  formatearMoneda,
  calcularPrestamo,
  calcularDiasMora, getTasaMoraAnual,
  calcularMoraCompuesta,
} from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { excluirPruebaPago, excluirPruebaPrestamo } from '@/lib/cliente-prueba'

// GET - informe comparativo (hoy vs ayer, mes vs mes anterior)
// v4.0: refactor N+1 → groupBy único para reporte anual + auth
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo') || 'mes'
    const anioParam = searchParams.get('anio')
    const mesParam = searchParams.get('mes')

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // === Calcular fechas según el periodo seleccionado ===
    let inicioPeriodo: Date
    let finPeriodo: Date
    let etiquetaPeriodo: string

    if (periodo === 'semana') {
      // Semana actual (lunes a domingo)
      const diaSemana = hoy.getDay() // 0=domingo, 1=lunes
      const diff = diaSemana === 0 ? 6 : diaSemana - 1
      inicioPeriodo = new Date(hoy)
      inicioPeriodo.setDate(hoy.getDate() - diff)
      finPeriodo = new Date(inicioPeriodo)
      finPeriodo.setDate(inicioPeriodo.getDate() + 6)
      finPeriodo.setHours(23, 59, 59, 999)
      etiquetaPeriodo = `Semana del ${inicioPeriodo.toLocaleDateString('es-CO')}`
    } else if (periodo === 'quincena') {
      // Quincena actual (1-15 o 16-fin de mes)
      if (hoy.getDate() <= 15) {
        inicioPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        finPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 15, 23, 59, 59, 999)
      } else {
        inicioPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 16)
        finPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
      }
      etiquetaPeriodo = `Quincena ${hoy.getDate() <= 15 ? '1ra' : '2da'} de ${hoy.toLocaleString('es-CO', { month: 'long' })}`
    } else if (periodo === 'año') {
      // Año completo o año específico
      const anio = anioParam ? parseInt(anioParam) : hoy.getFullYear()
      inicioPeriodo = new Date(anio, 0, 1)
      finPeriodo = new Date(anio, 11, 31, 23, 59, 59, 999)
      etiquetaPeriodo = `Año ${anio}`
    } else {
      // Mes (default) o mes específico
      const anio = anioParam ? parseInt(anioParam) : hoy.getFullYear()
      const mes = mesParam ? parseInt(mesParam) - 1 : hoy.getMonth()
      inicioPeriodo = new Date(anio, mes, 1)
      finPeriodo = new Date(anio, mes + 1, 0, 23, 59, 59, 999)
      etiquetaPeriodo = inicioPeriodo.toLocaleString('es-CO', { month: 'long', year: 'numeric' })
    }

    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)
    const finHoy = new Date(hoy)
    finHoy.setHours(23, 59, 59, 999)
    const finAyer = new Date(ayer)
    finAyer.setHours(23, 59, 59, 999)

    // Mes actual y anterior (para comparativos)
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999)

    // Consultas paralelas (excluyendo clientes de prueba)
    const filtroPago = excluirPruebaPago()
    const filtroPrestamo = excluirPruebaPrestamo()
    const [
      pagosHoy,
      pagosAyer,
      pagosMesActual,
      pagosMesAnterior,
      pagosPeriodo,
      prestamosActivosCount,
      prestamosEnMoraCount,
      saldoTotalActivos,
      prestamosActivosParaProyeccion,
    ] = await Promise.all([
      db.pago.findMany({
        where: { estado: 'APLICADO', fechaPago: { gte: hoy, lte: finHoy }, ...filtroPago },
        include: { prestamo: { include: { cliente: true } } },
      }),
      db.pago.findMany({
        where: { estado: 'APLICADO', fechaPago: { gte: ayer, lte: finAyer }, ...filtroPago },
        include: { prestamo: { include: { cliente: true } } },
      }),
      db.pago.findMany({
        where: { estado: 'APLICADO', fechaPago: { gte: inicioMesActual, lte: finMesActual }, ...filtroPago },
      }),
      db.pago.findMany({
        where: { estado: 'APLICADO', fechaPago: { gte: inicioMesAnterior, lte: finMesAnterior }, ...filtroPago },
      }),
      // === Pagos del periodo seleccionado (semana/quincena/mes/año) ===
      db.pago.findMany({
        where: { estado: 'APLICADO', fechaPago: { gte: inicioPeriodo, lte: finPeriodo }, ...filtroPago },
        include: { prestamo: { include: { cliente: true } } },
      }),
      db.prestamo.count({ where: { estado: 'ACTIVO', ...filtroPrestamo } }),
      db.prestamo.count({ where: { estado: 'EN_MORA', ...filtroPrestamo } }),
      db.prestamo.aggregate({
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, ...filtroPrestamo },
        _sum: { saldoTotal: true },
      }),
      // === Solicitudes activos para calcular proyecciones ===
      db.prestamo.findMany({
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, ...filtroPrestamo },
        include: {
          cliente: true,
          pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } },
        },
      }),
    ])

    // Calcular totales
    const totalHoy = pagosHoy.reduce((s, p) => s + p.montoTotal, 0)
    const totalAyer = pagosAyer.reduce((s, p) => s + p.montoTotal, 0)
    const totalMesActual = pagosMesActual.reduce((s, p) => s + p.montoTotal, 0)
    const totalMesAnterior = pagosMesAnterior.reduce((s, p) => s + p.montoTotal, 0)

    // === Totales del periodo seleccionado ===
    const totalPeriodo = pagosPeriodo.reduce((s, p) => s + p.montoTotal, 0)
    const capitalRecaudadoPeriodo = pagosPeriodo.reduce((s, p) => s + p.montoCapital, 0)
    const interesRecaudadoPeriodo = pagosPeriodo.reduce((s, p) => s + p.montoInteres, 0)
    const moraRecaudadaPeriodo = pagosPeriodo.reduce((s, p) => s + p.montoMora, 0)

    // === Calcular capital e intereses PROGRAMADOS para el periodo ===
    let capitalProgramado = 0
    let interesProgramado = 0

    for (const prestamo of prestamosActivosParaProyeccion) {
      const calculo = calcularPrestamo({
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(prestamo),
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia as any,
        fechaDesembolso: prestamo.fechaDesembolso || undefined,
      })

      // Filtrar cuotas cuyo vencimiento cae dentro del periodo
      for (const cuota of calculo.tablaAmortizacion) {
        if (cuota.fechaVencimiento >= inicioPeriodo && cuota.fechaVencimiento <= finPeriodo) {
          // Verificar si ya está pagada
          const pagada = prestamo.pagos.some((p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO')
          if (!pagada) {
            capitalProgramado += cuota.capital
            interesProgramado += cuota.interes
          }
        }
      }
    }

    // === Calcular mora acumulada del periodo ===
    let moraTotalAcumulada = 0
    const morosos: any[] = []

    for (const prestamo of prestamosActivosParaProyeccion) {
      const calculo = calcularPrestamo({
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(prestamo),
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia as any,
        fechaDesembolso: prestamo.fechaDesembolso || undefined,
      })

      for (const cuota of calculo.tablaAmortizacion) {
        const pago = prestamo.pagos.find((p) => p.numeroCuota === cuota.numero)
        if (!pago || pago.estado !== 'APLICADO') {
          const diasMora = calcularDiasMora(cuota.fechaVencimiento)
          if (diasMora > 0) {
            const moraGenerada = calcularMoraCompuesta(
              cuota.montoCuota,
              getTasaMoraAnual(prestamo),
              diasMora
            )
            moraTotalAcumulada += moraGenerada

            // Agregar a la lista de morosos (sin duplicar)
            const existe = morosos.find((m) => m.prestamoId === prestamo.id)
            if (!existe && prestamo.cliente) {
              morosos.push({
                prestamoId: prestamo.id,
                codigo: prestamo.codigo,
                clienteId: prestamo.clienteId,
                clienteNombre: prestamo.cliente?.nombre || 'N/A',
                clienteCedula: prestamo.cliente?.cedula || 'N/A',
                clienteTelefono: prestamo.cliente?.telefono || 'N/A',
                cuotaPendiente: cuota.numero,
                fechaVencimiento: cuota.fechaVencimiento,
                diasMora,
                montoCuota: cuota.montoCuota,
                moraAcumulada: moraGenerada,
                totalAdeudado: cuota.montoCuota + moraGenerada,
              })
            }
          }
        }
      }
    }

    // === Reporte anual (12 meses) — refactor N+1 → groupBy único v4.0 ===
    const anioReporte = anioParam ? parseInt(anioParam) : hoy.getFullYear()
    const inicioAnioReporte = new Date(anioReporte, 0, 1)
    const finAnioReporte = new Date(anioReporte, 11, 31, 23, 59, 59, 999)

    // SQLite: usar strftime para agrupar por mes. PrismagroupBy por _count y _sum.
    const pagosAgrupadosRaw = await db.pago.findMany({
      where: {
        estado: 'APLICADO',
        fechaPago: { gte: inicioAnioReporte, lte: finAnioReporte },
      },
      select: {
        montoTotal: true,
        montoCapital: true,
        montoInteres: true,
        montoMora: true,
        fechaPago: true,
      },
    })

    // Agrupar en JS por mes (1 query en vez de 12)
    const mesesMap = new Map<number, { total: number; capital: number; interes: number; mora: number; numPagos: number }>()
    for (let m = 1; m <= 12; m++) mesesMap.set(m, { total: 0, capital: 0, interes: 0, mora: 0, numPagos: 0 })
    for (const p of pagosAgrupadosRaw) {
      if (!p.fechaPago) continue
      const mesNum = p.fechaPago.getMonth() + 1
      const agg = mesesMap.get(mesNum)!
      agg.total += p.montoTotal
      agg.capital += p.montoCapital
      agg.interes += p.montoInteres
      agg.mora += p.montoMora
      agg.numPagos += 1
    }
    const reporteAnual: any[] = []
    for (let m = 1; m <= 12; m++) {
      const fechaMes = new Date(anioReporte, m - 1, 1)
      const agg = mesesMap.get(m)!
      reporteAnual.push({
        mes: fechaMes.toLocaleString('es-CO', { month: 'short' }),
        mesNumero: m,
        total: agg.total,
        capital: agg.capital,
        interes: agg.interes,
        mora: agg.mora,
        numPagos: agg.numPagos,
      })
    }

    // Variación porcentual
    const variacionDiaria = totalAyer > 0
      ? ((totalHoy - totalAyer) / totalAyer) * 100
      : totalHoy > 0 ? 100 : 0
    const variacionMensual = totalMesAnterior > 0
      ? ((totalMesActual - totalMesAnterior) / totalMesAnterior) * 100
      : totalMesActual > 0 ? 100 : 0

    // Top clientes que más pagaron hoy
    const topClientesHoy = pagosHoy
      .reduce((acc: any[], p) => {
        const clienteId = p.prestamo.cliente.id
        const existing = acc.find((a) => a.clienteId === clienteId)
        if (existing) {
          existing.total += p.montoTotal
          existing.pagos += 1
        } else {
          acc.push({
            clienteId,
            nombre: p.prestamo.cliente.nombre,
            cedula: p.prestamo.cliente.cedula,
            total: p.montoTotal,
            pagos: 1,
          })
        }
        return acc
      }, [])
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Métodos de pago usados hoy
    const metodosHoy = pagosHoy.reduce((acc: any, p) => {
      acc[p.metodoPago] = (acc[p.metodoPago] || 0) + p.montoTotal
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        periodo: {
          tipo: periodo,
          etiqueta: etiquetaPeriodo,
          inicio: inicioPeriodo.toISOString(),
          fin: finPeriodo.toISOString(),
        },
        // === Resumen del periodo seleccionado ===
        resumenPeriodo: {
          totalRecaudado: totalPeriodo,
          capitalRecaudado: capitalRecaudadoPeriodo,
          interesRecaudado: interesRecaudadoPeriodo,
          moraRecaudada: moraRecaudadaPeriodo,
          numPagos: pagosPeriodo.length,
        },
        // === Capital e intereses programados vs recaudados ===
        proyeccion: {
          capitalProgramado,
          capitalRecaudado: capitalRecaudadoPeriodo,
          capitalPendiente: Math.max(0, capitalProgramado - capitalRecaudadoPeriodo),
          interesProgramado,
          interesRecaudado: interesRecaudadoPeriodo,
          interesPendiente: Math.max(0, interesProgramado - interesRecaudadoPeriodo),
          moraAcumulada: moraTotalAcumulada,
          moraRecaudada: moraRecaudadaPeriodo,
          moraPendiente: Math.max(0, moraTotalAcumulada - moraRecaudadaPeriodo),
        },
        // === Listado de morosos ===
        morosos: morosos.sort((a, b) => b.diasMora - a.diasMora),
        // === Reporte anual (12 meses) ===
        reporteAnual,
        // === Comparativos (siempre presentes) ===
        comparativoDiario: {
          hoy: { fecha: hoy.toISOString(), total: totalHoy, numPagos: pagosHoy.length, promedio: pagosHoy.length > 0 ? totalHoy / pagosHoy.length : 0 },
          ayer: { fecha: ayer.toISOString(), total: totalAyer, numPagos: pagosAyer.length, promedio: pagosAyer.length > 0 ? totalAyer / pagosAyer.length : 0 },
          variacion: variacionDiaria,
        },
        comparativoMensual: {
          mesActual: { mes: inicioMesActual.toLocaleString('es-CO', { month: 'long', year: 'numeric' }), total: totalMesActual, numPagos: pagosMesActual.length },
          mesAnterior: { mes: inicioMesAnterior.toLocaleString('es-CO', { month: 'long', year: 'numeric' }), total: totalMesAnterior, numPagos: pagosMesAnterior.length },
          variacion: variacionMensual,
        },
        cartera: {
          prestamosActivos: prestamosActivosCount,
          prestamosEnMora: prestamosEnMoraCount,
          saldoTotalActivos: saldoTotalActivos._sum.saldoTotal || 0,
          tasaMora: prestamosActivosCount + prestamosEnMoraCount > 0 ? (prestamosEnMoraCount / (prestamosActivosCount + prestamosEnMoraCount)) * 100 : 0,
        },
        topClientesHoy,
        metodosHoy,
      },
    })
  } catch (error: any) {
    console.error('[informe pagos] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

