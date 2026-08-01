// =====================================================
// /api/versiones/[id] — GET/PATCH/DELETE v3.0
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
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const version = await db.versionSistema.findUnique({ where: { id } })

    if (!version) {
      return NextResponse.json(
        { success: false, error: 'Versión no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: version })
  } catch (error) {
    logError('/api/versiones/[id] GET', error)
    return errorResponse('/api/versiones/[id] GET', error)
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

    const existente = await db.versionSistema.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Versión no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const datosActualizacion: any = {}
    if (body.nombre !== undefined) datosActualizacion.nombre = body.nombre
    if (body.descripcion !== undefined) datosActualizacion.descripcion = body.descripcion
    if (body.tipo !== undefined) datosActualizacion.tipo = body.tipo
    if (body.cambios !== undefined) {
      datosActualizacion.cambios = body.cambios ? JSON.stringify(body.cambios) : null
    }
    // No se puede cambiar `activa` aquí; usar /activar
    // No se puede cambiar `numero` (es unique y puede romper referencias)

    const actualizada = await db.versionSistema.update({
      where: { id },
      data: datosActualizacion,
    })

    return NextResponse.json({ success: true, data: actualizada })
  } catch (error) {
    logError('/api/versiones/[id] PATCH', error)
    return errorResponse('/api/versiones/[id] PATCH', error)
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
    const existente = await db.versionSistema.findUnique({ where: { id } })

    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Versión no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (existente.activa) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar la versión activa. Active otra primero.',
          code: 'CANNOT_DELETE_ACTIVE',
        },
        { status: 400 }
      )
    }

    await db.versionSistema.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Versión eliminada correctamente',
    })
  } catch (error) {
    logError('/api/versiones/[id] DELETE', error)
    return errorResponse('/api/versiones/[id] DELETE', error)
  }
}
