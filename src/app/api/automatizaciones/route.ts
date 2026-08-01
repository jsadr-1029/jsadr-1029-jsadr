// =====================================================
// /api/automatizaciones — CRUD v3.0
// GET  : lista automatizaciones (con filtros)
// POST : crea nueva automatización
// Solo ADMIN puede crear/editar/eliminar; CONSULTOR solo GET.
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
    const tipo = searchParams.get('tipo')
    const modulo = searchParams.get('modulo')
    const activa = searchParams.get('activa')

    const where: any = {}
    if (tipo) where.tipo = tipo
    if (modulo) where.modulo = modulo
    if (activa !== null && activa !== undefined) {
      where.activa = activa === 'true'
    }

    const automatizaciones = await db.automatizacion.findMany({
      where,
      include: {
        _count: { select: { ejecuciones: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: automatizaciones })
  } catch (error) {
    logError('/api/automatizaciones GET', error)
    return errorResponse('/api/automatizaciones GET', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const {
      nombre,
      descripcion,
      tipo,
      modulo = 'general',
      condicion,
      accion,
      activa = true,
      intervaloMinutos = 60,
    } = body

    if (!nombre || !tipo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nombre y tipo son obligatorios',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    // Validar tipo
    const tiposValidos = [
      'RECORDATORIO_PAGO',
      'ESCALACION_MORA',
      'COBRO_AUTOMATICO',
      'WHATSAPP_AUTO',
      'REPORTES_PROGRAMADOS',
      'SINCRONIZACION_BANCARIA',
    ]
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json(
        { success: false, error: `Tipo inválido. Válidos: ${tiposValidos.join(', ')}`, code: 'INVALID_TYPE' },
        { status: 400 }
      )
    }

    // Validar que condicion y accion sean JSON serializable
    let condicionStr: string | null = null
    let accionStr: string | null = null
    try {
      if (condicion) condicionStr = JSON.stringify(condicion)
      if (accion) accionStr = JSON.stringify(accion)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Condición o acción con JSON inválido', code: 'INVALID_JSON' },
        { status: 400 }
      )
    }

    // Calcular próxima ejecución si está activa
    const proximaEjecucion = activa
      ? new Date(Date.now() + intervaloMinutos * 60 * 1000)
      : null

    const nueva = await db.automatizacion.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        tipo,
        modulo,
        condicion: condicionStr,
        accion: accionStr,
        activa,
        intervaloMinutos,
        proximaEjecucion,
        creadorId: authResult.id,
      },
      include: {
        _count: { select: { ejecuciones: true } },
      },
    })

    return NextResponse.json({ success: true, data: nueva }, { status: 201 })
  } catch (error) {
    logError('/api/automatizaciones POST', error)
    return errorResponse('/api/automatizaciones POST', error)
  }
}
