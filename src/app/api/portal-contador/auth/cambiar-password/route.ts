import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  rateLimit,
  getClientInfo,
  registrarAuditLog,
} from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { requireContador } from '@/lib/contador-auth'

// POST /api/portal-contador/auth/cambiar-password
// Cambio de contraseña obligatorio en el primer login.
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth
    const user = auth as any

    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`contador-cambiar-pwd:${clientInfo.ip}`, 10, 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Espere 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const passwordActual = typeof body.passwordActual === 'string' ? body.passwordActual : ''
    const nuevaPassword = typeof body.nuevaPassword === 'string' ? body.nuevaPassword : ''

    if (!passwordActual || !nuevaPassword) {
      return NextResponse.json(
        { success: false, error: 'Contraseña actual y nueva son obligatorias.' },
        { status: 400 }
      )
    }

    if (nuevaPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      )
    }

    const usuario = await db.usuario.findUnique({ where: { id: user.id } })
    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const ok = await verifyPassword(passwordActual, usuario.passwordHash)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'La contraseña actual es incorrecta.' },
        { status: 401 }
      )
    }

    if (passwordActual === nuevaPassword) {
      return NextResponse.json(
        { success: false, error: 'La nueva contraseña no puede ser igual a la actual.' },
        { status: 400 }
      )
    }

    // Hashear nueva contraseña con bcrypt (rounds=12)
    const bcrypt = await import('bcryptjs')
    const nuevoHash = await bcrypt.hash(nuevaPassword, 12)

    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: nuevoHash,
        mustChangePassword: false,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    })

    // Emitir nuevos tokens (sesión refrescada)
    const access_token = generateAccessToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    })
    const refresh_token = generateRefreshToken({
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    })

    await registrarAuditLog({
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      accion: 'CONTADOR_CAMBIO_PASSWORD',
      modulo: 'portal-contador',
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: {
        access_token,
        refresh_token,
        usuario: {
          id: usuario.id,
          username: usuario.username,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          mustChangePassword: false,
        },
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
