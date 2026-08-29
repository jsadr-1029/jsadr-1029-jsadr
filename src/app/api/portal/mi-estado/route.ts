// =====================================================
// GET /api/portal/mi-estado
// v4.10 (QA M07 TC-PORT-012)
// =====================================================
// Devuelve el estado de cuenta del cliente autenticado:
//   - Datos básicos del cliente
//   - Solicitudes activos/cancelados/jurídicos
//   - Saldos totales
//   - Próximos vencimientos (cuotas pendientes)
//
// Autenticación:
//   - Token en header `x-portal-token` (preferido) o en query `?token=`
//   - El cliente se identifica por `tokenSesion` en BD.
//   - Se valida `tokenExpira > now`.
//   - **No se acepta clienteId arbitrario**: solo se devuelven los datos
//     del cliente cuyo token coincida.
//
// Respuesta:
//   HTTP 200: { success, data: { cliente, resumen, prestamos, proximosVencimientos } }
//   HTTP 401: { error: 'Token requerido' | 'Sesión expirada' }
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    // Token desde header (preferido) o query string
    const token =
      req.headers.get('x-portal-token') ||
      new URL(req.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido', codigo: 'TOKEN_REQUERIDO' },
        { status: 401 }
      )
    }

    // Buscar cliente por tokenSesion (no por clienteId arbitrario)
    // Esto garantiza que solo se devuelvan datos del cliente autenticado.
    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token as string },
      include: {
        categoria: {
          include: { cuentaRecaudo: true },
        },
        prestamos: {
          include: {
            categoria: { include: { cuentaRecaudo: true } },
            pagos: {
              orderBy: { numeroCuota: 'asc' },
              include: { cuentaRecaudo: true },
            },
            casoJuridico: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada', codigo: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // === Procesar solicitudes y calcular resumen ===
    const prestamosConCuenta = cliente.prestamos.map((p) => {
      const cuentaRecaudo = p.categoria?.cuentaRecaudo || cliente.categoria?.cuentaRecaudo || null
      return {
        ...p,
        cuentaRecaudoPago: cuentaRecaudo
          ? {
              banco: cuentaRecaudo.banco,
              tipoCuenta: cuentaRecaudo.tipoCuenta,
              numeroCuenta: cuentaRecaudo.numeroCuenta,
              titular: cuentaRecaudo.titular,
              nombreCuenta: cuentaRecaudo.nombre,
            }
          : null,
      }
    })

    const prestamosActivos = prestamosConCuenta.filter(
      (p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION'
    )
    const prestamosCancelados = prestamosConCuenta.filter((p) => p.estado === 'CANCELADO')
    const prestamosJuridico = prestamosConCuenta.filter((p) => p.estado === 'JURIDICO')

    const saldoTotalActivos = prestamosActivos.reduce((s, p) => s + p.saldoTotal, 0)
    const totalPagado = prestamosConCuenta.reduce((s, p) => s + p.montoPagado, 0)

    // === Próximos vencimientos: cuotas pendientes no pagadas ===
    // Tomamos la próxima cuota pendiente de cada solicitud activo.
    const proximosVencimientos: Array<{
      prestamoId: string
      prestamoCodigo: string
      numeroCuota: number
      fechaVencimiento: string
      montoCuota: number
      diasMora: number
    }> = []

    const now = new Date()
    for (const p of prestamosActivos) {
      const pagos = p.pagos || []
      // Buscar la primera cuota no pagada (estado != 'PAGADO')
      const cuotaPendiente = pagos.find((pg) => pg.estado !== 'PAGADO' && pg.estado !== 'ANULADO')
      if (cuotaPendiente && cuotaPendiente.fechaVencimiento) {
        const diasMora = Math.floor(
          (now.getTime() - new Date(cuotaPendiente.fechaVencimiento).getTime()) /
            (24 * 60 * 60 * 1000)
        )
        proximosVencimientos.push({
          prestamoId: p.id,
          prestamoCodigo: p.codigo,
          numeroCuota: cuotaPendiente.numeroCuota,
          fechaVencimiento: new Date(cuotaPendiente.fechaVencimiento).toISOString(),
          montoCuota: Number(cuotaPendiente.montoTotal),
          diasMora: diasMora > 0 ? diasMora : 0,
        })
      }
    }

    // Ordenar por fecha de vencimiento ascendente
    proximosVencimientos.sort(
      (a, b) =>
        new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime()
    )

    // === Cuenta de recaudo principal ===
    const cuentaPrincipal = cliente.categoria?.cuentaRecaudo || null

    // === Bitácora de acceso (auditoría) ===
    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
        accion: 'CONSULTA_ESTADO',
        exito: true,
        detalle: `Cliente consultó su estado de cuenta (${prestamosActivos.length} solicitudes activos)`,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          email: cliente.email,
          activo: cliente.activo,
        },
        resumen: {
          totalPrestamos: prestamosConCuenta.length,
          prestamosActivos: prestamosActivos.length,
          prestamosCancelados: prestamosCancelados.length,
          prestamosJuridico: prestamosJuridico.length,
          saldoTotalActivos,
          totalPagado,
        },
        prestamos: prestamosConCuenta.map((p) => ({
          ...p,
          montoPrincipal: Number(p.montoPrincipal),
          montoCuota: Number(p.montoCuota),
          totalInteres: Number(p.totalInteres),
          saldoTotal: Number(p.saldoTotal),
          montoPagado: Number(p.montoPagado),
        })),
        proximosVencimientos,
        cuentaRecaudoPrincipal: cuentaPrincipal
          ? {
              banco: cuentaPrincipal.banco,
              tipoCuenta: cuentaPrincipal.tipoCuenta,
              numeroCuenta: cuentaPrincipal.numeroCuenta,
              titular: cuentaPrincipal.titular,
              nombreCuenta: cuentaPrincipal.nombre,
            }
          : null,
      },
    })
  } catch (e) {
    console.error('[portal/mi-estado] error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message, codigo: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
