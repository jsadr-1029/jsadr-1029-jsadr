// =====================================================
// /api/clientes/[id]/marcar-prueba
// =====================================================
// Marca o desmarca un cliente como cliente de prueba.
// Los clientes de prueba pueden hacer todo el proceso (simular, solicitar,
// firmar, pagar, etc.) pero sus cifras NO se contabilizan en los saldos
// reales del sistema (dashboard, reportes, cartera, balance, morosidad,
// mensual-informe, etc.).
//
// PUT /api/clientes/[id]/marcar-prueba
//   Body: { esPrueba: boolean, motivo?: string }
//   RBAC: solo ADMIN
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import {
  marcarComoPrueba,
  desmarcarComoPrueba,
  esClientePruebaPorCedula,
  invalidarCacheCliente,
  CEDULAS_PRUEBA_HARDCODED,
} from '@/lib/cliente-prueba'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { esPrueba, motivo } = body

    if (typeof esPrueba !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Campo "esPrueba" (boolean) es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el cliente existe
    const cliente = await db.cliente.findUnique({
      where: { id },
      select: { id: true, cedula: true, nombre: true, esPrueba: true },
    })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // === Caso 1: marcar como prueba ===
    if (esPrueba) {
      await marcarComoPrueba(id, user?.id, motivo || 'Marcado desde panel de administración')
      invalidarCacheCliente(id)

      const actualizado = await db.cliente.findUnique({
        where: { id },
        select: { id: true, nombre: true, cedula: true, esPrueba: true, fechaMarcadoPrueba: true, motivoPrueba: true },
      })

      return NextResponse.json({
        success: true,
        message: `Cliente "${cliente.nombre}" marcado como cliente de prueba. Sus préstamos y pagos ya no se contabilizan en los saldos reales del sistema.`,
        data: actualizado,
      })
    }

    // === Caso 2: desmarcar como prueba ===
    // Si la cédula está en la lista hardcodeada, no se puede desmarcar
    if (esClientePruebaPorCedula(cliente.cedula)) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede desmarcar como prueba: la cédula ${cliente.cedula} está en la lista hardcodeada del sistema (cliente canónico de QA).`,
          codigo: 'CEDULA_HARDCODEADA',
          cedulasHardcodeadas: CEDULAS_PRUEBA_HARDCODED,
        },
        { status: 400 }
      )
    }

    await desmarcarComoPrueba(id)
    invalidarCacheCliente(id)

    const actualizado = await db.cliente.findUnique({
      where: { id },
      select: { id: true, nombre: true, cedula: true, esPrueba: true, fechaMarcadoPrueba: true, motivoPrueba: true },
    })

    return NextResponse.json({
      success: true,
      message: `Cliente "${cliente.nombre}" desmarcado como cliente de prueba. Sus préstamos y pagos vuelven a contabilizarse en los saldos reales del sistema.`,
      data: actualizado,
    })
  } catch (error) {
    logError('/api/clientes/[id]/marcar-prueba PUT', error)
    return errorResponse('/api/clientes/[id]/marcar-prueba PUT', error)
  }
}

// GET — verifica si un cliente es de prueba
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const cliente = await db.cliente.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        esPrueba: true,
        fechaMarcadoPrueba: true,
        motivoPrueba: true,
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...cliente,
        hardcodeado: esClientePruebaPorCedula(cliente.cedula),
      },
    })
  } catch (error) {
    logError('/api/clientes/[id]/marcar-prueba GET', error)
    return errorResponse('/api/clientes/[id]/marcar-prueba GET', error)
  }
}
