import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBaseUrl } from '@/lib/url'

/**
 * GET /api/portal/otros-si-pendientes
 *
 * Lista todos los Otros Síes del cliente autenticado que requieren su firma
 * (estado PENDIENTE_FIRMA) y también los ya firmados recientemente (FIRMADO),
 * para mostrarlos en el portal del cliente en la sección "Documentos por firmar".
 *
 * Header: x-portal-token: <token de sesión del cliente>
 *
 * Retorna para cada Otro Sí:
 *   - id, codigo, tipoModificacion, descripcion, estado, fechaSolicitud, fechaFirma
 *   - prestamo: { id, codigo, montoCuota, numeroCuotas, frecuencia }
 *   - firma: { id, estadoFirma, otpCanal, otpEnviado } (la firma electrónica vinculada)
 *   - tokenFirma: { token, fechaExpiracion } (si hay token activo para firmar)
 *   - linkFirma: URL pública /firma/{token} (para abrir el flujo de firma)
 *   - linkDocumento: URL del HTML del Otro Sí (regenerado) — solo lectura
 *   - linkConstancia: URL del certificado de firma (solo si está FIRMADO)
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    // === Buscar todos los solicitudes del cliente ===
    const prestamos = await db.prestamo.findMany({
      where: { clienteId: cliente.id },
      select: {
        id: true,
        codigo: true,
        montoCuota: true,
        numeroCuotas: true,
        frecuencia: true,
        montoPrincipal: true,
        estado: true,
      },
    })

    if (prestamos.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pendientesCount: 0,
      })
    }

    const prestamoIds = prestamos.map((p) => p.id)
    const prestamoMap = new Map(prestamos.map((p) => [p.id, p]))

    // === Buscar Otros Síes de esos solicitudes (PENDIENTE_FIRMA y FIRMADO) ===
    // Excluimos ANULADO. Orden: PENDIENTE_FIRMA primero, luego FIRMADO por fecha desc.
    const otrosSi = await db.otroSiCambioFecha.findMany({
      where: {
        prestamoId: { in: prestamoIds },
        estado: { in: ['PENDIENTE_FIRMA', 'FIRMADO'] },
      },
      include: {
        firma: {
          include: {
            tokens: {
              where: { usado: false },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
    })

    const origin = getBaseUrl()

    const data = otrosSi.map((os: any) => {
      const prestamo = prestamoMap.get(os.prestamoId)
      const firma = os.firma
      const tokenFirma = firma?.tokens?.[0] || null

      // === Link al documento HTML del Otro Sí ===
      // Endpoint público de lectura del HTML del Otro Sí (no requiere auth del admin):
      // usamos /api/portal/otros-si-pendientes/[id]/documento para servir el HTML
      const linkDocumento = `${origin}/api/portal/otros-si-pendientes/${os.id}/documento`

      // === Link al flujo de firma pública ===
      let linkFirma: string | null = null
      let tokenFirmaValor: string | null = null
      let tokenFirmaExpira: string | null = null
      if (tokenFirma) {
        tokenFirmaValor = tokenFirma.token
        tokenFirmaExpira = tokenFirma.fechaExpiracion.toISOString()
        linkFirma = `${origin}/firma/${tokenFirma.token}`
      }

      // === Link a la constancia de firma (solo si está FIRMADO) ===
      let linkConstancia: string | null = null
      if (os.estado === 'FIRMADO' && firma?.id) {
        linkConstancia = `${origin}/api/firma/certificado?firmaId=${firma.id}`
      }

      return {
        id: os.id,
        codigo: os.codigo,
        tipoModificacion: os.tipoModificacion,
        descripcion: os.descripcion,
        estado: os.estado,
        fechaSolicitud: os.fechaSolicitud.toISOString(),
        fechaFirma: os.fechaFirma ? os.fechaFirma.toISOString() : null,
        prestamo: prestamo
          ? {
              id: prestamo.id,
              codigo: prestamo.codigo,
              montoCuota: Number(prestamo.montoCuota),
              numeroCuotas: prestamo.numeroCuotas,
              frecuencia: prestamo.frecuencia,
              montoPrincipal: Number(prestamo.montoPrincipal),
              estado: prestamo.estado,
            }
          : null,
        firma: firma
          ? {
              id: firma.id,
              estadoFirma: firma.estadoFirma,
              otpCanal: firma.otpCanal,
              otpEnviado: firma.otpEnviado,
              otpValidado: firma.otpValidado,
              fechaFirmaCompleta: firma.fechaFirmaCompleta
                ? firma.fechaFirmaCompleta.toISOString()
                : null,
            }
          : null,
        tokenFirma: tokenFirmaValor,
        tokenFirmaExpira: tokenFirmaExpira,
        linkFirma,
        linkDocumento,
        linkConstancia,
      }
    })

    const pendientesCount = data.filter((d: any) => d.estado === 'PENDIENTE_FIRMA').length

    return NextResponse.json({
      success: true,
      data,
      pendientesCount,
    })
  } catch (error: any) {
    console.error('[portal/otros-si-pendientes] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener Otros Síes pendientes' },
      { status: 500 }
    )
  }
}
