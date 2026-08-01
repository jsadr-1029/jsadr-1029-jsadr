import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - configuración general del sistema (Reforzado: requiere CONSULTOR+)
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const configuraciones = await db.configuracion.findMany({ orderBy: { clave: 'asc' } })
    return NextResponse.json({ success: true, data: { configuraciones } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// PATCH - actualizar configuración (Reforzado: requiere ADMIN)
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { clave, valor } = body

    if (!clave || valor === undefined) {
      return NextResponse.json(
        { success: false, error: 'clave y valor son obligatorios' },
        { status: 400 }
      )
    }

    const actualizado = await db.configuracion.upsert({
      where: { clave },
      update: { valor: valor.toString() },
      create: { clave, valor: valor.toString() },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
