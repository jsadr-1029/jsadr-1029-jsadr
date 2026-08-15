import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString, toNumber } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/declaraciones/[id]?empresaId=...
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

    const declaracion = await db.contDeclaracion.findFirst({ where })
    if (!declaracion) {
      return NextResponse.json(
        { success: false, error: 'Declaración no encontrada.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: declaracion })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// PATCH /api/portal-contador/declaraciones/[id]
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
    const existe = await db.contDeclaracion.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Declaración no encontrada.' },
        { status: 404 }
      )
    }

    const data: any = {}
    if (body.estado !== undefined) {
      const e = sanitizeString(body.estado, 20)
      if (['BORRADOR', 'EN_REVISION', 'APROBADA', 'PRESENTADA', 'ARCHIVADA'].includes(e || '')) {
        data.estado = e
        if (e === 'PRESENTADA') {
          data.fechaPresentacion = new Date()
          data.presentadaPor = user.nombre
        }
      }
    }
    if (body.valorAPagar !== undefined) data.valorAPagar = toNumber(body.valorAPagar, 0)
    if (body.valorPagado !== undefined) data.valorPagado = toNumber(body.valorPagado, 0)
    if (body.fechaVencimiento !== undefined) {
      data.fechaVencimiento = body.fechaVencimiento ? new Date(body.fechaVencimiento) : null
    }
    if (body.observaciones !== undefined) {
      data.observaciones = sanitizeString(body.observaciones, 1000) || null
    }

    const actualizado = await db.contDeclaracion.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// DELETE /api/portal-contador/declaraciones/[id]
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
    const existe = await db.contDeclaracion.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Declaración no encontrada.' },
        { status: 404 }
      )
    }
    if (existe.estado === 'PRESENTADA') {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar una declaración PRESENTADA.' },
        { status: 400 }
      )
    }

    await db.contDeclaracion.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Declaración eliminada.' })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
