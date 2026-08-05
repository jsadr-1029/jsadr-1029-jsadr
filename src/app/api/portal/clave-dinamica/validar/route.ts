// =====================================================
// /api/portal/clave-dinamica/validar
// =====================================================
// Valida la Clave Dinámica ingresada por el cliente y emite un
// `codigoConfirmacion` de un solo uso que el frontend enviará
// junto con la solicitud de crédito a /api/solicitudes-web.
//
// Seguridad:
//   - Compara el hash SHA-256 del input contra el hash almacenado
//     usando timingSafeEqual (anti-timing-attack)
//   - Bloquea tras 3 intentos fallidos
//   - Marca el OtpRegistro como `usado=true` tras éxito (no reutilizable)
//   - codigoConfirmacion: 32 bytes hex random, guardado hasheado
//     en OtpRegistro.sessionIdGenerado y devuelto al cliente
//   - codigoConfirmacion expira cuando el OtpRegistro expira
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  verificarOtp,
  incrementarIntentoOtp,
  marcarOtpVerificado,
  obtenerIp,
  obtenerUserAgent,
} from '@/lib/otp'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clienteId, token, otpRegistroId, clave } = body || {}

    if (!clienteId || !token || !otpRegistroId || !clave) {
      return NextResponse.json(
        {
          success: false,
          error: 'clienteId, token, otpRegistroId y clave son requeridos',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    // === Buscar cliente ===
    const cliente = await db.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado', code: 'CLIENTE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // === Validar sesión del portal ===
    const now = new Date()
    const tokenValido =
      !!cliente.tokenSesion &&
      cliente.tokenSesion === token &&
      !!cliente.tokenExpira &&
      cliente.tokenExpira > now

    if (!tokenValido) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada', code: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // === Buscar OtpRegistro ===
    const otpReg = await db.otpRegistro.findUnique({ where: { id: otpRegistroId } })
    if (!otpReg) {
      return NextResponse.json(
        { success: false, error: 'Clave no encontrada. Solicita una nueva.', code: 'OTP_NOT_FOUND' },
        { status: 404 }
      )
    }

    // === Verificar pertenencia ===
    if (otpReg.clienteId !== cliente.id) {
      return NextResponse.json(
        { success: false, error: 'Clave no pertenece al cliente', code: 'OTP_OWNER_MISMATCH' },
        { status: 403 }
      )
    }

    // === Verificar tipo ===
    if (otpReg.tipo !== 'SOLICITUD_SIMULADOR') {
      return NextResponse.json(
        { success: false, error: 'Tipo de clave inválido', code: 'OTP_TYPE_INVALID' },
        { status: 400 }
      )
    }

    // === Verificar no usado ===
    if (otpReg.usado) {
      return NextResponse.json(
        { success: false, error: 'Clave ya utilizada. Solicita una nueva.', code: 'OTP_USED' },
        { status: 400 }
      )
    }

    // === Verificar no bloqueado ===
    if (otpReg.bloqueado) {
      return NextResponse.json(
        { success: false, error: 'Clave bloqueada por intentos fallidos. Solicita una nueva.', code: 'OTP_BLOCKED' },
        { status: 403 }
      )
    }

    // === Verificar no expirada ===
    if (otpReg.expiraEn < now) {
      return NextResponse.json(
        { success: false, error: 'Clave expirada. Solicita una nueva.', code: 'OTP_EXPIRED' },
        { status: 410 }
      )
    }

    const ip = obtenerIp(req)
    const ua = obtenerUserAgent(req)

    // === Comparación constant-time contra el hash almacenado ===
    const claveValida = verificarOtp(String(clave), otpReg.codigoHash)

    if (!claveValida) {
      const { intentos, maxIntentos, bloqueado } = await incrementarIntentoOtp(otpRegistroId)

      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: ip,
          userAgent: ua,
          accion: 'CLAVE_DINAMICA_VALIDADA',
          exito: false,
          detalle: `Clave incorrecta. Intento ${intentos}/${maxIntentos}`,
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: `Clave incorrecta. Intentos restantes: ${Math.max(0, maxIntentos - intentos)}`,
          code: 'OTP_INVALID',
          intentosRestantes: Math.max(0, maxIntentos - intentos),
          bloqueado,
        },
        { status: 401 }
      )
    }

    // === Clave válida — generar codigoConfirmacion de un solo uso ===
    const codigoConfirmacion = crypto.randomBytes(32).toString('hex')
    const codigoConfirmacionHash = crypto
      .createHash('sha256')
      .update(codigoConfirmacion)
      .digest('hex')

    // === Marcar OtpRegistro como verificado + guardar hash del codigoConfirmacion ===
    await marcarOtpVerificado(otpRegistroId, codigoConfirmacionHash)

    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: ip,
        userAgent: ua,
        accion: 'CLAVE_DINAMICA_VALIDADA',
        exito: true,
        detalle: `Clave dinámica validada. codigoConfirmacion emitido.`,
      },
    })

    return NextResponse.json({
      success: true,
      codigoConfirmacion, // 32 bytes hex, de un solo uso
      expiraEn: otpReg.expiraEn,
      message: 'Clave validada. Ya puedes enviar tu solicitud.',
    })
  } catch (e) {
    console.error('[clave-dinamica/validar] error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
