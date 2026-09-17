// =====================================================
// /api/chat/totp-setup — Configuración TOTP para chat interno del portal cliente
// POST { accion: 'iniciar' | 'confirmar' | 'desactivar', clienteId, codigo? }
//
// Flujo:
//   1. iniciar     → genera secreto + QR (no activo aún)
//   2. confirmar   → verifica código TOTP del cliente → activa totpEnabled=true
//   3. desactivar  → pide código actual, desactiva y borra secreto
//
// REEMPLAZA al OTP-WhatsApp SOLO para chat interno.
// Otros OTPs (firma pagaré, código aprobación préstamo, MFA admin, recuperación clave) NO se tocan.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getPortalClientInfo, registrarAccesoPortal } from '@/lib/acceso-portal'
import { generateSecret, generateURI, verifyTOTP } from '@/lib/totp'
import { sanitizeError } from '@/lib/error-handler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accion } = body

    if (accion === 'iniciar') return iniciar(req, body)
    if (accion === 'confirmar') return confirmar(req, body)
    if (accion === 'desactivar') return desactivar(req, body)

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Use: iniciar | confirmar | desactivar' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === INICIAR setup TOTP ===
async function iniciar(req: NextRequest, body: any) {
  const clientInfo = getPortalClientInfo(req)
  const { clienteId, cedula } = body

  if (!clienteId && !cedula) {
    return NextResponse.json(
      { success: false, error: 'clienteId o cedula son requeridos' },
      { status: 400 }
    )
  }

  const cliente = await db.cliente.findFirst({
    where: clienteId ? { id: clienteId } : { cedula },
    select: { id: true, nombre: true, cedula: true, telefono: true, totpEnabled: true },
  })

  if (!cliente) {
    return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  }

  if (cliente.totpEnabled) {
    return NextResponse.json(
      {
        success: false,
        error: 'TOTP ya está activado. Desactiva primero si quieres reconfigurar.',
        code: 'TOTP_ALREADY_ENABLED',
      },
      { status: 400 }
    )
  }

  const secret = generateSecret()
  const uri = generateURI(secret, cliente.cedula, 'Jsadr Chat')
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 240, margin: 1 })

  await db.cliente.update({
    where: { id: cliente.id },
    data: {
      totpSecret: secret,
      totpCreatedAt: new Date(),
    },
  })

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'CONSULTA',
    exito: true,
    detalle: 'Setup TOTP iniciado (chat interno)',
  })

  return NextResponse.json({
    success: true,
    data: {
      secret,
      uri,
      qrDataUrl,
      totpEnabled: false,
      message: 'Escanea el QR con Google Authenticator / Authy / Microsoft Authenticator y confirma con un código.',
    },
  })
}

// === CONFIRMAR setup TOTP ===
async function confirmar(req: NextRequest, body: any) {
  const clientInfo = getPortalClientInfo(req)
  const { clienteId, cedula, codigo } = body

  if (!codigo || (!clienteId && !cedula)) {
    return NextResponse.json(
      { success: false, error: 'clienteId/cedula y codigo son requeridos' },
      { status: 400 }
    )
  }

  const cliente = await db.cliente.findFirst({
    where: clienteId ? { id: clienteId } : { cedula },
    select: { id: true, nombre: true, cedula: true, totpSecret: true, totpEnabled: true },
  })

  if (!cliente) {
    return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  }

  if (!cliente.totpSecret) {
    return NextResponse.json(
      { success: false, error: 'No hay setup TOTP pendiente. Llama a iniciar primero.', code: 'NO_PENDING_SETUP' },
      { status: 400 }
    )
  }

  if (cliente.totpEnabled) {
    return NextResponse.json(
      { success: false, error: 'TOTP ya está activo', code: 'ALREADY_ENABLED' },
      { status: 400 }
    )
  }

  const codigoValido = verifyTOTP(String(codigo), cliente.totpSecret)
  if (!codigoValido) {
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'INTENTO_FALLIDO',
      exito: false,
      detalle: 'Confirmación TOTP incorrecta (chat interno)',
    })
    return NextResponse.json(
      { success: false, error: 'Código TOTP incorrecto. Verifica la hora del dispositivo y vuelve a intentar.' },
      { status: 401 }
    )
  }

  await db.cliente.update({
    where: { id: cliente.id },
    data: {
      totpEnabled: true,
      totpLastUsed: new Date(),
    },
  })

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'LOGIN',
    exito: true,
    detalle: 'TOTP activado correctamente (chat interno)',
  })

  return NextResponse.json({
    success: true,
    data: { totpEnabled: true, message: 'TOTP activado. Ya puedes usar tu app autenticadora para el chat.' },
  })
}

// === DESACTIVAR TOTP ===
async function desactivar(req: NextRequest, body: any) {
  const clientInfo = getPortalClientInfo(req)
  const { clienteId, cedula, codigo } = body

  if (!codigo || (!clienteId && !cedula)) {
    return NextResponse.json(
      { success: false, error: 'clienteId/cedula y codigo son requeridos' },
      { status: 400 }
    )
  }

  const cliente = await db.cliente.findFirst({
    where: clienteId ? { id: clienteId } : { cedula },
    select: { id: true, nombre: true, cedula: true, totpSecret: true, totpEnabled: true },
  })

  if (!cliente) {
    return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  }

  if (!cliente.totpEnabled || !cliente.totpSecret) {
    return NextResponse.json(
      { success: false, error: 'TOTP no está activado', code: 'NOT_ENABLED' },
      { status: 400 }
    )
  }

  const codigoValido = verifyTOTP(String(codigo), cliente.totpSecret)
  if (!codigoValido) {
    await registrarAccesoPortal({
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      accion: 'INTENTO_FALLIDO',
      exito: false,
      detalle: 'Desactivación TOTP rechazada (código incorrecto)',
    })
    return NextResponse.json(
      { success: false, error: 'Código TOTP incorrecto. No se desactivó.' },
      { status: 401 }
    )
  }

  await db.cliente.update({
    where: { id: cliente.id },
    data: {
      totpSecret: null,
      totpEnabled: false,
      totpCreatedAt: null,
      totpLastUsed: null,
    },
  })

  await registrarAccesoPortal({
    clienteId: cliente.id,
    clienteCedula: cliente.cedula,
    clienteNombre: cliente.nombre,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    accion: 'CONSULTA',
    exito: true,
    detalle: 'TOTP desactivado (chat interno)',
  })

  return NextResponse.json({
    success: true,
    data: { totpEnabled: false, message: 'TOTP desactivado. El chat volverá a usar OTP por WhatsApp.' },
  })
}

// GET — estado TOTP del cliente (sin exponer el secreto)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clienteId = url.searchParams.get('clienteId')
  const cedula = url.searchParams.get('cedula')

  if (!clienteId && !cedula) {
    return NextResponse.json({ success: false, error: 'clienteId o cedula son requeridos' }, { status: 400 })
  }

  const cliente = await db.cliente.findFirst({
    where: clienteId ? { id: clienteId } : { cedula: cedula || undefined },
    select: { totpEnabled: true, totpCreatedAt: true, totpLastUsed: true },
  })

  if (!cliente) {
    return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      totpEnabled: cliente.totpEnabled,
      totpCreatedAt: cliente.totpCreatedAt,
      totpLastUsed: cliente.totpLastUsed,
      hasPendingSetup: !cliente.totpEnabled && cliente.totpCreatedAt !== null,
    },
  })
}
