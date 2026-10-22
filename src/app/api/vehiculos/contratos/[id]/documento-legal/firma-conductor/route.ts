// =====================================================
// /api/vehiculos/contratos/[id]/documento-legal/firma-conductor
// POST: maneja todo el flujo de firma del conductor:
//   accion=fotos → guarda fotos (cédula frente/reverso, selfie)
//   accion=firma → guarda firma manuscrita
//   accion=otp → genera y envía OTP al email del conductor
//   accion=verificar-otp → valida OTP
//   accion=completar → marca firma del conductor como completada
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email'
import { buildAbsoluteUrl } from '@/lib/url'
import crypto from 'crypto'

function hashOtp(codigo: string): string {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, accion } = body

    if (!token || !accion) {
      return NextResponse.json({ success: false, error: 'Token y accion son obligatorios' }, { status: 400 })
    }

    // Buscar documento por token de conductor
    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { conductorToken: token },
    })

    if (!documento) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })
    }

    if (documento.conductorTokenExpira && new Date() > documento.conductorTokenExpira) {
      return NextResponse.json({ success: false, error: 'El enlace ha expirado' }, { status: 401 })
    }

    if (documento.estado !== 'ENVIADO_CONDUCTOR' && documento.estado !== 'FIRMADO_CONDUCTOR') {
      return NextResponse.json({ success: false, error: `El contrato no está disponible para firma del conductor (estado: ${documento.estado})` }, { status: 400 })
    }

    // === ACCIÓN: GUARDAR FOTOS ===
    if (accion === 'fotos') {
      const { fotoCedulaFrente, fotoCedulaReverso, fotoSelfie } = body
      if (!fotoCedulaFrente || !fotoCedulaReverso || !fotoSelfie) {
        return NextResponse.json({ success: false, error: 'Las 3 fotos son obligatorias (cédula frente, cédula reverso, selfie)' }, { status: 400 })
      }
      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { conductorFotoCedulaFrente: fotoCedulaFrente, conductorFotoCedulaReverso: fotoCedulaReverso, conductorFotoSelfie: fotoSelfie },
      })
      return NextResponse.json({ success: true, message: 'Fotos guardadas correctamente' })
    }

    // === ACCIÓN: GUARDAR FIRMA MANUSCRITA ===
    if (accion === 'firma') {
      const { firmaManuscrita } = body
      if (!firmaManuscrita) {
        return NextResponse.json({ success: false, error: 'La firma manuscrita es obligatoria' }, { status: 400 })
      }
      // Verificar que las fotos estén cargadas
      if (!documento.conductorFotoCedulaFrente || !documento.conductorFotoCedulaReverso || !documento.conductorFotoSelfie) {
        return NextResponse.json({ success: false, error: 'Debes cargar las fotos primero' }, { status: 400 })
      }
      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { conductorFirmaManuscrita: firmaManuscrita },
      })
      return NextResponse.json({ success: true, message: 'Firma guardada' })
    }

    // === ACCIÓN: ENVIAR OTP ===
    if (accion === 'otp') {
      if (!documento.conductorFirmaManuscrita) {
        return NextResponse.json({ success: false, error: 'Debes dibujar tu firma primero' }, { status: 400 })
      }
      if (!documento.conductorEmail) {
        return NextResponse.json({ success: false, error: 'No hay email registrado para enviar el OTP' }, { status: 400 })
      }

      const otp = String(crypto.randomInt(100000, 999999))
      const otpHash = hashOtp(otp)
      const otpExpira = new Date(Date.now() + 15 * 60 * 1000) // 15 min

      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { conductorOtpHash: otpHash, conductorOtpExpira: otpExpira, conductorOtpValidado: false },
      })

      // Enviar OTP por email
      try {
        await enviarEmail({
          to: documento.conductorEmail,
          subject: `Código OTP - Firma Contrato ${documento.numeroContrato}`,
          text: `Estimado/a ${documento.conductorNombre},\n\nTu código de verificación para completar la firma del contrato es:\n\n  >>  ${otp}  <<\n\nEste código expira en 15 minutos.\nNo compartas este código con nadie.\n\nSaludos,\nSistema de Gestión de Vehículos`,
        })
      } catch (e) {
        console.error('[firma-conductor/otp] Error enviando email:', e)
        return NextResponse.json({ success: false, error: 'Error al enviar el código OTP por email' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Código OTP enviado a ${documento.conductorEmail.slice(0, 3)}***${documento.conductorEmail.split('@')[1]}`,
        emailDestino: documento.conductorEmail.slice(0, 3) + '***' + documento.conductorEmail.split('@')[1],
      })
    }

    // === ACCIÓN: VERIFICAR OTP ===
    if (accion === 'verificar-otp') {
      const { otpIngresado } = body
      if (!otpIngresado) {
        return NextResponse.json({ success: false, error: 'Código OTP requerido' }, { status: 400 })
      }
      if (!documento.conductorOtpHash || !documento.conductorOtpExpira) {
        return NextResponse.json({ success: false, error: 'No se ha enviado el código OTP' }, { status: 400 })
      }
      if (new Date() > documento.conductorOtpExpira) {
        return NextResponse.json({ success: false, error: 'El código OTP ha expirado. Solicita uno nuevo.' }, { status: 400 })
      }

      const inputHash = hashOtp(String(otpIngresado))
      if (inputHash !== documento.conductorOtpHash) {
        return NextResponse.json({ success: false, error: 'Código incorrecto. Verifica e intenta nuevamente.' }, { status: 400 })
      }

      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { conductorOtpValidado: true },
      })

      return NextResponse.json({ success: true, message: 'Código OTP verificado correctamente' })
    }

    // === ACCIÓN: COMPLETAR FIRMA DEL CONDUCTOR ===
    if (accion === 'completar') {
      if (!documento.conductorOtpValidado) {
        return NextResponse.json({ success: false, error: 'Debes validar el código OTP primero' }, { status: 400 })
      }
      if (!documento.conductorFotoCedulaFrente || !documento.conductorFotoCedulaReverso || !documento.conductorFotoSelfie || !documento.conductorFirmaManuscrita) {
        return NextResponse.json({ success: false, error: 'Faltan documentos o firma' }, { status: 400 })
      }

      // Obtener IP y User-Agent del request
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const userAgent = req.headers.get('user-agent') || 'unknown'

      // Actualizar estado a FIRMADO_CONDUCTOR
      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: {
          estado: 'FIRMADO_CONDUCTOR',
          conductorFechaFirma: new Date(),
          conductorIp: ip,
          conductorUserAgent: userAgent,
        },
      })

      // Enviar email al propietario con el link de firma
      const linkPropietario = buildAbsoluteUrl(`/firma-contrato-vehiculo/${documento.propietarioToken}`)
      if (documento.propietarioEmail) {
        try {
          await enviarEmail({
            to: documento.propietarioEmail,
            subject: `Contrato ${documento.numeroContrato} - Pendiente tu firma`,
            text: `El conductor ${documento.conductorNombre} ha firmado el contrato ${documento.numeroContrato}.\n\nAhora debes firmar tú como propietario.\n\nIngresa al siguiente enlace:\n${linkPropietario}\n\nEl enlace expira en 7 días.`,
          })
        } catch (e) {
          console.error('[firma-conductor/completar] Error enviando email al propietario:', e)
        }
      }

      return NextResponse.json({
        success: true,
        message: '¡Firma completada! Se ha notificado al propietario para que firme el contrato.',
        linkPropietario,
      })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    console.error('[firma-conductor] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
