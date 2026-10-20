// =====================================================
// /api/vehiculos/registro-conductor/firma
// Guarda la firma electrónica (base64 PNG) y pasa a estado OTP
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, firmaElectronica } = body

    if (!token || !firmaElectronica) {
      return NextResponse.json({ success: false, error: 'Token y firmaElectronica son obligatorios' }, { status: 400 })
    }

    const solicitud = await db.solicitudConductorVehiculo.findFirst({
      where: { tokenRegistro: token, tokenExpira: { gt: new Date() } },
    })

    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    if (solicitud.estado !== 'FIRMA') {
      return NextResponse.json({
        success: false,
        error: `Debes completar los documentos primero (estado actual: ${solicitud.estado})`,
      }, { status: 400 })
    }

    // Verificar que las fotos estén cargadas
    if (!solicitud.fotoCedulaFrente || !solicitud.fotoCedulaReverso ||
        !solicitud.fotoLicenciaFrente || !solicitud.fotoLicenciaReverso ||
        !solicitud.fotoSelfie || !solicitud.fotoReciboServicios) {
      return NextResponse.json({
        success: false,
        error: 'Faltan fotos por cargar. Completa todos los documentos antes de firmar.',
      }, { status: 400 })
    }

    const actualizada = await db.solicitudConductorVehiculo.update({
      where: { id: solicitud.id },
      data: {
        firmaElectronica,
        fechaFirma: new Date(),
        estado: 'OTP',
      },
    })

    return NextResponse.json({
      success: true,
      estado: 'OTP',
      message: 'Firma guardada. Ahora debes validar el código OTP enviado a tu teléfono.',
    })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/firma] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
