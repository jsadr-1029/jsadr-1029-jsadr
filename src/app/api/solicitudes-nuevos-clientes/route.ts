// =====================================================
// /api/solicitudes-nuevos-clientes — Solicitudes de nuevos clientes
// POST: crear solicitud (público, sin auth)
// GET: listar solicitudes (GESTOR+)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { rateLimit, getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { z } from 'zod'

const schema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  apellido: z.string().min(2, 'Apellido requerido'),
  tipoDocumento: z.enum(['CC', 'CE', 'TI']).default('CC'),
  cedula: z.string().min(5, 'Documento requerido'),
  fechaNacimiento: z.string().optional(),
  telefono: z.string().min(7, 'Teléfono requerido'),
  email: z.string().email().optional().or(z.literal('')),
  ciudad: z.string().optional(),
  municipio: z.string().optional(),
  direccion: z.string().optional(),
  ocupacion: z.string().optional(),
  ingresoMensual: z.union([z.number(), z.string()]).transform(v => Number(v)).optional(),
  valorSolicitado: z.union([z.number(), z.string()]).transform(v => Number(v)),
  plazoDeseado: z.union([z.number(), z.string()]).transform(v => Number(v)).optional(),
  destinoCredito: z.string().optional(),
  referidoPorNombre: z.string().optional(),
  referidoPorApellido: z.string().optional(),
  referidoPorTelefono: z.string().optional(),
  referidoPorParentesco: z.string().optional(),
  aceptaTyC: z.boolean(),
  aceptaTratamientoDatos: z.boolean(),
})

// === GET — Listar (GESTOR+) ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    
    const where: any = {}
    if (estado && estado !== 'all') where.estado = estado

    const solicitudes = await db.solicitudNuevoCliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const resumen = {
      total: solicitudes.length,
      pendientes: solicitudes.filter(s => s.estado === 'PENDIENTE').length,
      aprobadas: solicitudes.filter(s => s.estado === 'APROBADA').length,
      rechazadas: solicitudes.filter(s => s.estado === 'RECHAZADA').length,
      convertidas: solicitudes.filter(s => s.estado === 'CONVERTIDA').length,
    }

    return NextResponse.json({ success: true, data: solicitudes, resumen })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// === POST — Crear solicitud (PÚBLICO, sin auth) ===
export async function POST(req: NextRequest) {
  try {
    // Rate limit para evitar spam
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`solicitud-nuevo:${clientInfo.ip}`, 3) // 3 por minuto
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const validacion = schema.safeParse(body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', fieldErrors: validacion.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = validacion.data

    // Validar aceptaciones obligatorias
    if (!data.aceptaTyC || !data.aceptaTratamientoDatos) {
      return NextResponse.json(
        { success: false, error: 'Debes aceptar los Términos y Condiciones y la Política de Tratamiento de Datos' },
        { status: 400 }
      )
    }

    // Generar código único
    const codigo = `SNC-${Date.now().toString(36).toUpperCase()}`

    // Verificar que no exista ya una solicitud con la misma cédula pendiente
    const existente = await db.solicitudNuevoCliente.findFirst({
      where: { cedula: data.cedula, estado: 'PENDIENTE' },
    })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya tienes una solicitud pendiente. Nos pondremos en contacto pronto.' },
        { status: 400 }
      )
    }

    const solicitud = await db.solicitudNuevoCliente.create({
      data: {
        codigo,
        nombre: data.nombre,
        apellido: data.apellido,
        tipoDocumento: data.tipoDocumento,
        cedula: data.cedula,
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
        telefono: data.telefono,
        email: data.email || null,
        ciudad: data.ciudad || null,
        municipio: data.municipio || null,
        direccion: data.direccion || null,
        ocupacion: data.ocupacion || null,
        ingresoMensual: data.ingresoMensual || null,
        valorSolicitado: data.valorSolicitado,
        plazoDeseado: data.plazoDeseado || null,
        destinoCredito: data.destinoCredito || null,
        referidoPorNombre: data.referidoPorNombre || null,
        referidoPorApellido: data.referidoPorApellido || null,
        referidoPorTelefono: data.referidoPorTelefono || null,
        referidoPorParentesco: data.referidoPorParentesco || null,
        aceptaTyC: data.aceptaTyC,
        aceptaTratamientoDatos: data.aceptaTratamientoDatos,
        fechaAceptacion: new Date(),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      },
    })

    return NextResponse.json({
      success: true,
      data: solicitud,
      mensaje: `Solicitud ${codigo} creada. Nos pondremos en contacto contigo pronto.`,
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
