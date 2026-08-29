import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'

// GET - listar bitácoras (con filtros por solicitud)
// Requiere autenticación (cualquier rol interno: ADMIN, GESTOR, CONSULTOR)
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const prestamoId = searchParams.get('prestamoId')
    const prestamoCodigo = searchParams.get('prestamoCodigo')
    const tipo = searchParams.get('tipo')

    const where: any = {}
    if (prestamoId) where.prestamoId = prestamoId
    if (prestamoCodigo) where.prestamoCodigo = prestamoCodigo
    if (tipo && tipo !== 'all') where.tipo = tipo

    const bitacoras = await db.bitacoraPrestamo.findMany({
      where,
      include: {
        usuario: { select: { nombre: true, rol: true } },
      },
      orderBy: { fechaEvento: 'desc' },
      take: 200,
    })

    return NextResponse.json({ success: true, data: bitacoras })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - crear entrada de bitácora
// Solo ADMIN y GESTOR pueden crear entradas manualmente
// (los registros automáticos del sistema se hacen directamente con db.bitacoraPrestamo.create)
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { prestamoId, prestamoCodigo, usuarioId, usuarioNombre, tipo, titulo, descripcion, resultado } = body

    if (!prestamoId || !prestamoCodigo || !titulo || !descripcion) {
      return NextResponse.json(
        { success: false, error: 'prestamoId, prestamoCodigo, titulo y descripcion son obligatorios' },
        { status: 400 }
      )
    }

    const bitacora = await db.bitacoraPrestamo.create({
      data: {
        prestamoId,
        prestamoCodigo,
        usuarioId: usuarioId || (authResult as any)?.userId || null,
        usuarioNombre: usuarioNombre || (authResult as any)?.nombre || 'Sistema',
        tipo: tipo || 'NOTA',
        titulo,
        descripcion,
        resultado: resultado || null,
      },
      include: {
        usuario: { select: { nombre: true, rol: true } },
      },
    })

    return NextResponse.json({ success: true, data: bitacora })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// DELETE - eliminar entrada de bitácora
// Solo ADMIN puede eliminar (la bitácora es evidencia regulatoria — restricción estricta)
export async function DELETE(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    await db.bitacoraPrestamo.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
