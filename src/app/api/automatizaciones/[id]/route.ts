// =====================================================
// /api/automatizaciones/[id] — GET/PATCH/DELETE v3.0
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params

    const automatizacion = await db.automatizacion.findUnique({
      where: { id },
      include: {
        ejecuciones: {
          orderBy: { fechaInicio: 'desc' },
          take: 20,
        },
        _count: { select: { ejecuciones: true } },
      },
    })

    if (!automatizacion) {
      return NextResponse.json(
        { success: false, error: 'Automatización no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: automatizacion })
  } catch (error) {
    logError('/api/automatizaciones/[id] GET', error)
    return errorResponse('/api/automatizaciones/[id] GET', error)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const body = await req.json()

    const existente = await db.automatizacion.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Automatización no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const datosActualizacion: any = {}
    if (body.nombre !== undefined) datosActualizacion.nombre = body.nombre
    if (body.descripcion !== undefined) datosActualizacion.descripcion = body.descripcion
    if (body.tipo !== undefined) datosActualizacion.tipo = body.tipo
    if (body.modulo !== undefined) datosActualizacion.modulo = body.modulo
    if (body.condicion !== undefined) {
      datosActualizacion.condicion = body.condicion ? JSON.stringify(body.condicion) : null
    }
    if (body.accion !== undefined) {
      datosActualizacion.accion = body.accion ? JSON.stringify(body.accion) : null
    }
    if (body.activa !== undefined) {
      datosActualizacion.activa = body.activa
      // Si se reactiva, reprogramar
      if (body.activa && !existente.proximaEjecucion) {
        datosActualizacion.proximaEjecucion = new Date(
          Date.now() + (body.intervaloMinutos || existente.intervaloMinutos) * 60 * 1000
        )
      } else if (!body.activa) {
        datosActualizacion.proximaEjecucion = null
      }
    }
    if (body.intervaloMinutos !== undefined) {
      datosActualizacion.intervaloMinutos = body.intervaloMinutos
      // Recalcular próxima ejecución
      if (existente.activa) {
        datosActualizacion.proximaEjecucion = new Date(
          Date.now() + body.intervaloMinutos * 60 * 1000
        )
      }
    }

    const actualizada = await db.automatizacion.update({
      where: { id },
      data: datosActualizacion,
      include: {
        _count: { select: { ejecuciones: true } },
      },
    })

    return NextResponse.json({ success: true, data: actualizada })
  } catch (error) {
    logError('/api/automatizaciones/[id] PATCH', error)
    return errorResponse('/api/automatizaciones/[id] PATCH', error)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params

    const existente = await db.automatizacion.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Automatización no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Eliminar en cascada (las ejecuciones se eliminan automáticamente por onDelete: Cascade)
    await db.automatizacion.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Automatización eliminada correctamente',
    })
  } catch (error) {
    logError('/api/automatizaciones/[id] DELETE', error)
    return errorResponse('/api/automatizaciones/[id] DELETE', error)
  }
}
