// =====================================================
// /api/vehiculos/registro-conductor/documentos
// Guarda las URLs de fotos de documentos y datos adicionales
// Campos:
//  - fotoCedulaFrente, fotoCedulaReverso
//  - fotoLicenciaFrente, fotoLicenciaReverso
//  - fotoSelfie (con documentos)
//  - fotoReciboServicios
//  - datos adicionales: direccion, ciudad, barrio, licencia, contacto emergencia
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      token, cedula,
      direccion, ciudad, barrio, fechaNacimiento,
      licenciaNumero, licenciaCategoria, licenciaVence,
      contactoEmergenciaNombre, contactoEmergenciaTelefono, contactoEmergenciaParentesco,
      fotoCedulaFrente, fotoCedulaReverso,
      fotoLicenciaFrente, fotoLicenciaReverso,
      fotoSelfie, fotoReciboServicios,
    } = body

    // === Buscar solicitud por token O por cédula ===
    // Si viene token, usarlo. Si no, buscar por cédula (última solicitud pendiente)
    let solicitud: any = null
    if (token) {
      solicitud = await db.solicitudConductorVehiculo.findFirst({
        where: {
          tokenRegistro: token,
          tokenExpira: { gt: new Date() },
        },
      })
    }
    if (!solicitud && cedula) {
      // Buscar la última solicitud pendiente de esta cédula
      solicitud = await db.solicitudConductorVehiculo.findFirst({
        where: {
          cedula: String(cedula).trim(),
          estado: { in: ['PENDIENTE', 'DOCUMENTOS'] },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'No se encontró una solicitud de registro activa. Inicia el registro nuevamente.' }, { status: 404 })
    }

    // Validar que las 6 fotos estén cargadas para pasar a fase FIRMA
    const fotosCompletas = fotoCedulaFrente && fotoCedulaReverso &&
      fotoLicenciaFrente && fotoLicenciaReverso &&
      fotoSelfie && fotoReciboServicios

    const data: any = {
      direccion, ciudad, barrio,
      licenciaNumero, licenciaCategoria,
      contactoEmergenciaNombre, contactoEmergenciaTelefono, contactoEmergenciaParentesco,
      fotoCedulaFrente, fotoCedulaReverso,
      fotoLicenciaFrente, fotoLicenciaReverso,
      fotoSelfie, fotoReciboServicios,
    }
    if (fechaNacimiento) data.fechaNacimiento = new Date(fechaNacimiento)
    if (licenciaVence) data.licenciaVence = new Date(licenciaVence)

    // Si todas las fotos están, pasar a estado FIRMA
    if (fotosCompletas) {
      data.estado = 'FIRMA'
    } else {
      data.estado = 'DOCUMENTOS'
    }

    const actualizada = await db.solicitudConductorVehiculo.update({
      where: { id: solicitud.id },
      data,
    })

    return NextResponse.json({
      success: true,
      estado: actualizada.estado,
      fotosCompletas,
      message: fotosCompletas
        ? 'Documentos completos. Continúa con la firma electrónica.'
        : 'Documentos guardados parcialmente. Faltan fotos por cargar.',
    })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/documentos] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET - recupera el estado de la solicitud por token (para retomar)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })
    }
    const solicitud = await db.solicitudConductorVehiculo.findFirst({
      where: { tokenRegistro: token, tokenExpira: { gt: new Date() } },
    })
    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }
    return NextResponse.json({ success: true, data: solicitud })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
