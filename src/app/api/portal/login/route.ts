import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { generateToken } from '@/lib/format'
import { getClientInfo } from '@/lib/security'

// =====================================================
// POST /api/portal/login
// Body:
//   { cedula: string, pin: string }    — login por cédula (preferido)
//   { clienteId: string, pin: string } — login por clienteId (legacy)
//
// Flujo:
//   1. Buscar cliente por cédula (o clienteId si se proporciona).
//   2. Si no tiene PIN, crearlo (primer acceso).
//   3. Validar PIN (bcrypt compare).
//   4. Generar token de sesión (2h) y persistir en cliente.tokenSesion.
//   5. Registrar en AccesoPortal.
//
// Respuesta:
//   { success: true, token, clienteId, nombre, nuevoPin?: true }
//   { success: false, error } (401/403/404 según caso)
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula, clienteId, pin } = body

    // Aceptar tanto cédula como clienteId (legacy)
    if (!pin) {
      return NextResponse.json(
        { success: false, error: 'PIN es requerido' },
        { status: 400 }
      )
    }
    if (!cedula && !clienteId) {
      return NextResponse.json(
        { success: false, error: 'Cédula o clienteId es requerido' },
        { status: 400 }
      )
    }

    // Buscar cliente
    const cliente = cedula
      ? await db.cliente.findUnique({ where: { cedula: String(cedula).trim() } })
      : await db.cliente.findUnique({ where: { id: clienteId } })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cuenta no encontrada' },
        { status: 404 }
      )
    }
    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cuenta inactiva' },
        { status: 403 }
      )
    }

    // Verificar bloqueo
    if (cliente.pinBloqueadoHasta && new Date(cliente.pinBloqueadoHasta) > new Date()) {
      return NextResponse.json(
        { success: false, error: 'Cuenta bloqueada temporalmente' },
        { status: 403 }
      )
    }

    const clientInfo = getClientInfo(req)

    // Si no tiene PIN, crearlo (primer acceso)
    if (!cliente.pinHash) {
      const pinHash = bcrypt.hashSync(pin, 10)
      await db.cliente.update({
        where: { id: cliente.id },
        data: { pinHash, pinCreatedAt: new Date(), pinIntentos: 0 },
      })
      // Login exitoso
      const token = generateToken(32)
      const tokenExpira = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2h
      await db.cliente.update({
        where: { id: cliente.id },
        data: {
          tokenSesion: token,
          tokenExpira,
          ultimoAccesoPortal: new Date(),
          pinIntentos: 0,
        },
      })

      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'LOGIN_PIN',
          exito: true,
          detalle: 'PIN creado y sesión iniciada',
        },
      })

      return NextResponse.json({
        success: true,
        token,
        clienteId: cliente.id,
        nombre: cliente.nombre,
        nuevoPin: true,
      })
    }

    // === v4.10 (QA M07 TC-PORT-003): bloqueo a los 5 intentos (estándar) ===
    // Antes era 3; el plan de pruebas exige 5 (coincide con /api/portal/auth).
    const MAX_INTENTOS_PIN = 5
    const TIEMPO_BLOQUEO_MIN = 15

    // Validar PIN existente
    const pinValido = bcrypt.compareSync(pin, cliente.pinHash)
    if (!pinValido) {
      const nuevosIntentos = cliente.pinIntentos + 1
      const bloquear = nuevosIntentos >= MAX_INTENTOS_PIN
      await db.cliente.update({
        where: { id: cliente.id },
        data: {
          pinIntentos: nuevosIntentos,
          pinBloqueadoHasta: bloquear ? new Date(Date.now() + TIEMPO_BLOQUEO_MIN * 60 * 1000) : null,
        },
      })

      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'LOGIN_PIN',
          exito: false,
          detalle: `PIN incorrecto. Intento ${nuevosIntentos}/${MAX_INTENTOS_PIN}`,
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: bloquear
            ? `Demasiados intentos. Cuenta bloqueada por ${TIEMPO_BLOQUEO_MIN} minutos.`
            : `PIN incorrecto. Intentos restantes: ${MAX_INTENTOS_PIN - nuevosIntentos}`,
          codigo: bloquear ? 'PIN_BLOQUEADO' : 'PIN_INCORRECTO',
        },
        { status: bloquear ? 403 : 401 }
      )
    }

    // PIN correcto - generar sesión
    const token = generateToken(32)
    const tokenExpira = new Date(Date.now() + 2 * 60 * 60 * 1000)
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: token,
        tokenExpira,
        ultimoAccesoPortal: new Date(),
        pinIntentos: 0,
      },
    })

    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'LOGIN_PIN',
        exito: true,
        detalle: 'Sesión iniciada',
      },
    })

    return NextResponse.json({
      success: true,
      token,
      clienteId: cliente.id,
      nombre: cliente.nombre,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE /api/portal/login — Cierre de sesión (logout)
// v4.10 (QA M07 TC-PORT-014)
// =====================================================
// Body: { token: string } | Headers: x-portal-token
// Acción:
//   1. Identifica al cliente por tokenSesion.
//   2. Limpia tokenSesion=null y tokenExpira=null en BD.
//   3. Registra LOGOUT en AccesoPortal (auditoría).
//   4. Retorna HTTP 200.
//
// Si el token no coincide con ningún cliente, retorna 200 igualmente
// (idempotente: no revela si la sesión existía).
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    // Token desde body o header (preferido)
    let token: string | undefined
    try {
      const body = await req.json()
      token = body?.token
    } catch {
      // body vacío no es error: leemos header
    }
    if (!token) {
      token = req.headers.get('x-portal-token') || undefined
    }

    const clientInfo = getClientInfo(req)

    if (token) {
      // Buscar cliente por tokenSesion
      const cliente = await db.cliente.findFirst({
        where: { tokenSesion: token },
        select: { id: true, cedula: true, nombre: true },
      })

      if (cliente) {
        // Limpiar token en BD
        await db.cliente.update({
          where: { id: cliente.id },
          data: {
            tokenSesion: null,
            tokenExpira: null,
          },
        })

        // Auditoría
        await db.accesoPortal.create({
          data: {
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            accion: 'LOGOUT',
            exito: true,
            detalle: 'Sesión cerrada por DELETE /api/portal/login',
          },
        })
      }
    }

    // Respuesta idempotente — siempre 200 (no revela si el token existía)
    return NextResponse.json(
      { success: true, message: 'Sesión cerrada' },
      { status: 200 }
    )
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
