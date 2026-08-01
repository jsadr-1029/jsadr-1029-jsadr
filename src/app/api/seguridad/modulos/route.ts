import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede gestionar módulos de seguridad
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const modulos = await db.seguridadModulo.findMany({ orderBy: { moduloKey: 'asc' } })
  return NextResponse.json({ modulos })
}

export async function POST(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede modificar módulos de seguridad
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const { moduloKey, moduloNombre, protegido } = body
    const existing = await db.seguridadModulo.findUnique({ where: { moduloKey } })
    if (existing) {
      const updated = await db.seguridadModulo.update({
        where: { moduloKey },
        data: { protegido: protegido ?? existing.protegido, moduloNombre: moduloNombre || existing.moduloNombre },
      })
      return NextResponse.json(updated)
    }
    const modulo = await db.seguridadModulo.create({
      data: { moduloKey, moduloNombre, protegido: protegido ?? false },
    })
    return NextResponse.json(modulo, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
