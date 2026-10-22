// =====================================================
// /api/vehiculos/contratos/[id]/documento-legal/firma-propietario
// POST: maneja todo el flujo de firma del propietario:
//   accion=fotos → guarda fotos
//   accion=firma → guarda firma manuscrita
//   accion=otp → genera y envía OTP al email del propietario
//   accion=verificar-otp → valida OTP
//   accion=completar → marca contrato como COMPLETADO + genera PDF final
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

    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { propietarioToken: token },
    })

    if (!documento) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })
    }

    if (documento.propietarioTokenExpira && new Date() > documento.propietarioTokenExpira) {
      return NextResponse.json({ success: false, error: 'El enlace ha expirado' }, { status: 401 })
    }

    if (documento.estado !== 'FIRMADO_CONDUCTOR' && documento.estado !== 'ENVIADO_PROPIETARIO') {
      return NextResponse.json({ success: false, error: `El conductor debe firmar primero (estado: ${documento.estado})` }, { status: 400 })
    }

    // === ACCIÓN: GUARDAR FOTOS ===
    if (accion === 'fotos') {
      const { fotoCedulaFrente, fotoCedulaReverso, fotoSelfie } = body
      if (!fotoCedulaFrente || !fotoCedulaReverso || !fotoSelfie) {
        return NextResponse.json({ success: false, error: 'Las 3 fotos son obligatorias' }, { status: 400 })
      }
      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { propietarioFotoCedulaFrente: fotoCedulaFrente, propietarioFotoCedulaReverso: fotoCedulaReverso, propietarioFotoSelfie: fotoSelfie },
      })
      return NextResponse.json({ success: true, message: 'Fotos guardadas correctamente' })
    }

    // === ACCIÓN: GUARDAR FIRMA MANUSCRITA ===
    if (accion === 'firma') {
      const { firmaManuscrita } = body
      if (!firmaManuscrita) {
        return NextResponse.json({ success: false, error: 'La firma manuscrita es obligatoria' }, { status: 400 })
      }
      if (!documento.propietarioFotoCedulaFrente || !documento.propietarioFotoCedulaReverso || !documento.propietarioFotoSelfie) {
        return NextResponse.json({ success: false, error: 'Debes cargar las fotos primero' }, { status: 400 })
      }
      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { propietarioFirmaManuscrita: firmaManuscrita },
      })
      return NextResponse.json({ success: true, message: 'Firma guardada' })
    }

    // === ACCIÓN: ENVIAR OTP ===
    if (accion === 'otp') {
      if (!documento.propietarioFirmaManuscrita) {
        return NextResponse.json({ success: false, error: 'Debes dibujar tu firma primero' }, { status: 400 })
      }
      if (!documento.propietarioEmail) {
        return NextResponse.json({ success: false, error: 'No hay email registrado' }, { status: 400 })
      }

      const otp = String(crypto.randomInt(100000, 999999))
      const otpHash = hashOtp(otp)
      const otpExpira = new Date(Date.now() + 15 * 60 * 1000)

      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { propietarioOtpHash: otpHash, propietarioOtpExpira: otpExpira, propietarioOtpValidado: false },
      })

      try {
        await enviarEmail({
          to: documento.propietarioEmail,
          subject: `Código OTP - Firma Contrato ${documento.numeroContrato}`,
          text: `Tu código de verificación para completar la firma del contrato es:\n\n  >>  ${otp}  <<\n\nExpira en 15 minutos.`,
        })
      } catch (e) {
        return NextResponse.json({ success: false, error: 'Error al enviar OTP' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Código OTP enviado a ${documento.propietarioEmail.slice(0, 3)}***`,
      })
    }

    // === ACCIÓN: VERIFICAR OTP ===
    if (accion === 'verificar-otp') {
      const { otpIngresado } = body
      if (!otpIngresado) {
        return NextResponse.json({ success: false, error: 'Código OTP requerido' }, { status: 400 })
      }
      if (!documento.propietarioOtpHash || !documento.propietarioOtpExpira) {
        return NextResponse.json({ success: false, error: 'No se ha enviado el código OTP' }, { status: 400 })
      }
      if (new Date() > documento.propietarioOtpExpira) {
        return NextResponse.json({ success: false, error: 'El código OTP ha expirado' }, { status: 400 })
      }

      const inputHash = hashOtp(String(otpIngresado))
      if (inputHash !== documento.propietarioOtpHash) {
        return NextResponse.json({ success: false, error: 'Código incorrecto' }, { status: 400 })
      }

      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: { propietarioOtpValidado: true },
      })

      return NextResponse.json({ success: true, message: 'OTP verificado' })
    }

    // === ACCIÓN: COMPLETAR (CONTRATO FIRMADO POR AMBAS PARTES) ===
    if (accion === 'completar') {
      if (!documento.propietarioOtpValidado) {
        return NextResponse.json({ success: false, error: 'Debes validar el OTP primero' }, { status: 400 })
      }

      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      const userAgent = req.headers.get('user-agent') || 'unknown'

      await db.contratoDocumentoVehiculo.update({
        where: { id: documento.id },
        data: {
          estado: 'COMPLETADO',
          propietarioFechaFirma: new Date(),
          propietarioIp: ip,
          propietarioUserAgent: userAgent,
        },
      })

      await db.auditoriaVehiculo.create({
        data: {
          entidad: 'CONTRATO_DOCUMENTO',
          entidadId: documento.id,
          accion: 'APROBAR',
          descripcion: `Contrato ${documento.numeroContrato} completado. Ambas partes han firmado electrónicamente. Conductor: ${documento.conductorNombre}, Propietario: ${documento.propietarioNombre}.`,
          usuarioNombre: 'Sistema (firma propietario)',
        },
      })

      return NextResponse.json({
        success: true,
        message: '¡Contrato firmado por ambas partes! El contrato está completo.',
      })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    console.error('[firma-propietario] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
