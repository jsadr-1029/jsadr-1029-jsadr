// =====================================================
// /api/chat/otp — Generación y verificación de OTP para chat
// POST /api/chat/otp  { accion: 'solicitar' | 'verificar' }
//   solicitar : genera 6 dígitos, hashea bcrypt, 5 min expiración
//   verificar : compara, 3 intentos máx, bloqueo 15 min
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/security'
import { getPortalClientInfo, registrarAccesoPortal } from '@/lib/acceso-portal'
import { enviarEmail } from '@/lib/email'
import { generarCodigoOtp, registrarOtp } from '@/lib/otp'
import { sanitizeError } from '@/lib/error-handler'

// === CONFIGURACIÓN ===
const OTP_EXPIRA_MIN = 5
const OTP_INTENTOS_MAX = 3
const OTP_BLOQUEO_MIN = 15
// Tiempo de vida de la sesión del portal tras verificar OTP (2 horas)
const SESION_PORTAL_HORAS = 2

// === POST — acción solicitar o verificar ===
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accion } = body

    if (accion === 'solicitar') return solicitarOtp(req, body)
    if (accion === 'verificar') return verificarOtp(req, body)

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Use: solicitar | verificar', code: 'INVALID_ACTION' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === SOLICITAR OTP ===
async function solicitarOtp(req: NextRequest, body: any) {
  const clientInfo = getPortalClientInfo(req)
  // FIXED v5.0: el OTP del chat del portal SIEMPRE se envía por correo electrónico.
  // La modalidad (WhatsApp/Email/Ambos) SOLO aplica a OTPs de préstamos.
  // El parámetro `metodo` del body se ignora para forzar canal=EMAIL.
  const metodo: 'EMAIL' = 'EMAIL'
  const { clienteId, cedula } = body

  if (!clienteId && !cedula) {
    return NextResponse.json(
      { success: false, error: 'clienteId o cedula son requeridos', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const cliente = await db.cliente.findFirst({
    where: clienteId ? { id: clienteId } : { cedula },
    select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
  })

  if (!cliente) {
    return NextResponse.json(
      { success: false, error: 'Cliente no encontrado', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // FIXED v5.0: exigir email registrado (canal obligatorio)
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

  // Verificar bloqueo previo
  const otpBloqueado = await db.otpChat.findFirst({
    where: {
      clienteId: cliente.id,
      bloqueado: true,
      fechaBloqueo: { gt: new Date(Date.now() - OTP_BLOQUEO_MIN * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (otpBloqueado && otpBloqueado.fechaBloqueo) {
    const bloqueoRestanteMs =
      otpBloqueado.fechaBloqueo.getTime() + OTP_BLOQUEO_MIN * 60 * 1000 - Date.now()
    if (bloqueoRestanteMs > 0) {
      const mins = Math.ceil(bloqueoRestanteMs / 60000)
      return NextResponse.json(
        {
          success: false,
          error: `Solicitudes bloqueadas. Intente en ${mins} minuto(s).`,
          code: 'BLOCKED',
          minutosRestantes: mins,
        },
        { status: 403 }
      )
    }
  }

  // Generar nuevo código
  const codigo = generarCodigoOtp('numeric', 6)
  const codigoHash = await hashPassword(codigo)
  const expiraEn = new Date(Date.now() + OTP_EXPIRA_MIN * 60 * 1000)

  // Marcar OTPs previos no usados como expirados/usados para evitar reutilización
  await db.otpChat.updateMany({
    where: {
      clienteId: cliente.id,
      usado: false,
      verificado: false,
    },
    data: { usado: true },
  })

  const otp = await db.otpChat.create({
    data: {
      clienteId: cliente.id,
      codigoHash,
      metodo,
      destinatario: cliente.email,
      maxIntentos: OTP_INTENTOS_MAX,
      expiraEn,
      ipSolicitud: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    },
  })

  // Registrar en OtpRegistro (trazabilidad centralizada)
  await registrarOtp({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    codigoPlano: codigo,
    metodo: 'EMAIL',
    destinatario: cliente.email,
    tipo: 'CHAT',
    entidadRefId: otp.id,
    descripcion: `OTP chat cliente ${cliente.nombre}`,
    maxIntentos: OTP_INTENTOS_MAX,
    expiraEnMinutos: OTP_EXPIRA_MIN,
    ipSolicitud: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    guardarCodigoPlano: false,
  })

  // Enviar OTP al cliente — SIEMPRE por correo electrónico (fixed v5.0)
  let envio: { exito: boolean; error?: string } | null = null
  const resultado = await enviarEmail({
    to: cliente.email,
    subject: 'Tu código de verificación — Jo*** Se*** Al*** D** R**',
    text: `Hola ${cliente.nombre},\n\nTu código de verificación es: ${codigo}\n\nVálido por ${OTP_EXPIRA_MIN} minutos. No lo compartas con nadie.\n\n— Jo*** Se*** Al*** D** R**`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px;"><h2 style="color: #1e40af;">Jo*** Se*** Al*** D** R**</h2><p>Hola <strong>${cliente.nombre}</strong>,</p><p>Tu código de verificación es:</p><div style="text-align: center; margin: 24px 0;"><div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; background: #f3f4f6; padding: 16px 32px; border-radius: 8px; font-family: 'Courier New', monospace;">${codigo}</div></div><p style="color: #6b7280; font-size: 13px;">Válido por ${OTP_EXPIRA_MIN} minutos.</p></div>`,
  })
  envio = { exito: resultado.success, error: resultado.error }

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'CONSULTA',
    exito: true,
    detalle: `OTP solicitado por ${metodo}`,
    metadata: { otpId: otp.id, expiraEn: expiraEn.toISOString() },
  })

  return NextResponse.json({
    success: true,
    data: {
      otpId: otp.id,
      expiraEn: expiraEn.toISOString(),
      metodo,
      destinatario: `***${(cliente.email || '').slice(4)}`,
      envio,
    },
  })
}

// === VERIFICAR OTP ===
async function verificarOtp(req: NextRequest, body: any) {
  const clientInfo = getPortalClientInfo(req)
  const { otpId, clienteId, cedula, codigo } = body

  if (!((otpId || clienteId || cedula) && codigo)) {
    return NextResponse.json(
      { success: false, error: 'otpId/clienteId/cedula y codigo son requeridos', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  // Buscar el OTP más reciente no usado del cliente
  let cliente: { id: string; nombre: string; cedula: string; telefono: string } | null = null
  if (clienteId) {
    cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true, cedula: true, telefono: true },
    })
  } else if (cedula) {
    cliente = await db.cliente.findUnique({
      where: { cedula },
      select: { id: true, nombre: true, cedula: true, telefono: true },
    })
  }

  let otp: Awaited<ReturnType<typeof db.otpChat.findUnique>> | Awaited<ReturnType<typeof db.otpChat.findFirst>> | null = null
  if (otpId) {
    otp = await db.otpChat.findUnique({ where: { id: otpId } })
  } else if (cliente) {
    otp = await db.otpChat.findFirst({
      where: { clienteId: cliente.id, usado: false },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (!otp) {
    return NextResponse.json(
      { success: false, error: 'No hay un código OTP activo. Solicite uno nuevo.', code: 'NO_OTP' },
      { status: 404 }
    )
  }

  if (otp.usado || otp.verificado) {
    return NextResponse.json(
      { success: false, error: 'El código ya fue utilizado. Solicite uno nuevo.', code: 'OTP_USED' },
      { status: 400 }
    )
  }

  if (otp.bloqueado) {
    if (otp.fechaBloqueo) {
      const bloqueoRestanteMs =
        otp.fechaBloqueo.getTime() + OTP_BLOQUEO_MIN * 60 * 1000 - Date.now()
      if (bloqueoRestanteMs > 0) {
        const mins = Math.ceil(bloqueoRestanteMs / 60000)
        return NextResponse.json(
          {
            success: false,
            error: `OTP bloqueado. Intente en ${mins} minuto(s).`,
            code: 'BLOCKED',
            minutosRestantes: mins,
          },
          { status: 403 }
        )
      }
    }
  }

  // Verificar expiración
  if (otp.expiraEn < new Date()) {
    await db.otpChat.update({
      where: { id: otp.id },
      data: { usado: true },
    })
    return NextResponse.json(
      { success: false, error: 'El código expiró. Solicite uno nuevo.', code: 'OTP_EXPIRED' },
      { status: 400 }
    )
  }

  // Comparar código
  const codigoValido = await verifyPassword(String(codigo), otp.codigoHash)
  if (!codigoValido) {
    const nuevosIntentos = otp.intentos + 1
    const debeBloquear = nuevosIntentos >= otp.maxIntentos

    await db.otpChat.update({
      where: { id: otp.id },
      data: {
        intentos: nuevosIntentos,
        bloqueado: debeBloquear,
        fechaBloqueo: debeBloquear ? new Date() : null,
      },
    })

    if (cliente) {
      await registrarAccesoPortal({
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'INTENTO_FALLIDO',
        exito: false,
        detalle: `OTP incorrecto. Intento ${nuevosIntentos}/${otp.maxIntentos}`,
      })
    }

    if (debeBloquear) {
      return NextResponse.json(
        {
          success: false,
          error: `Código bloqueado tras ${otp.maxIntentos} intentos fallidos. Espere ${OTP_BLOQUEO_MIN} minutos.`,
          code: 'BLOCKED',
          minutosRestantes: OTP_BLOQUEO_MIN,
        },
        { status: 403 }
      )
    }

    const restantes = otp.maxIntentos - nuevosIntentos
    return NextResponse.json(
      {
        success: false,
        error: `Código incorrecto. Intentos restantes: ${restantes}`,
        code: 'INVALID_OTP',
        intentosRestantes: restantes,
      },
      { status: 401 }
    )
  }

  // === Código válido ===
  const sessionId = crypto.randomBytes(32).toString('hex')

  await db.otpChat.update({
    where: { id: otp.id },
    data: {
      verificado: true,
      usado: true,
      fechaVerificacion: new Date(),
      sessionIdGenerado: sessionId,
      ipSolicitud: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    },
  })

  // === Guardar sessionId como token de sesión del cliente ===
  // Esto es CRÍTICO: las APIs de /api/chat/conversaciones y /api/chat/mensajes
  // validan el header x-portal-token contra cliente.tokenSesion.
  // Sin este guardado, el chat nunca podría listar conversaciones ni enviar mensajes.
  const tokenExpira = new Date(Date.now() + SESION_PORTAL_HORAS * 60 * 60 * 1000)
  if (cliente) {
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: sessionId,
        tokenExpira,
      },
    })
  }

  if (cliente) {
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'LOGIN',
      exito: true,
      detalle: 'OTP verificado correctamente',
      metadata: { otpId: otp.id, sessionId },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      sessionId,
      clienteId: otp.clienteId,
      verificado: true,
      tokenExpira: tokenExpira.toISOString(),
    },
  })
}
