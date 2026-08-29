import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generarHtmlOtroSi, TipoModificacionOtroSi, CuotaModificada } from '@/lib/otro-si'
import { getBaseUrl } from '@/lib/url'

/**
 * GET /api/portal/otros-si-pendientes/[id]/documento
 *
 * Sirve el HTML imprimible del Otro Sí para que el cliente pueda verlo
 * desde el portal (sin necesidad de autenticación de admin).
 *
 * Requiere header x-portal-token para garantizar que solo el cliente
 * dueño del Otro Sí pueda verlo.
 *
 * Query params:
 *   ?descargar=1  → fuerza descarga con Content-Disposition: attachment
 *                   (por defecto se devuelve inline para abrir/imprimir)
 *
 * El HTML incluye:
 *   - Si estado=PENDIENTE_FIRMA: documento sin firma (con espacio vacío)
 *   - Si estado=FIRMADO: documento con imagen de firma + constancia de firma electrónica + link al certificado
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: otroSiId } = await params
    const { searchParams } = new URL(req.url)
    const descargar = searchParams.get('descargar') === '1'

    const otroSi = await db.otroSiCambioFecha.findUnique({
      where: { id: otroSiId },
      include: {
        prestamo: { include: { cliente: true } },
        firma: true,
      },
    })

    if (!otroSi) {
      return NextResponse.json(
        { success: false, error: 'Otro Sí no encontrado' },
        { status: 404 }
      )
    }

    // Validar que el Otro Sí pertenece a un solicitud del cliente autenticado
    if (otroSi.prestamo.clienteId !== cliente.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para ver este Otro Sí' },
        { status: 403 }
      )
    }

    const prestamo = otroSi.prestamo
    const clientePrestamo = prestamo.cliente

    // === Parsear modificaciones desde el JSON almacenado ===
    let modificaciones: CuotaModificada[] = []
    try {
      modificaciones = JSON.parse(otroSi.fechasAnteriores || '[]')
    } catch {
      modificaciones = []
    }

    // === Construir datos de firma (si está firmado) ===
    let datosFirma: any = undefined
    let linkConstancia: string | undefined = undefined

    if (otroSi.estado === 'FIRMADO' && otroSi.firma && otroSi.firma.imagenFirma) {
      datosFirma = {
        firmaId: otroSi.firma.id,
        imagenFirma: otroSi.firma.imagenFirma,
        fechaFirma: otroSi.firma.fechaFirmaCompleta || otroSi.fechaFirma || otroSi.firma.createdAt,
        ipFirma: otroSi.firma.ipFirma,
        userAgent: otroSi.firma.userAgent,
        otpCanal: otroSi.firma.otpCanal,
        otpValidado: otroSi.firma.otpValidado,
        fotoSelfie: otroSi.firma.fotoSelfie,
        estadoFirma: otroSi.firma.estadoFirma,
      }
      linkConstancia = `${getBaseUrl()}/api/firma/certificado?firmaId=${otroSi.firma.id}`
    }

    // === Regenerar el HTML del Otro Sí ===
    const html = generarHtmlOtroSi({
      codigo: otroSi.codigo,
      tipoModificacion: otroSi.tipoModificacion as TipoModificacionOtroSi,
      prestamoCodigo: prestamo.codigo,
      clienteNombre: clientePrestamo.nombre,
      clienteCedula: clientePrestamo.cedula,
      clienteTelefono: clientePrestamo.telefono || undefined,
      clienteEmail: clientePrestamo.email || undefined,
      montoPrincipal: prestamo.montoPrincipal,
      montoCuota: prestamo.montoCuota,
      numeroCuotas: prestamo.numeroCuotas,
      frecuencia: prestamo.frecuencia,
      modificaciones,
      descripcion: otroSi.descripcion,
      fechaGeneracion: otroSi.fechaFirma ?? otroSi.createdAt,
      firma: datosFirma,
      linkConstancia,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    }

    if (descargar) {
      const codigoLimpio = otroSi.codigo.replace(/[^A-Za-z0-9-]/g, '_')
      const prestamoLimpio = prestamo.codigo.replace(/[^A-Za-z0-9-]/g, '_')
      const nombreArchivo = `${codigoLimpio}_${prestamoLimpio}_OtroSi.html`
      headers['Content-Disposition'] = `attachment; filename="${nombreArchivo}"`
    }

    return new NextResponse(html, { headers })
  } catch (error: any) {
    console.error('[portal/otros-si-pendientes/[id]/documento] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al generar el documento' },
      { status: 500 }
    )
  }
}
