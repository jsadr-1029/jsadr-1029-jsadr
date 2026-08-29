import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Obtiene solicitudes del cliente autenticado
export async function GET(req: NextRequest) {
  // Token solo desde header (no en URL para evitar filtración en logs)
  const token = req.headers.get('x-portal-token')

  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  const cliente = await db.cliente.findFirst({
    where: { tokenSesion: token as string },
  })
  if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
    return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
  }

  const prestamos = await db.prestamo.findMany({
    where: { clienteId: cliente.id },
    include: {
      categoria: true,
      pagos: { orderBy: { fechaPago: 'desc' }, take: 5 },
      firmas: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      email: cliente.email,
    },
    prestamos: prestamos.map((p) => ({
      ...p,
      montoPrincipal: Number(p.montoPrincipal),
      montoCuota: Number(p.montoCuota),
      totalInteres: Number(p.totalInteres),
      totalPagar: Number(p.totalPagar),
      saldoCapital: Number(p.saldoCapital),
      saldoInteres: Number(p.saldoInteres),
      saldoTotal: Number(p.saldoTotal),
      montoPagado: Number(p.montoPagado),
      montoMora: Number(p.montoMora),
      fondoGarantiaMonto: Number(p.fondoGarantiaMonto),
      pagos: p.pagos.map((pa) => ({
        ...pa,
        montoTotal: Number(pa.montoTotal),
      })),
    })),
  })
}
