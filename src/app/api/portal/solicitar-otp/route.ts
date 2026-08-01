import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generarCodigoOtp, registrarOtp, obtenerIp, obtenerUserAgent } from '@/lib/otp'
import { enviarEmail } from '@/lib/email'

// POST /api/portal/solicitar-otp
// Solicita OTP para firma de un préstamo desde el portal del cliente.
//
// Fixes aplicados:
//  - db.firma → db.firmaElectronica
//  - db.notificacion → db.notificacionLog
//  - Eliminado otpDemo de la respuesta (vulnerabilidad S1)
//  - OTP se guarda HASHEADO (SHA-256) en firma.otpCodigo, no en texto plano
//  - Se escribe registro en OtpRegistro (trazabilidad centralizada)
//  - Si canal=EMAIL, se envía por correo automáticamente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // FIXED v5.0: el OTP del portal SIEMPRE se envía por correo electrónico.
    // La modalidad (WhatsApp/Email/Ambos) SOLO aplica a OTPs de préstamos.
    // El parámetro `canal` del body se ignora para forzar canal=EMAIL.
    const canal = 'EMAIL'
    const { firmaId } = body

    if (!firmaId) {
      return NextResponse.json({ error: 'firmaId requerido' }, { status: 400 })
    }

    const firma = await db.firmaElectronica.findUnique({
      where: { id: firmaId },
      include: { prestamo: { include: { cliente: true } } },
    })
    if (!firma) {
      return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    }
    if (!firma.prestamo || !firma.prestamo.cliente) {
      return NextResponse.json({ error: 'Préstamo/cliente asociado a la firma no encontrado' }, { status: 404 })
    }

    // Verificar intentos previos
    if (firma.intentosOTP >= firma.maxIntentos) {
      return NextResponse.json({ error: 'Máximo de intentos alcanzado' }, { status: 429 })
    }

    // Generar OTP nuevo (numérico 6 dígitos)
    const otp = generarCodigoOtp('numeric', 6)
    const cliente = firma.prestamo.cliente
    const telefono = cliente.telefono || ''
    const email = cliente.email || ''
    const ip = obtenerIp(req)
    const ua = obtenerUserAgent(req)

    // FIXED v5.0: canal siempre EMAIL
    const canalEf: 'EMAIL' = 'EMAIL'

    if (!email) {
      return NextResponse.json(
        {
          error:
            'Tu cuenta no tiene un correo electrónico registrado. Contacta al administrador para actualizar tu correo antes de continuar.',
        },
        { status: 400 }
      )
    }

    // Registrar en OtpRegistro (trazabilidad centralizada)
    const otpRegistro = await registrarOtp({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      codigoPlano: otp,
      metodo: canalEf,
      destinatario: canalEf === 'EMAIL' ? email : telefono,
      tipo: 'FIRMA_PORTAL',
      entidadRefId: firma.id,
      descripcion: `OTP firma TyC préstamo ${firma.prestamo.codigo}`,
      maxIntentos: firma.maxIntentos,
      expiraEnMinutos: 5,
      ipSolicitud: ip,
      userAgent: ua,
      guardarCodigoPlano: false,
    })

    // Guardar OTP HASHEADO en la firma
    // (hashOtp está dentro de registrarOtp; aquí lo llamamos de nuevo
    //  para obtener el mismo hash y guardarlo en firma.otpCodigo.)
    const { hashOtp } = await import('@/lib/otp')
    await db.firmaElectronica.update({
      where: { id: firmaId },
      data: {
        otpCodigo: hashOtp(otp),
        otpCanal: canalEf,
        otpEnviado: true,
        otpFechaEnvio: new Date(),
        estadoFirma: 'OTP_ENVIADO',
      },
    })

    // Enviar por canal EMAIL (único canal permitido para OTPs del portal)
    let envioEmail = false

    const resultado = await enviarEmail({
      to: email,
      subject: 'Tu código OTP — Aurora Bancaria',
      text: `Hola ${cliente.nombre},

Tu código de verificación es: ${otp}

Este código es válido por 5 minutos. No lo compartas con nadie.

Si no solicitaste este código, ignora este correo.

— Aurora Bancaria`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px;">
  <h2 style="color: #1e40af; margin-bottom: 8px;">Aurora Bancaria</h2>
  <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Verificación de firma electrónica</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;">
  <p>Hola <strong>${cliente.nombre}</strong>,</p>
  <p>Tu código de verificación es:</p>
  <div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; background: #f3f4f6; padding: 16px 32px; border-radius: 8px; font-family: 'Courier New', monospace;">${otp}</div>
  </div>
  <p style="color: #6b7280; font-size: 13px;">Este código expira en <strong>5 minutos</strong>. No lo compartas con nadie.</p>
  <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este código, ignora este correo.</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">Aurora Bancaria v5.0 — Sistema de préstamos</p>
</div>`,
    })
    envioEmail = resultado.success
    if (!envioEmail) {
      console.error('[portal/solicitar-otp] Falla envío email:', resultado.error)
    }

    // Registrar envío en NotificacionLog
    await db.notificacionLog.create({
      data: {
        prestamoId: firma.prestamoId,
        clienteTelefono: telefono,
        tipo: 'OTP',
        mensaje: `OTP solicitado vía EMAIL para firma de préstamo ${firma.prestamo.codigo}`,
        estado: envioEmail ? 'ENVIADO' : 'FALLIDO',
        fechaEnvio: new Date(),
      },
    })

    // Bitácora de acceso portal
    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: ip,
        userAgent: ua,
        accion: 'OTP_SOLICITADO',
        exito: envioEmail,
        detalle: `OTP solicitado por canal EMAIL. Email: ${envioEmail ? 'OK' : 'falló'}`,
      },
    })

    // Respuesta SIN exponer el OTP
    return NextResponse.json({
      otpGenerado: true,
      otpRegistroId: otpRegistro.id,
      canal: canalEf,
      expiraEn: otpRegistro.expiraEn,
      emailEnviado: envioEmail,
      emailEnmascarado: email ? email.slice(0, 2) + '***' + email.slice(email.indexOf('@')) : null,
    })
  } catch (e) {
    console.error('[portal/solicitar-otp] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
