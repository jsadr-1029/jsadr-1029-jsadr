// =====================================================
// /api/chat/conversaciones/[id] — Detalle y actualización
// GET   /api/chat/conversaciones/:id   → detalle con mensajes + notas
// PATCH /api/chat/conversaciones/:id   → cambiar estado / asesor / cerrar
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

// === GET — detalle completo ===
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // === Verificar si es una petición del portal del cliente ===
    const portalToken = req.headers.get('x-portal-token')
    let esPortal = false

    if (portalToken) {
      const cliente = await db.cliente.findFirst({
        where: { tokenSesion: portalToken, tokenExpira: { gt: new Date() } },
        select: { id: true },
      })
      if (cliente) {
        esPortal = true
      }
    }

    if (!esPortal) {
      const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
      if (auth instanceof NextResponse) return auth
    }

    const { id } = await params

    const conversacion = await db.conversacionChat.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            direccion: true,
            ciudad: true,
            activo: true,
            prestamos: {
              select: {
                id: true,
                codigo: true,
                montoPrincipal: true,
                saldoTotal: true,
                estado: true,
              },
              take: 20,
            },
          },
        },
        asesor: {
          select: { id: true, nombre: true, username: true },
        },
        mensajes: {
          orderBy: { fechaEnvio: 'asc' },
          take: 500,
        },
        notasInternas: {
          include: {
            autor: { select: { id: true, nombre: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!conversacion) {
      return NextResponse.json(
        { success: false, error: 'Conversación no encontrada' },
        { status: 404 }
      )
    }

    // Marcar como leídos los mensajes del cliente que aún no lo estén
    await db.mensajeChat.updateMany({
      where: {
        conversacionId: id,
        remitenteTipo: 'CLIENTE',
        estado: { not: 'LEIDO' },
      },
      data: {
        estado: 'LEIDO',
        fechaLeido: new Date(),
        fechaEntregado: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: conversacion })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === PATCH — actualizar conversación ===
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await req.json()
    const {
      estado,
      asesorId,
      asunto,
      motivoCierre,
      permiteArchivos,
      permiteNotasInternas,
      otpVerificado,
      otpSessionId,
      resumenIA,
    } = body

    const existente = await db.conversacionChat.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Conversación no encontrada' },
        { status: 404 }
      )
    }

    const datos: Record<string, unknown> = {}
    if (estado) datos.estado = estado
    if (asesorId !== undefined) datos.asesorId = asesorId || null
    if (asunto !== undefined) datos.asunto = asunto
    if (motivoCierre !== undefined) datos.motivoCierre = motivoCierre || null
    if (permiteArchivos !== undefined) datos.permiteArchivos = !!permiteArchivos
    if (permiteNotasInternas !== undefined) datos.permiteNotasInternas = !!permiteNotasInternas
    if (otpVerificado !== undefined) datos.otpVerificado = !!otpVerificado
    if (otpSessionId !== undefined) datos.otpSessionId = otpSessionId || null
    if (resumenIA !== undefined) datos.resumenIA = resumenIA || null

    // Cerrar conversación
    if (estado === 'FINALIZADA' || estado === 'ARCHIVADA') {
      datos.fechaCierre = new Date()
      if (motivoCierre) datos.motivoCierre = motivoCierre
    }

    // Reabrir
    if (estado === 'ACTIVA' && existente.estado !== 'ACTIVA') {
      datos.fechaCierre = null
      datos.motivoCierre = null
    }

    const conversacion = await db.conversacionChat.update({
      where: { id },
      data: datos,
      include: {
        cliente: {
          select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
        },
        asesor: { select: { id: true, nombre: true, username: true } },
      },
    })

    // Si se cierra, agregar mensaje de sistema
    if ((estado === 'FINALIZADA' || estado === 'ARCHIVADA') && existente.estado !== estado) {
      await db.mensajeChat.create({
        data: {
          conversacionId: id,
          remitenteTipo: 'SISTEMA',
          remitenteNombre: 'Sistema',
          contenido:
            estado === 'FINALIZADA'
              ? `Conversación finalizada${motivoCierre ? `: ${motivoCierre}` : ''}.`
              : `Conversación archivada${motivoCierre ? `: ${motivoCierre}` : ''}.`,
          tipoMensaje: 'SISTEMA',
          estado: 'LEIDO',
          fechaEntregado: new Date(),
          fechaLeido: new Date(),
        },
      })
    }

    await registrarAuditLog({
      usuarioId: auth.id !== 'system' ? auth.id : null,
      usuarioNombre: auth.nombre,
      accion: 'CHAT_CONVERSACION_ACTUALIZADA',
      modulo: 'centro_comunicaciones',
      entidadId: id,
      entidadNombre: existente.codigo,
      detalles: JSON.stringify({ cambios: datos }),
      exito: true,
    })

    return NextResponse.json({ success: true, data: conversacion })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
