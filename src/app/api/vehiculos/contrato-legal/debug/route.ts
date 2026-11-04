// =====================================================
// /api/vehiculos/contrato-legal/debug
// -----------------------------------------------------
// Endpoint temporal de diagnóstico que devuelve en JSON las
// fechas reales leídas de la DB para un contrato dado.
// Útil para detectar discrepancias entre DB y PDF generado.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function fmtFechaCorta(f: Date | string | null | undefined): string {
  if (!f) return 'N/A'
  const d = typeof f === 'string' ? new Date(f) : f
  const iso = d.toISOString()
  const [yyyy, mm, dd] = iso.split('T')[0].split('-')
  return `${dd} / ${mm} / ${yyyy}`
}

function fmtFechaCortaVieja(f: Date | string | null | undefined): string {
  if (!f) return 'N/A'
  const d = typeof f === 'string' ? new Date(f) : f
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}

function fmtFechaCortaUTC(f: Date | string | null | undefined): string {
  if (!f) return 'N/A'
  const d = typeof f === 'string' ? new Date(f) : f
  return `${String(d.getUTCDate()).padStart(2, '0')} / ${String(d.getUTCMonth() + 1).padStart(2, '0')} / ${d.getUTCFullYear()}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })
    }

    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { OR: [{ conductorToken: token }, { propietarioToken: token }] },
    })

    if (!documento) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })
    }

    // Aplicar las 3 versiones de fmtFechaCorta para comparar
    const resultado = {
      success: true,
      buildTag: '1793754000-debug-v2',
      timestamp: new Date().toISOString(),
      process_TZ: process.env.TZ || 'undefined',
      documento: {
        id: documento.id,
        numeroContrato: documento.numeroContrato,
        estado: documento.estado,
        vehiculoPlaca: documento.vehiculoPlaca,
        conductorNombre: documento.conductorNombre,
        fechaInicio_raw: documento.fechaInicio,
        fechaFin_raw: documento.fechaFin,
        fechaInicio_toISOString: documento.fechaInicio?.toISOString(),
        fechaFin_toISOString: documento.fechaFin?.toISOString(),
        fechaInicio_getUTCDate: documento.fechaInicio?.getUTCDate(),
        fechaInicio_getDate: documento.fechaInicio?.getDate(),
        fechaFin_getUTCDate: documento.fechaFin?.getUTCDate(),
        fechaFin_getDate: documento.fechaFin?.getDate(),
      },
      fmtFechaCorta_nueva: fmtFechaCorta(documento.fechaInicio),
      fmtFechaCorta_vieja: fmtFechaCortaVieja(documento.fechaInicio),
      fmtFechaCorta_UTC: fmtFechaCortaUTC(documento.fechaInicio),
      fmtFechaCorta_nueva_fin: fmtFechaCorta(documento.fechaFin),
      fmtFechaCorta_vieja_fin: fmtFechaCortaVieja(documento.fechaFin),
      fmtFechaCorta_UTC_fin: fmtFechaCortaUTC(documento.fechaFin),
      tarifa: documento.tarifa,
      modalidadPago: documento.modalidadPago,
    }

    return NextResponse.json(resultado, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('[contrato-legal/debug] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
