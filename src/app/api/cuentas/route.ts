import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const cuentas = await db.cuentaRecaudo.findMany({
      include: { _count: { select: { categorias: true, pagos: true } } },
      orderBy: { codigo: 'asc' },
    })
    return NextResponse.json({ success: true, data: cuentas })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { codigo, nombre, banco, tipoCuenta, numeroCuenta, titular } = body

    if (!codigo || !nombre) {
      return NextResponse.json({ success: false, error: 'Código y nombre son obligatorios' }, { status: 400 })
    }

    const cuenta = await db.cuentaRecaudo.create({
      data: { codigo, nombre, banco, tipoCuenta, numeroCuenta, titular },
    })
    return NextResponse.json({ success: true, data: cuenta })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...datos } = body
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    const actualizado = await db.cuentaRecaudo.update({ where: { id }, data: datos })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
