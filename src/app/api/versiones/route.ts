// =====================================================
// /api/versiones — CRUD para versiones del sistema v3.0
// GET  : lista versiones
// POST : crea nueva versión
// Solo ADMIN puede crear/editar/eliminar.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const activa = searchParams.get('activa')

    const where: any = {}
    if (activa === 'true') where.activa = true
    if (activa === 'false') where.activa = false

    const versiones = await db.versionSistema.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: versiones })
  } catch (error) {
    logError('/api/versiones GET', error)
    return errorResponse('/api/versiones GET', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { numero, nombre, descripcion, cambios, tipo } = body

    if (!numero || !nombre) {
      return NextResponse.json(
        { success: false, error: 'Número y nombre son obligatorios', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // Validar formato de versión semántica (X.Y.Z)
    if (!/^\d+\.\d+\.\d+$/.test(numero)) {
      return NextResponse.json(
        { success: false, error: 'Formato de versión inválido (use X.Y.Z)', code: 'INVALID_VERSION' },
        { status: 400 }
      )
    }

    let cambiosStr: string | null = null
    if (cambios) {
      try {
        cambiosStr = JSON.stringify(cambios)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Cambios con JSON inválido', code: 'INVALID_JSON' },
          { status: 400 }
        )
      }
    }

    const nueva = await db.versionSistema.create({
      data: {
        numero,
        nombre,
        descripcion: descripcion || null,
        cambios: cambiosStr,
        tipo: tipo || 'MAYOR',
        activa: false, // por defecto inactiva, se activa con /activar
        creadorId: authResult.id,
      },
    })

    return NextResponse.json({ success: true, data: nueva }, { status: 201 })
  } catch (error) {
    logError('/api/versiones POST', error)
    return errorResponse('/api/versiones POST', error)
  }
}
