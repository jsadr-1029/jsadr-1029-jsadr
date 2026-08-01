// =====================================================
// /api/solicitudes-web/[id] — Detalle de Solicitud Web v3.0
// =====================================================
// GET -> obtiene una solicitud por id con tablaAmortizacion parseada
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const solicitud = await db.solicitudWeb.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            municipio: true,
            departamento: true,
            activo: true,
            tieneTasaPersonalizada: true,
            tasaPersonalizada: true,
            categoria: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
              },
            },
          },
        },
      },
    })

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Parsear tabla de amortización
    let tablaAmortizacionParseada: unknown = null
    if (solicitud.tablaAmortizacion) {
      try {
        tablaAmortizacionParseada = JSON.parse(solicitud.tablaAmortizacion)
      } catch {
        tablaAmortizacionParseada = null
      }
    }

    // Parsear historial de estados
    let historialEstadosParseado: unknown = null
    if (solicitud.historialEstados) {
      try {
        historialEstadosParseado = JSON.parse(solicitud.historialEstados)
      } catch {
        historialEstadosParseado = null
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...solicitud,
        tablaAmortizacionParseada,
        historialEstadosParseado,
      },
    })
  } catch (error) {
    logError('/api/solicitudes-web/[id] GET', error)
    return errorResponse('/api/solicitudes-web/[id] GET', error)
  }
}
