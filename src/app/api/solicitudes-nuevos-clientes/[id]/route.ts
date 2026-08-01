// =====================================================
// /api/solicitudes-nuevos-clientes/[id] — Operaciones por ID
// PATCH: cambiar estado (aprobar/rechazar/convertir)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const solicitud = await db.solicitudNuevoCliente.findUnique({ where: { id } })
    if (!solicitud) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, data: solicitud })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const body = await req.json()
    const { accion, observaciones } = body
    const clientInfo = getClientInfo(req)

    const solicitud = await db.solicitudNuevoCliente.findUnique({ where: { id } })
    if (!solicitud) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })

    let nuevoEstado = solicitud.estado
    let mensaje = ''

    if (accion === 'aprobar') { nuevoEstado = 'APROBADA'; mensaje = 'Solicitud aprobada' }
    else if (accion === 'rechazar') { nuevoEstado = 'RECHAZADA'; mensaje = 'Solicitud rechazada' }
    else if (accion === 'convertir') { nuevoEstado = 'CONVERTIDA'; mensaje = 'Solicitud convertida a cliente' }
    else if (accion === 'revisar') { nuevoEstado = 'REVISADA'; mensaje = 'Solicitud revisada' }

    const actualizada = await db.solicitudNuevoCliente.update({
      where: { id },
      data: { estado: nuevoEstado, observaciones: observaciones || solicitud.observaciones },
    })

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'SOLICITUD_NUEVO_CLIENTE',
      modulo: 'solicitudes-nuevos-clientes',
      entidadId: id,
      entidadNombre: `${solicitud.nombre} ${solicitud.apellido} - ${solicitud.codigo}`,
      detalles: mensaje,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({ success: true, data: actualizada, mensaje })
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
