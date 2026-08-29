import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { enviarWhatsApp } from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'

// POST /api/notificaciones/[id]/enviar
// Reenvía una notificación fallida o pendiente_manual.
//
// v4.12 (QA M09 TC-NOT-009):
//  - findUnique primero (valida existencia → 404 si no existe)
//  - Solo reenvía si estado ∈ {FALLIDO, PENDIENTE_MANUAL} → 400 si ya está ENVIADO
//  - Intenta reenvío real (WhatsApp Cloud API → wa.me fallback → Email si procede)
//  - Actualiza estado según resultado
//  - Registra AuditLog
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    // 1. Buscar la notificación
    const notif = await db.notificacionLog.findUnique({
      where: { id },
      include: { prestamo: { include: { cliente: true } } },
    })

    if (!notif) {
      return NextResponse.json(
        { success: false, error: 'NOTIFICACION_NO_ENCONTRADA' },
        { status: 404 }
      )
    }

    // 2. Validar estado: solo se reenvían fallidas o pendientes manuales
    const estadosReenviables = ['FALLIDO', 'PENDIENTE_MANUAL']
    if (!estadosReenviables.includes(notif.estado)) {
      return NextResponse.json(
        {
          success: false,
          error: `ESTADO_NO_REENVIABLE: estado actual=${notif.estado}. Solo se reenvían notificaciones en estado FALLIDO o PENDIENTE_MANUAL.`,
        },
        { status: 400 }
      )
    }

    // 3. Intentar reenvío real
    let envioExitoso = false
    let canalUsado: string | null = null
    let wamid: string | null = null
    let errorMessage: string | null = null

    // 3a. Intentar WhatsApp si hay teléfono
    if (notif.clienteTelefono) {
      const resultado = await enviarWhatsApp(notif.clienteTelefono, notif.mensaje)
      if (resultado.exito) {
        envioExitoso = true
        canalUsado = resultado.canal || 'WHATSAPP'
        wamid = resultado.wamid || null
      } else {
        errorMessage = resultado.error || 'WhatsApp falló'
      }
    }

    // 3b. Fallback a Email si WhatsApp falló y el cliente tiene email
    if (!envioExitoso && notif.prestamo?.cliente?.email) {
      try {
        const asunto = notif.tipo === 'MORA'
          ? `⚠️ Aviso de mora - Solicitud ${notif.prestamo.codigo}`
          : `⏰ Recordatorio de pago - Solicitud ${notif.prestamo.codigo}`

        const emailResult = await enviarEmail({
          to: notif.prestamo.cliente.email,
          subject: asunto,
          text: notif.mensaje,
          html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${notif.mensaje.replace(/</g, '&lt;')}</pre>`,
        })

        if (emailResult.success) {
          envioExitoso = true
          canalUsado = 'EMAIL'
        } else {
          errorMessage = `Email fallback: ${emailResult.error}`
        }
      } catch (emailErr: any) {
        errorMessage = `Email fallback exception: ${emailErr?.message}`
      }
    }

    // 4. Actualizar estado según resultado
    const updated = await db.notificacionLog.update({
      where: { id },
      data: {
        estado: envioExitoso ? 'ENVIADO' : 'FALLIDO',
        canal: canalUsado,
        wamid: wamid,
        error: envioExitoso ? null : errorMessage,
        fechaEnvio: new Date(),
      },
    })

    // 5. Audit log
    await db.auditLog.create({
      data: {
        usuarioNombre: 'Gestor',
        accion: envioExitoso ? 'NOTIFICACION_REENVIADA' : 'NOTIFICACION_REENVIO_FALLIDO',
        modulo: 'notificaciones',
        entidadId: notif.prestamoId || id,
        entidadNombre: notif.clienteTelefono,
        detalles: JSON.stringify({
          tipo: notif.tipo,
          estadoPrevio: notif.estado,
          estadoNuevo: updated.estado,
          canal: canalUsado,
          wamid: wamid,
        }),
        fecha: new Date(),
      },
    })

    return NextResponse.json({
      success: envioExitoso,
      notif: updated,
      canal: canalUsado,
      wamid: wamid,
    }, { status: envioExitoso ? 200 : 500 })
  } catch (e) {
    console.error('[notificaciones/[id]/enviar] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
