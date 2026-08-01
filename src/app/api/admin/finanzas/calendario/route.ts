// =====================================================
// /api/admin/finanzas/calendario — Calendario / Agenda financiera (Módulo 6)
// Mantiene registro de cada compra, cuota, saldo y gasto en tiempo real.
//
//   GET    → lista eventos (con filtros ?tipo=&desde=&hasta=&completado=)
//   POST   → crea un nuevo evento
//   PATCH  → actualiza un evento (toggle completado, editar, etc.)
//   DELETE → elimina un evento (?id=)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const TIPOS_VALIDOS = ['PAGO', 'RECORDATORIO', 'REPORTE', 'OTRO']

// =====================================================
// GET — Listar eventos del calendario
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const completado = searchParams.get('completado')

    const where: any = {}
    if (tipo && TIPOS_VALIDOS.includes(tipo)) where.tipo = tipo
    if (desde || hasta) {
      where.fecha = {}
      if (desde) where.fecha.gte = new Date(desde)
      if (hasta) where.fecha.lte = new Date(hasta)
    }
    if (completado === 'true') where.completado = true
    if (completado === 'false') where.completado = false

    const eventos = await db.eventoFinanciero.findMany({
      where,
      orderBy: { fecha: 'asc' },
      take: 500,
    })

    // Resumen rápido para el panel
    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59)

    const eventosMes = await db.eventoFinanciero.findMany({
      where: { fecha: { gte: inicioMes, lte: finMes } },
    })

    const proximos = await db.eventoFinanciero.findMany({
      where: {
        fecha: { gte: ahora },
        completado: false,
      },
      orderBy: { fecha: 'asc' },
      take: 5,
    })

    const resumen = {
      total: eventos.length,
      pendientes: eventos.filter((e) => !e.completado).length,
      completados: eventos.filter((e) => e.completado).length,
      eventosMes: eventosMes.length,
      proximos,
    }

    return NextResponse.json({ success: true, data: eventos, resumen })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Crear evento
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { titulo, descripcion, fecha, tipo, monto, categoria, origen, completado } = body

    if (!titulo) {
      return NextResponse.json(
        { success: false, error: 'titulo es requerido' },
        { status: 400 }
      )
    }
    if (!fecha) {
      return NextResponse.json(
        { success: false, error: 'fecha es requerida' },
        { status: 400 }
      )
    }

    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'OTRO'

    const nuevo = await db.eventoFinanciero.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        fecha: new Date(fecha),
        tipo: tipoFinal,
        monto: monto !== undefined && monto !== null && monto !== '' ? parseFloat(monto) : null,
        categoria: categoria || null,
        origen: origen || 'MANUAL',
        completado: typeof completado === 'boolean' ? completado : false,
      },
    })

    try {
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.username,
        accion: 'CREAR_EVENTO_CALENDARIO',
        modulo: 'finanzas',
        entidadNombre: titulo,
        detalles: `Evento de calendario creado por ${auth.username} (${tipoFinal})`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch (e) {
      // no bloquear
    }

    return NextResponse.json({ success: true, data: nuevo })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// PATCH — Actualizar evento
// Body: { id, titulo?, descripcion?, fecha?, tipo?, monto?, categoria?, origen?, completado? }
// =====================================================
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { id, titulo, descripcion, fecha, tipo, monto, categoria, origen, completado } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      )
    }

    const existente = await db.eventoFinanciero.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      )
    }

    const datos: any = {}
    if (titulo !== undefined) datos.titulo = titulo
    if (descripcion !== undefined) datos.descripcion = descripcion
    if (fecha !== undefined) datos.fecha = new Date(fecha)
    if (tipo !== undefined && TIPOS_VALIDOS.includes(tipo)) datos.tipo = tipo
    if (monto !== undefined) {
      datos.monto = monto === null || monto === '' ? null : parseFloat(monto)
    }
    if (categoria !== undefined) datos.categoria = categoria
    if (origen !== undefined) datos.origen = origen
    if (typeof completado === 'boolean') datos.completado = completado

    const actualizado = await db.eventoFinanciero.update({ where: { id }, data: datos })

    if (typeof completado === 'boolean') {
      try {
        await registrarAuditLog({
          usuarioId: auth.id,
          usuarioNombre: auth.username,
          accion: 'ACTUALIZAR_EVENTO_CALENDARIO',
          modulo: 'finanzas',
          entidadNombre: existente.titulo,
          detalles: `Evento ${completado ? 'completado' : 'reabierto'} por ${auth.username}`,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        })
      } catch (e) {
        // no bloquear
      }
    }

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — Eliminar evento
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido (query param)' },
        { status: 400 }
      )
    }

    const existente = await db.eventoFinanciero.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      )
    }

    await db.eventoFinanciero.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
