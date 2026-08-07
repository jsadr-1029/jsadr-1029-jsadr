import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generarCodigoOtp, hashOtp, verificarOtp, registrarOtp, obtenerIp, obtenerUserAgent } from '@/lib/otp'
import { calcularPrestamo } from '@/lib/finanzas'
import { enviarWhatsApp, mensajeOTPFirma, guardarNotificacion } from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'
import { sanitizeError } from '@/lib/error-handler'
import crypto from 'crypto'

// POST - crear firma y enviar OTP / guardar fotos / validar OTP
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accion } = body

    if (accion === 'iniciar_firma') {
      return await iniciarFirma(body, req)
    } else if (accion === 'enviar_otp') {
      return await enviarOTP(body)
    } else if (accion === 'guardar_fotos') {
      return await guardarFotos(body, req)
    } else if (accion === 'guardar_firma') {
      return await guardarFirma(body, req)
    } else if (accion === 'validar_otp') {
      return await validarOTP(body)
    } else if (accion === 'rechazar_firma') {
      return await rechazarFirma(body)
    }

    return NextResponse.json({ success: false, error: 'Acción no válida. Usa: iniciar_firma, enviar_otp, guardar_fotos, guardar_firma, validar_otp, rechazar_firma' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// === INICIAR FIRMA: crea FirmaElectronica + TokenFirma y devuelve info al cliente ===
// Si el préstamo tiene codeudor, crea DOS firmas (deudor + codeudor) con el mismo canal OTP
async function iniciarFirma(body: any, req: NextRequest) {
  const { prestamoId, clienteId, tipo, canal } = body
  if (!clienteId && !prestamoId) {
    return NextResponse.json({ success: false, error: 'clienteId o prestamoId requerido' }, { status: 400 })
  }

  // Buscar cliente y préstamo
  let cliente: any = null
  let prestamo: any = null
  if (prestamoId) {
    prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    })
    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
    }
    cliente = prestamo.cliente
  } else {
    cliente = await db.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
  }

  if (!cliente) {
    return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  }

  const canalFinal = canal || 'AMBOS' // WHATSAPP | EMAIL | AMBOS
  if (canalFinal === 'EMAIL' && !cliente.email) {
    return NextResponse.json({
      success: false,
      error: 'El cliente no tiene correo electrónico registrado. Usa canal WHATSAPP o AMBOS, o registra el email del cliente.',
    }, { status: 400 })
  }

  // === Helper para crear una firma + token ===
  const crearFirmaYToken = async (
    clienteFirma: any,
    prestamoFirma: any,
    esCodeudor: boolean,
    canalOtp: string
  ) => {
    const firmaCreada = await db.firmaElectronica.create({
      data: {
        prestamoId: prestamoFirma?.id || null,
        clienteId: clienteFirma.id,
        tipo: tipo || 'PAGARE',
        imagenFirma: '', // se llenará después
        otpCanal: canalOtp,
        estadoFirma: 'PENDIENTE',
        esFirmaCodeudor: esCodeudor,
        firmanteRol: esCodeudor ? 'CODEUDOR' : 'DEUDOR',
        firmanteNombre: clienteFirma.nombre,
        firmanteCedula: clienteFirma.cedula,
      },
    })

    const tokenCreado = crypto.randomBytes(32).toString('hex')
    const fechaExp = new Date()
    fechaExp.setDate(fechaExp.getDate() + 7)

    const tokenFirmaCreado = await db.tokenFirma.create({
      data: {
        token: tokenCreado,
        firmaId: firmaCreada.id,
        prestamoId: prestamoFirma?.id || null,
        clienteId: clienteFirma.id,
        fechaExpiracion: fechaExp,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const linkFirmaCreado = `${baseUrl}/firma/${tokenCreado}`

    return { firma: firmaCreada, tokenFirma: tokenFirmaCreado, token: tokenCreado, linkFirma: linkFirmaCreado, expiracion: fechaExp }
  }

  // === Crear firma del DEUDOR ===
  const resultadoDeudor = await crearFirmaYToken(cliente, prestamo, false, canalFinal)

  // === Si el préstamo tiene codeudor, crear firma del CODEUDOR ===
  let resultadoCodeudor: any = null
  let codeudor: any = null

  if (prestamo?.tieneCodeudor && prestamo?.codeudorId) {
    codeudor = await db.cliente.findUnique({ where: { id: prestamo.codeudorId } })
    if (codeudor) {
      // Validar que el codeudor tenga email si el canal es EMAIL
      if (canalFinal === 'EMAIL' && !codeudor.email) {
        return NextResponse.json({
          success: false,
          error: 'El codeudor no tiene correo electrónico registrado. Usa canal WHATSAPP o AMBOS, o registra el email del codeudor.',
        }, { status: 400 })
      }

      resultadoCodeudor = await crearFirmaYToken(codeudor, prestamo, true, canalFinal)

      // Vincular la firma del codeudor al préstamo
      await db.prestamo.update({
        where: { id: prestamo.id },
        data: { codeudorFirmaId: resultadoCodeudor.firma.id },
      })
    }
  }

  // Generar URLs públicas de firma
  const linkFirma = resultadoDeudor.linkFirma
  const linkFirmaCodeudor = resultadoCodeudor?.linkFirma || null

  // === Generar mensajes de WhatsApp para AMBOS firmantes ===
  const generarMensajeWhatsApp = (nombreFirmante: string, link: string, esCodeudor: boolean) => {
    const rol = esCodeudor ? 'CODEUDOR' : 'DEUDOR'
    return `🔐 *FIRMA ELECTRÓNICA - PRÉSTAMO ${prestamo?.codigo || ''}*

Hola *${nombreFirmante}*,

Como *${rol}* del préstamo, necesitas firmar electrónicamente los Términos y Condiciones.

📋 *Pasos a seguir:*
1. Ingresa al siguiente link: ${link}
2. Sube foto de tu cédula (frente)
3. Tómate una selfie sosteniendo la cédula
4. Dibuja tu firma en pantalla
5. Recibirás un código OTP por ${canalFinal === 'AMBOS' ? 'WhatsApp y correo' : canalFinal === 'EMAIL' ? 'correo' : 'WhatsApp'}
6. Ingresa el código para completar la firma

⏰ *Importante:* El link expira en 7 días.

Si tienes dudas, responde a este mensaje.`
  }

  // Enviar WhatsApp al deudor
  let envioWhatsAppDeudor: any = null
  if (canalFinal === 'WHATSAPP' || canalFinal === 'AMBOS') {
    const mensajeDeudor = generarMensajeWhatsApp(cliente.nombre, linkFirma, false)
    envioWhatsAppDeudor = await enviarWhatsApp(cliente.telefono, mensajeDeudor)
    await guardarNotificacion({
      db,
      prestamoId: prestamo?.id || null,
      telefono: cliente.telefono,
      tipo: 'OTP',
      mensaje: mensajeDeudor,
      envio: envioWhatsAppDeudor,
    })
  }

  // Enviar WhatsApp al codeudor
  let envioWhatsAppCodeudor: any = null
  if (resultadoCodeudor && codeudor && (canalFinal === 'WHATSAPP' || canalFinal === 'AMBOS')) {
    const mensajeCodeudor = generarMensajeWhatsApp(codeudor.nombre, linkFirmaCodeudor, true)
    envioWhatsAppCodeudor = await enviarWhatsApp(codeudor.telefono, mensajeCodeudor)
    await guardarNotificacion({
      db,
      prestamoId: prestamo?.id || null,
      telefono: codeudor.telefono,
      tipo: 'OTP',
      mensaje: mensajeCodeudor,
      envio: envioWhatsAppCodeudor,
    })
  }

  // Enviar email al deudor
  let envioEmailDeudor: any = null
  if ((canalFinal === 'EMAIL' || canalFinal === 'AMBOS') && cliente.email) {
    try {
      envioEmailDeudor = await enviarEmail({
        to: cliente.email,
        subject: `Firma Electrónica - Préstamo ${prestamo?.codigo || ''}`,
        text: `Estimado/a ${cliente.nombre},\n\nComo DEUDOR del préstamo, necesitas firmar electrónicamente los Términos y Condiciones.\n\nIngresa al siguiente link: ${linkFirma}\n\nEl link expira en 7 días.`,
      })
    } catch (e) {
      console.error('[iniciarFirma] Error enviando email al deudor:', e)
    }
  }

  // Enviar email al codeudor
  let envioEmailCodeudor: any = null
  if (resultadoCodeudor && codeudor && (canalFinal === 'EMAIL' || canalFinal === 'AMBOS') && codeudor.email) {
    try {
      envioEmailCodeudor = await enviarEmail({
        to: codeudor.email,
        subject: `Firma Electrónica - Préstamo ${prestamo?.codigo || ''} (Codeudor)`,
        text: `Estimado/a ${codeudor.nombre},\n\nComo CODEUDOR del préstamo, necesitas firmar electrónicamente los Términos y Condiciones.\n\nIngresa al siguiente link: ${linkFirmaCodeudor}\n\nEl link expira en 7 días.`,
      })
    } catch (e) {
      console.error('[iniciarFirma] Error enviando email al codeudor:', e)
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      firmaId: resultadoDeudor.firma.id,
      token: resultadoDeudor.token,
      tokenId: resultadoDeudor.tokenFirma.id,
      linkFirma,
      canal: canalFinal,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        email: cliente.email,
      },
      prestamo: prestamo ? {
        id: prestamo.id,
        codigo: prestamo.codigo,
        montoPrincipal: prestamo.montoPrincipal,
        montoCuota: prestamo.montoCuota,
        numeroCuotas: prestamo.numeroCuotas,
        frecuencia: prestamo.frecuencia,
        totalPagar: prestamo.totalPagar,
      } : null,
      expiracion: resultadoDeudor.expiracion.toISOString(),
      // === Datos del codeudor (si existe) ===
      tieneCodeudor: !!resultadoCodeudor,
      firmaIdCodeudor: resultadoCodeudor?.firma.id || null,
      tokenCodeudor: resultadoCodeudor?.token || null,
      linkFirmaCodeudor: linkFirmaCodeudor || null,
      codeudor: codeudor ? {
        id: codeudor.id,
        nombre: codeudor.nombre,
        cedula: codeudor.cedula,
        telefono: codeudor.telefono,
        email: codeudor.email,
      } : null,
      // === Resultado de envíos ===
      envios: {
        whatsappDeudor: envioWhatsAppDeudor ? 'enviado' : 'no_enviado',
        whatsappCodeudor: envioWhatsAppCodeudor ? 'enviado' : 'no_enviado',
        emailDeudor: envioEmailDeudor ? 'enviado' : 'no_enviado',
        emailCodeudor: envioEmailCodeudor ? 'enviado' : 'no_enviado',
      },
      mensaje: resultadoCodeudor
        ? `✅ Se crearon 2 firmas electrónicas (deudor + codeudor). Se enviaron links por ${canalFinal} a ambos: ${cliente.nombre} (${cliente.telefono}) y ${codeudor.nombre} (${codeudor.telefono}).`
        : `✅ Se creó 1 firma electrónica para ${cliente.nombre}. Se envió el link por ${canalFinal}.`,
    },
  })
}

// === ENVIAR OTP por WhatsApp y/o correo ===
async function enviarOTP(body: any) {
  const { firmaId, canal } = body
  if (!firmaId) {
    return NextResponse.json({ success: false, error: 'firmaId requerido' }, { status: 400 })
  }

  const firma = await db.firmaElectronica.findUnique({
    where: { id: firmaId },
    include: { cliente: true, prestamo: true },
  })
  if (!firma) {
    return NextResponse.json({ success: false, error: 'Firma no encontrada' }, { status: 404 })
  }
  if (!firma.cliente) {
    return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Verificar intentos máximos
  if (firma.intentosOTP >= firma.maxIntentos) {
    await db.firmaElectronica.update({
      where: { id: firmaId },
      data: { estadoFirma: 'RECHAZADA' },
    })
    return NextResponse.json({
      success: false,
      error: `Has excedido el máximo de ${firma.maxIntentos} intentos. La firma ha sido rechazada.`,
    }, { status: 400 })
  }

  const otp = generarCodigoOtp('numeric', 6)
  const canalFinal = canal || firma.otpCanal || 'WHATSAPP'

  let envioWhatsApp: any = null
  let envioEmail: any = null

  // Enviar OTP por WhatsApp
  if (canalFinal === 'WHATSAPP' || canalFinal === 'AMBOS') {
    const mensaje = mensajeOTPFirma({
      nombreCliente: firma.cliente.nombre,
      codigoOtp: otp,
      tipoDocumento: firma.tipo === 'TYC' ? 'Términos y Condiciones' : firma.tipo,
    })
    envioWhatsApp = await enviarWhatsApp(firma.cliente.telefono, mensaje)
    await guardarNotificacion({
      db,
      prestamoId: firma.prestamoId || null,
      telefono: firma.cliente.telefono,
      tipo: 'OTP',
      mensaje,
      envio: envioWhatsApp,
    })
  }

  // Enviar OTP por Email
  if ((canalFinal === 'EMAIL' || canalFinal === 'AMBOS') && firma.cliente.email) {
    const subject = `Código de Verificación - Firma Electrónica ${firma.prestamo?.codigo || ''}`
    const textContent = `Estimado/a ${firma.cliente.nombre},

Tu código de verificación para completar la firma electrónica es:

  >>  ${otp}  <<

Este código expira en 5 minutos.
No compartas este código con nadie.

Saludos,
Sistema de Gestión de Préstamos`

    const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e40af;">🔐 Código de Verificación</h2>
  <p>Hola <strong>${firma.cliente.nombre}</strong>,</p>
  <p>Tu código para completar la firma electrónica es:</p>
  <div style="background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
    <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace;">${otp}</div>
  </div>
  <p style="color: #6b7280; font-size: 12px;">⏰ Expira en 5 minutos<br>
  ⚠️ No compartas este código con nadie.</p>
</div>`

    envioEmail = await enviarEmail({
      to: firma.cliente.email,
      subject,
      text: textContent,
      html: htmlContent,
    })
  }

  // Registrar OTP centralizado en OtpRegistro (trazabilidad)
  const otpRegistro = await registrarOtp({
    clienteId: firma.clienteId,
    clienteCedula: firma.cliente.cedula,
    clienteNombre: firma.cliente.nombre,
    codigoPlano: otp,
    metodo: canalFinal as 'WHATSAPP' | 'EMAIL' | 'AMBOS',
    destinatario: canalFinal === 'EMAIL' ? (firma.cliente.email || '') : (firma.cliente.telefono || ''),
    tipo: 'FIRMA_ELECTRONICA',
    entidadRefId: firma.id,
    descripcion: `OTP firma ${firma.tipo} préstamo ${firma.prestamo?.codigo || 'N/A'}`,
    maxIntentos: firma.maxIntentos,
    expiraEnMinutos: 5,
    ipSolicitud: null,
    userAgent: null,
    guardarCodigoPlano: false,
  })

  // Actualizar firma con OTP HASHEADO (no texto plano)
  await db.firmaElectronica.update({
    where: { id: firmaId },
    data: {
      otpEnviado: true,
      otpCodigo: hashOtp(otp),  // SHA-256 hash
      otpCanal: canalFinal,
      otpFechaEnvio: new Date(),
      estadoFirma: 'OTP_ENVIADO',
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      firmaId: firma.id,
      otpRegistroId: otpRegistro.id,
      otpEnviado: true,
      canal: canalFinal,
      expiraEn: otpRegistro.expiraEn.toISOString(),
      emailDestino: firma.cliente.email || null,
      telefonoDestino: firma.cliente.telefono,
      whatsapp: envioWhatsApp,
      email: envioEmail,
    },
  })
}

// === GUARDAR FOTOS: documento y selfie ===
async function guardarFotos(body: any, req: NextRequest) {
  const { firmaId, fotoDocumento, fotoSelfie, geoUbicacion } = body
  if (!firmaId) {
    return NextResponse.json({ success: false, error: 'firmaId requerido' }, { status: 400 })
  }
  if (!fotoDocumento || !fotoSelfie) {
    return NextResponse.json({
      success: false,
      error: 'fotoDocumento y fotoSelfie son obligatorios (en formato base64)',
    }, { status: 400 })
  }

  const firma = await db.firmaElectronica.findUnique({ where: { id: firmaId } })
  if (!firma) {
    return NextResponse.json({ success: false, error: 'Firma no encontrada' }, { status: 404 })
  }
  if (firma.estadoFirma === 'COMPLETADA') {
    return NextResponse.json({ success: false, error: 'Esta firma ya fue completada' }, { status: 400 })
  }

  // Validar que sean base64 con data URL
  if (!fotoDocumento.startsWith('data:image/')) {
    return NextResponse.json({ success: false, error: 'fotoDocumento debe ser una imagen en base64 (data:image/...)' }, { status: 400 })
  }
  if (!fotoSelfie.startsWith('data:image/')) {
    return NextResponse.json({ success: false, error: 'fotoSelfie debe ser una imagen en base64 (data:image/...)' }, { status: 400 })
  }

  // Validar tamaño (máx 10MB por foto, base64 ~14MB)
  const tamanoDoc = Buffer.byteLength(fotoDocumento, 'utf8')
  const tamanoSelfie = Buffer.byteLength(fotoSelfie, 'utf8')
  if (tamanoDoc > 14 * 1024 * 1024 || tamanoSelfie > 14 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Las fotos no pueden superar 10MB cada una' }, { status: 400 })
  }

  // Calcular hashes SHA-256 (para integridad)
  const hashDoc = crypto.createHash('sha256').update(fotoDocumento).digest('hex')
  const hashSelfie = crypto.createHash('sha256').update(fotoSelfie).digest('hex')

  // Obtener IP y user agent
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'desconocida'
  const userAgent = req.headers.get('user-agent') || 'desconocido'

  await db.firmaElectronica.update({
    where: { id: firmaId },
    data: {
      fotoDocumento,
      fotoSelfie,
      fotoDocumentoHash: hashDoc,
      fotoSelfieHash: hashSelfie,
      ipFirma: ip,
      userAgent,
      geoUbicacion: geoUbicacion || null,
      fechaSubidaFotos: new Date(),
      estadoFirma: 'FOTOS_SUBIDAS',
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      firmaId,
      estado: 'FOTOS_SUBIDAS',
      hashDocumento: hashDoc,
      hashSelfie: hashSelfie,
      ip,
      userAgent,
    },
    mensaje: 'Fotos guardadas correctamente. Ahora puedes dibujar tu firma.',
  })
}

// === VALIDAR OTP (sin guardar firma todavía) ===
async function validarOTP(body: any) {
  const { firmaId, otpIngresado } = body
  if (!firmaId || !otpIngresado) {
    return NextResponse.json({ success: false, error: 'firmaId y otpIngresado son obligatorios' }, { status: 400 })
  }

  const firma = await db.firmaElectronica.findUnique({ where: { id: firmaId } })
  if (!firma) {
    return NextResponse.json({ success: false, error: 'Firma no encontrada' }, { status: 404 })
  }

  // Verificar expiración (5 minutos)
  if (!firma.otpFechaEnvio) {
    return NextResponse.json({ success: false, error: 'No se ha enviado el código OTP todavía' }, { status: 400 })
  }
  const expiracion = new Date(firma.otpFechaEnvio.getTime())
  expiracion.setMinutes(expiracion.getMinutes() + 5)
  if (new Date() > expiracion) {
    return NextResponse.json({ success: false, error: 'El código OTP ha expirado. Solicita uno nuevo.' }, { status: 400 })
  }

  // Incrementar intentos
  await db.firmaElectronica.update({
    where: { id: firmaId },
    data: { intentosOTP: { increment: 1 } },
  })

  // Comparación constant-time contra el hash SHA-256 almacenado
  // (firma.otpCodigo ahora guarda el hash, no el código plano)
  const otpValido = verificarOtp(String(otpIngresado), firma.otpCodigo || '')
  if (!otpValido) {
    const intentosRestantes = firma.maxIntentos - (firma.intentosOTP + 1)
    if (intentosRestantes <= 0) {
      await db.firmaElectronica.update({
        where: { id: firmaId },
        data: { estadoFirma: 'RECHAZADA' },
      })
      return NextResponse.json({
        success: false,
        error: 'Código incorrecto. Has agotado todos los intentos. Firma rechazada.',
      }, { status: 400 })
    }
    return NextResponse.json({
      success: false,
      error: `Código incorrecto. Te quedan ${intentosRestantes} intento(s).`,
    }, { status: 400 })
  }

  // OTP correcto
  await db.firmaElectronica.update({
    where: { id: firmaId },
    data: {
      otpValidado: true,
      otpFechaValidacion: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    mensaje: 'OTP validado correctamente. Ya puedes guardar tu firma.',
  })
}

// === GUARDAR FIRMA: requiere OTP validado + fotos subidas ===
async function guardarFirma(body: any, req: NextRequest) {
  const { firmaId, imagenFirma } = body
  if (!firmaId || !imagenFirma) {
    return NextResponse.json(
      { success: false, error: 'firmaId e imagenFirma son obligatorios' },
      { status: 400 }
    )
  }

  const firma = await db.firmaElectronica.findUnique({ where: { id: firmaId } })
  if (!firma) {
    return NextResponse.json({ success: false, error: 'Firma no encontrada' }, { status: 404 })
  }
  if (!firma.otpValidado) {
    return NextResponse.json({ success: false, error: 'Debes validar el código OTP antes de guardar la firma' }, { status: 400 })
  }
  if (!firma.fotoDocumento || !firma.fotoSelfie) {
    return NextResponse.json({ success: false, error: 'Debes subir las fotos del documento y selfie antes de firmar' }, { status: 400 })
  }
  if (firma.estadoFirma === 'COMPLETADA') {
    return NextResponse.json({ success: false, error: 'Esta firma ya fue completada' }, { status: 400 })
  }

  // Validar que la firma sea base64 PNG
  if (!imagenFirma.startsWith('data:image/png')) {
    return NextResponse.json({ success: false, error: 'imagenFirma debe ser un PNG en base64' }, { status: 400 })
  }

  // Guardar firma
  const firmaActualizada = await db.firmaElectronica.update({
    where: { id: firmaId },
    data: {
      imagenFirma,
      estadoFirma: 'COMPLETADA',
      fechaFirmaCompleta: new Date(),
    },
  })

  // Marcar el token como usado
  await db.tokenFirma.updateMany({
    where: { firmaId },
    data: { usado: true, fechaUsado: new Date() },
  })

  // Si es de un préstamo, actualizar referencia y aceptar T&C automáticamente
  if (firma.prestamoId) {
    // Calcular fecha de vencimiento real según el plazo del préstamo (fix bug de precedencia JS)
    const prestamoFirma = await db.prestamo.findUnique({
      where: { id: firma.prestamoId },
      select: { plazoMeses: true, frecuencia: true, montoPrincipal: true, tasaInteresAnual: true, fechaDesembolso: true, codigo: true, cliente: { select: { nombre: true } } },
    })

    let fechaVencimientoCalc = new Date()
    if (prestamoFirma) {
      // Usar calcularPrestamo para obtener la fecha de vencimiento correcta según plazo y frecuencia
      try {
        const calc = calcularPrestamo({
          montoPrincipal: prestamoFirma.montoPrincipal,
          tasaInteresAnual: prestamoFirma.tasaInteresAnual,
          tasaMoraAnual: 0,
          plazoMeses: prestamoFirma.plazoMeses,
          frecuencia: prestamoFirma.frecuencia as any,
          fechaDesembolso: new Date(),
        })
        if (calc?.tablaAmortizacion?.length > 0) {
          // La fecha de vencimiento es la última cuota
          fechaVencimientoCalc = new Date(calc.tablaAmortizacion[calc.tablaAmortizacion.length - 1].fechaVencimiento)
        } else {
          // Fallback: sumar plazoMeses meses a hoy
          fechaVencimientoCalc = new Date()
          fechaVencimientoCalc.setMonth(fechaVencimientoCalc.getMonth() + (prestamoFirma.plazoMeses || 1))
        }
      } catch (e) {
        // Fallback seguro: sumar plazoMeses meses
        fechaVencimientoCalc = new Date()
        fechaVencimientoCalc.setMonth(fechaVencimientoCalc.getMonth() + (prestamoFirma.plazoMeses || 1))
      }
    }

    await db.prestamo.update({
      where: { id: firma.prestamoId },
      data: {
        firmaId: firma.id,
        tycAceptado: true,
        tycFechaAceptacion: new Date(),
        estado: 'ACTIVO',
        fechaDesembolso: new Date(),
        fechaVencimiento: fechaVencimientoCalc,
      },
    })

    // Registrar en bitácora del préstamo
    if (prestamoFirma) {
      try {
        await db.bitacoraPrestamo.create({
          data: {
            prestamoId: firma.prestamoId,
            prestamoCodigo: prestamoFirma.codigo,
            usuarioNombre: 'Sistema (firma electrónica)',
            tipo: 'FIRMA',
            titulo: 'Firma electrónica completada — préstamo activado',
            descripcion: `El cliente ${prestamoFirma.cliente?.nombre || ''} completó el flujo de firma electrónica (foto + firma + OTP). Préstamo activado con fecha de vencimiento ${fechaVencimientoCalc.toLocaleDateString('es-CO')} (${prestamoFirma.plazoMeses} meses).`,
            resultado: 'Préstamo pasado a ACTIVO, TyC aceptados, firma vinculada',
          },
        })
      } catch (e) {
        console.error('[firma] bitácora falló:', e)
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: firmaActualizada,
    mensaje: '¡Firma electrónica completada con éxito! El préstamo ha sido activado.',
  })
}

// === RECHAZAR FIRMA (por si el cliente decide no firmar) ===
async function rechazarFirma(body: any) {
  const { firmaId, motivo } = body
  if (!firmaId) {
    return NextResponse.json({ success: false, error: 'firmaId requerido' }, { status: 400 })
  }

  const firma = await db.firmaElectronica.findUnique({ where: { id: firmaId } })
  if (!firma) {
    return NextResponse.json({ success: false, error: 'Firma no encontrada' }, { status: 404 })
  }
  if (firma.estadoFirma === 'COMPLETADA') {
    return NextResponse.json({ success: false, error: 'No se puede rechazar una firma completada' }, { status: 400 })
  }

  await db.firmaElectronica.update({
    where: { id: firmaId },
    data: { estadoFirma: 'RECHAZADA' },
  })

  // Marcar tokens como usados
  await db.tokenFirma.updateMany({
    where: { firmaId },
    data: { usado: true, fechaUsado: new Date() },
  })

  return NextResponse.json({
    success: true,
    mensaje: 'Firma rechazada. El cliente deberá iniciar el proceso nuevamente.',
  })
}

// GET - obtener estado de una firma
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const firmaId = searchParams.get('firmaId')
    const token = searchParams.get('token')

    if (token) {
      // Verificar token público
      const tokenFirma = await db.tokenFirma.findUnique({
        where: { token },
        include: {
          firma: {
            include: {
              cliente: {
                select: {
                  id: true,
                  nombre: true,
                  cedula: true,
                  telefono: true,
                  email: true,
                },
              },
              prestamo: true,
            },
          },
        },
      })

      if (!tokenFirma) {
        return NextResponse.json({ success: false, error: 'Token de firma no válido' }, { status: 404 })
      }

      if (tokenFirma.usado) {
        return NextResponse.json({
          success: true,
          data: {
            estado: 'USADO',
            firma: tokenFirma.firma,
            mensaje: 'Este enlace ya fue utilizado.',
          },
        })
      }

      if (new Date() > tokenFirma.fechaExpiracion) {
        return NextResponse.json({
          success: true,
          data: {
            estado: 'EXPIRADO',
            firma: tokenFirma.firma,
            mensaje: 'Este enlace ha expirado.',
          },
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          estado: 'VALIDO',
          firma: tokenFirma.firma,
          cliente: tokenFirma.firma.cliente,
          prestamo: tokenFirma.firma.prestamo,
          expiracion: tokenFirma.fechaExpiracion,
        },
      })
    }

    if (firmaId) {
      const firma = await db.firmaElectronica.findUnique({
        where: { id: firmaId },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              cedula: true,
              telefono: true,
              email: true,
            },
          },
          prestamo: true,
        },
      })
      if (!firma) {
        return NextResponse.json({ success: false, error: 'Firma no encontrada' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: firma })
    }

    return NextResponse.json({ success: false, error: 'Especifica firmaId o token' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
