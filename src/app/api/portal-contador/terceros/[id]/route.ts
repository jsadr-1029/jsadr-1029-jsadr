import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/terceros/[id]?empresaId=...
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

    const tercero = await db.contTercero.findFirst({ where })
    if (!tercero) {
      return NextResponse.json(
        { success: false, error: 'Tercero no encontrado.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: tercero })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// PATCH /api/portal-contador/terceros/[id]
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
    const existe = await db.contTercero.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Tercero no encontrado.' },
        { status: 404 }
      )
    }

    const data: any = {}
    const campos = [
      'nombres', 'apellidos', 'razonSocial', 'direccion', 'telefono',
      'email', 'municipio', 'departamento', 'tipoTercero',
    ]
    for (const c of campos) {
      if (body[c] !== undefined) {
        const v = sanitizeString(body[c], 200)
        data[c] = v === null ? null : v
      }
    }
    if (typeof body.activo === 'boolean') data.activo = body.activo

    // Si cambia documento, verificar unicidad dentro de la empresa
    if (body.tipoDocumento && body.numeroDocumento) {
      const td = sanitizeString(body.tipoDocumento, 10)
      const nd = sanitizeString(body.numeroDocumento, 30)
      if (td && nd) {
        const dup = await db.contTercero.findFirst({
          where: {
            empresaId: existe.empresaId,
            tipoDocumento: td,
            numeroDocumento: nd,
            NOT: { id },
          },
        })
        if (dup) {
          return NextResponse.json(
            { success: false, error: `Ya existe otro tercero con ${td} ${nd}.` },
            { status: 409 }
          )
        }
        data.tipoDocumento = td
        data.numeroDocumento = nd
      }
    }

    const actualizado = await db.contTercero.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// DELETE /api/portal-contador/terceros/[id]  (soft-delete)
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
    const existe = await db.contTercero.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Tercero no encontrado.' },
        { status: 404 }
      )
    }

    const actualizado = await db.contTercero.update({
      where: { id },
      data: { activo: false },
    })
    return NextResponse.json({
      success: true,
      data: actualizado,
      message: 'Tercero desactivado.',
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
