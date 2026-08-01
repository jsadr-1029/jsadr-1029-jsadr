// =====================================================
// /api/bots/config — Configuración del bot Clientes
// GET    → lista toda la configuración
// PATCH  → actualiza una clave de configuración (rol ADMIN)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

export async function GET() {
  try {
    const configs = await db.configBot.findMany()
    // Convertir a objeto { clave: valor }
    const result: Record<string, string> = {}
    configs.forEach((c) => { result[c.clave] = c.valor })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { clave, valor, descripcion } = body

    if (!clave || valor === undefined) {
      return NextResponse.json(
        { success: false, error: 'clave y valor son obligatorios' },
        { status: 400 }
      )
    }

    // Upsert: si existe la clave, actualiza; si no, crea
    const config = await db.configBot.upsert({
      where: { clave: String(clave) },
      update: {
        valor: String(valor),
        descripcion: descripcion || undefined,
        actualizadoPor: auth.nombre,
      },
      create: {
        clave: String(clave),
        valor: String(valor),
        descripcion: descripcion || null,
        actualizadoPor: auth.nombre,
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
