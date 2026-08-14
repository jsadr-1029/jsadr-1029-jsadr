// =====================================================
// /api/solicitudes-web — Buzón de Solicitudes Web v3.0
// Jsadr
// =====================================================
// GET     -> lista todas las solicitudes web (con filtros opcionales)
// POST    -> crea una solicitud desde el portal del cliente
//            (valida sesión + calcula tasa automáticamente)
// PATCH   -> cambia estado, agrega observaciones o marca convertida
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  Frecuencia,
  ResultadoCalculo,
} from '@/lib/finanzas'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import crypto from 'crypto'
import { getPortalClientInfo } from '@/lib/acceso-portal'
import { solicitudWebSchema, validateInput } from '@/lib/validators'
import { safeCompare } from '@/lib/security'
import { verificarOtp } from '@/lib/otp'

// === CONSTANTES ===
const TASA_GENERAL_DEFAULT = 24 // % anual si no hay configuración
const FRECUENCIAS_VALIDAS: Frecuencia[] = ['MENSUAL', 'QUINCENAL', 'SEMANAL', 'DIARIO']

const ESTADOS_VALIDOS = [
  'PENDIENTE',
  'EN_REVISION',
  'APROBADA',
  'RECHAZADA',
  'CONVERTIDA',
] as const

// === UTILIDADES ===

/**
 * Genera un código único para la solicitud: SOL-YYYYMMDD-HHMMSS-XXXX
 */
function generarCodigoSolicitud(): string {
  const now = new Date()
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0')
  const fecha = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const hora = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const random = crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 4)
  return `SOL-${fecha}-${hora}-${random}`
}

/**
 * Obtiene la tasa general desde Configuracion (default 24%).
 * Busca varias claves comunes para tolerancia.
 */
async function obtenerTasaGeneralConfig(): Promise<number> {
  const clavesPosibles = [
    'TASA_INTERES_GENERAL',
    'TASA_GENERAL',
    'TASA_DEFAULT',
    'TASA_INTERES_DEFAULT',
  ]
  for (const clave of clavesPosibles) {
    const cfg = await db.configuracion.findUnique({ where: { clave } })
    if (cfg) {
      const valor = parseFloat(cfg.valor)
      if (!isNaN(valor) && valor > 0) return valor
    }
  }
  return TASA_GENERAL_DEFAULT
}

/**
 * Calcula el plazo en meses a partir del número de cuotas y frecuencia.
 */
function plazoMesesDesdeCuotas(numeroCuotas: number, frecuencia: Frecuencia): number {
  switch (frecuencia) {
    case 'MENSUAL':
      return numeroCuotas
    case 'QUINCENAL':
      return Math.ceil(numeroCuotas / 2)
    case 'SEMANAL':
      return Math.ceil(numeroCuotas / 4.345)
    case 'DIARIO':
      return Math.ceil(numeroCuotas / 30)
    default:
      return numeroCuotas
  }
}

// =====================================================
// GET — Listar solicitudes web
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado') || undefined
    const busqueda = searchParams.get('q') || undefined

    const where: Record<string, unknown> = {}
    if (estado && estado !== 'all' && ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
      where.estado = estado
    }
    if (busqueda) {
      where.OR = [
        { codigo: { contains: busqueda } },
        { clienteNombre: { contains: busqueda } },
        { clienteCedula: { contains: busqueda } },
      ]
    }

    const solicitudes = await db.solicitudWeb.findMany({
      where,
      orderBy: { fechaCreacion: 'desc' },
    })

    return NextResponse.json({ success: true, data: solicitudes })
  } catch (error) {
    logError('/api/solicitudes-web GET', error)
    return errorResponse('/api/solicitudes-web GET', error)
  }
}

// =====================================================
// POST — Crear solicitud desde el portal del cliente
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Reforzado: validar con Zod antes de procesar
    const validacion = validateInput(solicitudWebSchema, body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: validacion.error, fieldErrors: validacion.fieldErrors },
        { status: 400 }
      )
    }

    const {
      clienteId,
      token,
      valorSolicitado,
      numeroCuotas,
      frecuencia,
      primerPagoFecha,
      codigoConfirmacion,
      flexibilidadFinanciera,
      flexibilidadModalidad,
      flexibilidadCosto,
      renovacionAnticipada,
      renovacionAnticipadaCosto,
    } = body || {}

    // === Persistir Flexibilidad Financiera (2 tarifas) ===
    const flexElegida = !!flexibilidadFinanciera
    const modalidadElegida = (flexibilidadModalidad || 'BASICA').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'BASICA'
    const flexCostoFinal = flexElegida
      ? (Number(flexibilidadCosto) > 0
          ? Number(flexibilidadCosto)
          : (modalidadElegida === 'PREMIUM' ? 34900 : 15000))
      : 0

    // === Persistir Renovación Anticipada (cobro único $9.900) ===
    // Beneficio opcional que el cliente puede activar en el simulador del portal.
    // Le da derecho a reserva anticipada de cupo, prioridad en procesamiento,
    // tasa preferencial mantenida y desembolso acelerado.
    // El cobro se hace UNA sola vez al inicio del crédito (al activarse tras
    // la aceptación de T&C) y se registra como INGRESO automático en la caja
    // CAJA-RENOVACIONES.
    const RENOVACION_ANTICIPADA_COSTO_DEFAULT = 9900
    const renovElegida = !!renovacionAnticipada
    const renovCostoFinal = renovElegida
      ? (Number(renovacionAnticipadaCosto) > 0
          ? Number(renovacionAnticipadaCosto)
          : RENOVACION_ANTICIPADA_COSTO_DEFAULT)
      : 0

    // Validar campos requeridos
    if (!clienteId || !token || !valorSolicitado || !numeroCuotas || !frecuencia) {
      return NextResponse.json(
        {
          success: false,
          error:
            'clienteId, token, valorSolicitado, numeroCuotas y frecuencia son obligatorios',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    // === Validar codigoConfirmacion (Clave Dinámica verificada) ===
    // El cliente debe haber solicitado y validado una clave dinámica
    // en el simulador antes de poder enviar la solicitud.
    if (!codigoConfirmacion) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Debes validar tu Clave Dinámica en el simulador antes de enviar la solicitud.',
          code: 'MISSING_CODIGO_CONFIRMACION',
        },
        { status: 400 }
      )
    }

    if (!FRECUENCIAS_VALIDAS.includes(frecuencia as Frecuencia)) {
      return NextResponse.json(
        {
          success: false,
          error: `Frecuencia inválida. Valores permitidos: ${FRECUENCIAS_VALIDAS.join(', ')}`,
          code: 'INVALID_FRECUENCIA',
        },
        { status: 400 }
      )
    }

    const valorNum = parseFloat(valorSolicitado)
    const cuotasNum = parseInt(numeroCuotas, 10)

    if (isNaN(valorNum) || valorNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'valorSolicitado debe ser un número mayor a 0', code: 'INVALID_VALOR' },
        { status: 400 }
      )
    }
    if (isNaN(cuotasNum) || cuotasNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'numeroCuotas debe ser un entero mayor a 0', code: 'INVALID_CUOTAS' },
        { status: 400 }
      )
    }

    // === Buscar cliente ===
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado', code: 'CLIENTE_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cliente inactivo. Contacte al administrador.', code: 'CLIENTE_INACTIVO' },
        { status: 403 }
      )
    }

    // === Validar sesión del portal ===
    // Reforzado: comparación constante-time para prevenir timing attacks
    const now = new Date()
    const tokenValido =
      !!cliente.tokenSesion &&
      !!token &&
      safeCompare(cliente.tokenSesion, token) &&
      !!cliente.tokenExpira &&
      cliente.tokenExpira > now

    if (!tokenValido) {
      const clientInfo = getPortalClientInfo(req)
      try {
        await db.auditLog.create({
          data: {
            usuarioId: null,
            usuarioNombre: `Portal: ${cliente.nombre}`,
            accion: 'CREATE',
            modulo: 'solicitudes-web',
            entidadId: cliente.id,
            entidadNombre: cliente.nombre,
            detalles: JSON.stringify({
              error: 'Token de sesión inválido o expirado',
              clienteId,
            }),
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            exito: false,
            errorMessage: 'Token inválido o expirado',
          },
        })
      } catch (e) {
        console.error('[solicitudes-web POST] Audit log error:', e)
      }

      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada. Inicie sesión nuevamente.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // === Verificar codigoConfirmacion (Clave Dinámica) ===
    // Busca el OtpRegistro de tipo SOLICITUD_SIMULADOR que tenga
    // sessionIdGenerado = hash(codigoConfirmacion) y que esté verificado,
    // no usado, no expirado, y que pertenezca al cliente.
    const clientInfoPre = getPortalClientInfo(req)
    const codigoConfirmacionHash = crypto
      .createHash('sha256')
      .update(String(codigoConfirmacion))
      .digest('hex')

    const otpReg = await db.otpRegistro.findFirst({
      where: {
        clienteId: cliente.id,
        tipo: 'SOLICITUD_SIMULADOR',
        verificado: true,
        usado: true,
        bloqueado: false,
        expiraEn: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    const codigoConfirmacionValido =
      !!otpReg &&
      !!otpReg.sessionIdGenerado &&
      safeCompare(otpReg.sessionIdGenerado, codigoConfirmacionHash)

    if (!codigoConfirmacionValido) {
      try {
        await db.auditLog.create({
          data: {
            usuarioId: null,
            usuarioNombre: `Portal: ${cliente.nombre}`,
            accion: 'CREATE',
            modulo: 'solicitudes-web',
            entidadId: cliente.id,
            entidadNombre: cliente.nombre,
            detalles: JSON.stringify({
              error: 'codigoConfirmacion inválido o expirado',
              clienteId,
            }),
            ipOrigen: clientInfoPre.ip,
            userAgent: clientInfoPre.userAgent,
            exito: false,
            errorMessage: 'Clave dinámica inválida o expirada',
          },
        })
      } catch (e) {
        console.error('[solicitudes-web POST] Audit log error:', e)
      }

      return NextResponse.json(
        {
          success: false,
          error:
            'Clave Dinámica inválida o expirada. Solicita y valida una nueva clave en el simulador.',
          code: 'INVALID_CODIGO_CONFIRMACION',
        },
        { status: 401 }
      )
    }

    // === Invalidar el codigoConfirmacion (un solo uso) ===
    // Al marcar usado=false y verificado=false, no podrá reutilizarse.
    await db.otpRegistro.update({
      where: { id: otpReg!.id },
      data: {
        usado: false,
        verificado: false,
        bloqueado: true,
        fechaBloqueo: new Date(),
      },
    })

    // === Determinar tasa y calcular préstamo ===
    let resultado: ResultadoCalculo
    let tasaUtilizada: number
    let tasaOrigen: string

    const fechaDesembolso = primerPagoFecha ? new Date(primerPagoFecha) : new Date()
    const frecuenciaTyped = frecuencia as Frecuencia

    if (cliente.tieneTasaPersonalizada && cliente.tasaPersonalizada != null) {
      // Tasa personalizada mensual fija sobre capital inicial
      tasaUtilizada = cliente.tasaPersonalizada
      tasaOrigen = 'PERSONALIZADA'
      resultado = calcularPrestamoTasaFijaMensual({
        montoPrincipal: valorNum,
        tasaMensualFija: cliente.tasaPersonalizada,
        numeroCuotas: cuotasNum,
        frecuencia: frecuenciaTyped,
        fechaDesembolso,
      })
    } else {
      // Tasa general de Configuracion
      const tasaAnual = await obtenerTasaGeneralConfig()
      const plazoMeses = plazoMesesDesdeCuotas(cuotasNum, frecuenciaTyped)
      tasaUtilizada = tasaAnual
      tasaOrigen = 'GENERAL'
      resultado = calcularPrestamo({
        montoPrincipal: valorNum,
        tasaInteresAnual: tasaAnual,
        tasaMoraAnual: tasaAnual, // no aplica en simulación
        plazoMeses,
        frecuencia: frecuenciaTyped,
        fechaDesembolso,
      })
    }

    // === Generar código único ===
    const codigo = generarCodigoSolicitud()

    // === Cliente info snapshot ===
    const clientInfo = getPortalClientInfo(req)

    // === Historial de estados inicial ===
    const historialEstados = JSON.stringify([
      {
        estado: 'PENDIENTE',
        fecha: now.toISOString(),
        observacion: 'Solicitud creada desde el portal del cliente',
      },
    ])

    // === Crear solicitud ===
    const solicitud = await db.solicitudWeb.create({
      data: {
        codigo,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteCedula: cliente.cedula,
        clienteTelefono: cliente.telefono,
        clienteEmail: cliente.email,
        valorSolicitado: valorNum,
        numeroCuotas: cuotasNum,
        frecuencia: frecuenciaTyped,
        tasaUtilizada,
        tasaOrigen,
        cuotaEstimada: resultado.montoCuota,
        totalIntereses: resultado.totalInteres,
        totalPagar: resultado.totalPagar,
        primerPagoFecha: primerPagoFecha ? new Date(primerPagoFecha) : null,
        tablaAmortizacion: JSON.stringify(resultado.tablaAmortizacion),
        ipOrigen: clientInfo.ip,
        navegador: clientInfo.userAgent,
        canalOrigen: 'PORTAL_CLIENTE',
        estado: 'PENDIENTE',
        estadoFlujoFirma: 'PENDIENTE',
        // === Flexibilidad Financiera (2 tarifas) persistida en la solicitud ===
        flexibilidadFinanciera: flexElegida,
        flexibilidadModalidad: flexElegida ? modalidadElegida : null,
        flexibilidadCosto: flexCostoFinal,
        // === Renovación Anticipada (cobro único $9.900) persistida en la solicitud ===
        renovacionAnticipada: renovElegida,
        renovacionAnticipadaCosto: renovCostoFinal,
        historialEstados,
      },
    })

    // === Auditoría ===
    try {
      await db.auditLog.create({
        data: {
          usuarioId: null,
          usuarioNombre: `Portal: ${cliente.nombre}`,
          accion: 'CREATE',
          modulo: 'solicitudes-web',
          entidadId: solicitud.id,
          entidadNombre: codigo,
          detalles: JSON.stringify({
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            valorSolicitado: valorNum,
            numeroCuotas: cuotasNum,
            frecuencia: frecuenciaTyped,
            tasaUtilizada,
            tasaOrigen,
            cuotaEstimada: resultado.montoCuota,
            totalPagar: resultado.totalPagar,
            flexibilidadFinanciera: flexElegida,
            flexibilidadCosto: flexCostoFinal,
            renovacionAnticipada: renovElegida,
            renovacionAnticipadaCosto: renovCostoFinal,
            ipOrigen: clientInfo.ip,
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        },
      })
    } catch (e) {
      console.error('[solicitudes-web POST] Audit log error:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...solicitud,
        tablaAmortizacionParseada: resultado.tablaAmortizacion,
      },
      message: 'Solicitud creada exitosamente',
    }, { status: 201 })
  } catch (error) {
    logError('/api/solicitudes-web POST', error)
    return errorResponse('/api/solicitudes-web POST', error)
  }
}

// =====================================================
// PATCH — Cambiar estado, agregar observaciones o marcar convertida
// =====================================================
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { id, accion, estado, observaciones, prestamoCreadoId, revisadoPor } = body || {}

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es obligatorio', code: 'MISSING_ID' },
        { status: 400 }
      )
    }

    if (!accion) {
      return NextResponse.json(
        { success: false, error: 'accion es obligatoria', code: 'MISSING_ACCION' },
        { status: 400 }
      )
    }

    const solicitudActual = await db.solicitudWeb.findUnique({ where: { id } })
    if (!solicitudActual) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Parsear historial actual
    let historial: Array<{
      estado: string
      fecha: string
      observacion?: string
      usuario?: string
    }> = []
    try {
      if (solicitudActual.historialEstados) {
        historial = JSON.parse(solicitudActual.historialEstados)
      }
    } catch {
      historial = []
    }

    const now = new Date()
    const dataUpdate: Record<string, unknown> = {
      fechaRevision: now,
      revisadoPor: revisadoPor || auth.nombre || 'Sistema',
    }

    switch (accion) {
      case 'cambiar_estado': {
        if (!estado || !ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
          return NextResponse.json(
            {
              success: false,
              error: `estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
              code: 'INVALID_ESTADO',
            },
            { status: 400 }
          )
        }
        dataUpdate.estado = estado
        // === Sincronizar estadoFlujoFirma con el estado de la solicitud ===
        // Cuando el admin aprueba la solicitud (APROBADA) o la convierte, el cliente
        // debe ver el flujo de firma (cargue de fotos + firma manuscrita + OTP) en el portal.
        if (estado === 'APROBADA' || estado === 'CONVERTIDA') {
          dataUpdate.estadoFlujoFirma = 'EN_FIRMA_CLIENTE'
        } else if (estado === 'RECHAZADA') {
          dataUpdate.estadoFlujoFirma = 'PENDIENTE'
        }
        historial.push({
          estado,
          fecha: now.toISOString(),
          usuario: revisadoPor || auth.nombre,
          observacion: `Estado cambiado a ${estado}`,
        })
        break
      }

      case 'agregar_observaciones': {
        if (!observaciones) {
          return NextResponse.json(
            { success: false, error: 'observaciones es requerido', code: 'MISSING_OBSERV' },
            { status: 400 }
          )
        }
        const obsPrevias = solicitudActual.observaciones
          ? `${solicitudActual.observaciones}\n---\n`
          : ''
        dataUpdate.observaciones = `${obsPrevias}[${now.toISOString()} - ${
          revisadoPor || auth.nombre
        }]: ${observaciones}`
        historial.push({
          estado: solicitudActual.estado,
          fecha: now.toISOString(),
          usuario: revisadoPor || auth.nombre,
          observacion: observaciones,
        })
        break
      }

      case 'rechazar': {
        dataUpdate.estado = 'RECHAZADA'
        if (observaciones) {
          const obsPrevias = solicitudActual.observaciones
            ? `${solicitudActual.observaciones}\n---\n`
            : ''
          dataUpdate.observaciones = `${obsPrevias}[${now.toISOString()} - ${
            revisadoPor || auth.nombre
          }]: ${observaciones}`
        }
        historial.push({
          estado: 'RECHAZADA',
          fecha: now.toISOString(),
          usuario: revisadoPor || auth.nombre,
          observacion: observaciones || 'Solicitud rechazada',
        })
        break
      }

      case 'marcar_convertida': {
        if (!prestamoCreadoId) {
          return NextResponse.json(
            {
              success: false,
              error: 'prestamoCreadoId es requerido para marcar convertida',
              code: 'MISSING_PRESTAMO',
            },
            { status: 400 }
          )
        }
        dataUpdate.estado = 'CONVERTIDA'
        dataUpdate.prestamoCreadoId = prestamoCreadoId
        dataUpdate.fechaConversion = now
        // === Activar flujo de firma del lado del cliente ===
        // El cliente verá en el portal el flujo: cargue de fotos + firma manuscrita + OTP
        dataUpdate.estadoFlujoFirma = 'EN_FIRMA_CLIENTE'
        historial.push({
          estado: 'CONVERTIDA',
          fecha: now.toISOString(),
          usuario: revisadoPor || auth.nombre,
          observacion: `Convertida en préstamo ${prestamoCreadoId}. Flujo de firma activado para el cliente.`,
        })
        break
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `accion inválida. Acciones permitidas: cambiar_estado, agregar_observaciones, rechazar, marcar_convertida`,
            code: 'INVALID_ACCION',
          },
          { status: 400 }
        )
    }

    dataUpdate.historialEstados = JSON.stringify(historial)

    const solicitudActualizada = await db.solicitudWeb.update({
      where: { id },
      data: dataUpdate as never,
    })

    // === Auditoría ===
    try {
      await db.auditLog.create({
        data: {
          usuarioId: auth.id === 'system' ? null : auth.id,
          usuarioNombre: auth.nombre,
          accion: 'UPDATE',
          modulo: 'solicitudes-web',
          entidadId: solicitudActual.id,
          entidadNombre: solicitudActual.codigo,
          detalles: JSON.stringify({
            accion,
            estadoAnterior: solicitudActual.estado,
            estadoNuevo: dataUpdate.estado || solicitudActual.estado,
            observaciones: observaciones || null,
            prestamoCreadoId: prestamoCreadoId || null,
          }),
          exito: true,
        },
      })
    } catch (e) {
      console.error('[solicitudes-web PATCH] Audit log error:', e)
    }

    return NextResponse.json({
      success: true,
      data: solicitudActualizada,
      message: 'Solicitud actualizada correctamente',
    })
  } catch (error) {
    logError('/api/solicitudes-web PATCH', error)
    return errorResponse('/api/solicitudes-web PATCH', error)
  }
}
