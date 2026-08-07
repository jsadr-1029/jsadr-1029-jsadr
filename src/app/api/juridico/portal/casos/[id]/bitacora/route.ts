// =====================================================
// /api/juridico/portal/casos/[id]/bitacora
// v4.11 (QA M08 TC-JUR-012)
// =====================================================
//   GET → ver bitácora (cronología) del caso jurídico
//
// Autenticación:
//   - Token en header `x-juridico-token` o query `?token=`
//   - valida tokenExpira > now
//
// Autorización:
//   - ABOGADO: solo si el caso está asignado a él.
//   - GESTOR: cualquier caso.
//
// Respuesta:
//   HTTP 200 + movimientos ordenados por fecha (asc o desc).
//   Query ?order=asc|desc (default desc).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { verificarTokenPortal } from '../../../auth/route'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: casoId } = await params

    // === Token ===
    const headerToken = req.headers.get('x-juridico-token')
    const queryToken = new URL(req.url).searchParams.get('token')
    const token = headerToken || queryToken

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido' },
        { status: 401 }
      )
    }

    const usuario = await verificarTokenPortal(token)
    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' },
        { status: 401 }
      )
    }

    // === Orden (default: desc = más recientes primero) ===
    const order = new URL(req.url).searchParams.get('order') === 'asc' ? 'asc' : 'desc'

    // === Buscar el caso (con validación de asignación) ===
    const caso = await db.casoJuridico.findUnique({
      where: { id: casoId },
      select: {
        id: true,
        abogadoEmail: true,
        abogadoNombre: true,
        prestamo: { select: { codigo: true } },
        cronologias: {
          orderBy: { fecha: order },
        },
      },
    })

    if (!caso) {
      return NextResponse.json(
        { success: false, error: 'Caso no encontrado' },
        { status: 404 }
      )
    }

    // === Validar asignación ===
    if (usuario.rol === 'ABOGADO') {
      const esAsignado =
        (usuario.cedula && caso.abogadoEmail?.includes(usuario.cedula)) ||
        caso.abogadoNombre?.includes(usuario.nombre)
      if (!esAsignado) {
        return NextResponse.json(
          {
            success: false,
            error: 'No autorizado. Este caso no está asignado a tu usuario.',
            codigo: 'CASO_AJENO',
          },
          { status: 403 }
        )
      }
    }

    // === Auditoría ===
    const clientInfo = getClientInfo(req)
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'CONSULTA_BITACORA_CASO',
        modulo: 'juridico',
        entidadId: caso.id,
        entidadNombre: `Bitácora del caso ${caso.id}`,
        detalles: JSON.stringify({
          casoId,
          totalMovimientos: caso.cronologias.length,
          order,
          prestamoCodigo: caso.prestamo?.codigo,
        }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch {
      // no bloquear
    }

    return NextResponse.json({
      success: true,
      data: {
        casoId: caso.id,
        total: caso.cronologias.length,
        movimientos: caso.cronologias,
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
