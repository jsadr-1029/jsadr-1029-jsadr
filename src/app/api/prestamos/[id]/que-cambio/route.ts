import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// GET /api/prestamos/[id]/que-cambio
// =====================================================
// Compara el comportamiento de pagos ACTUAL del crédito contra el
// comportamiento ANTERIOR y devuelve una lista de "Cambios detectados".
//
// Definición de "actual" vs "anterior":
//   - Actual: últimos 30 días (o desde la última cuota pagada).
//   - Anterior: los 30 días previos (o el promedio histórico antes del último pago).
//
// Cambios que detecta:
//   🔴 El último pago fue significativamente menor al promedio (>= 25% menor).
//   🟠 El cliente está pagando más tarde que antes (promedio de días de atraso aumentó).
//   🟢 El saldo disminuye según lo esperado (ritmo de pago saludable).
//   🟡 El ritmo de pago disminuyó (menos pagos aplicados en el período actual vs anterior).
//   ⚫ El cliente entró en mora recientemente.
//   🔵 El cliente ha mejorado su puntualidad.
//   ⚪ Sin cambios significativos.
//
// El botón "¿QUÉ CAMBIÓ?" en PrestamosView abre un modal que muestra
// estos hallazgos sin que el gestor tenga que revisar manualmente el
// historial completo.

type CambioDetectado = {
  severidad: 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'azul' | 'neutro'
  emoji: string
  titulo: string
  descripcion: string
  // Métricas de soporte (para mostrar contexto al gestor)
  valorActual?: string
  valorAnterior?: string
  diferencia?: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params

    // === Cargar el solicitud ===
    const prestamo = await db.prestamo.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        estado: true,
        montoPrincipal: true,
        montoCuota: true,
        numeroCuotas: true,
        cuotasPagadas: true,
        saldoTotal: true,
        montoPagado: true,
        montoMora: true,
        diasMora: true,
        fechaDesembolso: true,
        fechaVencimiento: true,
        frecuencia: true,
        updatedAt: true,
      },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrado' },
        { status: 404 }
      )
    }

    // === Cargar pagos APLICADO de este solicitud, ordenados por fecha ===
    const pagos = await db.pago.findMany({
      where: {
        prestamoId: id,
        estado: 'APLICADO',
        fechaPago: { not: null },
      },
      select: {
        id: true,
        numeroCuota: true,
        montoTotal: true,
        montoCapital: true,
        montoInteres: true,
        montoMora: true,
        fechaPago: true,
        fechaVencimiento: true,
        metodoPago: true,
      },
      orderBy: { fechaPago: 'asc' },
    })

    // === Definir períodos: actual = últimos 30 días, anterior = 30 días previos ===
    const ahora = new Date()
    const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)
    const hace60 = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Pagos del período ACTUAL (últimos 30 días)
    const pagosActuales = pagos.filter((p) => new Date(p.fechaPago!) >= hace30)
    // Pagos del período ANTERIOR (30 días previos a los últimos 30)
    const pagosAnteriores = pagos.filter((p) => {
      const f = new Date(p.fechaPago!)
      return f < hace30 && f >= hace60
    })

    // === Métricas período ACTUAL ===
    const montoActual = pagosActuales.reduce((s, p) => s + (p.montoTotal || 0), 0)
    const numPagosActual = pagosActuales.length
    const promedioMontoActual = numPagosActual > 0 ? montoActual / numPagosActual : 0
    const promedioDiasAtrasoActual = pagosActuales.length > 0
      ? pagosActuales.reduce((s, p) => {
          const diff = new Date(p.fechaPago!).getTime() - new Date(p.fechaVencimiento).getTime()
          return s + Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
        }, 0) / pagosActuales.length
      : 0

    // === Métricas período ANTERIOR ===
    const montoAnterior = pagosAnteriores.reduce((s, p) => s + (p.montoTotal || 0), 0)
    const numPagosAnterior = pagosAnteriores.length
    const promedioMontoAnterior = numPagosAnterior > 0 ? montoAnterior / numPagosAnterior : 0
    const promedioDiasAtrasoAnterior = pagosAnteriores.length > 0
      ? pagosAnteriores.reduce((s, p) => {
          const diff = new Date(p.fechaPago!).getTime() - new Date(p.fechaVencimiento).getTime()
          return s + Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
        }, 0) / pagosAnteriores.length
      : 0

    // === Promedio histórico (todos los pagos excepto el último) ===
    const ultimoPago = pagos.length > 0 ? pagos[pagos.length - 1] : null
    const pagosAntesDelUltimo = pagos.slice(0, -1)
    const promedioMontoHistorico = pagosAntesDelUltimo.length > 0
      ? pagosAntesDelUltimo.reduce((s, p) => s + (p.montoTotal || 0), 0) / pagosAntesDelUltimo.length
      : 0

    // === Detectar cambios ===
    const cambios: CambioDetectado[] = []

    // 1. 🔴 El último pago fue significativamente menor al promedio
    if (ultimoPago && promedioMontoHistorico > 0) {
      const ultimoMonto = ultimoPago.montoTotal || 0
      const ratio = ultimoMonto / promedioMontoHistorico
      if (ratio < 0.75) {
        const porcentajeMenor = Math.round((1 - ratio) * 100)
        cambios.push({
          severidad: 'rojo',
          emoji: '🔴',
          titulo: `El último pago fue ${porcentajeMenor}% menor al promedio`,
          descripcion: `El pago más reciente (${formatearMoneda(ultimoMonto)}) es significativamente menor que el promedio histórico del cliente (${formatearMoneda(promedioMontoHistorico)}).`,
          valorActual: formatearMoneda(ultimoMonto),
          valorAnterior: formatearMoneda(promedioMontoHistorico),
          diferencia: `-${porcentajeMenor}%`,
        })
      } else if (ratio > 1.25) {
        const porcentajeMayor = Math.round((ratio - 1) * 100)
        cambios.push({
          severidad: 'verde',
          emoji: '🟢',
          titulo: `El último pago fue ${porcentajeMayor}% mayor al promedio`,
          descripcion: `El pago más reciente (${formatearMoneda(ultimoMonto)}) supera el promedio histórico (${formatearMoneda(promedioMontoHistorico)}). El cliente podría estar anticipando cuotas.`,
          valorActual: formatearMoneda(ultimoMonto),
          valorAnterior: formatearMoneda(promedioMontoHistorico),
          diferencia: `+${porcentajeMayor}%`,
        })
      }
    }

    // 2. 🟠 El cliente está pagando más tarde que antes
    if (numPagosActual > 0 && numPagosAnterior > 0) {
      const diffDias = promedioDiasAtrasoActual - promedioDiasAtrasoAnterior
      if (diffDias >= 2) {
        cambios.push({
          severidad: 'naranja',
          emoji: '🟠',
          titulo: `El cliente está pagando ${Math.round(diffDias)} días más tarde que anteriormente`,
          descripcion: `Promedio de atraso en los últimos 30 días: ${Math.round(promedioDiasAtrasoActual)} días. Antes: ${Math.round(promedioDiasAtrasoAnterior)} días.`,
          valorActual: `${Math.round(promedioDiasAtrasoActual)} días`,
          valorAnterior: `${Math.round(promedioDiasAtrasoAnterior)} días`,
          diferencia: `+${Math.round(diffDias)} días`,
        })
      } else if (diffDias <= -2) {
        cambios.push({
          severidad: 'azul',
          emoji: '🔵',
          titulo: `El cliente mejoró su puntualidad (${Math.abs(Math.round(diffDias))} días menos de atraso)`,
          descripcion: `El cliente está pagando más puntual. Promedio de atraso actual: ${Math.round(promedioDiasAtrasoActual)} días. Antes: ${Math.round(promedioDiasAtrasoAnterior)} días.`,
          valorActual: `${Math.round(promedioDiasAtrasoActual)} días`,
          valorAnterior: `${Math.round(promedioDiasAtrasoAnterior)} días`,
          diferencia: `${Math.round(diffDias)} días`,
        })
      }
    }

    // 3. 🟢 El saldo disminuye según lo esperado (ritmo de pago saludable)
    if (prestamo.cuotasPagadas > 0 && prestamo.numeroCuotas > 0) {
      const progresoEsperado = prestamo.fechaDesembolso
        ? Math.min(1, (ahora.getTime() - new Date(prestamo.fechaDesembolso).getTime()) /
          (new Date(prestamo.fechaVencimiento || ahora).getTime() - new Date(prestamo.fechaDesembolso).getTime()))
        : 0
      const progresoReal = prestamo.cuotasPagadas / prestamo.numeroCuotas
      if (progresoReal >= progresoEsperado * 0.9 && prestamo.estado !== 'EN_MORA' && prestamo.estado !== 'JURIDICO') {
        cambios.push({
          severidad: 'verde',
          emoji: '🟢',
          titulo: 'El saldo disminuye según lo esperado',
          descripcion: `El cliente va ${prestamo.cuotasPagadas}/${prestamo.numeroCuotas} cuotas pagadas (${Math.round(progresoReal * 100)}%), lo cual coincide con el progreso esperado del ${Math.round(progresoEsperado * 100)}%.`,
          valorActual: `${prestamo.cuotasPagadas}/${prestamo.numeroCuotas} cuotas`,
          valorAnterior: `${Math.round(progresoEsperado * 100)}% esperado`,
          diferencia: 'En ritmo',
        })
      }
    }

    // 4. 🟡 El ritmo de pago disminuyó
    if (numPagosAnterior > 0 && numPagosActual < numPagosAnterior) {
      const reduccion = numPagosAnterior - numPagosActual
      const porcentajeReduccion = Math.round((reduccion / numPagosAnterior) * 100)
      cambios.push({
        severidad: 'amarillo',
        emoji: '🟡',
        titulo: `El ritmo de pago disminuyó durante los últimos 30 días`,
        descripcion: `En el período anterior se aplicaron ${numPagosAnterior} pagos. En los últimos 30 días solo ${numPagosActual}. Reducción del ${porcentajeReduccion}%.`,
        valorActual: `${numPagosActual} pagos`,
        valorAnterior: `${numPagosAnterior} pagos`,
        diferencia: `-${porcentajeReduccion}%`,
      })
    }

    // 5. ⚫ El cliente entró en mora recientemente
    if (prestamo.estado === 'EN_MORA' && prestamo.diasMora > 0) {
      const diasMora = prestamo.diasMora
      cambios.push({
        severidad: 'rojo',
        emoji: '⚫',
        titulo: `El cliente entró en mora — ${diasMora} días de atraso`,
        descripcion: `El crédito tiene ${diasMora} días de mora. Mora acumulada: ${formatearMoneda(prestamo.montoMora || 0)}. Se recomienda contactar al cliente para renegociar o aplicar un recordatorio de pago.`,
        valorActual: `${diasMora} días`,
        valorAnterior: '0 días',
        diferencia: `+${diasMora} días`,
      })
    }

    // 6. Si no hay cambios significativos
    if (cambios.length === 0) {
      cambios.push({
        severidad: 'neutro',
        emoji: '⚪',
        titulo: 'Sin cambios significativos en el comportamiento de pagos',
        descripcion: `El comportamiento actual del cliente es consistente con su historial previo. No se detectaron cambios relevantes en los últimos 30 días.`,
      })
    }

    // === Resumen ejecutivo ===
    const resumen = {
      totalCambios: cambios.length,
      hayAlertas: cambios.some((c) => c.severidad === 'rojo' || c.severidad === 'naranja'),
      hayMejoras: cambios.some((c) => c.severidad === 'verde' || c.severidad === 'azul'),
      mensaje: cambios.some((c) => c.severidad === 'rojo')
        ? '⚠️ Se detectaron alertas que requieren atención.'
        : cambios.some((c) => c.severidad === 'naranja')
          ? '🔍 Se detectaron cambios que vale la pena monitorear.'
          : cambios.some((c) => c.severidad === 'verde' || c.severidad === 'azul')
            ? '✅ El comportamiento del cliente es positivo.'
            : '✓ Comportamiento estable, sin cambios relevantes.',
    }

    return NextResponse.json({
      success: true,
      data: {
        prestamo: {
          id: prestamo.id,
          codigo: prestamo.codigo,
          estado: prestamo.estado,
        },
        periodos: {
          actual: { desde: hace30.toISOString(), hasta: ahora.toISOString() },
          anterior: { desde: hace60.toISOString(), hasta: hace30.toISOString() },
        },
        metricas: {
          actual: {
            numPagos: numPagosActual,
            montoTotal: montoActual,
            promedioMonto: promedioMontoActual,
            promedioDiasAtraso: promedioDiasAtrasoActual,
          },
          anterior: {
            numPagos: numPagosAnterior,
            montoTotal: montoAnterior,
            promedioMonto: promedioMontoAnterior,
            promedioDiasAtraso: promedioDiasAtrasoAnterior,
          },
        },
        cambios,
        resumen,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
