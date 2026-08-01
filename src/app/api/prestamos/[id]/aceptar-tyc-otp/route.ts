import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, getTasaMoraAnual } from '@/lib/finanzas'
import { generarCodigoOtp, hashOtp, verificarOtp, registrarOtp } from '@/lib/otp'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'
import crypto from 'crypto'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// GET /api/prestamos/[id]/aceptar-tyc-otp
// Ejecuta check_otp automáticamente — usado por el portal del cliente
// para saber si ya hay un OTP activo (no expirado) y NO generar uno nuevo.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prestamoId } = await params
    return await checkOTP(prestamoId)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prestamoId } = await params
    const body = await req.json()
    const { accion } = body

    if (accion === 'enviar_otp') return await enviarOTP(prestamoId, body)
    if (accion === 'validar_otp') return await validarOTP(prestamoId, body)
    if (accion === 'confirmar_con_foto') return await confirmarConFoto(prestamoId, body)
    if (accion === 'check_otp') return await checkOTP(prestamoId)

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

async function enviarOTP(prestamoId: string, body: any) {
  const { canal } = body
  const canalFinal = canal || 'AMBOS'
  const prestamo = await db.prestamo.findUnique({ where: { id: prestamoId }, include: { cliente: true } })
  if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  if (prestamo.estado !== 'PENDIENTE_ACEPTACION') return NextResponse.json({ success: false, error: 'El préstamo no está pendiente de aceptación' }, { status: 400 })
  if (!prestamo.cliente) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  if (canalFinal === 'EMAIL' && !prestamo.cliente.email) return NextResponse.json({ success: false, error: 'El cliente no tiene correo electrónico' }, { status: 400 })

  // === PROTECCIÓN: NO generar OTP nuevo si hay uno ACTIVO y no validado ===
  // Si el cliente vuelve a entrar al portal o vuelve a pedir OTP, pero ya tiene
  // uno vigente (no expirado, no validado), se mantiene el mismo código y NO se
  // genera uno nuevo. Solo cuando expire (5 min) se podrá generar otro.
  const firmaExistente = await db.firmaElectronica.findFirst({
    where: {
      prestamoId,
      tipo: 'TYC',
      estadoFirma: { in: ['OTP_ENVIADO', 'FOTOS_SUBIDAS'] },
      otpEnviado: true,
      otpFechaEnvio: { not: null },
      otpValidado: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (firmaExistente && firmaExistente.otpFechaEnvio) {
    const exp = new Date(firmaExistente.otpFechaEnvio.getTime() + 5 * 60000)
    const ahora = new Date()
    if (ahora < exp && !firmaExistente.otpValidado) {
      // OTP aún vigente — NO generar uno nuevo
      const segundosRestantes = Math.max(0, Math.floor((exp.getTime() - ahora.getTime()) / 1000))
      return NextResponse.json({
        success: true,
        data: {
          firmaId: firmaExistente.id,
          otpEnviado: true,
          canal: firmaExistente.otpCanal,
          segundosRestantes,
          emailDestino: prestamo.cliente.email || null,
          telefonoDestino: prestamo.cliente.telefono,
          reutilizado: true, // indica que NO se generó uno nuevo
        },
        mensaje: `Ya tienes un código activo. Revisa tu WhatsApp/correo. Tiempo restante: ${Math.floor(segundosRestantes / 60)}:${(segundosRestantes % 60).toString().padStart(2, '0')}.`,
      })
    }
  }

  // === Generar nuevo OTP (no hay activo o ya expiró) ===
  const otp = generarCodigoOtp('numeric', 6)
  let firma = await db.firmaElectronica.findFirst({ where: { prestamoId, tipo: 'TYC', estadoFirma: { in: ['PENDIENTE', 'OTP_ENVIADO'] } }, orderBy: { createdAt: 'desc' } })
  if (firma) {
    firma = await db.firmaElectronica.update({ where: { id: firma.id }, data: { otpEnviado: true, otpCodigo: hashOtp(otp), otpCanal: canalFinal, otpFechaEnvio: new Date(), estadoFirma: 'OTP_ENVIADO', intentosOTP: 0, otpValidado: false } })
  } else {
    firma = await db.firmaElectronica.create({ data: { prestamoId, clienteId: prestamo.cliente.id, tipo: 'TYC', imagenFirma: '', otpEnviado: true, otpCodigo: hashOtp(otp), otpCanal: canalFinal, otpFechaEnvio: new Date(), estadoFirma: 'OTP_ENVIADO' } })
  }

  // Registrar en OtpRegistro (trazabilidad centralizada)
  const otpRegistro = await registrarOtp({
    clienteId: prestamo.cliente.id,
    clienteCedula: prestamo.cliente.cedula,
    clienteNombre: prestamo.cliente.nombre,
    codigoPlano: otp,
    metodo: canalFinal as 'WHATSAPP' | 'EMAIL' | 'AMBOS',
    destinatario: canalFinal === 'EMAIL' ? (prestamo.cliente.email || '') : (prestamo.cliente.telefono || ''),
    tipo: 'FIRMA_ELECTRONICA',
    entidadRefId: firma.id,
    descripcion: `OTP aceptación TyC préstamo ${prestamo.codigo}`,
    maxIntentos: firma.maxIntentos,
    expiraEnMinutos: 5,
    guardarCodigoPlano: false,
  })

  let envioWhatsApp: any = null
  if (canalFinal === 'WHATSAPP' || canalFinal === 'AMBOS') {
    const mensaje = `🔐 *CÓDIGO DE VERIFICACIÓN - ACEPTACIÓN DE PRÉSTAMO*\n\nHola *${prestamo.cliente.nombre}*,\n\nPara confirmar la aceptación de los Términos y Condiciones de tu préstamo *${prestamo.codigo}*, ingresa el siguiente código:\n\n  >>  ${otp}  <<\n\n⏰ El código expira en 5 minutos.\n⚠️ No compartas este código con nadie.`
    envioWhatsApp = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
    await guardarNotificacion({ db, prestamoId, telefono: prestamo.cliente.telefono, tipo: 'OTP', mensaje, envio: envioWhatsApp })
  }

  let envioEmail: any = null
  if ((canalFinal === 'EMAIL' || canalFinal === 'AMBOS') && prestamo.cliente.email) {
    envioEmail = await enviarEmail({ to: prestamo.cliente.email, subject: `Código de Verificación - Préstamo ${prestamo.codigo}`, text: `Tu código es: ${otp}`, html: `<div style="font-size:36px;font-weight:bold;color:#1e40af;text-align:center;padding:20px;">${otp}</div><p>Expira en 5 minutos.</p>` })
  }

  return NextResponse.json({ success: true, data: { firmaId: firma.id, otpEnviado: true, canal: canalFinal, segundosRestantes: 300, emailDestino: prestamo.cliente.email || null, telefonoDestino: prestamo.cliente.telefono, whatsapp: envioWhatsApp, email: envioEmail }, mensaje: `Código enviado por ${canalFinal === 'WHATSAPP' ? 'WhatsApp' : canalFinal === 'EMAIL' ? 'correo' : 'WhatsApp y correo'}.` })
}

async function validarOTP(prestamoId: string, body: any) {
  const { otpIngresado } = body
  if (!otpIngresado) return NextResponse.json({ success: false, error: 'Código requerido' }, { status: 400 })
  const firma = await db.firmaElectronica.findFirst({ where: { prestamoId, tipo: 'TYC', estadoFirma: 'OTP_ENVIADO' }, orderBy: { createdAt: 'desc' } })
  if (!firma || !firma.otpFechaEnvio) return NextResponse.json({ success: false, error: 'No hay código pendiente' }, { status: 400 })
  const exp = new Date(firma.otpFechaEnvio.getTime() + 5 * 60000)
  if (new Date() > exp) return NextResponse.json({ success: false, error: 'El código ha expirado. Solicita uno nuevo.' }, { status: 400 })
  if (firma.intentosOTP >= firma.maxIntentos) { await db.firmaElectronica.update({ where: { id: firma.id }, data: { estadoFirma: 'RECHAZADA' } }); return NextResponse.json({ success: false, error: 'Has agotado los intentos.' }, { status: 400 }) }
  await db.firmaElectronica.update({ where: { id: firma.id }, data: { intentosOTP: { increment: 1 } } })
  // Reforzado: comparación constant-time contra el hash SHA-256 almacenado
  const otpValido = verificarOtp(String(otpIngresado), firma.otpCodigo || '')
  if (!otpValido) {
    const rest = firma.maxIntentos - (firma.intentosOTP + 1)
    if (rest <= 0) { await db.firmaElectronica.update({ where: { id: firma.id }, data: { estadoFirma: 'RECHAZADA' } }); return NextResponse.json({ success: false, error: 'Código incorrecto. Intentos agotados.' }, { status: 400 }) }
    return NextResponse.json({ success: false, error: `Código incorrecto. Te quedan ${rest} intento(s).` }, { status: 400 })
  }
  await db.firmaElectronica.update({ where: { id: firma.id }, data: { otpValidado: true, otpFechaValidacion: new Date() } })
  return NextResponse.json({
    success: true,
    mensaje:
      'Código verificado. Ahora sube la foto de tu cédula y luego la selfie sosteniendo la cédula.',
  })
}

async function confirmarConFoto(prestamoId: string, body: any) {
  const { fotoDocumentoBase64, fotoSelfieBase64 } = body

  // === VALIDACIONES (v5.0): ambas fotos son obligatorias ===
  // El flujo correcto es:
  //   1. Cliente recibe OTP por correo y lo valida.
  //   2. Cliente sube foto de su cédula (frente + reverso si aplica).
  //   3. Cliente toma selfie sosteniendo la cédula.
  //   4. Ambas fotos se guardan en FirmaElectronica, en DocumentoGestor
  //      (trazabilidad) y se incluyen en el pagaré PDF.
  if (!fotoDocumentoBase64) {
    return NextResponse.json(
      {
        success: false,
        error:
          'La foto del documento de identidad es obligatoria. Sube una foto clara de tu cédula.',
      },
      { status: 400 }
    )
  }
  if (!fotoSelfieBase64) {
    return NextResponse.json(
      {
        success: false,
        error:
          'La selfie sosteniendo la cédula es obligatoria. Toma una foto donde se vea tu rostro y la cédula.',
      },
      { status: 400 }
    )
  }

  // Validar que ambas sean imágenes válidas (NO permitir SVG por seguridad XSS)
  const validarImagen = (data: string): boolean => {
    if (!data.startsWith('data:image/')) return false
    // Permitir jpeg, png, webp. NO SVG (puede contener scripts).
    return (
      data.startsWith('data:image/jpeg') ||
      data.startsWith('data:image/png') ||
      data.startsWith('data:image/webp')
    )
  }
  if (!validarImagen(fotoDocumentoBase64)) {
    return NextResponse.json(
      { success: false, error: 'La foto del documento debe ser JPEG, PNG o WebP.' },
      { status: 400 }
    )
  }
  if (!validarImagen(fotoSelfieBase64)) {
    return NextResponse.json(
      { success: false, error: 'La selfie debe ser JPEG, PNG o WebP.' },
      { status: 400 }
    )
  }

  // Limitar tamaño: cada foto máximo ~5MB (base64 ~7MB)
  const MAX_SIZE = 7 * 1024 * 1024
  if (fotoDocumentoBase64.length > MAX_SIZE || fotoSelfieBase64.length > MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: 'Las fotos exceden el tamaño máximo permitido (5MB cada una).' },
      { status: 400 }
    )
  }

  const firma = await db.firmaElectronica.findFirst({
    where: {
      prestamoId,
      tipo: 'TYC',
      otpValidado: true,
      estadoFirma: { in: ['OTP_ENVIADO', 'FOTOS_SUBIDAS'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { prestamo: { include: { cliente: true } } },
  })
  if (!firma) {
    return NextResponse.json(
      { success: false, error: 'No hay verificación OTP pendiente. Valida el código primero.' },
      { status: 400 }
    )
  }
  const prestamo = firma.prestamo
  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // === Calcular hashes SHA-256 de ambas fotos ===
  const hashDocumento = crypto
    .createHash('sha256')
    .update(fotoDocumentoBase64)
    .digest('hex')
  const hashSelfie = crypto.createHash('sha256').update(fotoSelfieBase64).digest('hex')

  // === Actualizar FirmaElectronica con ambas fotos ===
  await db.firmaElectronica.update({
    where: { id: firma.id },
    data: {
      fotoDocumento: fotoDocumentoBase64,
      fotoDocumentoHash: hashDocumento,
      fotoSelfie: fotoSelfieBase64,
      fotoSelfieHash: hashSelfie,
      fechaSubidaFotos: new Date(),
      estadoFirma: 'COMPLETADA',
      fechaFirmaCompleta: new Date(),
    },
  })

  // === Guardar en DocumentoGestor (trazabilidad de documentación) ===
  // 1. Foto de la cédula
  await db.documentoGestor.create({
    data: {
      prestamoId,
      clienteId: prestamo.clienteId,
      tipo: 'FOTO_CEDULA',
      titulo: `Foto de cédula - Aceptación T&C ${prestamo.codigo}`,
      descripcion: `Foto del documento de identidad (cédula) subida por el cliente al aceptar T&C del préstamo ${prestamo.codigo}. Hash SHA-256: ${hashDocumento}.`,
      archivoBase64: fotoDocumentoBase64,
      archivoNombre: `cedula_${prestamo.codigo}.jpg`,
      archivoTipo: 'image/jpeg',
      archivoTamano: fotoDocumentoBase64.length,
      subidoPor: prestamo.cliente?.nombre || 'Cliente',
    },
  })

  // 2. Selfie con cédula
  await db.documentoGestor.create({
    data: {
      prestamoId,
      clienteId: prestamo.clienteId,
      tipo: 'FOTO_SELFI',
      titulo: `Selfie con cédula - Aceptación T&C ${prestamo.codigo}`,
      descripcion: `Selfie sosteniendo la cédula, subida por el cliente al aceptar T&C del préstamo ${prestamo.codigo}. Hash SHA-256: ${hashSelfie}.`,
      archivoBase64: fotoSelfieBase64,
      archivoNombre: `selfie_${prestamo.codigo}.jpg`,
      archivoTipo: 'image/jpeg',
      archivoTamano: fotoSelfieBase64.length,
      subidoPor: prestamo.cliente?.nombre || 'Cliente',
    },
  })

  // === Bitácora del préstamo (trazabilidad) ===
  await db.bitacoraPrestamo.create({
    data: {
      prestamoId,
      prestamoCodigo: prestamo.codigo,
      usuarioNombre: prestamo.cliente?.nombre || 'Cliente',
      tipo: 'FIRMA',
      titulo: 'T&C aceptados con OTP + foto cédula + selfie',
      descripcion: `Cliente validó OTP por correo y subió:
- Foto de su cédula de identidad (hash: ${hashDocumento.slice(0, 16)}...).
- Selfie sosteniendo la cédula (hash: ${hashSelfie.slice(0, 16)}...).
Ambas fotos fueron guardadas en DocumentoGestor y se incluyen como respaldo de firma en el pagaré PDF.`,
      resultado: 'Préstamo activado',
    },
  })

  // === Activar el préstamo ===
  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: new Date(),
  })
  const prestamoActualizado = await db.prestamo.update({
    where: { id: prestamoId },
    data: {
      estado: 'ACTIVO',
      tycAceptado: true,
      tycFechaAceptacion: new Date(),
      fechaDesembolso: new Date(),
      fechaVencimiento: calculo.fechaVencimiento,
      firmaId: firma.id,
    },
    include: { cliente: true },
  })

  // === Notificar al cliente por correo (canal obligatorio) ===
  const mensajeCorreo = `
Hola ${prestamo.cliente.nombre},

Tu préstamo ${prestamo.codigo} ha sido activado exitosamente.

DETALLES:
- Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}
- Cuota: $${prestamo.montoCuota.toLocaleString('es-CO')}
- Cuotas: ${prestamo.numeroCuotas}
- Total a pagar: $${prestamo.totalPagar.toLocaleString('es-CO')}

DOCUMENTACIÓN:
- Tu foto de cédula y selfie con cédula fueron guardadas como respaldo de firma.
- Estas imágenes se incluyen en tu pagaré electrónico como evidencia de identidad.

Si no reconoces esta activación, contacta inmediatamente al administrador.

— Aurora Bancaria
  `.trim()

  try {
    if (prestamo.cliente.email) {
      await enviarEmail({
        to: prestamo.cliente.email,
        subject: `Préstamo ${prestamo.codigo} activado — Aurora Bancaria`,
        text: mensajeCorreo,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
  <h2 style="color: #1e40af;">Préstamo activado</h2>
  <p>Hola <strong>${prestamo.cliente.nombre}</strong>,</p>
  <p>Tu préstamo <strong>${prestamo.codigo}</strong> ha sido activado exitosamente.</p>
  <h3>Detalles:</h3>
  <ul>
    <li>Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}</li>
    <li>Cuota: $${prestamo.montoCuota.toLocaleString('es-CO')}</li>
    <li>Cuotas: ${prestamo.numeroCuotas}</li>
    <li>Total a pagar: $${prestamo.totalPagar.toLocaleString('es-CO')}</li>
  </ul>
  <h3>Documentación:</h3>
  <p>Tu foto de cédula y selfie con cédula fueron guardadas como respaldo de firma. Estas imágenes se incluyen en tu pagaré electrónico como evidencia de identidad.</p>
  <p style="color: #6b7280; font-size: 13px;">Si no reconoces esta activación, contacta inmediatamente al administrador.</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">Aurora Bancaria v5.0</p>
</div>`,
      })
    }
  } catch (err) {
    // No fallar la activación si el correo falla
    console.error('[aceptar-tyc-otp] Error enviando correo de confirmación:', err)
  }

  // Notificación WhatsApp opcional (si el cliente tiene teléfono, no es OTP)
  const mensaje = `✅ *PRÉSTAMO ACTIVADO*\n\nHola *${prestamo.cliente.nombre}*,\n\nTu préstamo *${prestamo.codigo}* ha sido activado.\n\n• Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}\n• Cuota: $${prestamo.montoCuota.toLocaleString('es-CO')}\n• Cuotas: ${prestamo.numeroCuotas}\n• Total: $${prestamo.totalPagar.toLocaleString('es-CO')}\n\nSe envió comprobante a tu correo electrónico.`
  if (prestamo.cliente.telefono) {
    try {
      const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
      await guardarNotificacion({
        db,
        prestamoId,
        telefono: prestamo.cliente.telefono,
        tipo: 'ACTIVACION',
        mensaje,
        envio,
      })
    } catch {}
  }

  return NextResponse.json({
    success: true,
    mensaje:
      '¡Términos aceptados! Tu préstamo ha sido activado. Se guardó tu foto de cédula y selfie como respaldo de firma.',
    data: {
      prestamo: prestamoActualizado,
      firmaId: firma.id,
      hashDocumento,
      hashSelfie,
    },
  })
}

async function checkOTP(prestamoId: string) {
  const firma = await db.firmaElectronica.findFirst({ where: { prestamoId, tipo: 'TYC', estadoFirma: { in: ['OTP_ENVIADO', 'FOTOS_SUBIDAS'] }, otpEnviado: true, otpFechaEnvio: { not: null } }, orderBy: { createdAt: 'desc' } })
  if (!firma || !firma.otpFechaEnvio) return NextResponse.json({ success: true, data: { activo: false } })
  const exp = new Date(firma.otpFechaEnvio.getTime() + 5 * 60000)
  if (new Date() > exp) return NextResponse.json({ success: true, data: { activo: false, expirado: true } })
  const segundosRestantes = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000))
  return NextResponse.json({ success: true, data: { activo: true, canal: firma.otpCanal, segundosRestantes, minutosRestantes: Math.floor(segundosRestantes / 60), otpValidado: firma.otpValidado, verificado: firma.otpValidado, intentosUsados: firma.intentosOTP, intentosMaximos: firma.maxIntentos, fechaEnvio: firma.otpFechaEnvio, fechaExpiracion: exp } })
}
