// =====================================================
// /api/vehiculos/contrato-legal/firma
// POST público (sin JWT) para manejar todo el flujo de firma
// (conductor y propietario). Recibe token en el body.
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

    // Buscar por token de conductor o propietario
    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: {
        OR: [
          { conductorToken: token },
          { propietarioToken: token },
        ],
      },
    })

    if (!documento) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })
    }

    const esConductor = documento.conductorToken === token
    const tokenExpira = esConductor ? documento.conductorTokenExpira : documento.propietarioTokenExpira
    if (tokenExpira && new Date() > tokenExpira) {
      return NextResponse.json({ success: false, error: 'El enlace ha expirado' }, { status: 401 })
    }

    // === ACCIÓN: GUARDAR FOTOS ===
    if (accion === 'fotos') {
      const { fotoCedulaFrente, fotoCedulaReverso, fotoSelfie } = body
      if (!fotoCedulaFrente || !fotoCedulaReverso || !fotoSelfie) {
        return NextResponse.json({ success: false, error: 'Las 3 fotos son obligatorias' }, { status: 400 })
      }
      const data: any = {}
      if (esConductor) {
        data.conductorFotoCedulaFrente = fotoCedulaFrente
        data.conductorFotoCedulaReverso = fotoCedulaReverso
        data.conductorFotoSelfie = fotoSelfie
      } else {
        data.propietarioFotoCedulaFrente = fotoCedulaFrente
        data.propietarioFotoCedulaReverso = fotoCedulaReverso
        data.propietarioFotoSelfie = fotoSelfie
      }
      await db.contratoDocumentoVehiculo.update({ where: { id: documento.id }, data })
      return NextResponse.json({ success: true, message: 'Fotos guardadas' })
    }

    // === ACCIÓN: GUARDAR FIRMA ===
    if (accion === 'firma') {
      const { firmaManuscrita } = body
      if (!firmaManuscrita) {
        return NextResponse.json({ success: false, error: 'La firma manuscrita es obligatoria' }, { status: 400 })
      }
      // Verificar fotos cargadas
      const tieneFotos = esConductor
        ? (documento.conductorFotoCedulaFrente && documento.conductorFotoCedulaReverso && documento.conductorFotoSelfie)
        : (documento.propietarioFotoCedulaFrente && documento.propietarioFotoCedulaReverso && documento.propietarioFotoSelfie)
      if (!tieneFotos) {
        return NextResponse.json({ success: false, error: 'Debes cargar las fotos primero' }, { status: 400 })
      }
      const data: any = esConductor ? { conductorFirmaManuscrita: firmaManuscrita } : { propietarioFirmaManuscrita: firmaManuscrita }
      await db.contratoDocumentoVehiculo.update({ where: { id: documento.id }, data })
      return NextResponse.json({ success: true, message: 'Firma guardada' })
    }

    // === ACCIÓN: ENVIAR OTP ===
    if (accion === 'otp') {
      const tieneFirma = esConductor ? documento.conductorFirmaManuscrita : documento.propietarioFirmaManuscrita
      if (!tieneFirma) {
        return NextResponse.json({ success: false, error: 'Debes dibujar tu firma primero' }, { status: 400 })
      }
      const email = esConductor ? documento.conductorEmail : documento.propietarioEmail
      if (!email) {
        return NextResponse.json({ success: false, error: 'No hay email registrado' }, { status: 400 })
      }
      const otp = String(crypto.randomInt(100000, 999999))
      const otpHash = hashOtp(otp)
      const otpExpira = new Date(Date.now() + 15 * 60 * 1000)

      const data: any = esConductor
        ? { conductorOtpHash: otpHash, conductorOtpExpira: otpExpira, conductorOtpValidado: false }
        : { propietarioOtpHash: otpHash, propietarioOtpExpira: otpExpira, propietarioOtpValidado: false }
      await db.contratoDocumentoVehiculo.update({ where: { id: documento.id }, data })

      try {
        await enviarEmail({
          to: email,
          subject: `Código OTP - Firma Contrato ${documento.numeroContrato}`,
          text: `Tu código de verificación para completar la firma del contrato es:\n\n  >>  ${otp}  <<\n\nExpira en 15 minutos.\nNo compartas este código con nadie.`,
        })
      } catch (e) {
        return NextResponse.json({ success: false, error: 'Error al enviar OTP' }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        message: `Código OTP enviado a ${email.slice(0, 3)}***${email.split('@')[1] || ''}`,
      })
    }

    // === ACCIÓN: VERIFICAR OTP ===
    if (accion === 'verificar-otp') {
      const { otpIngresado } = body
      if (!otpIngresado) {
        return NextResponse.json({ success: false, error: 'Código OTP requerido' }, { status: 400 })
      }
      const otpHash = esConductor ? documento.conductorOtpHash : documento.propietarioOtpHash
      const otpExpira = esConductor ? documento.conductorOtpExpira : documento.propietarioOtpExpira
      if (!otpHash || !otpExpira) {
        return NextResponse.json({ success: false, error: 'No se ha enviado el código OTP' }, { status: 400 })
      }
      if (new Date() > otpExpira) {
        return NextResponse.json({ success: false, error: 'El código OTP ha expirado' }, { status: 400 })
      }
      const inputHash = hashOtp(String(otpIngresado))
      if (inputHash !== otpHash) {
        return NextResponse.json({ success: false, error: 'Código incorrecto' }, { status: 400 })
      }
      const data: any = esConductor ? { conductorOtpValidado: true } : { propietarioOtpValidado: true }
      await db.contratoDocumentoVehiculo.update({ where: { id: documento.id }, data })
      return NextResponse.json({ success: true, message: 'OTP verificado' })
    }

    // === ACCIÓN: COMPLETAR FIRMA ===
    if (accion === 'completar') {
      const otpValidado = esConductor ? documento.conductorOtpValidado : documento.propietarioOtpValidado
      if (!otpValidado) {
        return NextResponse.json({ success: false, error: 'Debes validar el OTP primero' }, { status: 400 })
      }
      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      const userAgent = req.headers.get('user-agent') || 'unknown'

      if (esConductor) {
        // Completar firma del conductor
        await db.contratoDocumentoVehiculo.update({
          where: { id: documento.id },
          data: {
            estado: 'FIRMADO_CONDUCTOR',
            conductorFechaFirma: new Date(),
            conductorIp: ip,
            conductorUserAgent: userAgent,
          },
        })
        // Enviar email al propietario
        const linkPropietario = buildAbsoluteUrl(`/firma-contrato-vehiculo/${documento.propietarioToken}`)
        if (documento.propietarioEmail) {
          try {
            await enviarEmail({
              to: documento.propietarioEmail,
              subject: `Contrato ${documento.numeroContrato} - Pendiente tu firma`,
              text: `El conductor ${documento.conductorNombre} ha firmado el contrato.\n\nAhora debes firmar tú como propietario.\n\nIngresa al siguiente enlace:\n${linkPropietario}\n\nExpira en 7 días.`,
            })
          } catch (e) { console.error('Error enviando email al propietario:', e) }
        }
        return NextResponse.json({
          success: true,
          message: '¡Firma completada! Se ha notificado al propietario.',
          linkPropietario,
        })
      } else {
        // Completar firma del propietario → CONTRATO COMPLETADO
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
            descripcion: `Contrato ${documento.numeroContrato} completado. Ambas partes han firmado electrónicamente.`,
            usuarioNombre: 'Sistema (firma dual)',
          },
        })
        return NextResponse.json({
          success: true,
          message: '¡Contrato firmado por ambas partes! El contrato está completo.',
        })
      }
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    console.error('[contrato-legal/firma] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
