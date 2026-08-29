import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateSecret as totpGenerateSecret, generateTOTP, generateURI as totpGenerateURI, verifyTOTP } from '@/lib/totp'
import QRCode from 'qrcode'
import {
  verifyAccessToken,
  registrarAuditLog,
  getClientInfo,
  rateLimit,
} from '@/lib/security'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { generarCodigoOtp, registrarOtp } from '@/lib/otp'
import { sanitizeError } from '@/lib/error-handler'

// POST - gestionar MFA
// accion: 'activar' | 'verificar_activacion' | 'desactivar' | 'enviar_otp_whatsapp' | 'obtener_estado'
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { accion } = body

    // Para activar/desactivar MFA se requiere token JWT
    let userId = body.userId // puede venir del frontend

    // === OBTENER ESTADO DE MFA ===
    if (accion === 'obtener_estado') {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 })
      }
      const usuario = await db.usuario.findUnique({ where: { id: userId } })
      if (!usuario) {
        return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: {
          mfaEnabled: usuario.mfaEnabled,
          mfaSecret: usuario.mfaSecret ? true : false,
          telefono: usuario.username, // info básica
        },
      })
    }

    // === ACTIVAR MFA (generar secret + QR) ===
    if (accion === 'activar') {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 })
      }

      const usuario = await db.usuario.findUnique({ where: { id: userId } })
      if (!usuario) {
        return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
      }

      // Generar secret TOTP
      const secret = totpGenerateSecret()
      const appName = 'SolicitudesSistema'
      const otpauthUrl = totpGenerateURI(secret, usuario.username, appName)

      // Generar QR code como data URL
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 250, margin: 2 })

      // Guardar el secret temporalmente (no activar MFA hasta que verifique)
      // Lo guardamos en el campo mfaSecret pero mfaEnabled sigue false
      await db.usuario.update({
        where: { id: userId },
        data: { mfaSecret: secret },
      })

      await registrarAuditLog({
        usuarioId: userId,
        usuarioNombre: usuario.nombre,
        accion: 'MFA_ACTIVACION_INICIADA',
        modulo: 'seguridad',
        detalles: JSON.stringify({ metodo: 'TOTP' }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        data: {
          secret,
          qrUrl: qrDataUrl,
          otpauthUrl,
          mensaje: 'Escanea el código QR con Google Authenticator, Authy o similar. Luego ingresa el código de 6 dígitos para confirmar.',
        },
      })
    }

    // === VERIFICAR ACTIVACIÓN (confirmar con código TOTP) ===
    if (accion === 'verificar_activacion') {
      const { codigo } = body
      if (!userId || !codigo) {
        return NextResponse.json({ success: false, error: 'userId y código requeridos' }, { status: 400 })
      }

      // Rate limiting
      const rl = rateLimit(`mfa_verify:${clientInfo.ip}`, 10)
      if (!rl.allowed) {
        return NextResponse.json({ success: false, error: 'Demasiados intentos. Espera 1 minuto.' }, { status: 429 })
      }

      const usuario = await db.usuario.findUnique({ where: { id: userId } })
      if (!usuario || !usuario.mfaSecret) {
        return NextResponse.json({ success: false, error: 'No hay secret MFA configurado' }, { status: 400 })
      }

      // Verificar código TOTP
      const valido = verifyTOTP(codigo, usuario.mfaSecret)

      if (!valido) {
        await registrarAuditLog({
          usuarioId: userId,
          usuarioNombre: usuario.nombre,
          accion: 'MFA_VERIFICACION_FALLIDA',
          modulo: 'seguridad',
          exito: false,
          errorMessage: 'Código TOTP incorrecto durante activación',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        })
        return NextResponse.json({ success: false, error: 'Código incorrecto. Verifica que tu teléfono tenga la hora correcta.' }, { status: 401 })
      }

      // Activar MFA
      await db.usuario.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      })

      await registrarAuditLog({
        usuarioId: userId,
        usuarioNombre: usuario.nombre,
        accion: 'MFA_ACTIVADA',
        modulo: 'seguridad',
        detalles: JSON.stringify({ metodo: 'TOTP' }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: '✅ MFA activado correctamente. A partir de ahora necesitarás el código de Google Authenticator para iniciar sesión.',
      })
    }

    // === DESACTIVAR MFA ===
    if (accion === 'desactivar') {
      const { codigo } = body
      if (!userId || !codigo) {
        return NextResponse.json({ success: false, error: 'userId y código requeridos' }, { status: 400 })
      }

      const usuario = await db.usuario.findUnique({ where: { id: userId } })
      if (!usuario || !usuario.mfaEnabled) {
        return NextResponse.json({ success: false, error: 'MFA no está activado' }, { status: 400 })
      }

      // Verificar código antes de desactivar
      const valido = verifyTOTP(codigo, usuario.mfaSecret!)

      if (!valido) {
        return NextResponse.json({ success: false, error: 'Código incorrecto. Ingresa tu código actual de Google Authenticator.' }, { status: 401 })
      }

      await db.usuario.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null },
      })

      await registrarAuditLog({
        usuarioId: userId,
        usuarioNombre: usuario.nombre,
        accion: 'MFA_DESACTIVADA',
        modulo: 'seguridad',
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: 'MFA desactivado. Tu cuenta es menos segura ahora.',
      })
    }

    // === ENVIAR OTP POR WHATSAPP ===
    // FIX-MISMATCH-MFA: antes se guardaba con clave OTP_WHATSAPP_${telefono} pero
    // /api/auth/login lo buscaba con OTP_WHATSAPP_${usuario.email}, así que el
    // OTP por WhatsApp NUNCA se validaba. Ahora se guardan AMBAS claves (telefono
    // y email) para que el login lo encuentre sin importar cómo se solicite.
    if (accion === 'enviar_otp_whatsapp') {
      const { telefono, usuarioNombre, usuarioEmail } = body
      if (!telefono && !usuarioEmail) {
        return NextResponse.json({ success: false, error: 'telefono o usuarioEmail requerido' }, { status: 400 })
      }

      // Generar OTP de 6 dígitos
      const otp = generarCodigoOtp('numeric', 6)

      // Guardar OTP temporalmente en configuración (expira en 5 min)
      // Guardamos con AMBAS claves (telefono y email) para que el login lo encuentre
      const expiracion = new Date()
      expiracion.setMinutes(expiracion.getMinutes() + 5)
      const valorOtp = JSON.stringify({ otp, expiracion: expiracion.toISOString(), usuarioNombre, telefono })

      const claves: string[] = []
      if (telefono) claves.push(`OTP_WHATSAPP_${telefono}`)
      if (usuarioEmail) claves.push(`OTP_WHATSAPP_${usuarioEmail}`)

      for (const clave of claves) {
        await db.configuracion.upsert({
          where: { clave },
          update: { valor: valorOtp, descripcion: 'OTP temporal WhatsApp' },
          create: { clave, valor: valorOtp, descripcion: 'OTP temporal WhatsApp' },
        })
      }

      // Registrar en OtpRegistro (trazabilidad)
      await registrarOtp({
        clienteId: null,
        clienteCedula: null,
        clienteNombre: usuarioNombre || 'Admin',
        codigoPlano: otp,
        metodo: 'WHATSAPP',
        destinatario: telefono || usuarioEmail || '',
        tipo: 'MFA_ADMIN',
        entidadRefId: null,
        descripcion: `OTP MFA admin ${usuarioNombre || ''}`,
        maxIntentos: 5,
        expiraEnMinutos: 5,
        ipSolicitud: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        guardarCodigoPlano: false,
      })

      // Enviar WhatsApp
      const mensaje = `🔐 *CÓDIGO DE VERIFICACIÓN*

Hola *${usuarioNombre || 'Usuario'}*, tu código de verificación es:

🔢 *${otp}*

Este código expira en 5 minutos. No lo compartas con nadie.

Si no solicitaste este código, ignora este mensaje.`

      const envio = await enviarWhatsApp(telefono, mensaje)

      // Guardar notificación
      await guardarNotificacion({
        db,
        telefono,
        tipo: 'OTP',
        mensaje,
        envio,
      })

      await registrarAuditLog({
        usuarioNombre: usuarioNombre || 'Sistema',
        accion: 'OTP_WHATSAPP_ENVIADO',
        modulo: 'seguridad',
        detalles: JSON.stringify({ telefono }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: 'Código OTP enviado por WhatsApp',
        whatsapp: envio,
      })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
