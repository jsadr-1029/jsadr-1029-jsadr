// =====================================================
// /api/planes-financieros — Plan Estratégico Financiero
// CRUD para planes de contabilidad con propósito financiero
// Seguridad: requireRole + Zod + rate limit + sanitizeError
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { rateLimit, getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { z } from 'zod'

// === SCHEMA ZOD ===
const planFinancieroSchema = z.object({
  nombre: z.string().min(3, 'Nombre muy corto').max(200),
  descripcion: z.string().max(2000).optional(),
  tipo: z.enum(['CRECIMIENTO', 'OPTIMIZACION', 'REDUCCION_RIESGO', 'LIQUIDEZ', 'EXPANSION']).default('CRECIMIENTO'),
  prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
  fechaInicio: z.string().refine((v) => !isNaN(Date.parse(v)), 'Fecha inválida'),
  fechaFin: z.string().refine((v) => !isNaN(Date.parse(v)), 'Fecha inválida'),
  // Reforzado: aceptar string o number y convertir a number
  presupuestoInversion: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, 'Debe ser número >= 0').default(0),
  metaIngresos: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, 'Debe ser número >= 0').default(0),
  metaAhorroCostos: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, 'Debe ser número >= 0').default(0),
  roiEsperado: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= -100 && v <= 10000, 'ROI inválido').default(0),
  responsableNombre: z.string().max(200).optional(),
  indicadores: z.string().max(5000).optional(),
})

// === GET — Listar planes (CONSULTOR+) ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const tipo = searchParams.get('tipo')

    const where: any = {}
    if (estado && estado !== 'all') where.estado = estado
    if (tipo && tipo !== 'all') where.tipo = tipo

    const planes = await db.planEstrategicoFinanciero.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // Calcular resumen
    const resumen = {
      total: planes.length,
      activos: planes.filter(p => p.estado === 'ACTIVO').length,
      borradores: planes.filter(p => p.estado === 'BORRADOR').length,
      completados: planes.filter(p => p.estado === 'COMPLETADO').length,
      inversionTotal: planes.reduce((s, p) => s + p.presupuestoInversion, 0),
      ingresosMeta: planes.reduce((s, p) => s + p.metaIngresos, 0),
      ingresosReales: planes.reduce((s, p) => s + p.ingresoReal, 0),
      roiPromedio: planes.length > 0 ? planes.reduce((s, p) => s + p.roiReal, 0) / planes.length : 0,
    }

    return NextResponse.json({ success: true, data: planes, resumen })
  } catch (error) {
    console.error('[planes-financieros GET]', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// === POST — Crear plan (GESTOR+) ===
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    // Rate limit
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`planes-financieros:${clientInfo.ip}`, 20)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validar con Zod
    const validacion = planFinancieroSchema.safeParse(body)
    if (!validacion.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          fieldErrors: validacion.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = validacion.data

    // Validar fechas
    if (new Date(data.fechaFin) <= new Date(data.fechaInicio)) {
      return NextResponse.json(
        { success: false, error: 'La fecha fin debe ser posterior a la fecha inicio' },
        { status: 400 }
      )
    }

    // Generar código único
    const codigo = `PEF-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`

    const plan = await db.planEstrategicoFinanciero.create({
      data: {
        codigo,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo: data.tipo,
        estado: 'BORRADOR',
        prioridad: data.prioridad,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: new Date(data.fechaFin),
        presupuestoInversion: data.presupuestoInversion,
        metaIngresos: data.metaIngresos,
        metaAhorroCostos: data.metaAhorroCostos,
        roiEsperado: data.roiEsperado,
        responsableNombre: data.responsableNombre || null,
        indicadores: data.indicadores || null,
        creadoPor: auth.id,
      },
    })

    // Audit log
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'PLAN_FINANCIERO_CREADO',
      modulo: 'planes-financieros',
      entidadId: plan.id,
      entidadNombre: plan.nombre,
      detalles: `Plan ${plan.codigo} creado con tipo ${plan.tipo}`,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, data: plan, mensaje: `Plan ${plan.codigo} creado` })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
