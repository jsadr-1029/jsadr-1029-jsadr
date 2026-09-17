import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

// POST /api/notificaciones/[id]/enviar
// Marca una notificación como ENVIADO (cuando el gestor confirma envío manual vía wa.me).
//
// Fixes aplicados:
//  - db.notificacion → db.notificacionLog (modelo correcto)
//  - db.auditLog ya existía, pero ajustamos los nombres de campos
//  - Añadido RBAC: solo ADMIN o GESTOR pueden marcar envío
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const notif = await db.notificacionLog.update({
      where: { id },
      data: {
        estado: 'ENVIADO',
        fechaEnvio: new Date(),
        error: null,
      },
    })

    // Audit log (campos correctos del modelo AuditLog)
    await db.auditLog.create({
      data: {
        usuarioNombre: 'Gestor',
        accion: 'NOTIFICACION_ENVIADA',
        modulo: 'notificaciones',
        entidadId: notif.prestamoId || id,
        entidadNombre: notif.clienteTelefono,
        detalles: JSON.stringify({ tipo: notif.tipo, estado: 'ENVIADO' }),
        fecha: new Date(),
      },
    })

    return NextResponse.json({ ok: true, notif })
  } catch (e) {
    console.error('[notificaciones/[id]/enviar] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
