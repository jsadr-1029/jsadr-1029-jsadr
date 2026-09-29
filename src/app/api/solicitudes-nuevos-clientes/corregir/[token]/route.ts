import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// =====================================================
// /api/solicitudes-nuevos-clientes/corregir/[token]
//
// GET: devuelve info de la solicitud devuelta + motivo + qué fotos corregir
//   (sin exponer todas las fotos, solo metadata)
//
// POST: recibe fotos corregidas y las guarda en la solicitud
//   Body: {
//     fotoCedulaFrente?: string (data:image/...base64),
//     fotoCedulaReverso?: string,
//     fotoSelfie?: string,
//     fotoCedulaFrenteNombre?: string,
//     fotoCedulaReversoNombre?: string,
//     fotoSelfieNombre?: string,
//   }
//   Solo actualiza las fotos que se envíen. Marca solicitud como PENDIENTE
//   de nuevo (vuelve a la cola de revisión).
// =====================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 400 }
      )
    }

    const solicitud = await db.solicitudNuevoCliente.findFirst({
      where: { tokenCorreccion: token },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        apellido: true,
        cedula: true,
        email: true,
        telefono: true,
        estado: true,
        motivoDevolucion: true,
        detalleDevolucion: true,
        fotosARecargar: true,
        vecesDevuelta: true,
        fechaDevolucion: true,
        tokenCorreccionExpira: true,
        // NO seleccionamos las fotos base64 aquí — el cliente no necesita verlas
      },
    })

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: 'Token de corrección inválido o ya utilizado', codigo: 'TOKEN_INVALIDO' },
        { status: 404 }
      )
    }

    if (solicitud.estado !== 'DEVUELTA') {
      return NextResponse.json(
        {
          success: false,
          error:
            solicitud.estado === 'PENDIENTE'
              ? 'Esta solicitud ya fue corregida y está pendiente de revisión.'
              : `Esta solicitud no está disponible para corrección (estado: ${solicitud.estado}).`,
          codigo: 'ESTADO_NO_VALIDO',
          estadoActual: solicitud.estado,
        },
        { status: 400 }
      )
    }

    if (
      solicitud.tokenCorreccionExpira &&
      new Date(solicitud.tokenCorreccionExpira) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'El enlace de corrección ha expirado. Contacta al asesor para solicitar uno nuevo.', codigo: 'TOKEN_EXPIRADO' },
        { status: 410 }
      )
    }

    let fotosARecargar: string[] = []
    try {
      fotosARecargar = solicitud.fotosARecargar ? JSON.parse(solicitud.fotosARecargar) : []
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        ...solicitud,
        fotosARecargar,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const {
      fotoCedulaFrente,
      fotoCedulaReverso,
      fotoSelfie,
      fotoCedulaFrenteNombre,
      fotoCedulaReversoNombre,
      fotoSelfieNombre,
    } = body

    // Validar que al menos una foto se esté enviando
    if (!fotoCedulaFrente && !fotoCedulaReverso && !fotoSelfie) {
      return NextResponse.json(
        { success: false, error: 'Debes enviar al menos una foto corregida', codigo: 'SIN_FOTOS' },
        { status: 400 }
      )
    }

    // Validar tamaño de cada foto (max ~5MB base64)
    const MAX_TAMANO = 7 * 1024 * 1024 // 7MB en chars base64 (~5MB binario)
    for (const [k, v] of Object.entries({ fotoCedulaFrente, fotoCedulaReverso, fotoSelfie })) {
      if (v && typeof v === 'string' && v.length > MAX_TAMANO) {
        return NextResponse.json(
          { success: false, error: `La foto ${k.replace('foto', '').toLowerCase()} es demasiado grande. Máximo 5MB.`, codigo: 'FOTO_MUY_GRANDE' },
          { status: 400 }
        )
      }
      if (v && typeof v === 'string' && !v.startsWith('data:image/')) {
        return NextResponse.json(
          { success: false, error: `La foto ${k.replace('foto', '').toLowerCase()} no tiene formato válido. Debe ser una imagen (JPEG, PNG, WebP).`, codigo: 'FORMATO_INVALIDO' },
          { status: 400 }
        )
      }
    }

    const solicitud = await db.solicitudNuevoCliente.findFirst({
      where: { tokenCorreccion: token },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        email: true,
        estado: true,
        tokenCorreccionExpira: true,
        fotosARecargar: true,
      },
    })

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: 'Token de corrección inválido', codigo: 'TOKEN_INVALIDO' },
        { status: 404 }
      )
    }

    if (solicitud.estado !== 'DEVUELTA') {
      return NextResponse.json(
        { success: false, error: 'Esta solicitud ya no está disponible para corrección', codigo: 'ESTADO_NO_VALIDO' },
        { status: 400 }
      )
    }

    if (
      solicitud.tokenCorreccionExpira &&
      new Date(solicitud.tokenCorreccionExpira) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'El enlace ha expirado', codigo: 'TOKEN_EXPIRADO' },
        { status: 410 }
      )
    }

    // Construir data de actualización — solo las fotos enviadas
    const updateData: any = {
      estado: 'PENDIENTE', // Vuelve a la cola de revisión
      fechaCorreccion: new Date(),
    }

    if (fotoCedulaFrente) {
      updateData.fotoCedulaFrenteCorregida = fotoCedulaFrente
      updateData.fotoCedulaFrenteCorregidaNombre = fotoCedulaFrenteNombre || `corregida-frente-${Date.now()}.jpg`
      // Sobrescribir la foto original con la corregida para que el gestor la vea directamente
      updateData.fotoCedulaFrente = fotoCedulaFrente
      updateData.fotoCedulaFrenteNombre = updateData.fotoCedulaFrenteCorregidaNombre
    }
    if (fotoCedulaReverso) {
      updateData.fotoCedulaReversoCorregida = fotoCedulaReverso
      updateData.fotoCedulaReversoCorregidaNombre = fotoCedulaReversoNombre || `corregida-reverso-${Date.now()}.jpg`
      updateData.fotoCedulaReverso = fotoCedulaReverso
      updateData.fotoCedulaReversoNombre = updateData.fotoCedulaReversoCorregidaNombre
    }
    if (fotoSelfie) {
      updateData.fotoSelfieCorregida = fotoSelfie
      updateData.fotoSelfieCorregidaNombre = fotoSelfieNombre || `corregida-selfie-${Date.now()}.jpg`
      updateData.fotoSelfie = fotoSelfie
      updateData.fotoSelfieNombre = updateData.fotoSelfieCorregidaNombre
    }

    // Limpiar token de corrección para que no se pueda reutilizar
    updateData.tokenCorreccion = null
    updateData.tokenCorreccionExpira = null

    await db.solicitudNuevoCliente.update({
      where: { id: solicitud.id },
      data: updateData,
    })

    // Enviar confirmación al cliente por email
    try {
      const { enviarEmail } = await import('@/lib/email')
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jsadr.com.co'
      await enviarEmail({
        to: solicitud.email || '',
        subject: `Hemos recibido tus correcciones — Solicitud ${solicitud.codigo}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f4f6fb;">
            <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(15,23,42,0.08);">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 8px 16px; border-radius: 12px; font-weight: bold;">✓ JSADR</div>
                <h1 style="color: #0b1220; font-size: 22px; margin: 16px 0 8px;">¡Correcciones recibidas!</h1>
              </div>
              <p style="color: #0b1220; font-size: 15px; line-height: 1.6;">Hola <strong>${solicitud.nombre}</strong>,</p>
              <p style="color: #5b6478; font-size: 14px; line-height: 1.6;">Hemos recibido las fotos corregidas de tu solicitud <strong>${solicitud.codigo}</strong>. Nuestro equipo las revisará y te contactará en menos de 24 horas.</p>
              <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #065f46; font-size: 14px; margin: 0;">✓ Solicitud vuelta a cola de revisión</p>
              </div>
              <p style="color: #8b94a8; font-size: 12px; text-align: center; margin-top: 24px;">© JSADR Microfinanzas</p>
            </div>
          </div>
        `,
        text: `Hola ${solicitud.nombre}, hemos recibido tus correcciones para la solicitud ${solicitud.codigo}. Las revisaremos en menos de 24 horas. Saludos, JSADR Microfinanzas.`,
      })
    } catch (emailErr: any) {
      console.error('[corregir solicitud] error enviando email de confirmación:', emailErr?.message)
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Tus correcciones fueron enviadas correctamente. El equipo revisará tu solicitud en menos de 24 horas.',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
