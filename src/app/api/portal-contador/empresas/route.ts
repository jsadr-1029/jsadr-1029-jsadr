import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/empresas
// Lista todas las empresas (con filtros opcionales ?activa=true&q=...)
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || undefined
    const soloActivas = searchParams.get('activa') === 'true'

    const where: any = {}
    if (soloActivas) where.activa = true
    if (q) {
      where.OR = [
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { nit: { contains: q, mode: 'insensitive' } },
      ]
    }

    const empresas = await db.contEmpresa.findMany({
      where,
      orderBy: { razonSocial: 'asc' },
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

    return NextResponse.json({ success: true, data: empresas })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// POST /api/portal-contador/empresas
// Crea una nueva empresa.
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))

    const razonSocial = sanitizeString(body.razonSocial, 200)
    const nit = sanitizeString(body.nit, 30)
    if (!razonSocial || !nit) {
      return NextResponse.json(
        { success: false, error: 'razonSocial y nit son obligatorios.' },
        { status: 400 }
      )
    }

    // Verificar NIT único
    const existe = await db.contEmpresa.findFirst({
      where: { nit: { equals: nit, mode: 'insensitive' } },
    })
    if (existe) {
      return NextResponse.json(
        { success: false, error: `Ya existe una empresa con NIT ${nit}.` },
        { status: 409 }
      )
    }

    const empresa = await db.contEmpresa.create({
      data: {
        razonSocial,
        nit,
        dv: sanitizeString(body.dv, 2) || null,
        tipoEmpresa: sanitizeString(body.tipoEmpresa, 50) || 'SOCIEDAD_LIMITADA',
        responsabilidades: sanitizeString(body.responsabilidades, 1000) || null,
        regimen: sanitizeString(body.regimen, 50) || null,
        ciiu: sanitizeString(body.ciiu, 20) || null,
        actividades: sanitizeString(body.actividades, 2000) || null,
        municipio: sanitizeString(body.municipio, 100) || null,
        departamento: sanitizeString(body.departamento, 100) || null,
        representanteLegal: sanitizeString(body.representanteLegal, 150) || null,
        contadorNombre: sanitizeString(body.contadorNombre, 150) || null,
        revisorFiscal: sanitizeString(body.revisorFiscal, 150) || null,
        marcoContable: sanitizeString(body.marcoContable, 50) || 'NIIF_PYMES',
        configuracionTributaria: sanitizeString(body.configuracionTributaria, 2000) || null,
        activa: typeof body.activa === 'boolean' ? body.activa : true,
      },
    })

    return NextResponse.json({ success: true, data: empresa }, { status: 201 })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
