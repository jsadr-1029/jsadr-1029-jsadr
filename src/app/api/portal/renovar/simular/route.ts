import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, generarCronograma } from '@/lib/finance'

// =====================================================
// POST /api/portal/renovar/simular
// Body:
//   { token: string, prestamoId: string, montoSolicitado: number,
//     plazoMeses: number, frecuencia?: 'MENSUAL'|'QUINCENAL'|'SEMANAL' }
//
// Lógica:
//   1. Validar sesión del cliente (token).
//   2. Buscar préstamo por ID, verificar que pertenece al cliente y está ACTIVO/EN_MORA.
//   3. Calcular saldo pendiente del préstamo actual:
//      - Sumar cuotas PENDIENTES (no pagadas) con sus valores a fecha actual.
//      - Incluir mora si aplica (en_mora).
//   4. Calcular excedente:
//      excedente = montoSolicitado - saldoPendiente
//      Si excedente <= 0 → error "El monto solicitado debe ser mayor al saldo pendiente".
//   5. Generar cronograma del nuevo préstamo por montoSolicitado.
//   6. Devolver proyección completa con disclaimer "sujeto a estudio".
//
// Respuesta:
//   {
//     success: true,
//     simulacion: {
//       prestamoActual: { codigo, saldoPendiente, cuotasPendientes: [...] },
//       nuevoMonto: number,
//       excedente: number,
//       nuevoCronograma: [...],
//       disclaimer: 'Sujeto a estudio'
//     }
//   }
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, prestamoId, montoSolicitado, plazoMeses, frecuencia } = body

    // 1. Validar sesión
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }
    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json({ success: false, error: 'Sesión expirada' }, { status: 401 })
    }

    // 2. Validar parámetros
    if (!prestamoId) {
      return NextResponse.json({ success: false, error: 'prestamoId es requerido' }, { status: 400 })
    }
    const montoNum = Number(montoSolicitado)
    const plazoNum = Number(plazoMeses)
    const frec = (frecuencia || 'MENSUAL') as 'MENSUAL' | 'QUINCENAL' | 'SEMANAL'
    if (!montoNum || montoNum <= 0) {
      return NextResponse.json({ success: false, error: 'Monto inválido' }, { status: 400 })
    }
    if (!plazoNum || plazoNum <= 0) {
      return NextResponse.json({ success: false, error: 'Plazo inválido' }, { status: 400 })
    }

    // 3. Buscar préstamo
    const prestamo = await db.prestamo.findFirst({
      where: {
        id: prestamoId,
        clienteId: cliente.id,
        estado: { in: ['ACTIVO', 'EN_MORA'] },
      },
      include: {
        categoria: true,
        pagos: { orderBy: { numeroCuota: 'asc' } },
      },
    })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado o no elegible para renovación' },
        { status: 404 }
      )
    }

    // 4. Calcular saldo pendiente del préstamo actual
    // Cuotas PENDIENTES = las que NO están PAGADO
    const cuotasPendientes = (prestamo.pagos || []).filter(
      (p) => p.estado !== 'PAGADO' && p.estado !== 'ANULADO'
    )
    const saldoPendiente = cuotasPendientes.reduce((s, p) => s + Number(p.montoTotal), 0)

    // Incluir mora: si el préstamo está en mora, sumar el monto de mora calculado
    // (para simplificación usamos montoMora de cada pago si existe, sino solo montoTotal)
    const moraTotal = cuotasPendientes.reduce((s, p) => s + (Number(p.montoMora) || 0), 0)
    const saldoTotalConMora = saldoPendiente + moraTotal

    if (saldoTotalConMora <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'El préstamo no tiene cuotas pendientes. No es elegible para renovación.',
          codigo: 'SIN_CUOTAS_PENDIENTES',
        },
        { status: 400 }
      )
    }

    // 5. Calcular excedente
    const excedente = montoNum - saldoTotalConMora
    if (excedente <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) debe ser mayor al saldo pendiente actual (${saldoTotalConMora.toLocaleString('es-CO')}).`,
          codigo: 'MONTO_INSUFICIENTE',
          saldoPendiente: saldoTotalConMora,
          montoSolicitado: montoNum,
        },
        { status: 400 }
      )
    }

    // 6. Generar cronograma del nuevo préstamo
    const tasaAnual = Number(prestamo.categoria?.tasaInteresAnual) || 240
    const tasaMensual = tasaAnual / 12

    const calc = calcularPrestamo({
      monto: montoNum,
      tasaMensual,
      plazoMeses: plazoNum,
      frecuencia: frec,
    })
    const nuevoCronograma = generarCronograma({
      monto: montoNum,
      tasaMensual,
      plazoMeses: plazoNum,
      frecuencia: frec,
    })

    // 7. Detalle de cuotas pendientes para mostrar al cliente
    const detalleCuotasPendientes = cuotasPendientes.map((p) => ({
      numero: p.numeroCuota,
      fechaVencimiento: p.fechaVencimiento,
      montoTotal: Number(p.montoTotal),
      mora: Number(p.montoMora) || 0,
      estado: p.estado,
    }))

    // 8. Cronograma nuevo con fechas formateadas
    const nuevoCronogramaFormateado = nuevoCronograma.map((c) => ({
      numero: c.numero,
      fechaVencimiento: c.fechaVencimiento,
      capital: Number(c.capital),
      interes: Number(c.interes),
      montoTotal: Number(c.montoTotal),
      saldoCapital: Number(c.saldoCapital),
    }))

    return NextResponse.json({
      success: true,
      simulacion: {
        prestamoActual: {
          id: prestamo.id,
          codigo: prestamo.codigo,
          estado: prestamo.estado,
          saldoPendiente,
          moraTotal,
          saldoTotalConMora,
          cuotasPendientes: detalleCuotasPendientes,
          cantidadCuotasPendientes: cuotasPendientes.length,
        },
        nuevoPrestamo: {
          montoSolicitado: montoNum,
          plazoMeses: plazoNum,
          frecuencia: frec,
          tasaAnual,
          tasaMensual,
          cuotaFija: calc.montoCuota,
          totalInteres: calc.totalInteres,
          totalPagar: calc.totalPagar,
          numeroCuotas: calc.numeroCuotas,
          cronograma: nuevoCronogramaFormateado,
        },
        excedente,
        // El excedente es lo que se entrega al cliente después de pagar el saldo pendiente
        // del préstamo actual. Si es negativo, el cliente debe pagar de más (no aplica renovación).
        explicacion: `Se recogen ${cuotasPendientes.length} cuota(s) pendiente(s) por un total de ${saldoTotalConMora.toLocaleString('es-CO')} COP. Del monto solicitado (${montoNum.toLocaleString('es-CO')} COP), se descuenta el saldo pendiente y se te entrega como excedente ${excedente.toLocaleString('es-CO')} COP. El nuevo préstamo queda con ${calc.numeroCuotas} cuotas de ${calc.montoCuota.toLocaleString('es-CO')} COP cada una.`,
        disclaimer:
          'Esta es una simulación y propuesta de renovación. Queda sujeta a estudio y aprobación por parte del equipo de crédito. Los valores finales pueden variar según la categoría asignada y la verificación de tu historial de pagos.',
        sujetoAEstudio: true,
      },
    })
  } catch (e) {
    console.error('[/api/portal/renovar/simular] error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
