// =====================================================
// WebAuthn / Passkeys — Librería de servidor
// -----------------------------------------------------
// Implementa registro y autenticación biométrica usando
// WebAuthn / FIDO2 / Passkeys.
//
// REGLA FUNDAMENTAL DE PRIVACIDAD:
// El servidor NUNCA recibe ni almacena datos biométricos
// (huellas, fotos, plantillas). Solo recibe información
// criptográfica (credential ID, public key, contador de
// sign-count) que permite verificar que el usuario se
// autenticó correctamente en su dispositivo.
//
// La biometría se procesa 100% en el dispositivo:
//   - iOS: Secure Enclave
//   - Android: Android Keystore
//   - Windows: TPM
//   - Mac: Touch ID via Secure Enclave
// =====================================================

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { db } from '@/lib/db'
import { getBaseUrl } from '@/lib/url'
import crypto from 'crypto'

// === Configuración WebAuthn ===
// RP ID = dominio principal (sin protocolo ni puerto)
// RP Name = nombre legible que se muestra en el prompt biométrico
function getRpId(): string {
  const url = getBaseUrl()
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return 'jsadr.com.co'
  }
}

function getRpName(): string {
  return 'Jsadr · Portal del Cliente'
}

// === Almacenamiento temporal de challenges ===
// Los challenges deben ser de un solo uso y expirar rápido (5 min).
// Se almacenan en la tabla Configuracion con clave única por cliente.
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutos

async function guardarChallenge(clienteId: string, challenge: string, tipo: 'registro' | 'login') {
  const clave = `WEBAUTHN_CHALLENGE_${tipo}_${clienteId}`
  const valor = JSON.stringify({
    challenge,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_EXPIRY_MS,
  })
  await db.configuracion.upsert({
    where: { clave },
    create: { clave, valor, descripcion: `Challenge WebAuthn ${tipo} para ${clienteId}` },
    update: { valor, updatedAt: new Date() },
  })
}

async function obtenerYConsumirChallenge(clienteId: string, tipo: 'registro' | 'login'): Promise<string | null> {
  const clave = `WEBAUTHN_CHALLENGE_${tipo}_${clienteId}`
  const config = await db.configuracion.findUnique({ where: { clave } })
  if (!config) return null

  // Consumir el challenge (borrarlo) para que no se pueda reutilizar
  await db.configuracion.delete({ where: { clave } }).catch(() => {})

  try {
    const data = JSON.parse(config.valor)
    if (Date.now() > data.expiresAt) return null
    return data.challenge
  } catch {
    return null
  }
}

// === Utilidades ===

// Codificar ArrayBuffer a base64url (para almacenar en BD)
export function bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Decodificar base64url a Uint8Array (para pasar a SimpleWebAuthn)
export function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Detectar plataforma del dispositivo desde el User-Agent
export function detectarPlataforma(userAgent: string | null): string {
  if (!userAgent) return 'desconocido'
  const ua = userAgent.toLowerCase()
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios'
  if (ua.includes('android')) return 'android'
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'desconocido'
}

// === REGISTRO DE PASSKEY ===

export async function generarOpcionesRegistro(clienteId: string) {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nombre: true, email: true, cedula: true },
  })
  if (!cliente) throw new Error('Cliente no encontrado')

  // Obtener passkeys existentes para evitar duplicados
  const passkeysExistentes = await db.passkey.findMany({
    where: { clienteId, activa: true },
    select: { credentialId: true, transports: true },
  })

  const exclusionCredentials = passkeysExistentes.map((p) => ({
    id: p.credentialId,
  }))

  const options = await generateRegistrationOptions({
    rpName: getRpName(),
    rpID: getRpId(),
    userName: cliente.cedula,
    userDisplayName: cliente.nombre,
    excludeCredentials: exclusionCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  // Guardar challenge para verificación posterior
  await guardarChallenge(clienteId, options.challenge, 'registro')

  return options
}

export async function verificarRegistro(
  clienteId: string,
  response: RegistrationResponseJSON,
  userAgent?: string | null
) {
  // Recuperar challenge guardado
  const expectedChallenge = await obtenerYConsumirChallenge(clienteId, 'registro')
  if (!expectedChallenge) {
    throw new Error('Challenge expirado o inválido. Solicita un nuevo registro.')
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getBaseUrl(),
    expectedRPID: getRpId(),
    requireUserVerification: false,
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Verificación de registro fallida. La credencial no es válida.')
  }

  const { credential } = verification.registrationInfo

  // Guardar la passkey en BD (SOLO información criptográfica, NO biometría)
  const credentialIdStr = credential.id
  const publicKeyStr = bufferToBase64url(credential.publicKey)
  const transportsStr = credential.transports ? JSON.stringify(credential.transports) : null

  // Detectar plataforma
  const plataforma = detectarPlataforma(userAgent || null)

  const passkey = await db.passkey.create({
    data: {
      clienteId,
      credentialId: credentialIdStr,
      credentialPublicKey: publicKeyStr,
      counter: BigInt(credential.counter || 0),
      transports: transportsStr,
      algorithm: -7, // Default ES256
      platform: plataforma,
      userAgent: userAgent || null,
      nickname: `Dispositivo ${plataforma}`,
    },
  })

  // Registrar evento de seguridad
  await db.securityEvent.create({
    data: {
      clienteId,
      tipo: 'PASSKEY_REGISTRADA',
      descripcion: `Nueva passkey registrada (${plataforma})`,
      userAgent: userAgent || null,
      severidad: 'INFO',
    },
  })

  return {
    verified: true,
    passkeyId: passkey.id,
    credentialId: credentialIdStr,
  }
}

// === AUTENTICACIÓN CON PASSKEY ===

export async function generarOpcionesAutenticacion(clienteId?: string) {
  // Si tenemos clienteId, filtrar por sus passkeys
  let allowCredentials: any[] = []
  if (clienteId) {
    const passkeys = await db.passkey.findMany({
      where: { clienteId, activa: true },
      select: { credentialId: true, transports: true },
    })
    allowCredentials = passkeys.map((p) => {
      const transports = p.transports ? JSON.parse(p.transports) : undefined
      return {
        id: p.credentialId,
        type: 'public-key' as const,
        transports: transports as any,
      }
    })
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpId(),
    userVerification: 'preferred',
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
  })

  // Si tenemos clienteId, guardar challenge específico
  if (clienteId) {
    await guardarChallenge(clienteId, options.challenge, 'login')
  } else {
    // Para login sin clienteId pre-identificado, guardar challenge genérico
    await guardarChallenge('ANONIMO', options.challenge, 'login')
  }

  return options
}

export async function verificarAutenticacion(
  response: AuthenticationResponseJSON,
  clienteId?: string,
  userAgent?: string | null
) {
  // Recuperar challenge
  const challengeKey = clienteId || 'ANONIMO'
  const expectedChallenge = await obtenerYConsumirChallenge(challengeKey, 'login')
  if (!expectedChallenge) {
    throw new Error('Challenge expirado o inválido. Solicita un nuevo inicio de sesión.')
  }

  // Buscar la passkey por credentialId
  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
    include: { cliente: { select: { id: true, nombre: true, cedula: true, activo: true, email: true } } },
  })

  if (!passkey || !passkey.activa) {
    throw new Error('Credencial no encontrada o desactivada.')
  }

  if (!passkey.cliente.activo) {
    throw new Error('Cuenta inactiva. Contacta al administrador.')
  }

  // Convertir la public key almacenada a Uint8Array
  const publicKeyBytes = base64urlToBuffer(passkey.credentialPublicKey)
  const transportsArray = passkey.transports ? JSON.parse(passkey.transports) : undefined

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getBaseUrl(),
    expectedRPID: getRpId(),
    credential: {
      id: passkey.credentialId,
      publicKey: publicKeyBytes as any,
      counter: Number(passkey.counter),
      transports: transportsArray,
    },
  })

  if (!verification.verified) {
    // Registrar intento fallido
    await db.securityEvent.create({
      data: {
        clienteId: passkey.clienteId,
        tipo: 'LOGIN_FALLIDO',
        descripcion: 'Autenticación biométrica fallida',
        userAgent: userAgent || null,
        severidad: 'WARN',
        exito: false,
      },
    })
    throw new Error('Verificación de autenticación fallida.')
  }

  // Actualizar contador y último uso de la passkey
  await db.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      ultimoUso: new Date(),
    },
  })

  return {
    verified: true,
    cliente: passkey.cliente,
    passkeyId: passkey.id,
  }
}

// === GESTIÓN DE PASSKEYS ===

export async function listarPasskeys(clienteId: string) {
  const passkeys = await db.passkey.findMany({
    where: { clienteId },
    select: {
      id: true,
      nickname: true,
      platform: true,
      activa: true,
      fechaRegistro: true,
      ultimoUso: true,
    },
    orderBy: { fechaRegistro: 'desc' },
  })
  return passkeys
}

export async function eliminarPasskey(clienteId: string, passkeyId: string) {
  const passkey = await db.passkey.findFirst({
    where: { id: passkeyId, clienteId },
  })
  if (!passkey) throw new Error('Passkey no encontrada')

  await db.passkey.update({
    where: { id: passkeyId },
    data: { activa: false },
  })

  await db.securityEvent.create({
    data: {
      clienteId,
      tipo: 'PASSKEY_ELIMINADA',
      descripcion: `Passkey eliminada (${passkey.platform || 'dispositivo'})`,
      severidad: 'WARN',
    },
  })

  return { success: true }
}

export async function renombrarPasskey(clienteId: string, passkeyId: string, nickname: string) {
  const passkey = await db.passkey.findFirst({
    where: { id: passkeyId, clienteId },
  })
  if (!passkey) throw new Error('Passkey no encontrada')

  await db.passkey.update({
    where: { id: passkeyId },
    data: { nickname },
  })

  return { success: true }
}

export async function tienePasskeys(clienteId: string): Promise<boolean> {
  const count = await db.passkey.count({
    where: { clienteId, activa: true },
  })
  return count > 0
}
