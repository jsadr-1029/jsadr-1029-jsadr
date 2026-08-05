import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTOTP } from '@/lib/totp'
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  checkAccountLockout,
  registerFailedAttempt,
  resetFailedAttempts,
  rateLimit,
  registrarAuditLog,
  getClientInfo,
} from '@/lib/security'
import { loginSchema, validateInput } from '@/lib/validators'
import { sanitizeError } from '@/lib/error-handler'

// POST - login de usuario con MFA (flujo de 2 pasos)
// Paso 1: validar credenciales → devuelve requiresMFA: true + temp_token
// Paso 2: validar OTP → devuelve access_token + refresh_token
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)

    // Rate limiting
    const rl = rateLimit(`login:${clientInfo.ip}`, 10)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiados intentos de login. Espera 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Reforzado: validar con Zod antes de procesar
    const validacion = validateInput(loginSchema, body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: validacion.error, fieldErrors: validacion.fieldErrors },
        { status: 400 }
      )
    }

    const { username, password, otp, step } = body

    // === PASO 2: VERIFICAR OTP ===
    if (step === 2 && otp) {
      // Buscar el usuario por username (case-insensitive)
      const usuario = await db.usuario.findFirst({
        where: { username: { equals: (username || '').toLowerCase(), mode: 'insensitive' } },
      })

      if (!usuario) {
        return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })
      }

      // Verificar OTP TOTP (Google Authenticator) — TOTP propio RFC 6238
      let otpValido = false
      if (usuario.mfaEnabled && usuario.mfaSecret) {
        try {
          otpValido = verifyTOTP(otp, usuario.mfaSecret)
        } catch {
          otpValido = false
        }
      }

      // Si TOTP no es válido, verificar OTP por WhatsApp
      if (!otpValido) {
        const otpConfig = await db.configuracion.findUnique({
          where: { clave: `OTP_WHATSAPP_${usuario.email}` },
        })
        if (otpConfig) {
          try {
            const data = JSON.parse(otpConfig.valor)
            if (data.otp === otp && new Date(data.expiracion) > new Date()) {
              otpValido = true
              // Borrar OTP usado
              await db.configuracion.delete({ where: { clave: `OTP_WHATSAPP_${usuario.email}` } })
            }
          } catch {}
        }
      }

      if (!otpValido) {
        await registrarAuditLog({
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          accion: 'MFA_VERIFICACION_FALLIDA',
          modulo: 'auth',
          exito: false,
          errorMessage: 'Código MFA incorrecto en login',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        })
        return NextResponse.json({ success: false, error: 'Código de verificación incorrecto' }, { status: 401 })
      }

      // === LOGIN COMPLETO ===
      await resetFailedAttempts(usuario.id)

      const access_token = generateAccessToken({ userId: usuario.id, username: usuario.username, rol: usuario.rol })
      const refresh_token = generateRefreshToken({ userId: usuario.id, username: usuario.username, rol: usuario.rol })

      await db.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } })

      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'LOGIN',
        modulo: 'auth',
        detalles: JSON.stringify({ rol: usuario.rol, mfa: true }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        data: {
          access_token,
          refresh_token,
          usuario: {
            id: usuario.id, nombre: usuario.nombre, username: usuario.username,
            email: usuario.email, rol: usuario.rol, permisos: usuario.permisos,
            mustChangePassword: usuario.mustChangePassword,
          },
        },
      })
    }

    // === PASO 1: VALIDAR CREDENCIALES ===
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Usuario y contraseña son obligatorios' }, { status: 400 })
    }

    // Búsqueda case-insensitive para que el usuario pueda ingresar
    // "Jsadr", "jsadr", "JD_jsadr", "jd_jsadr", etc. y todos funcionen.
    const usuario = await db.usuario.findFirst({
      where: { username: { equals: username.toLowerCase(), mode: 'insensitive' } },
    })

    if (!usuario) {
      await registrarAuditLog({
        usuarioNombre: username, accion: 'LOGIN', modulo: 'auth',
        exito: false, errorMessage: 'Usuario no encontrado',
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })
      return NextResponse.json({ success: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    // Verificar bloqueo
    const lockout = await checkAccountLockout(usuario.id)
    if (lockout.locked) {
      const mins = Math.ceil((lockout.blockedUntil!.getTime() - Date.now()) / 60000)
      return NextResponse.json({ success: false, error: `Cuenta bloqueada. Intenta en ${mins} minuto(s).` }, { status: 403 })
    }

    if (!usuario.activo) {
      return NextResponse.json({ success: false, error: 'Cuenta inactiva. Contacta al administrador.' }, { status: 403 })
    }

    const passwordValida = await verifyPassword(password, usuario.passwordHash)
    if (!passwordValida) {
      const result = await registerFailedAttempt(usuario.id)
      await registrarAuditLog({
        usuarioId: usuario.id, usuarioNombre: usuario.nombre,
        accion: 'LOGIN', modulo: 'auth', exito: false,
        errorMessage: `Contraseña incorrecta. Intento ${result.attempts}/${result.maxAttempts}`,
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })
      if (result.locked) {
        return NextResponse.json({ success: false, error: `Cuenta bloqueada tras ${result.maxAttempts} intentos. Espera 30 minutos.` }, { status: 403 })
      }
      return NextResponse.json({ success: false, error: `Usuario o contraseña incorrectos. Intentos restantes: ${result.maxAttempts - result.attempts}` }, { status: 401 })
    }

    // Credenciales válidas - resetear intentos
    await resetFailedAttempts(usuario.id)

    // === SI MFA ESTÁ ACTIVO, REQUERIR OTP ===
    if (usuario.mfaEnabled && usuario.mfaSecret) {
      // Generar temp token (5 min) para el paso 2
      const tempToken = generateAccessToken({ userId: usuario.id, username: usuario.username, rol: usuario.rol })

      await registrarAuditLog({
        usuarioId: usuario.id, usuarioNombre: usuario.nombre,
        accion: 'LOGIN_MFA_PENDIENTE', modulo: 'auth',
        detalles: JSON.stringify({ metodo: 'TOTP' }),
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        requiresMFA: true,
        tempToken,
        data: {
          usuario: {
            id: usuario.id, nombre: usuario.nombre, username: usuario.username,
            email: usuario.email,
          },
          metodosDisponibles: ['totp', 'whatsapp'],
          telefono: usuario.email, // se usa como identificador para OTP WhatsApp
        },
        mensaje: 'Ingresa el código de Google Authenticator o solicita uno por WhatsApp.',
      })
    }

    // === LOGIN SIN MFA (directo) ===
    const access_token = generateAccessToken({ userId: usuario.id, username: usuario.username, rol: usuario.rol })
    const refresh_token = generateRefreshToken({ userId: usuario.id, username: usuario.username, rol: usuario.rol })

    await db.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } })

    await registrarAuditLog({
      usuarioId: usuario.id, usuarioNombre: usuario.nombre,
      accion: 'LOGIN', modulo: 'auth',
      detalles: JSON.stringify({ rol: usuario.rol, mfa: false }),
      ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: {
        access_token, refresh_token,
        usuario: {
          id: usuario.id, nombre: usuario.nombre, username: usuario.username,
          email: usuario.email, rol: usuario.rol, permisos: usuario.permisos,
          mustChangePassword: usuario.mustChangePassword,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
