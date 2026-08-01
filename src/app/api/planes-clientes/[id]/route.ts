// =====================================================
// /api/planes-clientes/[id] — Operaciones por ID
// PATCH: actualizar estado, métricas
// DELETE: eliminar (solo ADMIN, solo BORRADOR)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { z } from 'zod'

const updateSchema = z.object({
  accion: z.enum(['actualizar', 'proponer', 'aceptar', 'iniciar_ejecucion', 'completar', 'cancelar', 'actualizar_metricas']),
  nombre: z.string().min(3).max(200).optional(),
  descripcion: z.string().max(2000).optional(),
  tipo: z.enum(['PERSONALIZADO', 'REESTRUCTURACION', 'REFINANCIACION', 'EXPANSION_CREDITO', 'FIDELIZACION']).optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  montoObjetivo: z.number().min(0).optional(),
  tasaPersonalizada: z.number().min(0).max(100).optional(),
  plazoMeses: z.number().int().min(1).max(120).optional(),
  cuotaObjetivo: z.number().min(0).optional(),
  objetivoComercial: z.string().max(1000).optional(),
  metricasExito: z.string().max(5000).optional(),
  gestorAsignado: z.string().max(200).optional(),
  // Para actualizar_metricas
  montoAprobado: z.number().min(0).optional(),
  cuotaActual: z.number().min(0).optional(),
  pagosRealizados: z.number().int().min(0).optional(),
  saldoPendiente: z.number().min(0).optional(),
  progreso: z.number().min(0).max(100).optional(),
  notasSeguimiento: z.string().max(5000).optional(),
  // Vinculación
  prestamoVinculadoId: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const plan = await db.planCliente.findUnique({ where: { id } })
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

    const planExistente = await db.planCliente.findUnique({ where: { id } })
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
          fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
          fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
          montoObjetivo: data.montoObjetivo,
          tasaPersonalizada: data.tasaPersonalizada,
          plazoMeses: data.plazoMeses,
          cuotaObjetivo: data.cuotaObjetivo,
          objetivoComercial: data.objetivoComercial,
          metricasExito: data.metricasExito,
          gestorAsignado: data.gestorAsignado,
        }
        mensajeAudit = `Plan ${planExistente.codigo} actualizado`
        break

      case 'proponer':
        if (planExistente.estado !== 'BORRADOR') {
          return NextResponse.json(
            { success: false, error: 'Solo se pueden proponer planes en BORRADOR' },
            { status: 400 }
          )
        }
        nuevosDatos = { estado: 'PROPUESTO' }
        mensajeAudit = `Plan ${planExistente.codigo} propuesto al cliente`
        break

      case 'aceptar':
        if (planExistente.estado !== 'PROPUESTO' && planExistente.estado !== 'BORRADOR') {
          return NextResponse.json(
            { success: false, error: 'Solo se pueden aceptar planes PROPUESTOS o en BORRADOR' },
            { status: 400 }
          )
        }
        nuevosDatos = { estado: 'ACEPTADO', fechaAceptacion: new Date() }
        mensajeAudit = `Plan ${planExistente.codigo} aceptado por cliente`
        break

      case 'iniciar_ejecucion':
        if (planExistente.estado !== 'ACEPTADO') {
          return NextResponse.json(
            { success: false, error: 'Solo se pueden ejecutar planes ACEPTADOS' },
            { status: 400 }
          )
        }
        nuevosDatos = { estado: 'EN_EJECUCION' }
        mensajeAudit = `Plan ${planExistente.codigo} en ejecución`
        break

      case 'completar':
        if (planExistente.estado !== 'EN_EJECUCION') {
          return NextResponse.json(
            { success: false, error: 'Solo se pueden completar planes EN EJECUCIÓN' },
            { status: 400 }
          )
        }
        nuevosDatos = { estado: 'COMPLETADO', progreso: 100 }
        mensajeAudit = `Plan ${planExistente.codigo} completado`
        break

      case 'cancelar':
        nuevosDatos = { estado: 'CANCELADO' }
        mensajeAudit = `Plan ${planExistente.codigo} cancelado`
        break

      case 'actualizar_metricas':
        nuevosDatos = {
          montoAprobado: data.montoAprobado,
          cuotaActual: data.cuotaActual,
          pagosRealizados: data.pagosRealizados,
          saldoPendiente: data.saldoPendiente,
          progreso: data.progreso,
          notasSeguimiento: data.notasSeguimiento,
          prestamoVinculadoId: data.prestamoVinculadoId,
        }
        mensajeAudit = `Métricas del plan ${planExistente.codigo} actualizadas`
        break
    }

    // Limpiar undefined
    Object.keys(nuevosDatos).forEach(k => nuevosDatos[k] === undefined && delete nuevosDatos[k])

    const planActualizado = await db.planCliente.update({
      where: { id },
      data: nuevosDatos,
    })

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'PLAN_CLIENTE_ACTUALIZADO',
      modulo: 'planes-clientes',
      entidadId: id,
      entidadNombre: planExistente.codigo,
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
    const plan = await db.planCliente.findUnique({ where: { id } })
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

    await db.planCliente.delete({ where: { id } })

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'PLAN_CLIENTE_ELIMINADO',
      modulo: 'planes-clientes',
      entidadId: id,
      entidadNombre: plan.codigo,
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
