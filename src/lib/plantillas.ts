// =====================================================
// Plantillas — Helper central para renderizar y enviar
// mensajes (Email/WhatsApp) usando plantillas editables
// desde el módulo Administración.
// =====================================================
//
// Una plantilla es un registro en la tabla Plantilla con:
//   - codigo: identificador único (ej: SOLICITUD_PRESTAMO)
//   - tipo:   EMAIL | WHATSAPP
//   - asunto: asunto del correo (solo EMAIL)
//   - contenido: texto con marcadores {{variable}}
//   - contenidoHtml: HTML opcional (solo EMAIL)
//   - variables: JSON array de variables disponibles
//
// Al enviar un mensaje, se busca la plantilla por codigo+tipo.
// Si no existe o está inactiva, se usa un fallback hardcodeado
// (para garantizar que el mensaje salga aunque la BD esté vacía).
//
// Las variables se reemplazan con la sintaxis {{variable}}.
// =====================================================

import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { formatCOP, formatDate } from './format'
import { formatearMoneda, formatearFecha } from './finanzas'

// === Cache en memoria (TTL 60s) ===
// Para no leer la BD en cada envío, cachear las plantillas activas.
interface PlantillaCache {
  data: any
  expiresAt: number
}
let cachePlantillas: Map<string, PlantillaCache> = new Map()
const CACHE_TTL_MS = 60 * 1000 // 1 minuto

// === Variables disponibles globalmente ===
// Cualquier plantilla puede usar estas variables. Si el valor es
// undefined o null al renderizar, se reemplaza por '' (vacío).
export const VARIABLES_GLOBALES = [
  'clienteNombre',
  'clienteCedula',
  'clienteEmail',
  'clienteTelefono',
  'prestamoCodigo',
  'monto',
  'montoCuota',
  'montoSolicitado',
  'saldoPendiente',
  'numeroCuota',
  'totalCuotas',
  'diasMora',
  'diasRestantes',
  'fechaVencimiento',
  'fechaSolicitud',
  'fechaAprobacion',
  'fechaDesembolso',
  'fechaPago',
  'tasaInteres',
  'tasaInteresAnual',
  'plazoMeses',
  'frecuencia',
  'codigo',
  'otp',
  'enlacePortal',
  'banco',
  'cuenta',
  'numeroCuenta',
  'tipoCuenta',
  'categoria',
  'estadoPrestamo',
  'empresa',
  'anioActual',
  'fechaHoy',
] as const

// === Tipo del contexto de variables ===
export type PlantillaVars = Record<string, string | number | Date | null | undefined>

// === Renderiza un contenido reemplazando {{variables}} ===
export function renderizarPlantilla(contenido: string, vars: PlantillaVars): string {
  if (!contenido) return ''
  let result = contenido

  // Reemplazar cada variable
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    let replacement = ''
    if (value === null || value === undefined) {
      replacement = ''
    } else if (value instanceof Date) {
      replacement = formatDate(value)
    } else if (typeof value === 'number') {
      // Si parece monto (grande), formatear como COP
      if (key.toLowerCase().includes('monto') || key.toLowerCase().includes('saldo') || key.toLowerCase().includes('cuota')) {
        replacement = formatCOP(value)
      } else {
        replacement = String(value)
      }
    } else {
      replacement = String(value)
    }
    result = result.replace(regex, replacement)
  }

  // Limpiar variables no usadas (que se quedaron como {{algo}})
  result = result.replace(/\{\{[^}]+\}\}/g, '')

  return result
}

// === Obtiene una plantilla de la BD (con cache) ===
export async function obtenerPlantilla(codigo: string, tipo: 'EMAIL' | 'WHATSAPP'): Promise<any | null> {
  const cacheKey = `${tipo}:${codigo}`
  const cached = cachePlantillas.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const plantilla = await db.plantilla.findFirst({
      where: { codigo, tipo, activa: true },
    })
    if (plantilla) {
      cachePlantillas.set(cacheKey, { data: plantilla, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return plantilla
  } catch (e) {
    console.error(`[plantillas] Error al obtener plantilla ${codigo}/${tipo}:`, e)
    return null
  }
}

// === Invalida el cache (llamar al editar/crear/eliminar plantillas) ===
export function invalidarCachePlantillas(): void {
  cachePlantillas.clear()
}

// === Obtiene todas las variables disponibles para una plantilla ===
export function obtenerVariablesPlantilla(plantilla: any): string[] {
  if (!plantilla?.variables) return []
  try {
    return JSON.parse(plantilla.variables)
  } catch {
    return []
  }
}

// === Envía un email usando una plantilla ===
export async function enviarEmailPlantilla(
  codigo: string,
  to: string,
  vars: PlantillaVars
): Promise<{ success: boolean; error?: string; messageId?: string; usadaPlantilla?: boolean }> {
  const plantilla = await obtenerPlantilla(codigo, 'EMAIL')

  if (!plantilla) {
    return { success: false, error: `Plantilla no encontrada: ${codigo}`, usadaPlantilla: false }
  }

  const asunto = renderizarPlantilla(plantilla.asunto || '', vars)
  const text = renderizarPlantilla(plantilla.contenido, vars)
  const html = plantilla.contenidoHtml ? renderizarPlantilla(plantilla.contenidoHtml, vars) : undefined

  const result = await enviarEmail({ to, subject: asunto, text, html })
  return { ...result, usadaPlantilla: true }
}

// === Envía un WhatsApp usando una plantilla ===
export async function enviarWhatsappPlantilla(
  codigo: string,
  telefono: string,
  vars: PlantillaVars,
  opts?: { prestamoId?: string; guardarLog?: boolean }
): Promise<{ success: boolean; error?: string; usadaPlantilla?: boolean }> {
  const plantilla = await obtenerPlantilla(codigo, 'WHATSAPP')

  if (!plantilla) {
    return { success: false, error: `Plantilla no encontrada: ${codigo}`, usadaPlantilla: false }
  }

  const mensaje = renderizarPlantilla(plantilla.contenido, vars)
  const envio = await enviarWhatsApp(telefono, mensaje)

  if (opts?.guardarLog && opts?.prestamoId) {
    try {
      await guardarNotificacion({
        db,
        prestamoId: opts.prestamoId,
        telefono,
        tipo: codigo,
        mensaje,
        envio,
      })
    } catch (e) {
      console.error('[plantillas] Error guardando log de WhatsApp:', e)
    }
  }

  return { success: envio.exito, error: envio.error, usadaPlantilla: true }
}

// === Helper para construir variables comunes desde un solicitud + cliente ===
export function construirVarsPrestamo(prestamo: any, cliente: any, extra: PlantillaVars = {}): PlantillaVars {
  return {
    clienteNombre: cliente?.nombre || '',
    clienteCedula: cliente?.cedula || '',
    clienteEmail: cliente?.email || '',
    clienteTelefono: cliente?.telefono || '',
    prestamoCodigo: prestamo?.codigo || '',
    codigo: prestamo?.codigo || '',
    monto: prestamo?.montoPrincipal || 0,
    montoSolicitado: prestamo?.montoPrincipal || 0,
    montoCuota: prestamo?.montoCuota || 0,
    tasaInteres: prestamo?.tasaInteresMensual || 0,
    tasaInteresAnual: prestamo?.tasaInteresAnual || 0,
    plazoMeses: prestamo?.plazoMeses || 0,
    frecuencia: prestamo?.frecuencia || '',
    estadoPrestamo: prestamo?.estado || '',
    fechaSolicitud: prestamo?.fechaSolicitud || '',
    fechaAprobacion: prestamo?.fechaAprobacion || '',
    fechaDesembolso: prestamo?.fechaDesembolso || '',
    fechaVencimiento: prestamo?.fechaVencimiento || '',
    empresa: 'JSADR',
    anioActual: new Date().getFullYear(),
    fechaHoy: new Date(),
    enlacePortal: process.env.NEXT_PUBLIC_APP_URL || 'https://jsadr.com.co',
    ...extra,
  }
}

// === Helper para construir variables desde un pago ===
export function construirVarsPago(pago: any, prestamo: any, cliente: any, extra: PlantillaVars = {}): PlantillaVars {
  return construirVarsPrestamo(prestamo, cliente, {
    montoCuota: pago?.montoTotal || 0,
    numeroCuota: pago?.numeroCuota || 0,
    totalCuotas: prestamo?.numeroCuotas || 0,
    monto: pago?.montoTotal || 0,
    fechaVencimiento: pago?.fechaVencimiento || '',
    fechaPago: pago?.fechaPago || '',
    saldoPendiente: pago?.saldoPendiente || 0,
    ...extra,
  })
}
