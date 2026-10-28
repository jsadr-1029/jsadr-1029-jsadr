import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/empresas/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const empresa = await db.contEmpresa.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            terceros: true,
            cuentas: true,
            comprobantes: true,
            periodos: true,
            declaraciones: true,
          },
        },
      },
    })

    if (!empresa) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: empresa })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// PATCH /api/portal-contador/empresas/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const existe = await db.contEmpresa.findUnique({ where: { id } })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada.' },
        { status: 404 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const data: any = {}

    const campos = [
      'razonSocial', 'dv', 'tipoEmpresa', 'responsabilidades', 'regimen',
      'ciiu', 'actividades', 'municipio', 'departamento', 'representanteLegal',
      'contadorNombre', 'revisorFiscal', 'marcoContable', 'configuracionTributaria',
    ]
    for (const c of campos) {
      if (body[c] !== undefined) {
        const v = sanitizeString(body[c], c === 'actividades' || c === 'configuracionTributaria' ? 2000 : 500)
        data[c] = v === null ? null : v
      }
    }
    if (body.nit !== undefined) {
      const nit = sanitizeString(body.nit, 30)
      if (nit) {
        // Verificar unicidad del NIT (excluyendo el actual)
        const dup = await db.contEmpresa.findFirst({
          where: { nit: { equals: nit, mode: 'insensitive' }, NOT: { id } },
        })
        if (dup) {
          return NextResponse.json(
            { success: false, error: `Ya existe otra empresa con NIT ${nit}.` },
            { status: 409 }
          )
        }
        data.nit = nit
      }
    }
    if (typeof body.activa === 'boolean') data.activa = body.activa

    const actualizada = await db.contEmpresa.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: actualizada })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// DELETE /api/portal-contador/empresas/[id]
// Soft-delete: marca activa=false. No elimina físicamente.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const existe = await db.contEmpresa.findUnique({ where: { id } })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada.' },
        { status: 404 }
      )
    }

    const actualizada = await db.contEmpresa.update({
      where: { id },
      data: { activa: false },
    })

    return NextResponse.json({
      success: true,
      data: actualizada,
      message: 'Empresa desactivada (soft-delete).',
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
