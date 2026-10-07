import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/format'
import { getClientInfo, generateAccessToken } from '@/lib/security'

// =====================================================
// POST /api/portal/login
// Body:
//   { cedula: string }        — login por cédula (único método)
//
// Flujo (v3.0 — 2026-09-30):
//   1. Buscar PRIMERO en tabla Usuario (admin/gestor/consultor) por cédula.
//   2. Si no encuentra, buscar en tabla Cliente por cédula.
//   3. Si no existe en ninguna → 404 NO_REGISTRADO.
//   4. Generar token de sesión.
//   5. Si es Usuario → devolver tipo=USUARIO + accessToken + rol.
//   6. Si es Cliente → devolver tipo=CLIENTE + token de portal.
//
// NOTA: Todos los usuarios (admin y clientes) ingresan SOLO con cédula.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula } = body

    if (!cedula) {
      return NextResponse.json(
        { success: false, error: 'Cédula es requerida', codigo: 'CEDULA_REQUERIDA' },
        { status: 400 }
      )
    }

    const cedulaLimpia = String(cedula).trim()
    const clientInfo = getClientInfo(req)

    // === 1. Buscar en tabla Usuario (admin/gestor/consultor) ===
    const usuario = await db.usuario.findFirst({
      where: {
        OR: [
          { cedula: cedulaLimpia },
          { username: cedulaLimpia },
        ],
        activo: true,
      },
    })

    if (usuario) {
      // Es admin/gestor/consultor — login sin contraseña
      const accessToken = generateAccessToken({
        userId: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
      })

      // Actualizar último acceso
      await db.usuario.update({
        where: { id: usuario.id },
        data: {
          ultimoAcceso: new Date(),
        },
      })

      await db.accesoPortal.create({
        data: {
          clienteCedula: cedulaLimpia,
          clienteNombre: usuario.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'LOGIN_CEDULA',
          exito: true,
          detalle: `Login admin/gestor: ${usuario.rol} (solo cédula, sin contraseña)`,
        },
      })

      return NextResponse.json({
        success: true,
        tipo: 'USUARIO',
        token: accessToken,
        accessToken,
        usuarioId: usuario.id,
        clienteId: usuario.id, // para compatibilidad con el frontend
        nombre: usuario.nombre,
        rol: usuario.rol,
      })
    }

    // === Verificar si la cédula está bloqueada ===
    const bloqueo = await db.variableGlobal.findUnique({
      where: { clave: `BLOQUEO_${cedulaLimpia}` },
    })
    if (bloqueo) {
      return NextResponse.json(
        { success: false, error: 'Tu acceso ha sido bloqueado. Contacta al asesor.', codigo: 'BLOQUEADO' },
        { status: 403 }
      )
    }

    // === 2. Buscar en tabla Cliente ===
    const cliente = await db.cliente.findUnique({ where: { cedula: cedulaLimpia } })

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tu cédula no está registrada. Si eres nuevo, regístrate primero.',
          codigo: 'NO_REGISTRADO',
        },
        { status: 404 }
      )
    }

    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cuenta inactiva. Contacta al asesor.', codigo: 'CUENTA_INACTIVA' },
        { status: 403 }
      )
    }

    // Generar token de sesión del portal (2h)
    const token = generateToken(32)
    const tokenExpira = new Date(Date.now() + 2 * 60 * 60 * 1000)

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
        accion: 'LOGIN_CEDULA',
        exito: true,
        detalle: 'Sesión iniciada con cédula (sin PIN)',
      },
    })

    return NextResponse.json({
      success: true,
      tipo: 'CLIENTE',
      token,
      clienteId: cliente.id,
      nombre: cliente.nombre,
      requiereActualizacion: !cliente.datosActualizadosOct2026,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
