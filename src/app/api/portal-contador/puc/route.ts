import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, requireEmpresaId, sanitizeString, toNumber } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/puc?empresaId=...&q=...
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const empresaId = requireEmpresaId(req)
    if (empresaId instanceof NextResponse) return empresaId

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || undefined
    const tipo = searchParams.get('tipo') || undefined
    const estado = searchParams.get('estado') || undefined

    const where: any = { empresaId: empresaId as string }
    if (tipo) where.tipo = tipo
    if (estado) where.estado = estado
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nombre: { contains: q, mode: 'insensitive' } },
      ]
    }

    const cuentas = await db.contCuentaPUC.findMany({
      where,
      orderBy: [{ codigo: 'asc' }],
      take: 1000,
    })

    return NextResponse.json({ success: true, data: cuentas })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// POST /api/portal-contador/puc
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const empresaId = requireEmpresaId(req, body)
    if (empresaId instanceof NextResponse) return empresaId

    const codigo = sanitizeString(body.codigo, 20)
    const nombre = sanitizeString(body.nombre, 200)
    const naturaleza = sanitizeString(body.naturaleza, 10)
    const tipo = sanitizeString(body.tipo, 20)

    if (!codigo || !nombre || !naturaleza || !tipo) {
      return NextResponse.json(
        { success: false, error: 'codigo, nombre, naturaleza y tipo son obligatorios.' },
        { status: 400 }
      )
    }
    if (naturaleza !== 'DEBITO' && naturaleza !== 'CREDITO') {
      return NextResponse.json(
        { success: false, error: 'naturaleza debe ser DEBITO o CREDITO.' },
        { status: 400 }
      )
    }

    // Unicidad empresa + codigo
    const existe = await db.contCuentaPUC.findUnique({
      where: {
        empresaId_codigo: { empresaId: empresaId as string, codigo },
      },
    })
    if (existe) {
      return NextResponse.json(
        { success: false, error: `Ya existe la cuenta ${codigo}.` },
        { status: 409 }
      )
    }

    // Validar cuenta padre (si viene)
    let cuentaPadreId: string | null = null
    if (body.cuentaPadreId) {
      const padre = await db.contCuentaPUC.findFirst({
        where: { id: body.cuentaPadreId, empresaId: empresaId as string },
      })
      if (!padre) {
        return NextResponse.json(
          { success: false, error: 'La cuenta padre no existe en esta empresa.' },
          { status: 400 }
        )
      }
      cuentaPadreId = padre.id
    }

    const cuenta = await db.contCuentaPUC.create({
      data: {
        empresaId: empresaId as string,
        codigo,
        nombre,
        naturaleza,
        tipo,
        cuentaPadreId,
        terceroRequerido: !!body.terceroRequerido,
        centroCostoRequerido: !!body.centroCostoRequerido,
        tratamientoTributario: sanitizeString(body.tratamientoTributario, 100) || null,
        estadoFinanciero: sanitizeString(body.estadoFinanciero, 20) || null,
        estado: sanitizeString(body.estado, 20) || 'ACTIVA',
        saldo: toNumber(body.saldo, 0),
      },
    })

    return NextResponse.json({ success: true, data: cuenta }, { status: 201 })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
