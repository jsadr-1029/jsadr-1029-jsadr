// =====================================================
// TOTP propio RFC 6238 — sin dependencias externas
// Implementación con Web Crypto / Node crypto
// - generateSecret(): secreto base32 aleatorio (160 bits)
// - generateTOTP(secret): token de 6 dígitos válido por 30s
// - verifyTOTP(token, secret): permite ventana de ±1 step
// - generateURI(secret, label, issuer): otpauth:// para QR
// =====================================================

import crypto from 'crypto'

// === CONSTANTES RFC 6238 ===
const STEP_SECONDS = 30
const DIGITS = 6
const ALGORITHM = 'sha1'
const SECRET_LENGTH_BYTES = 20 // 160 bits (recomendado RFC 4226)

// === BASE32 (RFC 4648) ===
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }

  // Padding a múltiplos de 8
  while (output.length % 8 !== 0) {
    output += '='
  }

  return output
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) {
      throw new Error(`Carácter base32 inválido: ${char}`)
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

// === API PÚBLICA ===

/**
 * Genera un secreto TOTP aleatorio codificado en base32 (160 bits).
 */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(SECRET_LENGTH_BYTES)
  return base32Encode(bytes)
}

/**
 * Devuelve el contador de tiempo actual (número de step de 30s desde epoch).
 */
function timeCounter(time: number = Date.now()): number {
  return Math.floor(time / 1000 / STEP_SECONDS)
}

/**
 * Genera un token TOTP de 6 dígitos para el secreto dado.
 * RFC 6238 — HOTP con contador = floor(T / 30).
 */
export function generateTOTP(secret: string, time: number = Date.now()): string {
  const key = base32Decode(secret)
  const counter = Buffer.alloc(8)
  const step = timeCounter(time)
  // Escribir el contador como big-endian de 64 bits
  counter.writeBigUInt64BE(BigInt(step))

  const hmac = crypto.createHmac(ALGORITHM, key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f

  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const token = binary % 10 ** DIGITS
  return token.toString().padStart(DIGITS, '0')
}

/**
 * Verifica un token TOTP permitiendo una ventana de ±windowSteps steps
 * (default 1 = ±30 segundos de deriva permitida).
 * Usa comparación de tiempo constante para evitar timing attacks.
 */
export function verifyTOTP(
  token: string,
  secret: string,
  windowSteps: number = 1,
  time: number = Date.now()
): boolean {
  if (!token || !secret) return false

  const cleanToken = token.replace(/\s/g, '')
  if (!/^\d+$/.test(cleanToken) || cleanToken.length !== DIGITS) {
    return false
  }

  const now = Date.now()
  for (let i = -windowSteps; i <= windowSteps; i++) {
    const checkTime = now + i * STEP_SECONDS * 1000
    const expected = generateTOTP(secret, checkTime)
    if (timingSafeEqual(cleanToken, expected)) {
      return true
    }
  }

  return false
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Construye la URI otpauth:// para QR (compatible con Google Authenticator,
 * Authy, 1Password, Microsoft Authenticator, etc.).
 *
 * Formato: otpauth://totp/<label>?secret=<secret>&issuer=<issuer>&algorithm=SHA1&digits=6&period=30
 */
export function generateURI(
  secret: string,
  label: string,
  issuer: string = 'Jsadr'
): string {
  const encodedLabel = encodeURIComponent(`${issuer}:${label}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${encodedLabel}?${params.toString()}`
}

/**
 * Constantes exportadas para documentación / UI.
 */
export const TOTP_CONFIG = {
  STEP_SECONDS,
  DIGITS,
  ALGORITHM,
  SECRET_LENGTH_BYTES,
} as const
