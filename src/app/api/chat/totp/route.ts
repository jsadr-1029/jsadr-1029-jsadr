// =====================================================
// /api/chat/totp — Verificación TOTP para chat interno del portal cliente
// POST { clienteId/cedula, codigo } → verifica TOTP → emite sessionId
//
// REEMPLAZA al OTP-WhatsApp (api/chat/otp) SOLO para chat interno.
// Otros OTPs (firma pagaré, código aprobación solicitud, MFA admin) NO se tocan.
//
// El sessionId generado se guarda en cliente.tokenSesion — igual que hace
// /api/chat/otp al verificar. Por lo tanto, los gates existentes en
// /api/chat/conversaciones y /api/chat/mensajes NO requieren cambios.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getPortalClientInfo, registrarAccesoPortal } from '@/lib/acceso-portal'
import { verifyTOTP } from '@/lib/totp'
import { sanitizeError } from '@/lib/error-handler'

const SESION_PORTAL_HORAS = 2
const TOTP_INTENTOS_MAX = 5
const TOTP_BLOQUEO_MIN = 15

interface IntentoRecord {
  clienteId: string
  intentos: number
  bloqueadoHasta?: number
}

// Memoria por proceso para rate-limit de intentos TOTP
// (en multi-instancia debería migrarse a Redis)
const intentosFallidos = new Map<string, IntentoRecord>()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clienteId, cedula, codigo } = body

    if (!codigo || (!clienteId && !cedula)) {
      return NextResponse.json(
        { success: false, error: 'clienteId/cedula y codigo son requeridos' },
        { status: 400 }
      )
    }

    const clientInfo = getPortalClientInfo(req)

    const cliente = await db.cliente.findFirst({
      where: clienteId ? { id: clienteId } : { cedula },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        totpSecret: true,
        totpEnabled: true,
        tokenSesion: true,
        tokenExpira: true,
      },
    })

    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    if (!cliente.totpEnabled || !cliente.totpSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'TOTP no está activado para este cliente. Configúralo primero en /api/chat/totp-setup.',
          code: 'TOTP_NOT_ENABLED',
        },
        { status: 400 }
      )
    }

    // Verificar bloqueo por intentos fallidos
    const record = intentosFallidos.get(cliente.id)
    if (record?.bloqueadoHasta && record.bloqueadoHasta > Date.now()) {
      const mins = Math.ceil((record.bloqueadoHasta - Date.now()) / 60000)
      return NextResponse.json(
        {
          success: false,
          error: `Bloqueado por intentos fallidos. Intenta en ${mins} minuto(s).`,
          code: 'BLOCKED',
          minutosRestantes: mins,
        },
        { status: 403 }
      )
    }

    // Verificar código TOTP (ventana ±30s por defecto)
    const codigoValido = verifyTOTP(String(codigo), cliente.totpSecret)
    if (!codigoValido) {
      const current = record || { clienteId: cliente.id, intentos: 0 }
      current.intentos += 1

      if (current.intentos >= TOTP_INTENTOS_MAX) {
        current.bloqueadoHasta = Date.now() + TOTP_BLOQUEO_MIN * 60 * 1000
        intentosFallidos.set(cliente.id, current)

        await registrarAccesoPortal({
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'INTENTO_FALLIDO',
          exito: false,
          detalle: `TOTP bloqueado tras ${TOTP_INTENTOS_MAX} intentos (chat interno)`,
        })

        return NextResponse.json(
          {
            success: false,
            error: `Bloqueado tras ${TOTP_INTENTOS_MAX} intentos fallidos. Espera ${TOTP_BLOQUEO_MIN} minutos.`,
            code: 'BLOCKED',
            minutosRestantes: TOTP_BLOQUEO_MIN,
          },
          { status: 403 }
        )
      }

      intentosFallidos.set(cliente.id, current)

      await registrarAccesoPortal({
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'INTENTO_FALLIDO',
        exito: false,
        detalle: `TOTP incorrecto. Intento ${current.intentos}/${TOTP_INTENTOS_MAX} (chat interno)`,
      })

      const restantes = TOTP_INTENTOS_MAX - current.intentos
      return NextResponse.json(
        {
          success: false,
          error: `Código TOTP incorrecto. Intentos restantes: ${restantes}`,
          code: 'INVALID_TOTP',
          intentosRestantes: restantes,
        },
        { status: 401 }
      )
    }

    // === Código válido — emitir sessionId ===
    intentosFallidos.delete(cliente.id)

    const sessionId = crypto.randomBytes(32).toString('hex')
    const tokenExpira = new Date(Date.now() + SESION_PORTAL_HORAS * 60 * 60 * 1000)

    // Persistir sessionId como tokenSesion (igual que /api/chat/otp hace)
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: sessionId,
        tokenExpira,
        totpLastUsed: new Date(),
      },
    })

    // Registrar en OtpChat para auditoría (mismo lugar que OTP-WhatsApp, con metodo='TOTP')
    await db.otpChat.create({
      data: {
        clienteId: cliente.id,
        codigoHash: 'TOTP_NO_HASHED', // TOTP no se hashea — el secreto ya está cifrado en cliente.totpSecret
        metodo: 'TOTP',
        destinatario: 'IN_APP',
        maxIntentos: TOTP_INTENTOS_MAX,
        expiraEn: tokenExpira,
        ipSolicitud: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        usado: true,
        verificado: true,
        fechaVerificacion: new Date(),
        sessionIdGenerado: sessionId,
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
      detalle: 'TOTP verificado correctamente (chat interno)',
      metadata: { sessionId, metodo: 'TOTP' },
    })

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        clienteId: cliente.id,
        verificado: true,
        tokenExpira: tokenExpira.toISOString(),
        metodo: 'TOTP',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
