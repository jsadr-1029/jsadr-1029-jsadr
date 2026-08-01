// =====================================================
// /api/chat/config — Configuración del módulo Centro de Comunicaciones
// GET   /api/chat/config                → lee parámetros
// PATCH /api/chat/config                → actualiza parámetros (solo admin)
//
// Los valores se guardan en la tabla Configuracion con claves prefijadas:
//   CHAT_INACTIVIDAD_MIN         (default 30)
//   CHAT_OTP_EXPIRA_MIN          (default 5)
//   CHAT_OTP_INTENTOS_MAX        (default 3)
//   CHAT_OTP_BLOQUEO_MIN         (default 15)
//   CHAT_CORREOS_HABILITADO      (default "true")
//   CHAT_CORREO_REMITENTE        (default "jsa@jsadr.com.co")
//   CHAT_MENSAJE_BIENVENIDA      (default "Bienvenido al Centro de ...")
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const DEFAULTS: Record<string, string> = {
  CHAT_INACTIVIDAD_MIN: '30',
  CHAT_OTP_EXPIRA_MIN: '5',
  CHAT_OTP_INTENTOS_MAX: '3',
  CHAT_OTP_BLOQUEO_MIN: '15',
  CHAT_CORREOS_HABILITADO: 'true',
  CHAT_CORREO_REMITENTE: 'jsa@jsadr.com.co',
  CHAT_MENSAJE_BIENVENIDA:
    'Bienvenido al Centro de Comunicaciones de Jsadr. Un asesor le atenderá en breve.',
}

const DESCRIPCIONES: Record<string, string> = {
  CHAT_INACTIVIDAD_MIN: 'Minutos de inactividad para cerrar conversación automáticamente',
  CHAT_OTP_EXPIRA_MIN: 'Minutos de expiración del código OTP (5 por defecto)',
  CHAT_OTP_INTENTOS_MAX: 'Intentos máximos antes de bloquear OTP (3 por defecto)',
  CHAT_OTP_BLOQUEO_MIN: 'Minutos de bloqueo tras exceder intentos OTP (15 por defecto)',
  CHAT_CORREOS_HABILITADO: 'Habilitar envío de correos desde el chat',
  CHAT_CORREO_REMITENTE: 'Correo remitente para notificaciones del chat',
  CHAT_MENSAJE_BIENVENIDA: 'Mensaje de bienvenida automático al iniciar conversación',
}

// === GET — leer configuración ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const registros = await db.configuracion.findMany({
      where: { clave: { startsWith: 'CHAT_' } },
    })

    const mapa: Record<string, string> = {}
    for (const r of registros) mapa[r.clave] = r.valor

    const config: Record<string, { valor: string; descripcion: string }> = {}
    for (const clave of Object.keys(DEFAULTS)) {
      config[clave] = {
        valor: mapa[clave] ?? DEFAULTS[clave],
        descripcion: DESCRIPCIONES[clave] || '',
      }
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === PATCH — actualizar configuración ===
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { valores } = body as { valores: Record<string, string> }

    if (!valores || typeof valores !== 'object') {
      return NextResponse.json(
        { success: false, error: 'valores (objeto) es obligatorio' },
        { status: 400 }
      )
    }

    const clavesPermitidas = Object.keys(DEFAULTS)
    const cambios: Record<string, string> = {}

    for (const [clave, valor] of Object.entries(valores)) {
      if (!clavesPermitidas.includes(clave)) continue
      const valorStr = String(valor)
      cambios[clave] = valorStr

      const existente = await db.configuracion.findUnique({ where: { clave } })
      if (existente) {
        await db.configuracion.update({
          where: { clave },
          data: { valor: valorStr },
        })
      } else {
        await db.configuracion.create({
          data: {
            clave,
            valor: valorStr,
            descripcion: DESCRIPCIONES[clave] || null,
          },
        })
      }
    }

    await registrarAuditLog({
      usuarioId: auth.id !== 'system' ? auth.id : null,
      usuarioNombre: auth.nombre,
      accion: 'CHAT_CONFIG_ACTUALIZADA',
      modulo: 'centro_comunicaciones',
      detalles: JSON.stringify({ cambios }),
      exito: true,
    })

    return NextResponse.json({ success: true, data: { actualizados: Object.keys(cambios) } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
