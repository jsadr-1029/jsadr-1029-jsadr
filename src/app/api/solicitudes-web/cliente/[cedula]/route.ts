// =====================================================
// /api/solicitudes-web/cliente/[cedula] — Solicitudes por cliente v3.0
// =====================================================
// GET -> lista las solicitudes web de un cliente específico
//        valida el token del portal mediante query ?token=...
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, logError } from '@/lib/error-handler'
import { safeCompare } from '@/lib/security'
import { getPortalClientInfo } from '@/lib/acceso-portal'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cedula: string }> }
) {
  try {
    const { cedula } = await params
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || ''

    if (!cedula) {
      return NextResponse.json(
        { success: false, error: 'Cédula requerida', code: 'CEDULA_REQUIRED' },
        { status: 400 }
      )
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido', code: 'TOKEN_REQUIRED' },
        { status: 400 }
      )
    }

    // Buscar cliente por cédula
    const cliente = await db.cliente.findUnique({
      where: { cedula },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        activo: true,
        tokenSesion: true,
        tokenExpira: true,
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cliente inactivo', code: 'CLIENTE_INACTIVO' },
        { status: 403 }
      )
    }

    // Validar token del portal
    // Reforzado: comparación constante-time para prevenir timing attacks
    const now = new Date()
    const tokenValido =
      !!cliente.tokenSesion &&
      !!token &&
      safeCompare(cliente.tokenSesion, token) &&
      !!cliente.tokenExpira &&
      cliente.tokenExpira > now

    if (!tokenValido) {
      const clientInfo = getPortalClientInfo(req)
      try {
        await db.auditLog.create({
          data: {
            usuarioId: null,
            usuarioNombre: `Portal: ${cliente.nombre}`,
            accion: 'CONSULTA',
            modulo: 'solicitudes-web',
            entidadId: cliente.id,
            entidadNombre: cliente.nombre,
            detalles: JSON.stringify({
              error: 'Token inválido o expirado al consultar solicitudes',
              cedula,
            }),
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            exito: false,
            errorMessage: 'Token inválido o expirado',
          },
        })
      } catch (e) {
        console.error('[solicitudes-web/cliente] Audit log error:', e)
      }

      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada', code: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // Listar solicitudes del cliente
    const solicitudes = await db.solicitudWeb.findMany({
      where: { clienteId: cliente.id },
      orderBy: { fechaCreacion: 'desc' },
      select: {
        id: true,
        codigo: true,
        valorSolicitado: true,
        numeroCuotas: true,
        frecuencia: true,
        tasaUtilizada: true,
        tasaOrigen: true,
        cuotaEstimada: true,
        totalIntereses: true,
        totalPagar: true,
        primerPagoFecha: true,
        estado: true,
        observaciones: true,
        fechaCreacion: true,
        fechaRevision: true,
        fechaConversion: true,
        prestamoCreadoId: true,
        // === Campos nuevos: flujo de firma + flexibilidad ===
        estadoFlujoFirma: true,
        flexibilidadFinanciera: true,
        flexibilidadModalidad: true,
        flexibilidadCosto: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          cedula: cliente.cedula,
        },
        solicitudes,
        total: solicitudes.length,
      },
    })
  } catch (error) {
    logError('/api/solicitudes-web/cliente/[cedula] GET', error)
    return errorResponse('/api/solicitudes-web/cliente/[cedula] GET', error)
  }
}
