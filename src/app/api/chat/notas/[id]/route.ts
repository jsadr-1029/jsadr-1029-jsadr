// =====================================================
// /api/chat/notas/[id] — Elimina una nota interna
// DELETE /api/chat/notas/:id
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

// === DELETE — eliminar nota ===
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const nota = await db.notaInterna.findUnique({
      where: { id },
      select: { id: true, conversacionId: true, autorId: true, contenido: true },
    })
    if (!nota) {
      return NextResponse.json(
        { success: false, error: 'Nota no encontrada' },
        { status: 404 }
      )
    }

    // Solo el autor o un admin puede borrarla
    if (nota.autorId !== auth.id && auth.rol !== 'ADMIN' && auth.id !== 'system') {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para eliminar esta nota', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    await db.notaInterna.delete({ where: { id } })

    await registrarAuditLog({
      usuarioId: auth.id !== 'system' ? auth.id : null,
      usuarioNombre: auth.nombre,
      accion: 'CHAT_NOTA_ELIMINADA',
      modulo: 'centro_comunicaciones',
      entidadId: nota.conversacionId,
      detalles: JSON.stringify({ notaId: id }),
      exito: true,
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
