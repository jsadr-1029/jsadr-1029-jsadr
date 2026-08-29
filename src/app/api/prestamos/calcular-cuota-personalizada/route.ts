import { NextRequest, NextResponse } from 'next/server'
import { formatearMoneda, formatearFecha, Frecuencia } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// POST - calcular solicitud con cuota personalizada (modalidad "checa")
// El usuario define: monto, tasa mensual, número de cuotas, frecuencia, cuota manual
// El sistema calcula: intereses, distribución, total, tabla de amortización
export async function POST(req: NextRequest) {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const {
      montoPrincipal,
      tasaMensual,      // ej: 20 = 20% mensual
      numeroCuotas,     // ej: 2 (mensual) o 4 (quincenal)
      frecuencia,       // MENSUAL | QUINCENAL
      montoCuota,       // ej: 210000 (lo que el usuario quiere cobrar por cuota)
      fechaInicio,
    } = body

    const monto = parseFloat(montoPrincipal)
    const tasaMen = parseFloat(tasaMensual)
    const nCuotas = parseInt(numeroCuotas)
    const cuota = montoCuota ? parseFloat(montoCuota) : 0
    const inicio = fechaInicio ? new Date(fechaInicio) : new Date()

    if (!monto || !tasaMen || !nCuotas) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos: montoPrincipal, tasaMensual, numeroCuotas' },
        { status: 400 }
      )
    }

    // === CORRECCIÓN DEFINITIVA: La tasa es MENSUAL (capital × tasa% por cada mes de duración).
    // El número de cuotas NO afecta el interés. Solo afecta la duración en meses.
    //
    // Lógica:
    //   - 1 cuota mensual      = 1 mes  → interés = capital × tasa% × 1 mes
    //   - 1 cuota quincenal    = 0.5 mes → interés = capital × tasa% × 1 mes (mínimo 1 mes)
    //   - 2 cuotas mensuales   = 2 meses → interés = capital × tasa% × 2 meses
    //   - 2 cuotas quincenales = 1 mes  → interés = capital × tasa% × 1 mes
    //   - 4 cuotas quincenales = 2 meses → interés = capital × tasa% × 2 meses
    //
    // Ejemplo: 300.000 al 20% mensual
    //   - 1 cuota mensual: 300.000 + 60.000 = 360.000 → cuota = 360.000
    //   - 1 cuota quincenal: 300.000 + 60.000 = 360.000 → cuota = 360.000
    //   - 2 cuotas mensuales: 300.000 + 120.000 = 420.000 → cuota = 210.000
    //   - 2 cuotas quincenales: 300.000 + 60.000 = 360.000 → cuota = 180.000
    //   - 4 cuotas quincenales: 300.000 + 120.000 = 420.000 → cuota = 105.000
    // ============================================================================

    const tasaAnual = tasaMen * 12 // ej: 20% mensual = 240% anual

    // === Calcular duración en MESES según la frecuencia y número de cuotas ===
    let mesesDuracion = 1 // mínimo 1 mes (aunque sea 1 cuota quincenal)
    let cuotasPorMes = 1
    if (frecuencia === 'MENSUAL') {
      cuotasPorMes = 1
      mesesDuracion = nCuotas // cada cuota mensual = 1 mes
    } else if (frecuencia === 'QUINCENAL') {
      cuotasPorMes = 2
      mesesDuracion = Math.max(1, Math.ceil(nCuotas / 2)) // 2 quincenas = 1 mes
    } else if (frecuencia === 'SEMANAL') {
      cuotasPorMes = 4
      mesesDuracion = Math.max(1, Math.ceil(nCuotas / 4)) // 4 semanas = 1 mes
    } else if (frecuencia === 'DIARIO') {
      cuotasPorMes = 30
      mesesDuracion = Math.max(1, Math.ceil(nCuotas / 30)) // 30 días = 1 mes
    }

    // Interés TOTAL = capital × tasa% × meses de duración
    const interesTotalFijo = Math.round((monto * tasaMen / 100) * mesesDuracion * 100) / 100

    // Total a pagar = capital + interés total
    const totalAPagarCalculado = Math.round((monto + interesTotalFijo) * 100) / 100

    // Cuota constante sugerida = total a pagar / número de cuotas
    const cuotaSugerida = Math.round((totalAPagarCalculado / nCuotas) * 100) / 100

    // Si el usuario envió montoCuota, la usamos; si no, usamos la cuota sugerida
    const cuotaFinal = cuota > 0 ? cuota : cuotaSugerida

    // Interés por cuota (constante, dividido equitativamente)
    const interesPorCuota = Math.round((interesTotalFijo / nCuotas) * 100) / 100

    // Tabla de amortización
    const tabla: any[] = []
    let saldoCapital = monto
    let totalInteres = 0
    let totalCapital = 0
    let totalPagado = 0

    // Abono a capital constante por cuota
    const abonoCapitalCuota = Math.round((monto / nCuotas) * 100) / 100

    for (let i = 1; i <= nCuotas; i++) {
      let capital = abonoCapitalCuota
      let interes = interesPorCuota
      let cuotaEsta = cuotaFinal

      if (i === nCuotas) {
        // En la última cuota, ajustar para que el saldo quede en 0
        capital = Math.round(saldoCapital * 100) / 100
        // El interés de la última cuota se ajusta para que el total cuadre
        interes = Math.round((totalAPagarCalculado - totalCapital - totalInteres - capital) * 100) / 100
        if (interes < 0) interes = 0
        cuotaEsta = Math.round((capital + interes) * 100) / 100
      }

      saldoCapital = Math.round((saldoCapital - capital) * 100) / 100
      if (saldoCapital < 0) saldoCapital = 0

      totalInteres = Math.round((totalInteres + interes) * 100) / 100
      totalCapital = Math.round((totalCapital + capital) * 100) / 100
      totalPagado = Math.round((totalPagado + cuotaEsta) * 100) / 100

      // Calcular fecha de vencimiento
      const fechaVenc = new Date(inicio)
      if (frecuencia === 'MENSUAL') {
        fechaVenc.setMonth(fechaVenc.getMonth() + i)
      } else if (frecuencia === 'QUINCENAL') {
        fechaVenc.setDate(fechaVenc.getDate() + (15 * i))
      } else if (frecuencia === 'SEMANAL') {
        fechaVenc.setDate(fechaVenc.getDate() + (7 * i))
      } else if (frecuencia === 'DIARIO') {
        fechaVenc.setDate(fechaVenc.getDate() + i)
      }

      tabla.push({
        numero: i,
        fechaVencimiento: fechaVenc,
        montoCuota: cuotaEsta,
        capital,
        interes,
        saldoCapital,
        acumuladoInteres: totalInteres,
        acumuladoCapital: totalCapital,
      })
    }

    const totalPagar = Math.round((totalCapital + totalInteres) * 100) / 100

    return NextResponse.json({
      success: true,
      data: {
        montoPrincipal: monto,
        tasaMensual: tasaMen,
        tasaAnual,
        numeroCuotas: nCuotas,
        frecuencia,
        montoCuota: cuotaFinal,
        cuotaSugerida, // cuota calculada automáticamente (si el usuario no envió una)
        totalInteres,
        totalCapital,
        totalPagar,
        mesesDuracion,
        cuotasPorMes,
        interesPorCuota,
        interesTotalFijo,
        tablaAmortizacion: tabla,
        fechaVencimiento: tabla[tabla.length - 1]?.fechaVencimiento,
        tipoCalculo: 'CUOTA_PERSONALIZADA',
        resumen: {
          prestado: formatearMoneda(monto),
          cuotaFija: formatearMoneda(cuotaFinal),
          totalInteres: formatearMoneda(totalInteres),
          totalPagar: formatearMoneda(totalPagar),
          tasaMensual: `${tasaMen}%`,
          tasaAnual: `${tasaAnual}%`,
          nCuotas: `${nCuotas} cuotas ${frecuencia.toLowerCase()}es`,
          duracion: `${mesesDuracion} mese(s)`,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
