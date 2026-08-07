import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// /api/cajas/[id]/movimientos v4.7 — QA M04 TC-PAG-015
// -----------------------------------------------------
// GET  - listar movimientos de una caja (paginado)
// POST - crear movimiento de caja (INGRESO/EGRESO)
//
// v4.7 (QA M04 TC-PAG-015): se añadieron las siguientes validaciones:
//   1. Auth requireRole ADMIN/GESTOR (antes no había auth — crítico de seguridad)
//   2. Validación monto > 0 (MONTO_INVALIDO)
//   3. Validación tipo INGRESO|EGRESO (TIPO_INVALIDO)
//   4. Validación concepto no vacío (CONCEPTO_REQUERIDO)
//   5. Audit log de cada movimiento creado
// =====================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: cualquier rol autenticado puede consultar
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const [total, movimientos] = await Promise.all([
    db.movimientoCaja.count({ where: { cajaId: id } }),
    db.movimientoCaja.findMany({
      where: { cajaId: id },
      include: { prestamo: { include: { cliente: true } } },
      orderBy: { fechaMovimiento: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    movimientos: movimientos.map((m) => ({
      ...m,
      monto: Number(m.monto),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // === v4.7 (QA M04 TC-PAG-015): auth requireRole ADMIN/GESTOR ===
  // Antes: cualquier usuario (incluso sin token) podía crear movimientos de caja.
  // Esto permitía manipular saldos de caja sin autorización.
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult as any

  const { id } = await params
  try {
    const body = await req.json()
    const { tipo, monto, concepto, referencia, prestamoId } = body
    const montoNum = Number(monto)

    // === v4.7 (QA M04 TC-PAG-015): validación monto > 0 ===
    if (isNaN(montoNum) || montoNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Monto debe ser mayor a 0. Recibido: ${monto}`,
          codigo: 'MONTO_INVALIDO',
        },
        { status: 400 }
      )
    }

    // === v4.7 (QA M04 TC-PAG-015): validación tipo INGRESO|EGRESO ===
    const tipoNormalizado = (tipo || 'INGRESO').toUpperCase()
    if (tipoNormalizado !== 'INGRESO' && tipoNormalizado !== 'EGRESO') {
      return NextResponse.json(
        {
          success: false,
          error: `Tipo debe ser INGRESO o EGRESO. Recibido: ${tipo}`,
          codigo: 'TIPO_INVALIDO',
        },
        { status: 400 }
      )
    }

    // === v4.7 (QA M04 TC-PAG-015): validación concepto requerido ===
    if (!concepto || String(concepto).trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'El concepto del movimiento es obligatorio',
          codigo: 'CONCEPTO_REQUERIDO',
        },
        { status: 400 }
      )
    }

    const caja = await db.cajaMenor.findUnique({ where: { id } })
    if (!caja) return NextResponse.json({ success: false, error: 'Caja no encontrada' }, { status: 404 })

    // === Transacción atómica: movimiento + actualización de saldo ===
    const movimiento = await db.$transaction(async (tx) => {
      const mov = await tx.movimientoCaja.create({
        data: {
          cajaId: id,
          tipo: tipoNormalizado,
          monto: montoNum,
          concepto,
          referencia: referencia || null,
          prestamoId: prestamoId || null,
          fechaMovimiento: new Date(),
          creadoPor: user?.nombre || 'Sistema',
          usuarioId: user?.id || null,
        },
      })

      // Actualizar saldo de la caja
      if (tipoNormalizado === 'EGRESO') {
        await tx.cajaMenor.update({
          where: { id },
          data: {
            saldoActual: { decrement: montoNum },
            totalEgresos: { increment: montoNum },
          },
        })
      } else {
        await tx.cajaMenor.update({
          where: { id },
          data: {
            saldoActual: { increment: montoNum },
            totalIngresos: { increment: montoNum },
          },
        })
      }

      return mov
    })

    // === Audit log v4.7 ===
    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: user?.id,
      usuarioNombre: user?.nombre || 'Sistema',
      accion: 'CAJA_MOVIMIENTO_CREADO',
      modulo: 'cajas',
      entidadId: movimiento.id,
      entidadNombre: `Caja ${caja.codigo} - ${tipoNormalizado} ${montoNum}`,
      detalles: JSON.stringify({
        cajaId: id,
        cajaCodigo: caja.codigo,
        tipo: tipoNormalizado,
        monto: montoNum,
        concepto,
        referencia: referencia || null,
        prestamoId: prestamoId || null,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json(
      { success: true, data: { ...movimiento, monto: Number(movimiento.monto) } },
      { status: 201 }
    )
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
