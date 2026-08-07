// =====================================================
// /api/juridico/portal/casos/[id] — Detalle de un caso jurídico
// v4.11 (QA M08 TC-JUR-008 + TC-JUR-010)
// =====================================================
//   GET → detalle completo del caso (con cronología, documentos, alertas)
//
// Autenticación:
//   - Token en header `x-juridico-token` o query `?token=`
//   - valida tokenExpira > now
//
// Autorización (TC-JUR-010):
//   - ABOGADO: solo puede ver casos asignados a él (abogadoEmail contains
//     cedula O abogadoNombre contains nombre). Si no → HTTP 403.
//   - GESTOR: puede ver cualquier caso (bypass).
//
// Trazabilidad:
//   - Registra CONSULTA_CASO en AuditLog con usuarioId, ip, userAgent.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { verificarTokenPortal } from '../../auth/route'
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

    // === Buscar el caso ===
    const caso = await db.casoJuridico.findUnique({
      where: { id: casoId },
      include: {
        prestamo: {
          select: {
            id: true,
            codigo: true,
            montoPrincipal: true,
            saldoTotal: true,
            diasMora: true,
            montoMora: true,
            montoPagado: true,
            cuotasPagadas: true,
            numeroCuotas: true,
            estado: true,
            fechaVencimiento: true,
            cliente: {
              select: {
                id: true,
                nombre: true,
                cedula: true,
                telefono: true,
                email: true,
                direccion: true,
                ciudad: true,
              },
            },
          },
        },
        cronologias: {
          orderBy: { fecha: 'desc' },
        },
        documentos: {
          orderBy: { fechaSubida: 'desc' },
        },
        alertas: {
          where: { atendida: false },
          orderBy: { fechaAlerta: 'asc' },
        },
      },
    })

    if (!caso) {
      return NextResponse.json(
        { success: false, error: 'Caso no encontrado' },
        { status: 404 }
      )
    }

    // === TC-JUR-010: Validar asignación del caso al abogado ===
    // GESTOR bypass; ABOGADO debe ser el asignado.
    if (usuario.rol === 'ABOGADO') {
      const esAsignado =
        (usuario.cedula && caso.abogadoEmail?.includes(usuario.cedula)) ||
        caso.abogadoNombre?.includes(usuario.nombre)

      if (!esAsignado) {
        // Auditoría del intento de acceso no autorizado
        const clientInfo = getClientInfo(req)
        try {
          await registrarAuditLog({
            usuarioId: usuario.id,
            usuarioNombre: usuario.nombre,
            accion: 'ACCESO_CASO_AJENO_BLOQUEADO',
            modulo: 'juridico',
            entidadId: caso.id,
            entidadNombre: `Caso ${caso.id}`,
            detalles: `Abogado ${usuario.cedula || usuario.nombre} intentó ver caso ajeno`,
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            exito: false,
          })
        } catch {
          // no bloquear
        }

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

    // === Auditoría: registro de consulta ===
    const clientInfo = getClientInfo(req)
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'CONSULTA_CASO_JURIDICO',
        modulo: 'juridico',
        entidadId: caso.id,
        entidadNombre: `Caso ${caso.id}`,
        detalles: `Consulta de detalle del caso jurídico (rol ${usuario.rol})`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch {
      // no bloquear
    }

    return NextResponse.json({
      success: true,
      data: caso,
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
