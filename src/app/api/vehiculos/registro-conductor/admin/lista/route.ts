// =====================================================
// /api/vehiculos/registro-conductor/admin/lista
// Lista todas las solicitudes de registro (solo ADMIN/GESTOR)
// En la lista NO devuelve fotos completas (muy pesadas)
// Usa ?detalle=true&id=XXX para obtener fotos de una solicitud
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const detalleId = searchParams.get('id')

    // Si se pide detalle de una solicitud específica, devolver todo (con fotos)
    if (detalleId) {
      const solicitud = await db.solicitudConductorVehiculo.findUnique({
        where: { id: detalleId },
      })
      if (!solicitud) {
        return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: solicitud })
    }

    // Lista sin fotos completas (solo indicadores de si tiene foto)
    const where: any = {}
    if (estado) where.estado = estado

    const solicitudes = await db.solicitudConductorVehiculo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cedula: true,
        nombre: true,
        telefono: true,
        email: true,
        direccion: true,
        ciudad: true,
        barrio: true,
        licenciaNumero: true,
        licenciaCategoria: true,
        licenciaVence: true,
        contactoEmergenciaNombre: true,
        contactoEmergenciaTelefono: true,
        contactoEmergenciaParentesco: true,
        estado: true,
        createdAt: true,
        aprobadoPor: true,
        aprobadoAt: true,
        motivoRechazo: true,
        conductorCreadoId: true,
        // Indicadores de si tiene foto (sin cargar el base64 completo)
        // Usamos _count-like: si el campo no es null, tiene foto
      },
    })

    // Agregar indicadores booleanos de fotos
    const solicitudesConIndicadores = await Promise.all(
      solicitudes.map(async (s) => {
        const full = await db.solicitudConductorVehiculo.findUnique({
          where: { id: s.id },
          select: {
            fotoCedulaFrente: true,
            fotoCedulaReverso: true,
            fotoLicenciaFrente: true,
            fotoLicenciaReverso: true,
            fotoSelfie: true,
            fotoReciboServicios: true,
          },
        })
        return {
          ...s,
          tieneFotoCedulaFrente: !!full?.fotoCedulaFrente,
          tieneFotoCedulaReverso: !!full?.fotoCedulaReverso,
          tieneFotoLicenciaFrente: !!full?.fotoLicenciaFrente,
          tieneFotoLicenciaReverso: !!full?.fotoLicenciaReverso,
          tieneFotoSelfie: !!full?.fotoSelfie,
          tieneFotoReciboServicios: !!full?.fotoReciboServicios,
          // Para la miniatura del avatar: cargar selfie (es la más pequeña)
          fotoSelfie: full?.fotoSelfie || null,
        }
      })
    )

    return NextResponse.json({ success: true, data: solicitudesConIndicadores })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/admin/lista] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
