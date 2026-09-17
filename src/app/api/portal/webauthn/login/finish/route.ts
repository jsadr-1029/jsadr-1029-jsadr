import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verificarAutenticacion, detectarPlataforma } from '@/lib/webauthn'
import { sanitizeError } from '@/lib/error-handler'
import crypto from 'crypto'

// POST /api/portal/webauthn/login/finish
// Completa la autenticación biométrica y crea una sesión
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { response, clienteId: clienteIdHint } = body

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'Respuesta del autenticador requerida' },
        { status: 400 }
      )
    }

    const userAgent = req.headers.get('user-agent')
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Verificar la autenticación
    const resultado = await verificarAutenticacion(response, clienteIdHint, userAgent)
    const cliente = resultado.cliente

    // Crear sesión (token opaco de 32 bytes, 8h de expiración)
    const tokenSesion = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 horas

    // Actualizar el cliente con el nuevo token
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion,
        tokenExpira: expira,
        ultimoAccesoPortal: new Date(),
        claveIntentos: 0,
        claveBloqueadoHasta: null,
      },
    })

    // Registrar el dispositivo/sesión
    const plataforma = detectarPlataforma(userAgent)
    const tokenHash = crypto.createHash('sha256').update(tokenSesion).digest('hex')

    // Detectar si es un dispositivo nuevo (no hay sesiones previas de este dispositivo)
    const sesionesPrevias = await db.dispositivoSesion.count({
      where: { clienteId: cliente.id, activa: true },
    })

    await db.dispositivoSesion.create({
      data: {
        clienteId: cliente.id,
        tokenHash,
        plataforma,
        navegador: userAgent?.substring(0, 100) || null,
        ipRegistro: ip,
        ipUltimoAcceso: ip,
        expira,
        metodoAuth: 'PASSKEY',
      },
    })

    // Registrar evento de seguridad
    await db.securityEvent.create({
      data: {
        clienteId: cliente.id,
        tipo: 'LOGIN_PASSKEY',
        descripcion: `Inicio de sesión biométrico exitoso (${plataforma})`,
        ip,
        userAgent: userAgent?.substring(0, 200) || null,
        dispositivo: plataforma,
        severidad: 'INFO',
      },
    })

    // Si es un dispositivo nuevo, marcar como CRITICAL y notificar
    if (sesionesPrevias === 0) {
      await db.securityEvent.create({
        data: {
          clienteId: cliente.id,
          tipo: 'NUEVO_DISPOSITIVO',
          descripcion: `Primer acceso desde un nuevo dispositivo (${plataforma})`,
          ip,
          userAgent: userAgent?.substring(0, 200) || null,
          dispositivo: plataforma,
          severidad: 'WARN',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        token: tokenSesion,
        clienteId: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
      },
      mensaje: 'Autenticación biométrica exitosa',
    })
  } catch (error: any) {
    console.error('[webauthn/login/finish] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
