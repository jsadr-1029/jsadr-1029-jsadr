// =====================================================
// /api/juridico/portal/casos — Casos jurídicos del abogado/gestor logueado
//   GET → lista los casos jurídicos asignados al abogado
//   Header: x-juridico-token: <token>
//   Query:  ?token=xxx (alternativa al header)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { verificarTokenPortal } from '../auth/route'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const headerToken = req.headers.get('x-juridico-token')
    const token = headerToken || searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido' },
        { status: 401 }
      )
    }

    const usuario = await verificarTokenPortal(token)
    if (!usuario) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.',
        },
        { status: 401 }
      )
    }

    // Casos asignados al abogado:
    // - abogadoEmail contiene la cédula del abogado, o
    // - abogadoNombre contiene el nombre del usuario
    // (heurística usada en el módulo jurídico del sistema)
    const condiciones: Record<string, unknown>[] = []

    if (usuario.cedula) {
      condiciones.push({ abogadoEmail: { contains: usuario.cedula } })
    }
    condiciones.push({ abogadoNombre: { contains: usuario.nombre } })

    // Si es GESTOR, también puede ver todos los casos no cerrados
    const where =
      usuario.rol === 'GESTOR'
        ? { estado: { not: 'CERRADO' } }
        : { OR: condiciones }

    const casos = await db.casoJuridico.findMany({
      where: where as never,
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
          take: 30,
        },
        alertas: {
          where: { atendida: false },
          orderBy: { fechaAlerta: 'asc' },
        },
        documentos: {
          orderBy: { fechaSubida: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Resumen agregado
    const total = casos.length
    const porEstado = casos.reduce<Record<string, number>>((acc, c) => {
      acc[c.estado] = (acc[c.estado] || 0) + 1
      return acc
    }, {})
    const honorariosTotal = casos.reduce(
      (sum, c) => sum + (c.honorarios || 0),
      0
    )
    const honorariosPagados = casos.reduce(
      (sum, c) => sum + (c.honorariosPagados || 0),
      0
    )
    const valorReclamadoTotal = casos.reduce(
      (sum, c) => sum + (c.valorReclamado || 0),
      0
    )

    // v4.11 (QA M08 TC-JUR-015): registrar consulta en AuditLog
    const clientInfo = getClientInfo(req)
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'CONSULTA_CASOS_JURIDICOS',
        modulo: 'juridico',
        entidadNombre: usuario.cedula || usuario.username,
        detalles: `Listado de casos jurídicos asignados (${total} casos, rol ${usuario.rol})`,
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
        casos,
        resumen: {
          total,
          porEstado,
          honorariosTotal,
          honorariosPagados,
          honorariosPendientes: honorariosTotal - honorariosPagados,
          valorReclamadoTotal,
        },
        abogado: {
          id: usuario.id,
          nombre: usuario.nombre,
          username: usuario.username,
          rol: usuario.rol,
          cedula: usuario.cedula,
        },
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
