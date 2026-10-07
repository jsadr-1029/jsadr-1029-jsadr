import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/seguridad/bloqueos — listar cédulas bloqueadas
// POST /api/seguridad/bloqueos — bloquear cédula
// DELETE /api/seguridad/bloqueos?id=... — desbloquear

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth
    const bloqueos = await db.variableGlobal.findMany({
      where: { categoria: 'bloqueo_usuario' },
      orderBy: { createdAt: 'desc' },
    })
    const data = bloqueos.map((b) => ({
      id: b.id,
      cedula: b.clave.replace('BLOQUEO_', ''),
      motivo: b.valor,
      createdAt: b.createdAt,
    }))
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json({ success: false, error: sanitizeError(e).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth
    const body = await req.json()
    const { cedula, motivo } = body
    if (!cedula) return NextResponse.json({ success: false, error: 'Cédula requerida' }, { status: 400 })

    const existe = await db.variableGlobal.findUnique({ where: { clave: `BLOQUEO_${cedula}` } })
    if (existe) return NextResponse.json({ success: false, error: 'Esta cédula ya está bloqueada' }, { status: 400 })

    await db.variableGlobal.create({
      data: {
        clave: `BLOQUEO_${cedula}`,
        valor: motivo || 'Bloqueo manual',
        tipo: 'string',
        categoria: 'bloqueo_usuario',
        descripcion: `Cédula bloqueada del portal del cliente`,
        editable: true,
      },
    })
    return NextResponse.json({ success: true, mensaje: `Cédula ${cedula} bloqueada` })
  } catch (e) {
    return NextResponse.json({ success: false, error: sanitizeError(e).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    await db.variableGlobal.delete({ where: { id } })
    return NextResponse.json({ success: true, mensaje: 'Usuario desbloqueado' })
  } catch (e) {
    return NextResponse.json({ success: false, error: sanitizeError(e).message }, { status: 500 })
  }
}
