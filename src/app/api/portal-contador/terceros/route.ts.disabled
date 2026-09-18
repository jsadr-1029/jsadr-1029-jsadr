import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, requireEmpresaId, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/terceros?empresaId=...&q=...&tipoTercero=...
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const empresaId = requireEmpresaId(req)
    if (empresaId instanceof NextResponse) return empresaId

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || undefined
    const tipoTercero = searchParams.get('tipoTercero') || undefined
    const tipoDocumento = searchParams.get('tipoDocumento') || undefined

    const where: any = { empresaId: empresaId as string }
    if (tipoTercero) where.tipoTercero = tipoTercero
    if (tipoDocumento) where.tipoDocumento = tipoDocumento
    if (q) {
      where.OR = [
        { nombres: { contains: q, mode: 'insensitive' } },
        { apellidos: { contains: q, mode: 'insensitive' } },
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { numeroDocumento: { contains: q, mode: 'insensitive' } },
      ]
    }

    const terceros = await db.contTercero.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    return NextResponse.json({ success: true, data: terceros })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// POST /api/portal-contador/terceros
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const empresaId = requireEmpresaId(req, body)
    if (empresaId instanceof NextResponse) return empresaId

    const tipoDocumento = sanitizeString(body.tipoDocumento, 10)
    const numeroDocumento = sanitizeString(body.numeroDocumento, 30)
    const tipoTercero = sanitizeString(body.tipoTercero, 30)

    if (!tipoDocumento || !numeroDocumento || !tipoTercero) {
      return NextResponse.json(
        { success: false, error: 'tipoDocumento, numeroDocumento y tipoTercero son obligatorios.' },
        { status: 400 }
      )
    }

    // Unicidad por empresa + documento
    const existe = await db.contTercero.findUnique({
      where: {
        empresaId_tipoDocumento_numeroDocumento: {
          empresaId: empresaId as string,
          tipoDocumento,
          numeroDocumento,
        },
      },
    })
    if (existe) {
      return NextResponse.json(
        { success: false, error: `Ya existe un tercero con ${tipoDocumento} ${numeroDocumento}.` },
        { status: 409 }
      )
    }

    const tercero = await db.contTercero.create({
      data: {
        empresaId: empresaId as string,
        tipoDocumento,
        numeroDocumento,
        tipoTercero,
        nombres: sanitizeString(body.nombres, 100) || null,
        apellidos: sanitizeString(body.apellidos, 100) || null,
        razonSocial: sanitizeString(body.razonSocial, 200) || null,
        direccion: sanitizeString(body.direccion, 200) || null,
        telefono: sanitizeString(body.telefono, 50) || null,
        email: sanitizeString(body.email, 150) || null,
        municipio: sanitizeString(body.municipio, 100) || null,
        departamento: sanitizeString(body.departamento, 100) || null,
        activo: typeof body.activo === 'boolean' ? body.activo : true,
      },
    })

    return NextResponse.json({ success: true, data: tercero }, { status: 201 })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
