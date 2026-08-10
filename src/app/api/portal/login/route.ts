import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { generateToken } from '@/lib/format'
import { getClientInfo } from '@/lib/security'

// =====================================================
// POST /api/portal/login
// Body:
//   { cedula: string, pin: string }     — login por cédula + PIN (legacy)
//   { cedula: string, clave: string }   — login por cédula + clave (v4.13)
//   { clienteId: string, pin: string }  — login por clienteId (legacy)
//
// Flujo:
//   1. Buscar cliente por cédula (o clienteId si se proporciona).
//   2a. Si se envió `clave` (v4.13):
//       - Validar contra claveHash (bcrypt).
//       - Si `debeCambiarClave=true`: devolver código CAMBIO_CLAVE_OBLIGATORIO
//         con un token temporal (claveTempToken) que solo autoriza el cambio
//         de clave. NO se entrega token de sesión completa.
//       - Si `debeCambiarClave=false`: generar sesión normal.
//   2b. Si se envió `pin` (legacy):
//       - Si no tiene PIN, crearlo (primer acceso).
//       - Validar PIN (bcrypt compare).
//   3. Generar token de sesión (8h) y persistir en cliente.tokenSesion.
//   4. Registrar en AccesoPortal.
//
// Respuesta:
//   { success: true, token, clienteId, nombre, nuevoPin?: true }
//   { success: false, error } (401/403/404 según caso)
//   { success: false, codigo: 'CAMBIO_CLAVE_OBLIGATORIO', claveTempToken, clienteId, nombre }
//     — cuando la clave es válida pero debe cambiarse. El frontend debe
//       mostrar el formulario de cambio de clave y llamar a
//       /api/portal/cambiar-clave-primer-login con el claveTempToken.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula, clienteId, pin, clave } = body

    // === v4.13: soporte para login con clave (no solo PIN) ===
    const usaClave = typeof clave === 'string' && clave.length > 0
    const usaPin = typeof pin === 'string' && pin.length > 0

    if (!usaClave && !usaPin) {
      return NextResponse.json(
        { success: false, error: 'PIN o clave es requerido' },
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

    // Verificar bloqueo (PIN o clave, según corresponda)
    const bloqueadoHasta = usaClave ? cliente.claveBloqueadoHasta : cliente.pinBloqueadoHasta
    if (bloqueadoHasta && new Date(bloqueadoHasta) > new Date()) {
      return NextResponse.json(
        { success: false, error: 'Cuenta bloqueada temporalmente' },
        { status: 403 }
      )
    }

    const clientInfo = getClientInfo(req)

    // =====================================================
    // === v4.13 — Login con CLAVE (alfanumérica) ===
    // =====================================================
    if (usaClave) {
      // Si no tiene claveHash, no se puede loguear con clave
      if (!cliente.claveHash) {
        await db.accesoPortal.create({
          data: {
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            accion: 'LOGIN_CLAVE',
            exito: false,
            detalle: 'Cliente sin clave configurada',
          },
        })
        return NextResponse.json(
          { success: false, error: 'Cédula o clave incorrecta', codigo: 'CLAVE_INVALIDA' },
          { status: 401 }
        )
      }

      // Validar clave contra el hash bcrypt
      const claveValida = bcrypt.compareSync(clave, cliente.claveHash)
      if (!claveValida) {
        const nuevosIntentos = (cliente.claveIntentos || 0) + 1
        const MAX_INTENTOS_CLAVE = 5
        const TIEMPO_BLOQUEO_MIN = 15
        const bloquear = nuevosIntentos >= MAX_INTENTOS_CLAVE
        await db.cliente.update({
          where: { id: cliente.id },
          data: {
            claveIntentos: nuevosIntentos,
            claveBloqueadoHasta: bloquear
              ? new Date(Date.now() + TIEMPO_BLOQUEO_MIN * 60 * 1000)
              : null,
          },
        })

        await db.accesoPortal.create({
          data: {
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            accion: 'LOGIN_CLAVE',
            exito: false,
            detalle: `Clave incorrecta. Intento ${nuevosIntentos}/${MAX_INTENTOS_CLAVE}`,
          },
        })

        return NextResponse.json(
          {
            success: false,
            error: bloquear
              ? `Demasiados intentos. Cuenta bloqueada por ${TIEMPO_BLOQUEO_MIN} minutos.`
              : `Clave incorrecta. Intentos restantes: ${MAX_INTENTOS_CLAVE - nuevosIntentos}`,
            codigo: bloquear ? 'CLAVE_BLOQUEADA' : 'CLAVE_INVALIDA',
          },
          { status: bloquear ? 403 : 401 }
        )
      }

      // === Clave válida — resetear intentos ===
      await db.cliente.update({
        where: { id: cliente.id },
        data: { claveIntentos: 0, claveBloqueadoHasta: null },
      })

      // === v4.13: ¿Debe cambiar la clave? ===
      if (cliente.debeCambiarClave) {
        // Generar token temporal SOLO para cambio de clave (24h)
        const claveTempToken = crypto.randomBytes(32).toString('hex')
        const claveTempExpira = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
        await db.cliente.update({
          where: { id: cliente.id },
          data: { claveTempToken, claveTempExpira },
        })

        await db.accesoPortal.create({
          data: {
            clienteId: cliente.id,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            accion: 'LOGIN_CLAVE',
            exito: true,
            detalle: 'Clave válida — debe cambiar (primer ingreso)',
          },
        })

        return NextResponse.json({
          success: false,
          codigo: 'CAMBIO_CLAVE_OBLIGATORIO',
          claveTempToken,
          clienteId: cliente.id,
          nombre: cliente.nombre,
          mensaje: 'Por seguridad, debes cambiar tu clave antes de continuar.',
        })
      }

      // Login con clave exitoso — generar sesión
      const token = generateToken(32)
      const tokenExpira = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8h
      await db.cliente.update({
        where: { id: cliente.id },
        data: {
          tokenSesion: token,
          tokenExpira,
          ultimoAccesoPortal: new Date(),
        },
      })

      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'LOGIN_CLAVE',
          exito: true,
          detalle: 'Sesión iniciada con clave',
        },
      })

      return NextResponse.json({
        success: true,
        token,
        clienteId: cliente.id,
        nombre: cliente.nombre,
      })
    }

    // =====================================================
    // === Legacy: Login con PIN ===
    // =====================================================
    // POLÍTICA DE SEGURIDAD (bloqueo de creación automática):
    // Antes, si el cliente no tenía pinHash, el sistema lo creaba
    // automáticamente con cualquier PIN que el usuario escribiera.
    // Esto permitía a cualquiera "crear" credenciales para una cédula
    // sin autorización. Ahora se rechaza: las credenciales SOLO las
    // puede crear/modificar:
    //   1. Un ADMIN/GESTOR autenticado desde el módulo de Seguridad
    //   2. El propio cliente vía enlace de recuperación enviado al correo
    // El login con PIN legacy se mantiene solo para clientes que ya
    // tienen pinHash (creado por un admin anteriormente).
    if (!cliente.pinHash) {
      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'LOGIN_PIN',
          exito: false,
          detalle: 'Rechazado: el cliente no tiene PIN registrado. Debe ser creado por un administrador.',
        },
      })

      return NextResponse.json(
        {
          success: false,
          codigo: 'SIN_PIN_REGISTRADO',
          error:
            'Tu cuenta no tiene PIN registrado. Contacta al administrador para que cree tus credenciales, o usa la opción "Olvidé mi clave" para recibirla por correo.',
        },
        { status: 403 }
      )
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
    // Sesión extendida a 8 horas (antes 2h) — ver comentario arriba.
    const tokenExpira = new Date(Date.now() + 8 * 60 * 60 * 1000)
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
