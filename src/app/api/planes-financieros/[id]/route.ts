// =====================================================
// /api/planes-financieros/[id] — Operaciones por ID
// PATCH: actualizar estado, métricas, aprobación
// DELETE: eliminar (solo ADMIN, solo BORRADOR)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { z } from 'zod'

const updateSchema = z.object({
  accion: z.enum(['actualizar', 'activar', 'completar', 'cancelar', 'aprobar', 'actualizar_metricas']),
  nombre: z.string().min(3).max(200).optional(),
  descripcion: z.string().max(2000).optional(),
  tipo: z.enum(['CRECIMIENTO', 'OPTIMIZACION', 'REDUCCION_RIESGO', 'LIQUIDEZ', 'EXPANSION']).optional(),
  prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  presupuestoInversion: z.number().min(0).optional(),
  metaIngresos: z.number().min(0).optional(),
  metaAhorroCostos: z.number().min(0).optional(),
  roiEsperado: z.number().min(-100).max(10000).optional(),
  responsableNombre: z.string().max(200).optional(),
  indicadores: z.string().max(5000).optional(),
  // Para actualizar_metricas
  ingresoReal: z.number().min(0).optional(),
  costoReal: z.number().min(0).optional(),
  roiReal: z.number().optional(),
  progreso: z.number().min(0).max(100).optional(),
  notasSeguimiento: z.string().max(5000).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const plan = await db.planEstrategicoFinanciero.findUnique({ where: { id } })
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await req.json()

    const validacion = updateSchema.safeParse(body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', fieldErrors: validacion.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = validacion.data
    const accion = data.accion
    const clientInfo = getClientInfo(req)

    const planExistente = await db.planEstrategicoFinanciero.findUnique({ where: { id } })
    if (!planExistente) {
      return NextResponse.json({ success: false, error: 'Plan no encontrado' }, { status: 404 })
    }

    let nuevosDatos: any = {}
    let mensajeAudit = ''

    switch (accion) {
      case 'actualizar':
        nuevosDatos = {
          nombre: data.nombre,
          descripcion: data.descripcion,
          tipo: data.tipo,
          prioridad: data.prioridad,
          fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
          fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
          presupuestoInversion: data.presupuestoInversion,
          metaIngresos: data.metaIngresos,
          metaAhorroCostos: data.metaAhorroCostos,
          roiEsperado: data.roiEsperado,
          responsableNombre: data.responsableNombre,
          indicadores: data.indicadores,
        }
        mensajeAudit = `Plan ${planExistente.codigo} actualizado`
        break

      case 'activar':
        if (planExistente.estado !== 'BORRADOR' && planExistente.estado !== 'EN_REVISION') {
          return NextResponse.json(
            { success: false, error: 'Solo se pueden activar planes en BORRADOR o EN_REVISION' },
            { status: 400 }
          )
        }
        nuevosDatos = { estado: 'ACTIVO', fechaAprobacion: new Date(), aprobadoPor: auth.id }
        mensajeAudit = `Plan ${planExistente.codigo} activado`
        break

      case 'completar':
        if (planExistente.estado !== 'ACTIVO') {
          return NextResponse.json(
            { success: false, error: 'Solo se pueden completar planes ACTIVOS' },
            { status: 400 }
          )
        }
        nuevosDatos = { estado: 'COMPLETADO' }
        mensajeAudit = `Plan ${planExistente.codigo} completado`
        break

      case 'cancelar':
        nuevosDatos = { estado: 'CANCELADO' }
        mensajeAudit = `Plan ${planExistente.codigo} cancelado`
        break

      case 'aprobar':
        nuevosDatos = { estado: 'ACTIVO', fechaAprobacion: new Date(), aprobadoPor: auth.id }
        mensajeAudit = `Plan ${planExistente.codigo} aprobado`
        break

      case 'actualizar_metricas':
        // Calcular ROI real si hay ingreso y costo
        let roiReal = data.roiReal
        if (data.ingresoReal !== undefined && data.costoReal !== undefined && data.costoReal > 0) {
          roiReal = ((data.ingresoReal - data.costoReal) / data.costoReal) * 100
        }
        nuevosDatos = {
          ingresoReal: data.ingresoReal,
          costoReal: data.costoReal,
          roiReal: roiReal,
          progreso: data.progreso,
          notasSeguimiento: data.notasSeguimiento,
        }
        mensajeAudit = `Métricas del plan ${planExistente.codigo} actualizadas`
        break
    }

    // Limpiar undefined
    Object.keys(nuevosDatos).forEach(k => nuevosDatos[k] === undefined && delete nuevosDatos[k])

    const planActualizado = await db.planEstrategicoFinanciero.update({
      where: { id },
      data: nuevosDatos,
    })

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'PLAN_FINANCIERO_ACTUALIZADO',
      modulo: 'planes-financieros',
      entidadId: id,
      entidadNombre: planExistente.nombre,
      detalles: mensajeAudit,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, data: planActualizado, mensaje: mensajeAudit })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const plan = await db.planEstrategicoFinanciero.findUnique({ where: { id } })
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan no encontrado' }, { status: 404 })
    }

    // Solo se pueden eliminar planes en BORRADOR o CANCELADO
    if (plan.estado !== 'BORRADOR' && plan.estado !== 'CANCELADO') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden eliminar planes en BORRADOR o CANCELADO' },
        { status: 400 }
      )
    }

    await db.planEstrategicoFinanciero.delete({ where: { id } })

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'PLAN_FINANCIERO_ELIMINADO',
      modulo: 'planes-financieros',
      entidadId: id,
      entidadNombre: plan.nombre,
      detalles: `Plan ${plan.codigo} eliminado`,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, mensaje: `Plan ${plan.codigo} eliminado` })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
