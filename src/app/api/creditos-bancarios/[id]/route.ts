import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// GET - obtener un crédito bancario
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const credito = await db.prestamoBancario.findUnique({ where: { id } })
    if (!credito) {
      return NextResponse.json({ success: false, error: 'Crédito no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: credito })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// PUT - actualizar crédito bancario (préstamo o tarjeta)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      nombre, banco, tipo, montoPrincipal, tasaAnual, plazoMeses, seguroMensual,
      fechaDesembolso, descripcion, estado,
      // Tarjeta
      cupoTotal, saldoUtilizado, diaCorte, diaPago, pagoMinimo, pagoTotalSin,
      fechaCorteActual, fechaPagoProximo,
    } = body

    // Calcular cupo disponible si es tarjeta
    let cupoDisponible: number | undefined
    if (cupoTotal !== undefined || saldoUtilizado !== undefined) {
      const cTotal = cupoTotal !== undefined ? parseFloat(cupoTotal) : 0
      const sUtil = saldoUtilizado !== undefined ? parseFloat(saldoUtilizado) : 0
      cupoDisponible = cTotal - sUtil
    }

    const credito = await db.prestamoBancario.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(banco !== undefined && { banco }),
        ...(tipo !== undefined && { tipo }),
        ...(montoPrincipal !== undefined && { montoPrincipal: parseFloat(montoPrincipal) }),
        ...(tasaAnual !== undefined && { tasaAnual: parseFloat(tasaAnual) }),
        ...(plazoMeses !== undefined && { plazoMeses: parseInt(plazoMeses) }),
        ...(seguroMensual !== undefined && { seguroMensual: parseFloat(seguroMensual) }),
        ...(fechaDesembolso !== undefined && { fechaDesembolso: new Date(fechaDesembolso) }),
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
        ...(estado !== undefined && { estado }),
        // Tarjeta
        ...(cupoTotal !== undefined && { cupoTotal: parseFloat(cupoTotal) }),
        ...(saldoUtilizado !== undefined && { saldoUtilizado: parseFloat(saldoUtilizado) }),
        ...(cupoDisponible !== undefined && { cupoDisponible }),
        ...(diaCorte !== undefined && { diaCorte: parseInt(diaCorte) }),
        ...(diaPago !== undefined && { diaPago: parseInt(diaPago) }),
        ...(pagoMinimo !== undefined && { pagoMinimo: parseFloat(pagoMinimo) }),
        ...(pagoTotalSin !== undefined && { pagoTotalSin: parseFloat(pagoTotalSin) }),
        ...(fechaCorteActual !== undefined && { fechaCorteActual: fechaCorteActual ? new Date(fechaCorteActual) : null }),
        ...(fechaPagoProximo !== undefined && { fechaPagoProximo: fechaPagoProximo ? new Date(fechaPagoProximo) : null }),
      },
    })

    return NextResponse.json({ success: true, data: credito })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// DELETE - eliminar crédito bancario
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.prestamoBancario.delete({ where: { id } })
    return NextResponse.json({ success: true, mensaje: 'Crédito eliminado' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
