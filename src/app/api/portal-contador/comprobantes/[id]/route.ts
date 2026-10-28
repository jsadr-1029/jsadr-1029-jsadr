import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/comprobantes/[id]?empresaId=...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get('empresaId')

    const where: any = { id }
    if (empresaId) where.empresaId = empresaId

    const comprobante = await db.contComprobante.findFirst({
      where,
      include: {
        asientos: {
          include: { cuenta: true },
          orderBy: { createdAt: 'asc' },
        },
        periodo: true,
      },
    })
    if (!comprobante) {
      return NextResponse.json(
        { success: false, error: 'Comprobante no encontrado.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: comprobante })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// PATCH /api/portal-contador/comprobantes/[id]
// Permite cambiar estado (BORRADOR → APROBADO / ANULADO) y concepto.
// No permite editar asientos ni montos de un comprobante APROBADO.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth
    const user = auth as any

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const empresaId = body.empresaId

    const where: any = { id }
    if (empresaId) where.empresaId = empresaId
    const comprobante = await db.contComprobante.findFirst({ where })
    if (!comprobante) {
      return NextResponse.json(
        { success: false, error: 'Comprobante no encontrado.' },
        { status: 404 }
      )
    }

    const data: any = {}
    if (body.concepto !== undefined) {
      const c = sanitizeString(body.concepto, 300)
      if (c) data.concepto = c
    }
    if (body.descripcion !== undefined) {
      data.descripcion = sanitizeString(body.descripcion, 500) || null
    }
    if (body.estado !== undefined) {
      const nuevoEstado = sanitizeString(body.estado, 20)
      if (!['BORRADOR', 'APROBADO', 'ANULADO'].includes(nuevoEstado || '')) {
        return NextResponse.json(
          { success: false, error: 'estado inválido.' },
          { status: 400 }
        )
      }
      // No permitir aprobar un comprobante descuadrado
      if (nuevoEstado === 'APROBADO') {
        const diff = Math.abs(comprobante.totalDebitos - comprobante.totalCreditos)
        if (diff > 0.01) {
          return NextResponse.json(
            { success: false, error: 'No se puede aprobar un comprobante descuadrado.' },
            { status: 400 }
          )
        }
        data.estado = 'APROBADO'
        data.aprobadoPorId = user.id
        data.aprobadoPorNombre = user.nombre
      } else if (nuevoEstado === 'ANULADO') {
        data.estado = 'ANULADO'
      } else {
        data.estado = 'BORRADOR'
      }
    }

    const actualizado = await db.contComprobante.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// DELETE /api/portal-contador/comprobantes/[id]
// Solo permite eliminar comprobantes en BORRADOR. Revierte saldos de cuentas.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get('empresaId')

    const where: any = { id }
    if (empresaId) where.empresaId = empresaId
    const comprobante = await db.contComprobante.findFirst({
      where,
      include: { asientos: true },
    })
    if (!comprobante) {
      return NextResponse.json(
        { success: false, error: 'Comprobante no encontrado.' },
        { status: 404 }
      )
    }
    if (comprobante.estado !== 'BORRADOR') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden eliminar comprobantes en estado BORRADOR. Anúlelo en su lugar.' },
        { status: 400 }
      )
    }

    await db.$transaction(async (tx) => {
      // Revertir saldos de cuentas
      for (const a of comprobante.asientos) {
        const cuenta = await tx.contCuentaPUC.findUnique({ where: { id: a.cuentaId } })
        if (cuenta) {
          const nuevoSaldo =
            cuenta.naturaleza === 'DEBITO'
              ? cuenta.saldo - a.debito + a.credito
              : cuenta.saldo - a.credito + a.debito
          await tx.contCuentaPUC.update({
            where: { id: a.cuentaId },
            data: { saldo: nuevoSaldo },
          })
        }
      }
      await tx.contAsiento.deleteMany({ where: { comprobanteId: id } })
      await tx.contComprobante.delete({ where: { id } })
    })

    return NextResponse.json({ success: true, message: 'Comprobante eliminado.' })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
