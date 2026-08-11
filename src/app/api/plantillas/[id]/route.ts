// =====================================================
// API /api/plantillas/[id] — Operaciones sobre una plantilla
// =====================================================
// GET    /api/plantillas/[id]   → obtener una plantilla
// PATCH  /api/plantillas/[id]   → actualizar
// DELETE /api/plantillas/[id]   → eliminar (solo si sistema=false)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { invalidarCachePlantillas } from '@/lib/plantillas'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const plantilla = await db.plantilla.findUnique({ where: { id: params.id } })
    if (!plantilla) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: plantilla })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Error al obtener plantilla' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(req, ['ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const existente = await db.plantilla.findUnique({ where: { id: params.id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    const allowedFields = [
      'nombre', 'categoria', 'descripcion', 'asunto', 'contenido',
      'contenidoHtml', 'variables', 'activa', 'evento',
    ]
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        if (f === 'variables' && Array.isArray(body[f])) {
          updateData[f] = JSON.stringify(body[f])
        } else {
          updateData[f] = body[f]
        }
      }
    }

    // Solo permitir cambiar codigo/tipo si no es del sistema
    if (!existente.sistema) {
      if (body.codigo !== undefined) updateData.codigo = body.codigo
      if (body.tipo !== undefined) updateData.tipo = body.tipo
    }

    const actualizada = await db.plantilla.update({
      where: { id: params.id },
      data: updateData,
    })

    invalidarCachePlantillas()

    return NextResponse.json({ success: true, data: actualizada })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Error al actualizar plantilla' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(req, ['ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const existente = await db.plantilla.findUnique({ where: { id: params.id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      )
    }

    if (existente.sistema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Las plantillas del sistema no se pueden eliminar. Puedes desactivarlas.',
        },
        { status: 403 }
      )
    }

    await db.plantilla.delete({ where: { id: params.id } })

    invalidarCachePlantillas()

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Error al eliminar plantilla' },
      { status: 500 }
    )
  }
}
