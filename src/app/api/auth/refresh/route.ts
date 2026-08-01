import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { registrarAuditLog, getClientInfo, generateAccessToken, generateRefreshToken } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

// FIX-SEGURIDAD-CRITICA #3: warn si JWT_REFRESH_SECRET === JWT_SECRET (deben ser distintos)
if (process.env.JWT_REFRESH_SECRET && process.env.JWT_SECRET) {
  if (process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
    console.warn('[SECURITY][WARN] JWT_REFRESH_SECRET es idéntico a JWT_SECRET. Deben ser secretos DIFERENTES para que un access token comprometido no permita forjar refresh tokens.')
  }
}

// Hash SHA-256 del refresh token para almacenarlo en Usuario.sessionToken
// (nunca almacenamos el refresh token en claro en BD)
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// POST - refrescar token de acceso usando refresh_token
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { refresh_token } = body

    if (!refresh_token) {
      return NextResponse.json(
        { success: false, error: 'Refresh token requerido' },
        { status: 400 }
      )
    }

    // FIX-SEGURIDAD-CRITICA #3: exigir JWT_REFRESH_SECRET del entorno (sin fallback débil)
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
    if (!JWT_REFRESH_SECRET) {
      console.error('[FATAL] JWT_REFRESH_SECRET no definido en variables de entorno.')
      return NextResponse.json(
        { success: false, error: 'JWT_REFRESH_SECRET no configurado en el servidor' },
        { status: 500 }
      )
    }

    let decoded: any
    try {
      decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET) as any
    } catch {
      return NextResponse.json(
        { success: false, error: 'Refresh token inválido o expirado' },
        { status: 401 }
      )
    }

    if (decoded.type !== 'refresh') {
      return NextResponse.json(
        { success: false, error: 'Token no es de tipo refresh' },
        { status: 401 }
      )
    }

    // Verificar que el usuario siga activo
    const usuario = await db.usuario.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, rol: true, activo: true, nombre: true, sessionToken: true }
    })

    if (!usuario || !usuario.activo) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado o inactivo' },
        { status: 401 }
      )
    }

    // FIX-SEGURIDAD-CRITICA #3: ROTACIÓN de refresh tokens — si el usuario tiene un
    // sessionToken almacenado, el refresh_token presentado debe coincidir con él.
    // Esto permite revocar tokens (cerrar todas las sesiones) y detectar reúso de
    // tokens (si alguien presenta un token ya rotado, lo bloqueamos).
    if (usuario.sessionToken) {
      const presentedHash = hashRefreshToken(refresh_token)
      if (presentedHash !== usuario.sessionToken) {
        // Token ya rotado o revocado → rechazar y marcar como sospechoso
        await registrarAuditLog({
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          accion: 'REFRESH_TOKEN_RECHAZADO',
          modulo: 'auth',
          detalles: JSON.stringify({ motivo: 'token_ya_rotado_o_revocado' }),
          exito: false,
          errorMessage: 'Refresh token presentado no coincide con el almacenado (posible reúso)',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        }).catch(() => {})
        return NextResponse.json(
          { success: false, error: 'Refresh token inválido o ya utilizado. Inicia sesión nuevamente.' },
          { status: 401 }
        )
      }
    }

    // Generar nuevos tokens usando las funciones de security.ts
    const newAccessToken = generateAccessToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    })

    const newRefreshToken = generateRefreshToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    })

    // FIX-SEGURIDAD-CRITICA #3: ROTACIÓN — guardar hash del nuevo refresh token en
    // Usuario.sessionToken. Esto invalida el refresh token anterior (rotación real)
    // y permite revocación (logout = borrar sessionToken).
    try {
      await db.usuario.update({
        where: { id: usuario.id },
        data: { sessionToken: hashRefreshToken(newRefreshToken) },
      })
    } catch (e) {
      console.error('[refresh] No se pudo persistir la rotación del refresh token:', e)
    }

    // Registrar en audit log
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'TOKEN_REFRESH',
        modulo: 'auth',
        detalles: JSON.stringify({ rotado: true }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
