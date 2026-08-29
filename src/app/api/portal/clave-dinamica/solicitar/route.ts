// =====================================================
// /api/portal/clave-dinamica/solicitar
// =====================================================
// Genera una Clave Dinámica (OTP de 6 dígitos) para confirmar
// el envío de una solicitud de crédito desde el simulador del
// portal del cliente.
//
// Flujo:
//   1. Cliente simula crédito en el simulador
//   2. Cliente presiona "Solicitar Clave Dinámica"
//   3. Este endpoint genera OTP, lo hashea (SHA-256) y lo guarda
//      en OtpRegistro con tipo='SOLICITUD_SIMULADOR'
//   4. Se envía por EMAIL al correo registrado del cliente
//   5. El cliente ingresa la clave en el simulador
//   6. /api/portal/clave-dinamica/validar verifica la clave y
//      emite un codigoConfirmacion de un solo uso
//   7. /api/solicitudes-web POST recibe codigoConfirmacion y crea
//      la solicitud
//
// Seguridad:
//   - Requiere token de sesión válido (cliente.tokenSesion)
//   - OTP hasheado con SHA-256 (no se almacena en claro)
//   - Expira en 5 minutos
//   - Máximo 3 intentos
//   - Rate-limit: 1 solicitud cada 60s por cliente
//   - Trazabilidad en OtpRegistro + AccesoPortal + NotificacionLog
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generarCodigoOtp,
  registrarOtp,
  obtenerIp,
  obtenerUserAgent,
  validarEmailEntregable,
} from '@/lib/otp'
import { enviarEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clienteId, token } = body || {}

    if (!clienteId || !token) {
      return NextResponse.json(
        { success: false, error: 'clienteId y token son requeridos', code: 'MISSING_FIELDS' },
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
    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cliente inactivo', code: 'CLIENTE_INACTIVO' },
        { status: 403 }
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

    // === Validar correo registrado ===
    if (!cliente.email) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Tu cuenta no tiene un correo electrónico registrado. Contacta al administrador para actualizar tu correo antes de continuar.',
          code: 'NO_EMAIL',
        },
        { status: 400 }
      )
    }

    // === Validar que el email sea entregable (no @test.com, @example.com, etc.) ===
    const validacionEmail = validarEmailEntregable(cliente.email)
    if (!validacionEmail.esValido) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El correo electrónico registrado en tu cuenta pertenece a un dominio de prueba que no puede recibir correos. Contacta al administrador para actualizar tu correo a una dirección real.',
          code: 'EMAIL_NO_ENTREGABLE',
          motivo: validacionEmail.motivo,
        },
        { status: 400 }
      )
    }

    // === Rate-limit: 1 solicitud cada 60s por cliente ===
    const ultimoOtp = await db.otpRegistro.findFirst({
      where: {
        clienteId: cliente.id,
        tipo: 'SOLICITUD_SIMULADOR',
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (ultimoOtp) {
      const segundosRestantes = Math.ceil(
        (ultimoOtp.createdAt.getTime() + 60_000 - Date.now()) / 1000
      )
      return NextResponse.json(
        {
          success: false,
          error: `Espera ${segundosRestantes}s antes de solicitar otra clave.`,
          code: 'RATE_LIMIT',
          segundosRestantes,
        },
        { status: 429 }
      )
    }

    // === Generar OTP ===
    const otp = generarCodigoOtp('numeric', 6)
    const ip = obtenerIp(req)
    const ua = obtenerUserAgent(req)

    // === Registrar en OtpRegistro ===
    const otpRegistro = await registrarOtp({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      codigoPlano: otp,
      metodo: 'EMAIL',
      destinatario: cliente.email,
      tipo: 'SOLICITUD_SIMULADOR',
      descripcion: `Clave dinámica para solicitud de crédito desde simulador`,
      maxIntentos: 3,
      expiraEnMinutos: 5,
      ipSolicitud: ip,
      userAgent: ua,
      guardarCodigoPlano: false,
    })

    // === Enviar por correo ===
    const resultado = await enviarEmail({
      to: cliente.email,
      subject: 'Tu Clave Dinámica — Jo*** Se*** Al*** D** R**',
      text: `Hola ${cliente.nombre},

Tu clave dinámica para confirmar tu solicitud de crédito es: ${otp}

Esta clave es válida por 5 minutos. No la compartas con nadie.

Si no solicitaste esta clave, ignora este correo.

— Jo*** Se*** Al*** D** R**`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px;">
  <h2 style="color: #1e40af; margin-bottom: 8px;">Jo*** Se*** Al*** D** R**</h2>
  <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Clave dinámica para solicitud de crédito</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;">
  <p>Hola <strong>${cliente.nombre}</strong>,</p>
  <p>Has solicitado una clave dinámica para confirmar tu solicitud de crédito desde el simulador del portal.</p>
  <p>Tu clave dinámica es:</p>
  <div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; background: #f3f4f6; padding: 16px 32px; border-radius: 8px; font-family: 'Courier New', monospace;">${otp}</div>
  </div>
  <p style="color: #6b7280; font-size: 13px;">Esta clave expira en <strong>5 minutos</strong>. No la compartas con nadie.</p>
  <p style="color: #6b7280; font-size: 13px;">Si no solicitaste esta clave, ignora este correo.</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">Jo*** Se*** Al*** D** R** v5.0 — Sistema de solicitudes</p>
</div>`,
    })

    if (!resultado.success) {
      console.error('[clave-dinamica/solicitar] Falla envío email:', resultado.error)
    }

    // === Registrar en NotificacionLog ===
    await db.notificacionLog.create({
      data: {
        clienteTelefono: cliente.telefono,
        tipo: 'OTP',
        mensaje: `Clave dinámica solicitada vía EMAIL para simulador`,
        estado: resultado.success ? 'ENVIADO' : 'FALLIDO',
        fechaEnvio: new Date(),
      },
    })

    // === Bitácora de acceso portal ===
    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: ip,
        userAgent: ua,
        accion: 'CLAVE_DINAMICA_SOLICITADA',
        exito: resultado.success,
        detalle: `Clave dinámica solicitada para simulador. Email: ${resultado.success ? 'OK' : 'falló'}`,
      },
    })

    // === Respuesta SIN exponer el OTP ===
    return NextResponse.json({
      success: true,
      otpRegistroId: otpRegistro.id,
      canal: 'EMAIL',
      expiraEn: otpRegistro.expiraEn,
      emailEnviado: resultado.success,
      emailEnmascarado: cliente.email
        ? cliente.email.slice(0, 2) + '***' + cliente.email.slice(cliente.email.indexOf('@'))
        : null,
    })
  } catch (e) {
    console.error('[clave-dinamica/solicitar] error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
