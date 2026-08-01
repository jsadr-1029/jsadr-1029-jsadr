import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - listar audit logs con filtros
export async function GET(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede consultar audit logs
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const { searchParams } = new URL(req.url)
    const modulo = searchParams.get('modulo')
    const accion = searchParams.get('accion')
    const usuarioId = searchParams.get('usuarioId')
    const soloErrores = searchParams.get('errores') === 'true'
    const limite = parseInt(searchParams.get('limite') || '100')

    const where: any = {}
    if (modulo && modulo !== 'all') where.modulo = modulo
    if (accion && accion !== 'all') where.accion = accion
    if (usuarioId && usuarioId !== 'all') where.usuarioId = usuarioId
    if (soloErrores) where.exito = false

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: limite,
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
