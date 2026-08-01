import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { calcularPrestamo, formatearMoneda } from '@/lib/finanzas'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// /api/refinanciaciones v4.0 — OLA 3
// POST - crear propuesta de refinanciación
// GET  - listar propuestas
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const prestamoId = searchParams.get('prestamoId')
    const where: any = {}
    if (prestamoId) where.prestamoId = prestamoId

    const refinanciaciones = await db.refinanciacion.findMany({
      where,
      include: { prestamo: { include: { cliente: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: refinanciaciones })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const {
      prestamoId, tipo,
      nuevaTasaInteresAnual, nuevoPlazoMeses, nuevaFrecuencia,
      capitalizaMora, capitalizaInteres, observaciones,
    } = body

    if (!prestamoId || !tipo) {
      return NextResponse.json({ success: false, error: 'prestamoId y tipo son obligatorios' }, { status: 400 })
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true, pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } } },
    })
    if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })

    // === Snapshot del préstamo actual ===
    const saldoCapitalAntes = prestamo.saldoCapital
    const saldoInteresAntes = prestamo.saldoInteres
    const moraAntes = prestamo.montoMora
    const totalAntes = prestamo.saldoTotal

    // === Calcular nuevo monto principal ===
    let nuevoMontoPrincipal = saldoCapitalAntes
    if (capitalizaMora && moraAntes > 0) {
      nuevoMontoPrincipal += moraAntes
    }
    if (capitalizaInteres && saldoInteresAntes > 0) {
      nuevoMontoPrincipal += saldoInteresAntes
    }

    // === Calcular nueva tabla de amortización ===
    const nuevoCalculo = calcularPrestamo({
      montoPrincipal: nuevoMontoPrincipal,
      tasaInteresAnual: nuevaTasaInteresAnual || prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo),
      plazoMeses: nuevoPlazoMeses || prestamo.plazoMeses,
      frecuencia: (nuevaFrecuencia || prestamo.frecuencia) as any,
      fechaDesembolso: new Date(),
    })

    const ref = await db.refinanciacion.create({
      data: {
        prestamoId,
        tipo, // REFINANCIACION | REESTRUCTURACION | ACUERDO_PAGO
        estado: 'PENDIENTE',
        saldoCapitalAntes,
        saldoInteresAntes,
        moraAntes,
        totalAntes,
        nuevoMontoPrincipal,
        nuevaTasaInteresAnual: nuevaTasaInteresAnual || prestamo.tasaInteresAnual,
        nuevoPlazoMeses: nuevoPlazoMeses || prestamo.plazoMeses,
        nuevaFrecuencia: nuevaFrecuencia || prestamo.frecuencia,
        nuevasCuotas: nuevoCalculo.numeroCuotas,
        nuevoMontoCuota: nuevoCalculo.montoCuota,
        capitalizaMora: !!capitalizaMora,
        capitalizaInteres: !!capitalizaInteres,
        solicitadoPorId: user.id,
        observaciones: observaciones || null,
        nuevaTablaAmortizacion: JSON.stringify(nuevoCalculo.tablaAmortizacion),
      },
      include: { prestamo: { include: { cliente: true } } },
    })

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: user.id, usuarioNombre: user.nombre,
      accion: 'REFINANCIACION_CREADA', modulo: 'pagos',
      entidadId: ref.id, entidadNombre: `Refinanciación ${ref.id}`,
      detalles: JSON.stringify({
        prestamoId, tipo,
        totalAntes, nuevoMontoPrincipal,
        nuevasCuotas: nuevoCalculo.numeroCuotas,
        nuevoMontoCuota: nuevoCalculo.montoCuota,
      }),
      ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: ref,
      resumen: {
        totalAntes: formatearMoneda(totalAntes),
        nuevoMontoPrincipal: formatearMoneda(nuevoMontoPrincipal),
        nuevoMontoCuota: formatearMoneda(nuevoCalculo.montoCuota),
        nuevasCuotas: nuevoCalculo.numeroCuotas,
        nuevaTabla: nuevoCalculo.tablaAmortizacion,
        ahorroMora: capitalizaMora ? formatearMoneda(0) : formatearMoneda(moraAntes),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
