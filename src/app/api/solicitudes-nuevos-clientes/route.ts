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
  // === Datos personales — TODOS OBLIGATORIOS ===
  nombre: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)').max(80),
  apellido: z.string().min(2, 'El apellido es obligatorio (mínimo 2 caracteres)').max(80),
  tipoDocumento: z.enum(['CC', 'CE', 'TI']).default('CC'),
  cedula: z
    .string()
    .min(6, 'El número de documento es obligatorio (mínimo 6 dígitos)')
    .max(12, 'Máximo 12 dígitos')
    .regex(/^\d+$/, 'El documento solo puede contener números'),
  fechaNacimiento: z
    .string()
    .min(1, 'La fecha de nacimiento es obligatoria')
    .refine((val) => {
      const fecha = new Date(val + 'T12:00:00')
      if (isNaN(fecha.getTime())) return false
      const hoy = new Date()
      let edad = hoy.getFullYear() - fecha.getFullYear()
      const mes = hoy.getMonth() - fecha.getMonth()
      if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad--
      return edad >= 18 && edad <= 100
    }, 'Debes ser mayor de 18 años'),
  telefono: z
    .string()
    .min(7, 'El teléfono es obligatorio (mínimo 7 dígitos)')
    .max(13, 'Máximo 13 caracteres')
    .regex(/^\+?\d+$/, 'Teléfono solo puede contener números y el signo +'),
  email: z
    .string()
    .min(1, 'El correo electrónico es obligatorio')
    .email('Correo electrónico inválido'),
  // === Ubicación y ocupación — TODOS OBLIGATORIOS ===
  ciudad: z.string().min(3, 'La ciudad es obligatoria').max(80),
  municipio: z.string().min(2, 'El municipio o localidad es obligatorio').max(80),
  direccion: z.string().min(5, 'La dirección es obligatoria (mínimo 5 caracteres)').max(200),
  ocupacion: z.string().min(3, 'La ocupación es obligatoria').max(100),
  ingresoMensual: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, 'El ingreso mensual es obligatorio')
    .refine((v) => v >= 100000, 'El ingreso mensual mínimo es $100.000 COP'),
  // === Datos bancarios — TODOS OBLIGATORIOS ===
  banco: z.string().min(2, 'Selecciona tu banco').max(80),
  tipoCuenta: z.enum(['AHORROS', 'CORRIENTE'], { message: 'Selecciona un tipo de cuenta válido' }),
  numeroCuenta: z
    .string()
    .min(5, 'El número de cuenta es obligatorio (mínimo 5 dígitos)')
    .max(20, 'Máximo 20 dígitos')
    .regex(/^\d+$/, 'El número de cuenta solo puede contener números'),
  // === Crédito solicitado — opcional (no está en el formulario) ===
  valorSolicitado: z.union([z.number(), z.string()]).transform((v) => Number(v)).optional(),
  plazoDeseado: z.union([z.number(), z.string()]).transform((v) => Number(v)).optional(),
  destinoCredito: z.string().optional(),
  // === Referido — opcional ===
  referidoPorNombre: z.string().optional(),
  referidoPorApellido: z.string().optional(),
  referidoPorTelefono: z.string().optional(),
  referidoPorParentesco: z.string().optional(),
  // === TyC — TODOS OBLIGATORIOS (true literal, pero serializado como boolean para Prisma) ===
  aceptaTyC: z.boolean().refine((v) => v === true, 'Debes aceptar los Términos y Condiciones'),
  aceptaTratamientoDatos: z.boolean().refine((v) => v === true, 'Debes aceptar la Política de Tratamiento de Datos'),
  aceptaConsultaCentrales: z.boolean().refine((v) => v === true, 'Debes autorizar la consulta en centrales'),
  aceptaReportarCentral: z.boolean().refine((v) => v === true, 'Debes autorizar el reporte a centrales'),
  // === Fotos — TODAS OBLIGATORIAS ===
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
        motivoDevolucion: true,
        fechaDevolucion: true,
        vecesDevuelta: true,
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
      devueltas: solicitudes.filter(s => s.estado === 'DEVUELTA').length,
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

    // Verificar si existe una solicitud DEVUELTA para esta cédula
    // Si existe, actualizarla en lugar de crear una nueva (flujo de corrección)
    const solicitudDevuelta = await db.solicitudNuevoCliente.findFirst({
      where: { cedula: data.cedula, estado: 'DEVUELTA' },
      orderBy: { fechaDevolucion: 'desc' },
    })

    // Si hay una solicitud DEVUELTA, permitir re-envío como actualización
    if (solicitudDevuelta) {
      const actualizada = await db.solicitudNuevoCliente.update({
        where: { id: solicitudDevuelta.id },
        data: {
          // Mantener el código original para trazabilidad
          codigo: solicitudDevuelta.codigo,
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
          banco: data.banco,
          tipoCuenta: data.tipoCuenta,
          numeroCuenta: data.numeroCuenta,
          // Resetear campos del crédito (se manejan en el portal)
          valorSolicitado: null,
          plazoDeseado: null,
          destinoCredito: null,
          referidoPorNombre: data.referidoPorNombre || null,
          referidoPorApellido: data.referidoPorApellido || null,
          referidoPorTelefono: data.referidoPorTelefono || null,
          referidoPorParentesco: data.referidoPorParentesco || null,
          // Re-aceptar TyC
          aceptaTyC: data.aceptaTyC,
          aceptaTratamientoDatos: data.aceptaTratamientoDatos,
          aceptaConsultaCentrales: data.aceptaConsultaCentrales,
          aceptaReportarCentral: data.aceptaReportarCentral,
          fechaAceptacion: new Date(),
          // Actualizar fotos
          fotoCedulaFrente: data.fotoCedulaFrente,
          fotoCedulaReverso: data.fotoCedulaReverso,
          fotoSelfie: data.fotoSelfie,
          fotoCedulaFrenteNombre: data.fotoCedulaFrenteNombre || 'cedula-frente.jpg',
          fotoCedulaReversoNombre: data.fotoCedulaReversoNombre || 'cedula-reverso.jpg',
          fotoSelfieNombre: data.fotoSelfieNombre || 'selfie.jpg',
          // Resetear estado a PENDIENTE (elimina la devolución previa)
          estado: 'PENDIENTE',
          observaciones: null,
          motivoDevolucion: null,
          fechaDevolucion: null,
          // Mantener revisadoPor para histórico
          revisadoPorId: null,
          revisadoPorNombre: null,
          fechaRevision: null,
          // Trazabilidad del re-envío
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

      await registrarAuditLog({
        usuarioId: null,
        usuarioNombre: `Cliente: ${data.nombre} ${data.apellido}`,
        accion: 'SOLICITUD_CORREGIDA_REENVIADA',
        modulo: 'solicitudes-nuevos-clientes',
        entidadId: actualizada.id,
        entidadNombre: `${data.nombre} ${data.apellido} - ${actualizada.codigo}`,
        detalles: `Solicitud corregida y reenviada por el cliente. Vez devuelta previa: ${solicitudDevuelta.vecesDevuelta || 1}`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })

      return NextResponse.json({
        success: true,
        data: actualizada,
        mensaje: `Solicitud ${actualizada.codigo} corregida y reenviada. Nos pondremos en contacto contigo pronto.`,
      })
    }

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
