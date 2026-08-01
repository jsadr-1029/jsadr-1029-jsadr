import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - listar cajas menores con movimientos (Reforzado: requiere CONSULTOR+)
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth
    const cajas = await db.cajaMenor.findMany({
      include: {
        movimientos: {
          orderBy: { fechaMovimiento: 'desc' },
          take: 50,
        },
        _count: { select: { movimientos: true } },
      },
      orderBy: { codigo: 'asc' },
    })
    return NextResponse.json({ success: true, data: cajas })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - registrar movimiento de caja (ingreso/egreso manual)
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { cajaId, tipo, monto, concepto, referencia, prestamoId, creadoPor } = body

    if (!cajaId || !tipo || !monto || !concepto) {
      return NextResponse.json(
        { success: false, error: 'cajaId, tipo, monto y concepto son obligatorios' },
        { status: 400 }
      )
    }

    const caja = await db.cajaMenor.findUnique({ where: { id: cajaId } })
    if (!caja) {
      return NextResponse.json({ success: false, error: 'Caja no encontrada' }, { status: 404 })
    }

    const montoNum = parseFloat(monto)
    if (tipo === 'EGRESO' && montoNum > caja.saldoActual) {
      return NextResponse.json(
        { success: false, error: 'Saldo insuficiente en la caja' },
        { status: 400 }
      )
    }

    // Crear movimiento
    const movimiento = await db.movimientoCaja.create({
      data: {
        cajaId,
        tipo,
        monto: montoNum,
        concepto,
        referencia: referencia || null,
        prestamoId: prestamoId || null,
        creadoPor: creadoPor || 'Sistema',
      },
    })

    // Actualizar saldo
    const incremento = tipo === 'INGRESO' ? montoNum : -montoNum
    await db.cajaMenor.update({
      where: { id: cajaId },
      data: {
        saldoActual: { increment: incremento },
        totalIngresos: tipo === 'INGRESO' ? { increment: montoNum } : undefined,
        totalEgresos: tipo === 'EGRESO' ? { increment: montoNum } : undefined,
      },
    })

    return NextResponse.json({ success: true, data: movimiento })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
