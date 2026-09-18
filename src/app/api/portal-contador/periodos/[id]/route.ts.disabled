import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/periodos/[id]?empresaId=...
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

    const periodo = await db.contPeriodo.findFirst({
      where,
      include: { _count: { select: { comprobantes: true } } },
    })
    if (!periodo) {
      return NextResponse.json(
        { success: false, error: 'Período no encontrado.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: periodo })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// PATCH /api/portal-contador/periodos/[id]
// Permite cambiar estado directamente (utilidad administrativa).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const empresaId = body.empresaId

    const where: any = { id }
    if (empresaId) where.empresaId = empresaId
    const existe = await db.contPeriodo.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Período no encontrado.' },
        { status: 404 }
      )
    }

    const data: any = {}
    if (body.estado !== undefined) {
      const e = sanitizeString(body.estado, 20)
      if (['ABIERTO', 'EN_CIERRE', 'CERRADO', 'REABIERTO'].includes(e || '')) {
        data.estado = e
        if (e === 'CERRADO') {
          data.fechaCierre = new Date()
        }
      }
    }

    const actualizado = await db.contPeriodo.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// DELETE /api/portal-contador/periodos/[id]
// Solo se puede eliminar si no tiene comprobantes.
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
    const existe = await db.contPeriodo.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Período no encontrado.' },
        { status: 404 }
      )
    }

    const comprobantes = await db.contComprobante.count({ where: { periodoId: id } })
    if (comprobantes > 0) {
      return NextResponse.json(
        { success: false, error: `No se puede eliminar: el período tiene ${comprobantes} comprobante(s).` },
        { status: 400 }
      )
    }

    await db.contPeriodo.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Período eliminado.' })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
