import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import crypto from 'crypto'

// GET /api/portal/webauthn/sesiones
// Lista los dispositivos y sesiones activas del cliente
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    // Hash del token actual para identificar la sesión actual
    const tokenHashActual = crypto.createHash('sha256').update(token).digest('hex')

    const sesiones = await db.dispositivoSesion.findMany({
      where: { clienteId: cliente.id, activa: true },
      select: {
        id: true,
        plataforma: true,
        navegador: true,
        ipUltimoAcceso: true,
        fechaRegistro: true,
        ultimoAcceso: true,
        expira: true,
        metodoAuth: true,
        tokenHash: true,
      },
      orderBy: { ultimoAcceso: 'desc' },
    })

    // Marcar la sesión actual
    const data = sesiones.map((s) => ({
      id: s.id,
      plataforma: s.plataforma || 'Desconocido',
      navegador: s.navegador || 'Desconocido',
      ipUltimoAcceso: s.ipUltimoAcceso,
      fechaRegistro: s.fechaRegistro,
      ultimoAcceso: s.ultimoAcceso,
      expira: s.expira,
      metodoAuth: s.metodoAuth,
      esActual: s.tokenHash === tokenHashActual,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// DELETE /api/portal/webauthn/sesiones?id=<sessionId>
// Revoca una sesión específica (o todas si no se especifica id)
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('id')
    const tokenHashActual = crypto.createHash('sha256').update(token).digest('hex')

    if (sessionId) {
      // Revocar una sesión específica
      const sesion = await db.dispositivoSesion.findFirst({
        where: { id: sessionId, clienteId: cliente.id },
      })
      if (!sesion) {
        return NextResponse.json(
          { success: false, error: 'Sesión no encontrada' },
          { status: 404 }
        )
      }
      if (sesion.tokenHash === tokenHashActual) {
        return NextResponse.json(
          { success: false, error: 'No puedes revocar la sesión que estás usando actualmente. Usa "Cerrar sesión" en su lugar.' },
          { status: 400 }
        )
      }

      await db.dispositivoSesion.update({
        where: { id: sessionId },
        data: { activa: false, revokedAt: new Date() },
      })

      // Invalidar el tokenSesion del cliente si coincide
      // (buscamos por el hash, no podemos revertir el hash)

      await db.securityEvent.create({
        data: {
          clienteId: cliente.id,
          tipo: 'SESION_REVOCADA',
          descripcion: 'Sesión revocada por el usuario',
          severidad: 'INFO',
        },
      })

      return NextResponse.json({
        success: true,
        mensaje: 'Sesión revocada correctamente',
      })
    } else {
      // "Cerrar sesión en todos los dispositivos" (excepto el actual)
      await db.dispositivoSesion.updateMany({
        where: {
          clienteId: cliente.id,
          activa: true,
          tokenHash: { not: tokenHashActual },
        },
        data: { activa: false, revokedAt: new Date() },
      })

      await db.securityEvent.create({
        data: {
          clienteId: cliente.id,
          tipo: 'SESION_REVOCADA',
          descripcion: 'Sesiones cerradas en todos los demás dispositivos',
          severidad: 'WARN',
        },
      })

      return NextResponse.json({
        success: true,
        mensaje: 'Se cerraron las sesiones en todos los demás dispositivos',
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
