// =====================================================
// /api/vehiculos/registro-conductor/otp
// Genera y envía OTP al teléfono del conductor
// Por ahora solo lo retorna (en producción integrar WhatsApp/Twilio)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })
    }

    const solicitud = await db.solicitudConductorVehiculo.findFirst({
      where: { tokenRegistro: token, tokenExpira: { gt: new Date() } },
    })

    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    if (solicitud.estado !== 'OTP') {
      return NextResponse.json({
        success: false,
        error: `Debes firmar primero (estado actual: ${solicitud.estado})`,
      }, { status: 400 })
    }

    // Generar OTP de 6 dígitos
    const otp = String(crypto.randomInt(100000, 999999))
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
    const otpExpira = new Date(Date.now() + 10 * 60 * 1000) // 10 minutos

    await db.solicitudConductorVehiculo.update({
      where: { id: solicitud.id },
      data: {
        otpHash,
        otpExpira,
      },
    })

    // En producción: enviar OTP por WhatsApp/SMS al solicitud.telefono
    // Por ahora se retorna para que el conductor lo ingrese (modo demo)
    console.log(`[OTP REGISTRO CONDUCTOR] ${solicitud.nombre} (${solicitud.telefono}): ${otp}`)

    return NextResponse.json({
      success: true,
      // En producción NO se debe devolver el OTP. Solo para desarrollo/demo:
      otpDemo: otp,
      telefono: solicitud.telefono.slice(0, -3) + 'XXX',
      message: `Código OTP enviado a ${solicitud.telefono.slice(0, -3)}XXX. Válido por 10 minutos.`,
    })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/otp] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
