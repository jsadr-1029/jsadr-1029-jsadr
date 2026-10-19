// =====================================================
// /api/vehiculos/registro-conductor/iniciar
// Inicia el proceso de registro. El conductor ingresa su cédula.
// Si hay una solicitud pendiente con token, la retoma.
// Devuelve token de registro para continuar el proceso.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula, nombre, telefono, email } = body

    if (!cedula || !nombre || !telefono) {
      return NextResponse.json(
        { success: false, error: 'cedula, nombre y telefono son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar si ya existe conductor con esta cédula
    const conductorExistente = await db.conductorVehiculo.findUnique({
      where: { cedula: String(cedula).trim() },
    })
    if (conductorExistente) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un conductor con esta cédula. Inicia sesión en el portal del conductor.',
        codigo: 'YA_REGISTRADO',
      }, { status: 409 })
    }

    // Verificar si ya hay solicitud pendiente
    const existente = await db.solicitudConductorVehiculo.findFirst({
      where: {
        cedula: String(cedula).trim(),
        estado: { in: ['PENDIENTE', 'DOCUMENTOS', 'FIRMA', 'OTP'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    let solicitud
    if (existente) {
      // Retomar solicitud existente con nuevo token
      const token = crypto.randomBytes(24).toString('hex')
      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      solicitud = await db.solicitudConductorVehiculo.update({
        where: { id: existente.id },
        data: {
          nombre, telefono, email,
          tokenRegistro: token,
          tokenExpira: expira,
        },
      })
    } else {
      const token = crypto.randomBytes(24).toString('hex')
      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      solicitud = await db.solicitudConductorVehiculo.create({
        data: {
          cedula: String(cedula).trim(),
          nombre,
          telefono,
          email,
          estado: 'PENDIENTE',
          tokenRegistro: token,
          tokenExpira: expira,
          creadoPor: 'SELF',
        },
      })
    }

    return NextResponse.json({
      success: true,
      token: solicitud.tokenRegistro,
      solicitudId: solicitud.id,
      estado: solicitud.estado,
      message: 'Registro iniciado. Continúa con la carga de documentos.',
    })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/iniciar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
