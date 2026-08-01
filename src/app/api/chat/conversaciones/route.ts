// =====================================================
// /api/chat/conversaciones — Lista y crea conversaciones
// GET  /api/chat/conversaciones            → lista con filtros
// POST /api/chat/conversaciones            → crea conversación con código único
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getAuthUser } from '@/lib/auth-guard'
import { registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

// === Genera código CHAT-YYYYMMDD-HHMMSS-XXXX ===
function generarCodigoConversacion(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = now.getFullYear()
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const hh = pad(now.getHours())
  const mi = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `CHAT-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${rand}`
}

// === GET — listar conversaciones con filtros ===
export async function GET(req: NextRequest) {
  try {
    // === Verificar si es una petición del portal del cliente ===
    const portalToken = req.headers.get('x-portal-token')
    let esPortal = false
    let clienteIdPortal = ''

    if (portalToken) {
      // Validar el token del portal
      const cliente = await db.cliente.findFirst({
        where: { tokenSesion: portalToken, tokenExpira: { gt: new Date() } },
        select: { id: true, nombre: true },
      })
      if (cliente) {
        esPortal = true
        clienteIdPortal = cliente.id
      }
    }

    if (!esPortal) {
      const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
      if (auth instanceof NextResponse) return auth
    }

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado') || ''
    const asesorId = searchParams.get('asesorId') || ''
    const clienteId = esPortal ? clienteIdPortal : (searchParams.get('clienteId') || '')
    const q = searchParams.get('q') || ''

    const where: Record<string, unknown> = {}
    if (estado && estado !== 'all') where.estado = estado
    if (asesorId) where.asesorId = asesorId
    if (clienteId) where.clienteId = clienteId
    if (q.trim()) {
      where.OR = [
        { codigo: { contains: q } },
        { asunto: { contains: q } },
        { cliente: { nombre: { contains: q } } },
        { cliente: { cedula: { contains: q } } },
      ]
    }

    const conversaciones = await db.conversacionChat.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
          },
        },
        asesor: {
          select: { id: true, nombre: true, username: true },
        },
        _count: {
          select: { mensajes: true, notasInternas: true },
        },
      },
      orderBy: { ultimaActividad: 'desc' },
      take: 200,
    })

    return NextResponse.json({ success: true, data: conversaciones })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === POST — crear conversación ===
export async function POST(req: NextRequest) {
  try {
    // === Verificar si es una petición del portal del cliente ===
    const portalToken = req.headers.get('x-portal-token')
    let esPortal = false
    let portalClienteId = ''

    if (portalToken) {
      const cliente = await db.cliente.findFirst({
        where: { tokenSesion: portalToken, tokenExpira: { gt: new Date() } },
        select: { id: true, nombre: true },
      })
      if (cliente) {
        esPortal = true
        portalClienteId = cliente.id
      }
    }

    let auth: any = null
    if (!esPortal) {
      const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
      if (authResult instanceof NextResponse) return authResult
      auth = authResult
    }

    const body = await req.json()
    const {
      clienteId,
      asunto,
      asesorId,
      moduloReferencia,
      entidadRefId,
      otpVerificado,
      otpSessionId,
      mensajeInicial,
    } = body

    // Si es portal, usar el clienteId del token
    const clienteIdFinal = esPortal ? portalClienteId : clienteId

    if (!clienteIdFinal) {
      return NextResponse.json(
        { success: false, error: 'clienteId es obligatorio' },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.findUnique({
      where: { id: clienteIdFinal },
      select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
    })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    const codigo = generarCodigoConversacion()

    // Asesor: si llega en el body úsalo; si es un asesor autenticado, úsalo a él.
    const asesorAsignado =
      asesorId || (auth && auth.rol !== 'CONSULTOR' && auth.id !== 'system' ? auth.id : null)

    const conversacion = await db.conversacionChat.create({
      data: {
        codigo,
        clienteId: clienteIdFinal,
        asesorId: asesorAsignado || null,
        asunto: asunto || 'Conversación general',
        moduloReferencia: moduloReferencia || null,
        entidadRefId: entidadRefId || null,
        otpVerificado: !!otpVerificado,
        otpSessionId: otpSessionId || null,
      },
      include: {
        cliente: {
          select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
        },
        asesor: { select: { id: true, nombre: true, username: true } },
      },
    })

    // Mensaje de sistema inicial
    await db.mensajeChat.create({
      data: {
        conversacionId: conversacion.id,
        remitenteTipo: 'SISTEMA',
        remitenteNombre: 'Sistema',
        contenido: mensajeInicial || `Conversación ${codigo} iniciada.`,
        tipoMensaje: 'SISTEMA',
        estado: 'LEIDO',
        fechaEntregado: new Date(),
        fechaLeido: new Date(),
      },
    })

    // Actualizar ultimaActividad
    await db.conversacionChat.update({
      where: { id: conversacion.id },
      data: { ultimaActividad: new Date() },
    })

    await registrarAuditLog({
      usuarioId: auth.id !== 'system' ? auth.id : null,
      usuarioNombre: auth.nombre,
      accion: 'CHAT_CONVERSACION_CREADA',
      modulo: 'centro_comunicaciones',
      entidadId: conversacion.id,
      entidadNombre: conversacion.codigo,
      detalles: JSON.stringify({ clienteId, asunto: conversacion.asunto }),
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
