// =====================================================
// /api/auth/switch-user — Impersonación solo-ADMIN
// -----------------------------------------------------
// Permite a un ADMIN cambiar de cuenta a otro usuario
// interno (GESTOR, CONSULTOR o ADMIN) sin conocer su
// contraseña. El endpoint:
//
//   • Verifica que el solicitante sea ADMIN (JWT).
//   • Valida que el usuario destino exista, esté activo
//     y tenga un rol permitido para impersonación.
//   • Emite access_token + refresh_token nuevos con
//     claim `impersonatedBy = <adminId>` para auditar
//     que la sesión proviene de una impersonación.
//   • Registra el cambio en audit_log.
//   • Devuelve los nuevos tokens + datos del usuario
//     destino, igual que el login normal, para que el
//     frontend reemplace la sesión.
//
// Roles destino permitidos: GESTOR, CONSULTOR, ADMIN.
// NO se permite impersonar ABOGADO (usa portal aparte)
// ni CLIENTE (no existe en tabla Usuario).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import {
  generateAccessToken,
  generateRefreshToken,
  registrarAuditLog,
  getClientInfo,
} from '@/lib/security'
import { getAuthUser } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// FIX-LOGOUT-INESPERADO: hash del refresh_token para almacenarlo en
// Usuario.sessionToken y que /api/auth/refresh pueda validarlo.
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

const ROLES_IMPONIBLES = ['GESTOR', 'CONSULTOR', 'ADMIN']

export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)

    // 1. Verificar que el solicitante sea ADMIN
    const admin = getAuthUser(req)
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'No autorizado. Token requerido.' },
        { status: 401 }
      )
    }
    if (admin.rol !== 'ADMIN') {
      await registrarAuditLog({
        usuarioId: admin.id,
        usuarioNombre: admin.nombre,
        accion: 'SWITCH_USER_DENEGADO',
        modulo: 'auth',
        exito: false,
        errorMessage: `Rol ${admin.rol} intentó impersonar sin permisos`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Solo el administrador puede cambiar de cuenta.' },
        { status: 403 }
      )
    }

    // 2. Leer y validar el cuerpo
    const body = await req.json()
    const { targetUserId, volverA } = body as { targetUserId?: string; volverA?: boolean }

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID de usuario destino requerido.' },
        { status: 400 }
      )
    }

    // 3. Buscar el usuario destino
    const objetivo = await db.usuario.findUnique({
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

    if (!objetivo) {
      return NextResponse.json(
        { success: false, error: 'Usuario destino no encontrado.' },
        { status: 404 }
      )
    }

    if (!objetivo.activo) {
      return NextResponse.json(
        { success: false, error: 'El usuario destino está inactivo.' },
        { status: 400 }
      )
    }

    if (!ROLES_IMPONIBLES.includes(objetivo.rol)) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede impersonar a un usuario con rol ${objetivo.rol}. Solo se permite GESTOR, CONSULTOR o ADMIN.`,
        },
        { status: 400 }
      )
    }

    // 4. Emitir nuevos tokens con claim `impersonatedBy`
    //    Si el admin está volviendo a su propia cuenta, no
    //    marcamos impersonación (es una sesión normal).
    const esVueltaAdmin = volverA && objetivo.id === admin.id
    const tokenPayload = {
      userId: objetivo.id,
      username: objetivo.username,
      rol: objetivo.rol,
      nombre: objetivo.nombre,
      ...(esVueltaAdmin ? {} : { impersonatedBy: admin.id }),
    }

    const access_token = generateAccessToken(tokenPayload)
    const refresh_token = generateRefreshToken(tokenPayload)

    // 5. Actualizar último acceso del usuario destino y almacenar hash del
    //    refresh_token para validación posterior en /api/auth/refresh.
    //    FIX-LOGOUT-INESPERADO: sin esto, el refresh route no puede validar
    //    que el token presentado coincida con la sesión activa, lo que
    //    hace imposible revocar sesiones impersonadas.
    try {
      await db.usuario.update({
        where: { id: objetivo.id },
        data: {
          ultimoAcceso: new Date(),
          sessionToken: hashRefreshToken(refresh_token),
        },
      })
    } catch (e) {
      console.error('[switch-user] No se pudo persistir sessionToken:', e)
    }

    // 5.1 Buscar el nombre real del admin (el JWT legacy no incluye `nombre`)
    const adminDB = await db.usuario.findUnique({
      where: { id: admin.id },
      select: { nombre: true, username: true },
    })

    // 6. Auditar
    await registrarAuditLog({
      usuarioId: admin.id,
      usuarioNombre: adminDB?.nombre || admin.nombre,
      accion: esVueltaAdmin ? 'SWITCH_USER_VOLVER' : 'SWITCH_USER',
      modulo: 'auth',
      detalles: JSON.stringify({
        from: { id: admin.id, username: admin.username, rol: 'ADMIN' },
        to: { id: objetivo.id, username: objetivo.username, rol: objetivo.rol },
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    // 7. Responder igual que login
    return NextResponse.json({
      success: true,
      data: {
        access_token,
        refresh_token,
        usuario: {
          id: objetivo.id,
          nombre: objetivo.nombre,
          username: objetivo.username,
          email: objetivo.email,
          rol: objetivo.rol,
          permisos: objetivo.permisos,
          mustChangePassword: objetivo.mustChangePassword,
        },
        impersonatedBy: esVueltaAdmin ? null : admin.id,
        adminOriginal: {
          id: admin.id,
          nombre: adminDB?.nombre || 'Administrador',
          username: adminDB?.username || admin.username,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
