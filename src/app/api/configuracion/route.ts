import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede consultar configuración global
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const configs = await db.configuracion.findMany({
    orderBy: { clave: 'asc' },
  })
  return NextResponse.json({ configuraciones: configs })
}

export async function POST(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede modificar configuración global
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const { clave, valor, descripcion } = body

    const existing = await db.configuracion.findUnique({ where: { clave } })
    let config
    if (existing) {
      config = await db.configuracion.update({
        where: { clave },
        data: { valor, descripcion: descripcion || existing.descripcion },
      })
    } else {
      config = await db.configuracion.create({
        data: { clave, valor, descripcion: descripcion || null },
      })
    }
    return NextResponse.json(config, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
