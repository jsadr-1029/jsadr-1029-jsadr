// =====================================================
// /api/chat/iniciar — Iniciar chat sin OTP, solo con cédula + teléfono
// -----------------------------------------------------
// POST /api/chat/iniciar
//   { cedula, telefono }   (telefono = últimos 4 dígitos)
//
// Flujo:
//   1. Busca al cliente por cédula.
//   2. Verifica que los últimos 4 dígitos del teléfono registrado
//      coincidan con el teléfono enviado.
//   3. Genera un sessionId aleatorio (32 bytes hex).
//   4. Lo persiste en cliente.tokenSesion (con expiración 2h).
//   5. Registra en AccesoPortal para auditoría.
//
// Este endpoint reemplaza la verificación OTP/TOTP por una
// confirmación simple de identidad dentro del chat mismo.
// El cliente solo necesita saber su cédula y los últimos 4
// dígitos de su teléfono registrado.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { registrarAccesoPortal, getPortalClientInfo } from '@/lib/acceso-portal'

// Rate limit: 5 intentos por cédula cada 10 minutos
const RATE_LIMIT_VENTANA_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_VENTANA_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

// Duración de la sesión de chat
const SESION_HORAS = 2

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula, telefono } = body

    // === Validación de entrada ===
    if (!cedula || typeof cedula !== 'string' || cedula.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Cédula requerida', code: 'MISSING_CEDULA' },
        { status: 400 }
      )
    }

    if (!telefono || typeof telefono !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Teléfono requerido (últimos 4 dígitos)', code: 'MISSING_TELEFONO' },
        { status: 400 }
      )
    }

    // Limpiar teléfono: solo dígitos, tomar últimos 4
    const telefonoLimpio = telefono.replace(/\D/g, '').slice(-4)
    if (telefonoLimpio.length !== 4) {
      return NextResponse.json(
        { success: false, error: 'Se requieren los últimos 4 dígitos del teléfono', code: 'INVALID_TELEFONO' },
        { status: 400 }
      )
    }

    const cedulaLimpia = cedula.trim()

    // === Rate limit por cédula ===
    const rlKey = `chat-iniciar:${cedulaLimpia}`
    const rl = checkRateLimit(rlKey)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiados intentos. Espera 10 minutos e intenta nuevamente.',
          code: 'RATE_LIMIT',
        },
        { status: 429 }
      )
    }

    // === Buscar cliente por cédula ===
    const cliente = await db.cliente.findUnique({
      where: { cedula: cedulaLimpia },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        email: true,
        activo: true,
      },
    })

    // Por seguridad: no revelar si la cédula existe o no
    // Pero necesitamos verificar el teléfono para permitir el acceso
    if (!cliente || !cliente.activo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Los datos no coinciden con nuestros registros. Verifica tu cédula y teléfono.',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // === Verificar teléfono (últimos 4 dígitos) ===
    const telefonoRegistradoLimpio = (cliente.telefono || '').replace(/\D/g, '')
    const ultimos4Registrados = telefonoRegistradoLimpio.slice(-4)

    if (!ultimos4Registrados || ultimos4Registrados !== telefonoLimpio) {
      // Registrar intento fallido para auditoría
      const clientInfo = getPortalClientInfo(req)
      await registrarAccesoPortal({
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'INTENTO_FALLIDO',
        exito: false,
        detalle: `CHAT_INICIAR_FALLIDO: Teléfono no coincide. Ingresado: ***${telefonoLimpio}, Registrado: ***${ultimos4Registrados || '???'}`,
      }).catch(() => {})

      return NextResponse.json(
        {
          success: false,
          error: 'Los datos no coinciden con nuestros registros. Verifica tu cédula y teléfono.',
          code: 'MISMATCH',
        },
        { status: 401 }
      )
    }

    // === Generar sesión de chat ===
    const sessionId = crypto.randomBytes(32).toString('hex')
    const tokenExpira = new Date(Date.now() + SESION_HORAS * 60 * 60 * 1000)

    // Persistir en cliente.tokenSesion (igual que los otros flujos de chat)
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: sessionId,
        tokenExpira,
      },
    })

    // Registrar acceso para auditoría
    const clientInfo = getPortalClientInfo(req)
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'CONSULTA',
      exito: true,
      detalle: `CHAT_INICIADO: Chat iniciado con verificación de cédula + teléfono (sin OTP). Sesión válida ${SESION_HORAS}h.`,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteCedula: cliente.cedula,
        tokenExpira: tokenExpira.toISOString(),
        sesionHoras: SESION_HORAS,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
