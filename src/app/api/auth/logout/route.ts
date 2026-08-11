// =====================================================
// /api/auth/logout — Cierre de sesión server-side
// -----------------------------------------------------
// FIX-LOGOUT-INESPERADO: antes NO existía este endpoint.
// El logout era solo client-side (borrar localStorage), lo que
// dejaba el refresh_token válido en el servidor hasta que
// expirara (7 días). Esto significaba:
//   1. Si alguien capturaba el refresh_token, podía seguir
//      refrescando la sesión incluso después de que el usuario
//      hubiera hecho logout.
//   2. La lógica de validación `sessionToken` en /api/auth/refresh
//      no servía para revocar sesiones, porque nadie la seteaba
//      a null.
//
// Ahora:
//   - El frontend llama a este endpoint al hacer logout.
//   - El servidor borra `Usuario.sessionToken`, lo que invalida
//      inmediatamente todos los refresh_token emitidos para ese
//      usuario (cualquier llamada futura a /api/auth/refresh
//      fallará con 401).
//   - Se audita el evento.
//
// Notas:
//   - Acepta el access_token en Authorization: Bearer (estándar).
//   - También acepta el refresh_token en el body como fallback
//     (por si el access_token ya expiró, caso común cuando el
//     usuario hace logout después de un rato largo).
//   - Es idempotente: llamarlo varias veces no causa error.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[FATAL] JWT_SECRET no definido')
    }
    return 'dev-temp-secret-change-in-production-' + Date.now()
  }
  return secret
}

function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[FATAL] JWT_REFRESH_SECRET no definido')
    }
    return 'dev-temp-refresh-secret-' + Date.now()
  }
  return secret
}

export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)

    // Intentar identificar al usuario a partir del access_token (header)
    let userId: string | null = null
    let username: string | null = null
    let nombre: string | null = null

    const authHeader = req.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any
        userId = decoded.userId || decoded.id || null
        username = decoded.username || null
        nombre = decoded.nombre || null
      } catch {
        // Token expirado o inválido: probamos con el refresh_token del body
      }
    }

    // Fallback: usar el refresh_token del body para identificar al usuario
    if (!userId) {
      try {
        const body = await req.json()
        const refresh_token = body?.refresh_token
        if (refresh_token) {
          const decoded = jwt.verify(refresh_token, getJwtRefreshSecret()) as any
          if (decoded.type === 'refresh') {
            userId = decoded.userId || null
            username = decoded.username || null
            nombre = decoded.nombre || null
          }
        }
      } catch {
        // Sin body o refresh inválido: no podemos identificar al usuario.
        // Aún así respondemos 200 para que el frontend pueda continuar
        // con el logout local sin bloquearse.
      }
    }

    // Si logramos identificar al usuario, revocamos la sesión
    if (userId) {
      try {
        await db.usuario.update({
          where: { id: userId },
          data: { sessionToken: null },
        })
      } catch (e) {
        console.error('[logout] No se pudo borrar sessionToken:', e)
        // No fatal: el logout local igual procede.
      }

      // Auditar (mejor esfuerzo)
      try {
        await registrarAuditLog({
          usuarioId: userId,
          usuarioNombre: nombre || username || 'desconocido',
          accion: 'LOGOUT',
          modulo: 'auth',
          detalles: JSON.stringify({ metodo: 'endpoint' }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        })
      } catch {}
    }

    // Siempre 200 — logout es idempotente
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Incluso en error, respondemos success para no bloquear el logout local
    console.error('[logout] Error:', sanitizeError(error).message)
    return NextResponse.json({ success: true })
  }
}
