// =====================================================
// /api/auth/switch-back — Volver a la cuenta de ADMIN
// -----------------------------------------------------
// Este endpoint está pensado para sesiones que están
// actualmente IMPERSONANDO a otro usuario (el JWT
// incluye el claim `impersonatedBy`).
//
// A diferencia de /api/auth/switch-user (que requiere
// rol ADMIN), este endpoint:
//
//   • Acepta cualquier sesión con claim `impersonatedBy`.
//   • Solo permite volver al admin ORIGINAL que lanzó
//     la impersonación (no se puede cambiar a otro admin).
//   • Emite tokens limpios sin `impersonatedBy`.
//   • Audita el cierre de impersonación.
//
// Seguridad:
//   - Un token sin `impersonatedBy` devuelve 400.
//   - El `targetUserId` debe coincidir con el
//     `impersonatedBy` del token; si no, 403.
//   - El admin destino debe existir y estar activo.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import {
  generateAccessToken,
  generateRefreshToken,
  registrarAuditLog,
  getClientInfo,
} from '@/lib/security'
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

export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)

    // 1. Verificar token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token requerido.' },
        { status: 401 }
      )
    }
    const token = authHeader.substring(7)

    let decoded: any
    try {
      decoded = jwt.verify(token, getJwtSecret())
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido o expirado.' },
        { status: 401 }
      )
    }

    // 2. Validar que sea sesión impersonada
    if (!decoded.impersonatedBy) {
      return NextResponse.json(
        { success: false, error: 'Esta sesión no es una impersonación. Solo se puede volver desde una sesión impersonada.' },
        { status: 400 }
      )
    }

    // 3. Leer cuerpo y validar targetUserId
    const body = await req.json()
    const { targetUserId } = body as { targetUserId?: string }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'ID de admin original requerido.' },
        { status: 400 }
      )
    }

    // 4. CRÍTICO: targetUserId debe coincidir con impersonatedBy
    if (targetUserId !== decoded.impersonatedBy) {
      await registrarAuditLog({
        usuarioId: decoded.userId || decoded.id,
        usuarioNombre: decoded.nombre || decoded.username,
        accion: 'SWITCH_BACK_DENEGADO',
        modulo: 'auth',
        exito: false,
        errorMessage: `Intento de volver a admin distinto del original (token: ${decoded.impersonatedBy}, request: ${targetUserId})`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'No podés volver a una cuenta distinta de la original.' },
        { status: 403 }
      )
    }

    // 5. Buscar el admin original
    const adminOriginal = await db.usuario.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        nombre: true,
        username: true,
        email: true,
        rol: true,
        activo: true,
        permisos: true,
        mustChangePassword: true,
      },
    })

    if (!adminOriginal) {
      return NextResponse.json(
        { success: false, error: 'El admin original ya no existe.' },
        { status: 404 }
      )
    }

    if (!adminOriginal.activo) {
      return NextResponse.json(
        { success: false, error: 'El admin original está inactivo.' },
        { status: 400 }
      )
    }

    if (adminOriginal.rol !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'El usuario original ya no es administrador.' },
        { status: 400 }
      )
    }

    // 6. Emitir tokens limpios (sin impersonatedBy)
    const tokenPayload = {
      userId: adminOriginal.id,
      username: adminOriginal.username,
      rol: adminOriginal.rol,
      nombre: adminOriginal.nombre,
    }

    const access_token = generateAccessToken(tokenPayload)
    const refresh_token = generateRefreshToken(tokenPayload)

    // 7. Actualizar último acceso
    await db.usuario.update({
      where: { id: adminOriginal.id },
      data: { ultimoAcceso: new Date() },
    })

    // 8. Auditar
    await registrarAuditLog({
      usuarioId: adminOriginal.id,
      usuarioNombre: adminOriginal.nombre,
      accion: 'SWITCH_USER_VOLVER',
      modulo: 'auth',
      detalles: JSON.stringify({
        from: { id: decoded.userId || decoded.id, username: decoded.username, rol: decoded.rol },
        to: { id: adminOriginal.id, username: adminOriginal.username, rol: 'ADMIN' },
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    // 9. Responder
    return NextResponse.json({
      success: true,
      data: {
        access_token,
        refresh_token,
        usuario: {
          id: adminOriginal.id,
          nombre: adminOriginal.nombre,
          username: adminOriginal.username,
          email: adminOriginal.email,
          rol: adminOriginal.rol,
          permisos: adminOriginal.permisos,
          mustChangePassword: adminOriginal.mustChangePassword,
        },
        impersonatedBy: null,
        adminOriginal: null,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
