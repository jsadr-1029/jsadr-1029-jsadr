import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString, toNumber } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/puc/[id]?empresaId=...
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

    const cuenta = await db.contCuentaPUC.findFirst({
      where,
      include: { subcuentas: { orderBy: { codigo: 'asc' } } },
    })
    if (!cuenta) {
      return NextResponse.json(
        { success: false, error: 'Cuenta no encontrada.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: cuenta })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// PATCH /api/portal-contador/puc/[id]
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
    const existe = await db.contCuentaPUC.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Cuenta no encontrada.' },
        { status: 404 }
      )
    }

    const data: any = {}
    const camposSimples = ['nombre', 'tratamientoTributario', 'estadoFinanciero', 'estado']
    for (const c of camposSimples) {
      if (body[c] !== undefined) {
        const v = sanitizeString(body[c], 200)
        data[c] = v === null ? null : v
      }
    }
    if (body.naturaleza !== undefined) {
      const n = sanitizeString(body.naturaleza, 10)
      if (n === 'DEBITO' || n === 'CREDITO') data.naturaleza = n
    }
    if (typeof body.terceroRequerido === 'boolean') data.terceroRequerido = body.terceroRequerido
    if (typeof body.centroCostoRequerido === 'boolean') data.centroCostoRequerido = body.centroCostoRequerido
    if (body.saldo !== undefined) data.saldo = toNumber(body.saldo, 0)
    if (body.cuentaPadreId !== undefined) {
      if (body.cuentaPadreId === null) {
        data.cuentaPadreId = null
      } else {
        const padre = await db.contCuentaPUC.findFirst({
          where: { id: body.cuentaPadreId, empresaId: existe.empresaId, NOT: { id } },
        })
        if (!padre) {
          return NextResponse.json(
            { success: false, error: 'Cuenta padre inválida.' },
            { status: 400 }
          )
        }
        data.cuentaPadreId = padre.id
      }
    }

    const actualizada = await db.contCuentaPUC.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: actualizada })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// DELETE /api/portal-contador/puc/[id]  → marca estado=INACTIVA
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
    const existe = await db.contCuentaPUC.findFirst({ where })
    if (!existe) {
      return NextResponse.json(
        { success: false, error: 'Cuenta no encontrada.' },
        { status: 404 }
      )
    }

    // Verificar que no tenga asientos asociados
    const enUso = await db.contAsiento.count({ where: { cuentaId: id } })
    if (enUso > 0) {
      const actualizada = await db.contCuentaPUC.update({
        where: { id },
        data: { estado: 'INACTIVA' },
      })
      return NextResponse.json({
        success: true,
        data: actualizada,
        message: 'La cuenta tiene asientos asociados; se marcó como INACTIVA.',
      })
    }

    await db.contCuentaPUC.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Cuenta eliminada.' })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
