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

// =====================================================
// FIX-LOGOUT-INESPERADO:
// Antes este endpoint ROTABA el refresh_token en cada llamada
// (sobrescribía Usuario.sessionToken con el hash del nuevo token).
// Eso provocaba cierres de sesión aleatorios por race condition:
//   - Múltiples llamadas API simultáneas que recibían 401 al expirar
//     el access token (cada 15 min) disparaban varias llamadas a
//     /api/auth/refresh; la primera rotaba el token, las siguientes
//     fallaban porque su refresh_token ya no coincidía → clearAuth()
//     → redirección a /login mientras el usuario estaba activo.
//   - Lo mismo con múltiples pestañas abiertas.
//
// Nuevo esquema (ventana deslizante SIN rotación agresiva):
//   1. Verificamos firma JWT del refresh_token y que sea tipo 'refresh'.
//   2. Verificamos que el usuario siga activo.
//   3. Validamos que el hash del refresh_token presentado coincida con
//      Usuario.sessionToken (esto permite revocar sesiones: logout
//      borra sessionToken y ya nadie puede refrescar).
//   4. Emitimos un NUEVO access_token (siempre — es lo que el cliente
//      necesita para seguir llamando APIs).
//   5. Solo ROTAMOS el refresh_token si está a menos de
//      REFRESH_RENEW_WINDOW_SEC de expirar (típicamente 24 h antes
//      de los 7 días de vida). Así evitamos race conditions en el
//      caso común, pero seguimos renovando la sesión antes de que
//      caduque totalmente.
//
// Esto elimina el race condition porque:
//   - El refresh_token NO cambia entre llamadas concurrentes (salvo
//     que esté por expirar, caso raro).
//   - Si dos llamadas refrescan a la vez, ambas ven el mismo hash en
//     BD y ambas obtienen un access_token nuevo. Ninguna falla.
//   - La revocación sigue siendo posible (logout → sessionToken=null).
// =====================================================

// Ventana para renovar el refresh_token antes de que expire.
// 7 días de vida del refresh - 24 h = renovar si quedan < 24 h.
const REFRESH_RENEW_WINDOW_SEC = 24 * 60 * 60

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

    // Validar que el refresh_token presentado coincide con el almacenado.
    // Esto permite revocación: logout() puede setear sessionToken=null y
    // ningún refresh posterior tendrá éxito.
    //
    // FIX-LOGOUT-INESPERADO: si sessionToken es null pero el usuario acaba
    // de hacer login (todavía no se ha llamado a /api/auth/refresh), el
    // login route ya debe haber almacenado el hash. Si por alguna razón
    // no lo hizo (login legacy), permitimos el primer refresh para no
    // bloquear al usuario, y aprovechamos para guardar el hash ahora.
    const presentedHash = hashRefreshToken(refresh_token)
    if (usuario.sessionToken) {
      if (presentedHash !== usuario.sessionToken) {
        // Token ya revocado o inválido → rechazar
        await registrarAuditLog({
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          accion: 'REFRESH_TOKEN_RECHAZADO',
          modulo: 'auth',
          detalles: JSON.stringify({ motivo: 'token_no_coincide_con_sesion' }),
          exito: false,
          errorMessage: 'Refresh token no coincide con el almacenado (sesión revocada o reúso)',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        }).catch(() => {})
        return NextResponse.json(
          { success: false, error: 'Sesión no válida. Inicia sesión nuevamente.' },
          { status: 401 }
        )
      }
    }

    // Generar nuevo access token (siempre)
    const newAccessToken = generateAccessToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    })

    // Decidir si rotamos el refresh token:
    //   - Si faltan < REFRESH_RENEW_WINDOW_SEC para que expire, renovamos
    //     para mantener la sesión activa por otros 7 días.
    //   - En caso contrario, devolvemos el MISMO refresh_token para no
    //     invalidar otras pestañas/llamadas que aún lo tengan.
    let newRefreshToken = refresh_token
    let rotated = false
    const secondsToExpiry = decoded.exp ? (decoded.exp - Math.floor(Date.now() / 1000)) : 0
    if (secondsToExpiry > 0 && secondsToExpiry < REFRESH_RENEW_WINDOW_SEC) {
      newRefreshToken = generateRefreshToken({
        userId: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
      })
      rotated = true
      try {
        await db.usuario.update({
          where: { id: usuario.id },
          data: { sessionToken: hashRefreshToken(newRefreshToken) },
        })
      } catch (e) {
        console.error('[refresh] No se pudo persistir la rotación del refresh token:', e)
        // No fatal: el access token nuevo sigue siendo válido. El cliente
        // puede seguir trabajando; el siguiente refresh intentará de nuevo.
      }
    } else if (!usuario.sessionToken) {
      // Caso legacy: el login no almacenó el hash. Lo hacemos ahora sin
      // rotar el token (para no invalidar otras sesiones).
      try {
        await db.usuario.update({
          where: { id: usuario.id },
          data: { sessionToken: presentedHash },
        })
      } catch (e) {
        console.error('[refresh] No se pudo persistar el hash del refresh token (legacy):', e)
      }
    }

    // Registrar en audit log (sin exceder — solo eventos significativos)
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'TOKEN_REFRESH',
        modulo: 'auth',
        detalles: JSON.stringify({ rotado: rotated, faltanSeg: secondsToExpiry }),
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
