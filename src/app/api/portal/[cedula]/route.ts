import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// GET - portal de consulta por cédula
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cedula: string }> }
) {
  try {
    const { cedula } = await params

    const cliente = await db.cliente.findUnique({
      where: { cedula },
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

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'No se encontró ningún cliente con esa cédula' },
        { status: 404 }
      )
    }

    // Para cada préstamo activo, preparar la información de cuenta de recaudo
    // donde el cliente debe pagar
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

    // Resumen
    const prestamosActivos = prestamosConCuenta.filter(
      (p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION'
    )
    const prestamosCancelados = prestamosConCuenta.filter((p) => p.estado === 'CANCELADO')
    const prestamosJuridico = prestamosConCuenta.filter((p) => p.estado === 'JURIDICO')

    const saldoTotalActivos = prestamosActivos.reduce((s, p) => s + p.saldoTotal, 0)
    const totalPagado = prestamosConCuenta.reduce((s, p) => s + p.montoPagado, 0)

    // Cuenta de recaudo principal (la de la categoría del cliente)
    const cuentaPrincipal = cliente.categoria?.cuentaRecaudo || null

    // Campañas activas
    const campanas = await db.campaña.findMany({
      where: { activa: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      success: true,
      data: {
        cliente,
        resumen: {
          totalPrestamos: prestamosConCuenta.length,
          prestamosActivos: prestamosActivos.length,
          prestamosCancelados: prestamosCancelados.length,
          prestamosJuridico: prestamosJuridico.length,
          saldoTotalActivos,
          totalPagado,
        },
        prestamos: prestamosConCuenta,
        campanas,
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
