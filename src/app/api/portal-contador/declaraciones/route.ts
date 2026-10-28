import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, requireEmpresaId, sanitizeString, toNumber, toInt } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/declaraciones?empresaId=...&tipo=...&anio=...
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const empresaId = requireEmpresaId(req)
    if (empresaId instanceof NextResponse) return empresaId

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') || undefined
    const anio = searchParams.get('anio')
    const estado = searchParams.get('estado') || undefined

    const where: any = { empresaId: empresaId as string }
    if (tipo) where.tipo = tipo
    if (estado) where.estado = estado
    if (anio) where.anio = toInt(anio, 0)

    const declaraciones = await db.contDeclaracion.findMany({
      where,
      orderBy: [{ anio: 'desc' }, { tipo: 'asc' }],
    })

    return NextResponse.json({ success: true, data: declaraciones })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// POST /api/portal-contador/declaraciones
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const empresaId = requireEmpresaId(req, body)
    if (empresaId instanceof NextResponse) return empresaId

    const tipo = sanitizeString(body.tipo, 20)
    const periodoFiscal = sanitizeString(body.periodoFiscal, 30)
    const anio = toInt(body.anio, 0)

    if (!tipo || !periodoFiscal || !anio) {
      return NextResponse.json(
        { success: false, error: 'tipo, periodoFiscal y anio son obligatorios.' },
        { status: 400 }
      )
    }
    if (!['RENTA', 'IVA', 'RETENCION', 'ICA', 'EXOGENA'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'tipo inválido.' },
        { status: 400 }
      )
    }

    const declaracion = await db.contDeclaracion.create({
      data: {
        empresaId: empresaId as string,
        tipo,
        periodoFiscal,
        anio,
        estado: sanitizeString(body.estado, 20) || 'BORRADOR',
        valorAPagar: toNumber(body.valorAPagar, 0),
        valorPagado: toNumber(body.valorPagado, 0),
        fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null,
        fechaPresentacion: body.fechaPresentacion ? new Date(body.fechaPresentacion) : null,
        presentadaPor: sanitizeString(body.presentadaPor, 150) || null,
        observaciones: sanitizeString(body.observaciones, 1000) || null,
      },
    })

    return NextResponse.json({ success: true, data: declaracion }, { status: 201 })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
