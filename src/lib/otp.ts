// =====================================================
// OTP — HELPERS CENTRALIZADOS
// =====================================================
// Resuelve:
//  1. Unifica las 3 funciones generarOTP dispersas (finanzas.ts,
//     format.ts, chat/otp inline) en una sola con parámetro tipo.
//  2. Hashea SIEMPRE el OTP con SHA-256 antes de guardarlo en BD
//     (FirmaElectronica.otpCodigo, CodigoConfirmacion.codigo, OtpRegistro).
//  3. Centraliza la escritura en OtpRegistro (trazabilidad única).
//  4. Comparación constant-time al validar.
// =====================================================

import crypto from 'crypto'
import { db } from './db'

// --- Tipos ---
export type OtpTipo = 'numeric' | 'alphanumeric'
export type OtpCanal = 'WHATSAPP' | 'EMAIL' | 'AMBOS' | 'SMS' | 'TOTP'
export type OtpFlujo =
  | 'FIRMA_ELECTRONICA'
  | 'FIRMA_PORTAL'
  | 'CHAT'
  | 'PORTAL_LOGIN'
  | 'CAMBIO_CLAVE'
  | 'MFA_ADMIN'
  | 'SOLICITUD_SIMULADOR'
  | 'OTRO'

// --- Alfabeto sin caracteres confusos (sin 0/O/1/I/L) ---
const ALPHA_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// --- Generación unificada ---
export function generarCodigoOtp(tipo: OtpTipo = 'numeric', length = 6): string {
  if (length < 4 || length > 10) {
    throw new Error('Longitud OTP inválida (debe ser 4-10)')
  }
  if (tipo === 'numeric') {
    // crypto.randomInt es CSPRNG; rango [0, 10^length)
    const max = Math.pow(10, length)
    const n = crypto.randomInt(0, max)
    return n.toString().padStart(length, '0')
  }
  // alfanumérico sin caracteres confusos
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHA_ALPHABET[bytes[i] % ALPHA_ALPHABET.length]
  }
  return out
}

// --- Hashing SHA-256 (no reversible) ---
// Usamos SHA-256 (no bcrypt) porque el OTP tiene vida corta (5-30 min)
// y SHA-256 es suficiente. bcrypt sería overkill aquí.
export function hashOtp(codigo: string): string {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

// --- Comparación constant-time ---
// Primero hashea el input y luego compara con timingSafeEqual
export function verificarOtp(codigoIngresado: string, codigoHash: string): boolean {
  if (!codigoIngresado || !codigoHash) return false
  const inputHash = hashOtp(codigoIngresado.trim().toUpperCase())
  const a = Buffer.from(inputHash, 'hex')
  const b = Buffer.from(codigoHash, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// --- Registro centralizado en OtpRegistro ---
// Llamar desde cualquier endpoint que genere un OTP.
// Esto activa el modelo OtpRegistro que antes estaba muerto.
export interface RegistroOtpParams {
  clienteId?: string | null
  clienteCedula?: string | null
  clienteNombre?: string | null
  codigoPlano: string         // se hashea antes de guardarlo
  metodo: OtpCanal
  destinatario: string        // email o teléfono
  tipo: OtpFlujo
  entidadRefId?: string | null
  descripcion?: string | null
  maxIntentos?: number        // default 3
  expiraEnMinutos?: number    // default 5
  ipSolicitud?: string | null
  userAgent?: string | null
  // guardarCodigoPlano: NUNCA en producción. Solo en NODE_ENV !== 'production'
  // y solo si el caller lo pide explícitamente (para debugging).
  guardarCodigoPlano?: boolean
}

export interface RegistroOtpResult {
  id: string
  expiraEn: Date
  codigoHash: string
}

export async function registrarOtp(params: RegistroOtpParams): Promise<RegistroOtpResult> {
  const expiraEnMinutos = params.expiraEnMinutos ?? 5
  const expiraEn = new Date(Date.now() + expiraEnMinutos * 60 * 1000)
  const codigoHash = hashOtp(params.codigoPlano)

  // codigoPlano solo en desarrollo, y solo si el caller lo pide explícitamente
  const isProd = process.env.NODE_ENV === 'production'
  const codigoPlanoToStore =
    !isProd && params.guardarCodigoPlano ? params.codigoPlano : null

  const registro = await db.otpRegistro.create({
    data: {
      clienteId: params.clienteId || null,
      clienteCedula: params.clienteCedula || null,
      clienteNombre: params.clienteNombre || null,
      codigoHash,
      codigoPlano: codigoPlanoToStore,
      metodo: params.metodo,
      destinatario: params.destinatario,
      tipo: params.tipo,
      entidadRefId: params.entidadRefId || null,
      descripcion: params.descripcion || null,
      intentos: 0,
      maxIntentos: params.maxIntentos ?? 3,
      usado: false,
      bloqueado: false,
      expiraEn,
      ipSolicitud: params.ipSolicitud || null,
      userAgent: params.userAgent || null,
      verificado: false,
    },
  })

  return {
    id: registro.id,
    expiraEn,
    codigoHash,
  }
}

// --- Marcar OTP como verificado en OtpRegistro ---
export async function marcarOtpVerificado(
  otpRegistroId: string,
  sessionIdGenerado?: string
): Promise<void> {
  await db.otpRegistro.update({
    where: { id: otpRegistroId },
    data: {
      verificado: true,
      usado: true,
      fechaVerificacion: new Date(),
      sessionIdGenerado: sessionIdGenerado || null,
    },
  })
}

// --- Incrementar intentos fallidos en OtpRegistro ---
// Si llega a maxIntentos, marca como bloqueado.
export async function incrementarIntentoOtp(
  otpRegistroId: string
): Promise<{ intentos: number; maxIntentos: number; bloqueado: boolean }> {
  const r = await db.otpRegistro.findUnique({
    where: { id: otpRegistroId },
    select: { intentos: true, maxIntentos: true },
  })
  if (!r) throw new Error('OtpRegistro no encontrado: ' + otpRegistroId)
  const nuevosIntentos = r.intentos + 1
  const bloqueado = nuevosIntentos >= r.maxIntentos
  await db.otpRegistro.update({
    where: { id: otpRegistroId },
    data: {
      intentos: nuevosIntentos,
      bloqueado,
      fechaBloqueo: bloqueado ? new Date() : null,
    },
  })
  return { intentos: nuevosIntentos, maxIntentos: r.maxIntentos, bloqueado }
}

// --- Helper para extraer IP del request ---
export function obtenerIp(req: { headers: Headers }): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

export function obtenerUserAgent(req: { headers: Headers }): string | null {
  return req.headers.get('user-agent') || null
}
