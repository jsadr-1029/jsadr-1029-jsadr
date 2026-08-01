import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const [total, movimientos] = await Promise.all([
    db.movimientoCaja.count({ where: { cajaId: id } }),
    db.movimientoCaja.findMany({
      where: { cajaId: id },
      include: { prestamo: { include: { cliente: true } } },
      orderBy: { fechaMovimiento: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    movimientos: movimientos.map((m) => ({
      ...m,
      monto: Number(m.monto),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const { tipo, monto, concepto, referencia, prestamoId } = body
    const montoNum = Number(monto)

    const caja = await db.cajaMenor.findUnique({ where: { id } })
    if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })

    const movimiento = await db.movimientoCaja.create({
      data: {
        cajaId: id,
        tipo: tipo || 'INGRESO',
        monto: montoNum,
        concepto,
        referencia: referencia || null,
        prestamoId: prestamoId || null,
        fechaMovimiento: new Date(),
      },
    })

    // Actualizar saldo de la caja
    if (tipo === 'EGRESO') {
      await db.cajaMenor.update({
        where: { id },
        data: {
          saldoActual: { decrement: montoNum },
          totalEgresos: { increment: montoNum },
        },
      })
    } else {
      await db.cajaMenor.update({
        where: { id },
        data: {
          saldoActual: { increment: montoNum },
          totalIngresos: { increment: montoNum },
        },
      })
    }

    return NextResponse.json({ ...movimiento, monto: Number(movimiento.monto) }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
