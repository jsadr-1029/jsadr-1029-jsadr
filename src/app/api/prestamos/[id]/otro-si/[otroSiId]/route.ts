import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import {
  generarHtmlOtroSi,
  TipoModificacionOtroSi,
  CuotaModificada,
} from '@/lib/otro-si'

// =====================================================
// GET /api/prestamos/[id]/otro-si/[otroSiId]
// Devuelve el HTML imprimible/descargable de un Otro Sí
// existente, regenerado a partir de los datos almacenados.
//
// Query params opcionales:
//   ?descargar=1  → fuerza descarga con Content-Disposition: attachment
//                   (por defecto se devuelve inline para abrir/imprimir)
//
// Autorización: roles ADMIN, GESTOR, CONSULTOR.
// =====================================================
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; otroSiId: string }>
  }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { id: prestamoId, otroSiId } = await params
    const { searchParams } = new URL(req.url)
    const descargar = searchParams.get('descargar') === '1'

    // === Cargar Otro Sí ===
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

    // Validar que el Otro Sí pertenezca al préstamo indicado
    if (otroSi.prestamoId !== prestamoId) {
      return NextResponse.json(
        { success: false, error: 'El Otro Sí no pertenece al préstamo indicado' },
        { status: 400 }
      )
    }

    const prestamo = otroSi.prestamo
    const cliente = prestamo.cliente

    // === Parsear modificaciones desde el JSON almacenado ===
    let modificaciones: CuotaModificada[] = []
    try {
      modificaciones = JSON.parse(otroSi.fechasAnteriores || '[]')
    } catch {
      modificaciones = []
    }

    // === Regenerar el HTML del Otro Sí ===
    const html = generarHtmlOtroSi({
      codigo: otroSi.codigo,
      tipoModificacion: otroSi.tipoModificacion as TipoModificacionOtroSi,
      prestamoCodigo: prestamo.codigo,
      clienteNombre: cliente.nombre,
      clienteCedula: cliente.cedula,
      clienteTelefono: cliente.telefono || undefined,
      clienteEmail: cliente.email || undefined,
      montoPrincipal: prestamo.montoPrincipal,
      montoCuota: prestamo.montoCuota,
      numeroCuotas: prestamo.numeroCuotas,
      frecuencia: prestamo.frecuencia,
      modificaciones,
      descripcion: otroSi.descripcion,
      fechaGeneracion: otroSi.fechaFirma ?? otroSi.createdAt,
    })

    // === Si pidió descarga, agregar header attachment ===
    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
    }

    if (descargar) {
      // Nombre de archivo seguro: OS-001_JSA-CC-..._.html
      const codigoLimpio = otroSi.codigo.replace(/[^A-Za-z0-9-]/g, '_')
      const prestamoLimpio = prestamo.codigo.replace(/[^A-Za-z0-9-]/g, '_')
      const nombreArchivo = `${codigoLimpio}_${prestamoLimpio}_OtroSi.html`
      headers['Content-Disposition'] = `attachment; filename="${nombreArchivo}"`
    }

    // === Bitácora (no bloqueante) ===
    try {
      await db.bitacoraPrestamo.create({
        data: {
          prestamoId,
          prestamoCodigo: prestamo.codigo,
          usuarioNombre: 'Gestor',
          tipo: 'OTRO',
          titulo: `OTRO SÍ ${descargar ? 'DESCARGADO' : 'VISUALIZADO'}: ${otroSi.codigo}`,
          descripcion:
            `Se ${descargar ? 'descargó' : 'visualizó'} el Otro Sí ${otroSi.codigo} ` +
            `del préstamo ${prestamo.codigo}.\n` +
            `Estado del Otro Sí: ${otroSi.estado}\n` +
            `Tipo de modificación: ${otroSi.tipoModificacion}\n` +
            `Modificaciones: ${modificaciones.length} cuota(s)\n` +
            `Cliente: ${cliente.nombre} (CC ${cliente.cedula})`,
          resultado: `Otro Sí ${otroSi.codigo} ${descargar ? 'descargado' : 'visualizado'}`,
          fechaEvento: new Date(),
        },
      })
    } catch (e) {
      console.error('[otro-si/download] No se pudo registrar bitácora:', e)
    }

    return new NextResponse(html, { headers })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
