// =====================================================
// /api/planes-clientes — Plan Cliente (Préstamos)
// CRUD para planes personalizados de clientes
// Seguridad: requireRole + Zod + rate limit + sanitizeError
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { rateLimit, getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { z } from 'zod'

// === SCHEMA ZOD ===
const planClienteSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido'),
  nombre: z.string().min(3, 'Nombre muy corto').max(200),
  descripcion: z.string().max(2000).optional(),
  tipo: z.enum(['PERSONALIZADO', 'REESTRUCTURACION', 'REFINANCIACION', 'EXPANSION_CREDITO', 'FIDELIZACION']).default('PERSONALIZADO'),
  fechaInicio: z.string().refine((v) => !isNaN(Date.parse(v)), 'Fecha inválida'),
  fechaFin: z.string().refine((v) => !isNaN(Date.parse(v)), 'Fecha inválida'),
  // Reforzado: aceptar string o number y convertir a number
  montoObjetivo: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, 'Monto inválido').default(0),
  tasaPersonalizada: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0 && v <= 100, 'Tasa inválida').optional(),
  plazoMeses: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 1 && v <= 120, 'Plazo inválido').default(12),
  cuotaObjetivo: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, 'Cuota inválida').default(0),
  objetivoComercial: z.string().max(1000).optional(),
  metricasExito: z.string().max(5000).optional(),
  gestorAsignado: z.string().max(200).optional(),
})

// === GET — Listar planes (CONSULTOR+) ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const tipo = searchParams.get('tipo')
    const clienteId = searchParams.get('clienteId')

    const where: any = {}
    if (estado && estado !== 'all') where.estado = estado
    if (tipo && tipo !== 'all') where.tipo = tipo
    if (clienteId) where.clienteId = clienteId

    const planes = await db.planCliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // Calcular resumen
    const resumen = {
      total: planes.length,
      aceptados: planes.filter(p => p.estado === 'ACEPTADO').length,
      enEjecucion: planes.filter(p => p.estado === 'EN_EJECUCION').length,
      completados: planes.filter(p => p.estado === 'COMPLETADO').length,
      montoObjetivoTotal: planes.reduce((s, p) => s + p.montoObjetivo, 0),
      montoAprobadoTotal: planes.reduce((s, p) => s + p.montoAprobado, 0),
      progresoPromedio: planes.length > 0 ? planes.reduce((s, p) => s + p.progreso, 0) / planes.length : 0,
    }

    return NextResponse.json({ success: true, data: planes, resumen })
  } catch (error) {
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
    const rl = rateLimit(`planes-clientes:${clientInfo.ip}`, 20)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validar con Zod
    const validacion = planClienteSchema.safeParse(body)
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

    // Validar que el cliente existe
    const cliente = await db.cliente.findUnique({
      where: { id: data.clienteId },
      select: { id: true, nombre: true, cedula: true },
    })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Generar código único
    const codigo = `PLC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`

    const plan = await db.planCliente.create({
      data: {
        codigo,
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo: data.tipo,
        estado: 'BORRADOR',
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: new Date(data.fechaFin),
        montoObjetivo: data.montoObjetivo,
        tasaPersonalizada: data.tasaPersonalizada || null,
        plazoMeses: data.plazoMeses,
        cuotaObjetivo: data.cuotaObjetivo,
        objetivoComercial: data.objetivoComercial || null,
        metricasExito: data.metricasExito || null,
        gestorAsignado: data.gestorAsignado || null,
        creadoPor: auth.id,
      },
    })

    // Audit log
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'PLAN_CLIENTE_CREADO',
      modulo: 'planes-clientes',
      entidadId: plan.id,
      entidadNombre: `${plan.codigo} - ${cliente.nombre}`,
      detalles: `Plan ${plan.codigo} creado para cliente ${cliente.cedula} con tipo ${plan.tipo}`,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, data: plan, mensaje: `Plan ${plan.codigo} creado para ${cliente.nombre}` })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
