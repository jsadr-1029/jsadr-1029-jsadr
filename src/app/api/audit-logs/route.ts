import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede consultar audit logs
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')
  const modulo = searchParams.get('modulo') || ''
  const accion = searchParams.get('accion') || ''

  const where: any = {}
  if (modulo) where.modulo = modulo
  if (accion) where.accion = { contains: accion }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
