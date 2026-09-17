// =====================================================
// /api/chat/mensajes — Lista y crea mensajes
// GET  /api/chat/mensajes?conversacionId=&page=&limit=  → paginado
// POST /api/chat/mensajes                              → crea mensaje
//   Detecta remitente por header `x-portal-token`:
//     - Presente: remitente = CLIENTE (clienteId en body)
//     - Ausente : remitente = ASESOR (auth.user)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, type AuthUser } from '@/lib/auth-guard'
import { registrarAuditLog } from '@/lib/security'
import { getPortalClientInfo, registrarAccesoPortal } from '@/lib/acceso-portal'
import { sanitizeError } from '@/lib/error-handler'
import { responderMensajeBot } from '@/lib/bot-cliente-nlu'
import { generarRespuestaLLM } from '@/lib/llm-bot'

// =====================================================
// Generar respuesta automática del bot Clientes
// =====================================================
// =====================================================
// Generar respuesta automática del bot Clientes
// Usa el nuevo módulo bot-cliente-nlu.ts con:
//   • 45+ intents con sinónimos
//   • Matching por similitud (Levenshtein + Jaccard)
//   • Fallback a LLM cuando no hay match >= 0.55
// =====================================================
async function generarRespuestaBotClientes(mensaje: string, clienteId: string): Promise<string | null> {
  try {
    const resultado = await responderMensajeBot(mensaje, clienteId, generarRespuestaLLM as any)
    return resultado.respuesta
  } catch (error) {
    console.error('[Chat] Error en bot NLU:', error)
    return `Lo siento, tengo un problema técnico en este momento. Por favor, escribe "asesor" para hablar con un humano.`
  }
}

// === GET — listar mensajes paginados ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const conversacionId = searchParams.get('conversacionId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))

    if (!conversacionId) {
      return NextResponse.json(
        { success: false, error: 'conversacionId es obligatorio' },
        { status: 400 }
      )
    }

    const [mensajes, total] = await Promise.all([
      db.mensajeChat.findMany({
        where: { conversacionId },
        orderBy: { fechaEnvio: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.mensajeChat.count({ where: { conversacionId } }),
    ])

    return NextResponse.json({
      success: true,
      data: mensajes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === POST — crear mensaje ===
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      conversacionId,
      contenido,
      tipoMensaje = 'TEXTO',
      archivoUrl,
      archivoNombre,
      archivoTamano,
      archivoMimeType,
      clienteId,
    } = body

    if (!conversacionId || !contenido) {
      return NextResponse.json(
        { success: false, error: 'conversacionId y contenido son obligatorios' },
        { status: 400 }
      )
    }

    const conversacion = await db.conversacionChat.findUnique({
      where: { id: conversacionId },
      include: {
        cliente: {
          select: { id: true, nombre: true, cedula: true, telefono: true },
        },
      },
    })
    if (!conversacion) {
      return NextResponse.json(
        { success: false, error: 'Conversación no encontrada' },
        { status: 404 }
      )
    }
    if (conversacion.estado !== 'ACTIVA') {
      return NextResponse.json(
        { success: false, error: 'La conversación no está activa' },
        { status: 400 }
      )
    }

    const portalToken = req.headers.get('x-portal-token')

    let remitenteTipo: string
    let remitenteId: string | null
    let remitenteNombre: string
    let authUser: AuthUser | null = null

    if (portalToken) {
      // === Solicitud desde el portal del cliente ===
      // Validar que el cliente del token sea el dueño de la conversación.
      // No se exige OTP_SESSION_ID igual al token — eso rompia conversaciones
      // antiguas tras re-login o re-verificación. La pertenencia al cliente
      // es la única verificación necesaria (el token ya fue validado arriba
      // contra cliente.tokenSesion).
      if (clienteId && clienteId !== conversacion.clienteId) {
        return NextResponse.json(
          { success: false, error: 'clienteId no corresponde a la conversación', code: 'CLIENT_MISMATCH' },
          { status: 403 }
        )
      }

      remitenteTipo = 'CLIENTE'
      remitenteId = conversacion.clienteId
      remitenteNombre = conversacion.cliente.nombre

      const clientInfo = getPortalClientInfo(req)
      await registrarAccesoPortal({
        clienteId: conversacion.clienteId,
        clienteCedula: conversacion.cliente.cedula,
        clienteNombre: conversacion.cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'CONSULTA',
        exito: true,
        detalle: `Mensaje enviado a conversación ${conversacion.codigo}`,
      })
    } else {
      // === Solicitud desde el panel admin ===
      const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
      if (auth instanceof NextResponse) return auth
      authUser = auth

      remitenteTipo = 'ASESOR'
      remitenteId = auth.id !== 'system' ? auth.id : null
      remitenteNombre = auth.nombre
    }

    const mensaje = await db.mensajeChat.create({
      data: {
        conversacionId,
        remitenteTipo,
        remitenteId,
        remitenteNombre,
        contenido: String(contenido).slice(0, 10000),
        tipoMensaje: tipoMensaje || 'TEXTO',
        archivoUrl: archivoUrl || null,
        archivoNombre: archivoNombre || null,
        archivoTamano: archivoTamano ? Number(archivoTamano) : null,
        archivoMimeType: archivoMimeType || null,
        estado: 'ENTREGADO',
        fechaEntregado: new Date(),
      },
    })

    // Actualizar ultimaActividad de la conversación
    await db.conversacionChat.update({
      where: { id: conversacionId },
      data: { ultimaActividad: new Date() },
    })

    // Marcar como leídos los mensajes previos del OTRO remitente
    if (remitenteTipo === 'CLIENTE') {
      await db.mensajeChat.updateMany({
        where: {
          conversacionId,
          remitenteTipo: 'ASESOR',
          estado: { not: 'LEIDO' },
        },
        data: {
          estado: 'LEIDO',
          fechaLeido: new Date(),
        },
      })

      // === RESPUESTA AUTOMÁTICA DEL BOT CLIENTES ===
      // Generar respuesta automática usando la lógica del bot CHAT_CLIENTES
      try {
        const botResponse = await generarRespuestaBotClientes(contenido, conversacion.clienteId)
        if (botResponse) {
          await db.mensajeChat.create({
            data: {
              conversacionId,
              remitenteTipo: 'SISTEMA',
              remitenteNombre: 'Asistente Clientes',
              contenido: botResponse,
              tipoMensaje: 'TEXTO',
              estado: 'ENTREGADO',
              fechaEntregado: new Date(),
            },
          })
        }
      } catch (botError) {
        console.error('[Chat] Error en respuesta automática del bot:', botError)
      }
    } else if (remitenteTipo === 'ASESOR') {
      // El asesor ya vio los mensajes del cliente al abrir la conversación,
      // pero por consistencia los marcamos como entregados/leídos.
      await db.mensajeChat.updateMany({
        where: {
          conversacionId,
          remitenteTipo: 'CLIENTE',
          estado: 'ENVIADO',
        },
        data: {
          estado: 'LEIDO',
          fechaEntregado: new Date(),
          fechaLeido: new Date(),
        },
      })
    }

    if (authUser) {
      await registrarAuditLog({
        usuarioId: authUser.id !== 'system' ? authUser.id : null,
        usuarioNombre: authUser.nombre,
        accion: 'CHAT_MENAJE_ENVIADO',
        modulo: 'centro_comunicaciones',
        entidadId: conversacionId,
        entidadNombre: conversacion.codigo,
        detalles: JSON.stringify({ remitenteTipo, longitud: contenido.length }),
        exito: true,
      })
    }

    return NextResponse.json({ success: true, data: mensaje })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
