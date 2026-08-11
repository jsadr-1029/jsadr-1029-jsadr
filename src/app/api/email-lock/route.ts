import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import {
  enableEmailConfigLock,
  disableEmailConfigLock,
  verifyEmailConfigIntegrity,
  restoreEmailConfigFromSnapshot,
  getEmailLockStatus,
  EmailConfigLockError,
} from '@/lib/email-config-lock'

// GET — Estado del bloqueo (cualquier rol autenticado puede consultar)
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR', 'ABOGADO'])
    if (authResult instanceof NextResponse) return authResult

    const status = await getEmailLockStatus()
    return NextResponse.json({ success: true, data: status })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 },
    )
  }
}

// POST — Acciones sobre el bloqueo (solo ADMIN)
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { accion, reason, usuarioId, usuarioNombre } = body
    const clientInfo = getClientInfo(req)

    if (!accion) {
      return NextResponse.json(
        { success: false, error: 'Se requiere "accion": enable | disable | verify | restore' },
        { status: 400 },
      )
    }

    // Determinar nombre del usuario que ejecuta la acción
    const actorName = usuarioNombre || 'Admin'

    switch (accion) {
      case 'enable': {
        const result = await enableEmailConfigLock({
          usuarioId: usuarioId || null,
          usuarioNombre: actorName,
          reason: reason || 'Activación manual',
        })
        return NextResponse.json({ success: result.success, message: result.message, data: { snapshotAt: result.snapshotAt } })
      }

      case 'disable': {
        if (!reason || reason.trim().length < 10) {
          return NextResponse.json(
            {
              success: false,
              error: 'Se requiere un "reason" de al menos 10 caracteres para desactivar el bloqueo.',
            },
            { status: 400 },
          )
        }
        const result = await disableEmailConfigLock({
          usuarioId: usuarioId || null,
          usuarioNombre: actorName,
          reason,
        })
        return NextResponse.json({ success: result.success, message: result.message })
      }

      case 'verify': {
        const report = await verifyEmailConfigIntegrity()
        await registrarAuditLog({
          usuarioId: usuarioId || null,
          usuarioNombre: actorName,
          accion: 'EMAIL_CONFIG_LOCK_VERIFY',
          modulo: 'email-lock',
          detalles: JSON.stringify({
            driftDetected: report.driftDetected,
            driftCount: report.driftDetails.length,
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        })
        return NextResponse.json({ success: true, data: report })
      }

      case 'restore': {
        const result = await restoreEmailConfigFromSnapshot({
          usuarioId: usuarioId || null,
          usuarioNombre: actorName,
        })
        return NextResponse.json({ success: result.success, message: result.message, data: result.details })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acción no válida: ${accion}. Usa: enable | disable | verify | restore` },
          { status: 400 },
        )
    }
  } catch (error: any) {
    if (error instanceof EmailConfigLockError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode },
      )
    }
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 },
    )
  }
}
