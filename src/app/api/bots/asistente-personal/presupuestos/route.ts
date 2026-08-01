// /api/bots/asistente-personal/presupuestos — CRUD presupuestos
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { crearPresupuesto } from '@/lib/asistente-personal'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const ambito = searchParams.get('ambito')

    const presupuestos = await db.presupuesto.findMany({
      where: ambito ? { ambito } : {},
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: presupuestos })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { nombre, ambito, montoLimite, categoriaId, periodo, alertaEnPorcentaje } = body

    if (!nombre || !ambito || !montoLimite) {
      return NextResponse.json(
        { success: false, error: 'nombre, ambito y montoLimite son obligatorios' },
        { status: 400 }
      )
    }

    const presupuesto = await crearPresupuesto({
      nombre,
      ambito,
      montoLimite: parseFloat(montoLimite),
      categoriaId,
      periodo: periodo || 'MENSUAL',
      alertaEnPorcentaje: alertaEnPorcentaje || 80,
      creadoPor: auth.nombre,
    })

    return NextResponse.json({ success: true, data: presupuesto })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
