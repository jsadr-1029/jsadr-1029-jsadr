// =====================================================
// /api/solicitudes-nuevos-clientes — Solicitudes de nuevos clientes
// POST: crear solicitud (público, sin auth) — incluye fotos cédula + selfie
// GET: listar solicitudes (GESTOR+)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { rateLimit, getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { z } from 'zod'

// Validador para imágenes base64 (data URL)
const fotoSchema = z
  .string()
  .min(50, 'Foto demasiado pequeña')
  .max(7_000_000, 'Foto demasiado grande (máx ~5MB)')
  .refine(
    (v) => v.startsWith('data:image/jpeg') || v.startsWith('data:image/png') || v.startsWith('data:image/webp'),
    'Formato no válido. Solo JPG, PNG o WEBP.'
  )

const schema = z.object({
  nombre: z.string().min(2, 'Nombre requerido').max(80),
  apellido: z.string().min(2, 'Apellido requerido').max(80),
  tipoDocumento: z.enum(['CC', 'CE', 'TI']).default('CC'),
  cedula: z.string().min(5, 'Documento requerido').max(20),
  fechaNacimiento: z.string().optional(),
  telefono: z.string().min(7, 'Teléfono requerido').max(20),
  email: z.string().email().optional().or(z.literal('')),
  ciudad: z.string().optional(),
  municipio: z.string().optional(),
  direccion: z.string().optional(),
  ocupacion: z.string().optional(),
  ingresoMensual: z.union([z.number(), z.string()]).transform(v => Number(v)).optional(),
  // Campos bancarios OBLIGATORIOS (nuevos)
  banco: z.string().min(2, 'Banco requerido').max(80),
  tipoCuenta: z.enum(['AHORROS', 'CORRIENTE'], { message: 'Selecciona un tipo de cuenta válido' }),
  numeroCuenta: z.string().min(5, 'Número de cuenta requerido').max(30),
  // Crédito solicitado — eliminado del formulario, queda opcional en DB
  valorSolicitado: z.union([z.number(), z.string()]).transform(v => Number(v)).optional(),
  plazoDeseado: z.union([z.number(), z.string()]).transform(v => Number(v)).optional(),
  destinoCredito: z.string().optional(),
  referidoPorNombre: z.string().optional(),
  referidoPorApellido: z.string().optional(),
  referidoPorTelefono: z.string().optional(),
  referidoPorParentesco: z.string().optional(),
  aceptaTyC: z.boolean(),
  aceptaTratamientoDatos: z.boolean(),
  aceptaConsultaCentrales: z.boolean().default(false),
  aceptaReportarCentral: z.boolean().default(false),
  // Fotos obligatorias
  fotoCedulaFrente: fotoSchema,
  fotoCedulaReverso: fotoSchema,
  fotoSelfie: fotoSchema,
  fotoCedulaFrenteNombre: z.string().optional(),
  fotoCedulaReversoNombre: z.string().optional(),
  fotoSelfieNombre: z.string().optional(),
})

// === GET — Listar (GESTOR+) — SIN fotos en respuesta para no saturar ===
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
      select: {
        id: true,
        codigo: true,
        nombre: true,
        apellido: true,
        tipoDocumento: true,
        cedula: true,
        telefono: true,
        email: true,
        ciudad: true,
        municipio: true,
        ocupacion: true,
        ingresoMensual: true,
        banco: true,
        tipoCuenta: true,
        numeroCuenta: true,
        estado: true,
        observaciones: true,
        createdAt: true,
        fechaRevision: true,
        revisadoPorNombre: true,
        clienteCreadoId: true,
        clienteCreadoCodigo: true,
        // NO incluir fotoCedulaFrente/Reverso/Selfie (pesan ~5MB c/u)
      },
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

    // Aumentar límite de body para fotos base64 (hasta ~25MB)
    const rawBody = await req.text()
    if (rawBody.length > 25_000_000) {
      return NextResponse.json(
        { success: false, error: 'Payload demasiado grande (máx 25MB)' },
        { status: 413 }
      )
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON inválido' },
        { status: 400 }
      )
    }

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

    // Verificar que no exista ya una solicitud pendiente con esa cédula
    const existente = await db.solicitudNuevoCliente.findFirst({
      where: { cedula: data.cedula, estado: 'PENDIENTE' },
    })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya tienes una solicitud pendiente. Nos pondremos en contacto pronto.' },
        { status: 400 }
      )
    }

    // Verificar que la cédula no esté ya en Cliente (no permitir duplicados)
    const clienteExistente = await db.cliente.findFirst({
      where: { cedula: data.cedula },
      select: { id: true, nombre: true },
    })
    if (clienteExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya estás registrado como cliente. Inicia sesión en el portal.' },
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
        // Datos bancarios obligatorios
        banco: data.banco,
        tipoCuenta: data.tipoCuenta,
        numeroCuenta: data.numeroCuenta,
        // Crédito solicitado — campos en null (se maneja desde el portal del cliente)
        valorSolicitado: null,
        plazoDeseado: null,
        destinoCredito: null,
        referidoPorNombre: data.referidoPorNombre || null,
        referidoPorApellido: data.referidoPorApellido || null,
        referidoPorTelefono: data.referidoPorTelefono || null,
        referidoPorParentesco: data.referidoPorParentesco || null,
        aceptaTyC: data.aceptaTyC,
        aceptaTratamientoDatos: data.aceptaTratamientoDatos,
        aceptaConsultaCentrales: data.aceptaConsultaCentrales,
        aceptaReportarCentral: data.aceptaReportarCentral,
        fechaAceptacion: new Date(),
        // Fotos
        fotoCedulaFrente: data.fotoCedulaFrente,
        fotoCedulaReverso: data.fotoCedulaReverso,
        fotoSelfie: data.fotoSelfie,
        fotoCedulaFrenteNombre: data.fotoCedulaFrenteNombre || 'cedula-frente.jpg',
        fotoCedulaReversoNombre: data.fotoCedulaReversoNombre || 'cedula-reverso.jpg',
        fotoSelfieNombre: data.fotoSelfieNombre || 'selfie.jpg',
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        apellido: true,
        cedula: true,
        estado: true,
        createdAt: true,
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
