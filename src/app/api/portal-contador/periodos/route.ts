import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, requireEmpresaId, sanitizeString, toInt } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/periodos?empresaId=...&anio=...
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const empresaId = requireEmpresaId(req)
    if (empresaId instanceof NextResponse) return empresaId

    const { searchParams } = new URL(req.url)
    const anio = searchParams.get('anio')

    const where: any = { empresaId: empresaId as string }
    if (anio) where.anio = toInt(anio, 0)

    const periodos = await db.contPeriodo.findMany({
      where,
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
      include: { _count: { select: { comprobantes: true } } },
    })

    return NextResponse.json({ success: true, data: periodos })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// POST /api/portal-contador/periodos
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const empresaId = requireEmpresaId(req, body)
    if (empresaId instanceof NextResponse) return empresaId

    const anio = toInt(body.anio, 0)
    const mes = toInt(body.mes, -1)
    if (anio < 2000 || anio > 2100) {
      return NextResponse.json(
        { success: false, error: 'anio inválido.' },
        { status: 400 }
      )
    }
    if (mes < 0 || mes > 12) {
      return NextResponse.json(
        { success: false, error: 'mes inválido (0-12).' },
        { status: 400 }
      )
    }

    // Unicidad empresa + anio + mes
    const existe = await db.contPeriodo.findUnique({
      where: {
        empresaId_anio_mes: { empresaId: empresaId as string, anio, mes },
      },
    })
    if (existe) {
      return NextResponse.json(
        { success: false, error: `Ya existe el período ${anio}-${String(mes).padStart(2, '0')}.` },
        { status: 409 }
      )
    }

    const estado = sanitizeString(body.estado, 20) || 'ABIERTO'
    const periodo = await db.contPeriodo.create({
      data: {
        empresaId: empresaId as string,
        anio,
        mes,
        estado,
      },
    })

    return NextResponse.json({ success: true, data: periodo }, { status: 201 })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
