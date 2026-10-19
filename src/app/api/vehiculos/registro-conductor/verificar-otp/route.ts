// =====================================================
// /api/vehiculos/registro-conductor/verificar-otp
// Verifica el OTP y marca como COMPLETADA
// El conductor ya firmó digitalmente el contrato en este punto
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, otp } = body

    if (!token || !otp) {
      return NextResponse.json({ success: false, error: 'Token y OTP son obligatorios' }, { status: 400 })
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
        error: `No estás en fase OTP (estado actual: ${solicitud.estado})`,
      }, { status: 400 })
    }

    if (!solicitud.otpHash || !solicitud.otpExpira || solicitud.otpExpira < new Date()) {
      return NextResponse.json({ success: false, error: 'OTP expirado. Solicita uno nuevo.' }, { status: 400 })
    }

    const otpHashInput = crypto.createHash('sha256').update(String(otp)).digest('hex')
    if (otpHashInput !== solicitud.otpHash) {
      return NextResponse.json({ success: false, error: 'Código OTP incorrecto' }, { status: 400 })
    }

    // OTP verificado → marcar como COMPLETADA
    const actualizada = await db.solicitudConductorVehiculo.update({
      where: { id: solicitud.id },
      data: {
        otpVerificado: true,
        estado: 'COMPLETADA',
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'SOLICITUD_CONDUCTOR',
        entidadId: solicitud.id,
        accion: 'CREAR',
        descripcion: `Solicitud de registro completada por ${solicitud.nombre} (CC ${solicitud.cedula}). OTP verificado, firma electrónica guardada.`,
        usuarioNombre: `${solicitud.nombre} (SELF-REGISTRO)`,
      },
    })

    return NextResponse.json({
      success: true,
      estado: 'COMPLETADA',
      message: '¡Registro completado! Tu solicitud será revisada por un administrador.',
    })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/verificar-otp] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
