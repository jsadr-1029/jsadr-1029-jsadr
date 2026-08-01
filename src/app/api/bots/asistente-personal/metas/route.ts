// /api/bots/asistente-personal/metas — CRUD metas financieras
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { crearMeta } from '@/lib/asistente-personal'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const ambito = searchParams.get('ambito')

    const metas = await db.metaFinanciera.findMany({
      where: ambito ? { ambito } : {},
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: metas })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { nombre, tipo, ambito, montoObjetivo, fechaObjetivo, plazo, descripcion } = body

    if (!nombre || !ambito || !montoObjetivo) {
      return NextResponse.json(
        { success: false, error: 'nombre, ambito y montoObjetivo son obligatorios' },
        { status: 400 }
      )
    }

    const meta = await crearMeta({
      nombre,
      tipo: tipo || 'AHORRO',
      ambito,
      montoObjetivo: parseFloat(montoObjetivo),
      fechaObjetivo: fechaObjetivo ? new Date(fechaObjetivo) : undefined,
      plazo: plazo || 'MEDIANO',
      descripcion,
      creadoPor: auth.nombre,
    })

    return NextResponse.json({ success: true, data: meta })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
