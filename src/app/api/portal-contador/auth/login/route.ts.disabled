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

// POST /api/portal-contador/auth/login
// Login del Portal del Contador. Solo usuarios con rol CONTADOR (o ADMIN)
// pueden acceder. Respeta mustChangePassword (primer login).
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)

    // Rate limiting estricto en login
    const rl = rateLimit(`contador-login:${clientInfo.ip}`, 10, 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiados intentos de login. Espere 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Usuario y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    // Búsqueda case-insensitive
    const usuario = await db.usuario.findFirst({
      where: { username: { equals: username.toLowerCase(), mode: 'insensitive' } },
    })

    if (!usuario) {
      await registrarAuditLog({
        usuarioNombre: username,
        accion: 'CONTADOR_LOGIN_FALLIDO',
        modulo: 'portal-contador',
        exito: false,
        errorMessage: 'Usuario no encontrado',
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      )
    }

    // Verificar que el rol sea CONTADOR o ADMIN
    if (usuario.rol !== 'CONTADOR' && usuario.rol !== 'ADMIN') {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'CONTADOR_LOGIN_DENEGADO_ROL',
        modulo: 'portal-contador',
        exito: false,
        errorMessage: `Rol insuficiente: ${usuario.rol}`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Su usuario no tiene permiso para acceder al Portal del Contador.' },
        { status: 403 }
      )
    }

    if (!usuario.activo) {
      return NextResponse.json(
        { success: false, error: 'Cuenta inactiva. Contacte al administrador.' },
        { status: 403 }
      )
    }

    // Verificar bloqueo
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const mins = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { success: false, error: `Cuenta bloqueada. Intente en ${mins} minuto(s).` },
        { status: 403 }
      )
    }

    const passwordValida = await verifyPassword(password, usuario.passwordHash)
    if (!passwordValida) {
      // Registrar intento fallido
      const nuevosIntentos = (usuario.intentosFallidos || 0) + 1
      const maxIntentos = 5
      const bloqueado = nuevosIntentos >= maxIntentos
      await db.usuario.update({
        where: { id: usuario.id },
        data: bloqueado
          ? { intentosFallidos: nuevosIntentos, bloqueadoHasta: new Date(Date.now() + 30 * 60 * 1000) }
          : { intentosFallidos: nuevosIntentos },
      })
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'CONTADOR_LOGIN_FALLIDO',
        modulo: 'portal-contador',
        exito: false,
        errorMessage: `Contraseña incorrecta (${nuevosIntentos}/${maxIntentos})`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      if (bloqueado) {
        return NextResponse.json(
          { success: false, error: `Cuenta bloqueada tras ${maxIntentos} intentos. Espere 30 minutos.` },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { success: false, error: `Usuario o contraseña incorrectos. Intentos restantes: ${maxIntentos - nuevosIntentos}` },
        { status: 401 }
      )
    }

    // Resetear intentos fallidos
    await db.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
    })

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
      accion: 'CONTADOR_LOGIN_EXITOSO',
      modulo: 'portal-contador',
      detalles: JSON.stringify({ rol: usuario.rol, mustChangePassword: usuario.mustChangePassword }),
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
          mustChangePassword: usuario.mustChangePassword,
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
