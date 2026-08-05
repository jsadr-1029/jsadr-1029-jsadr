import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/portal/cuenta-pago
 * Devuelve la cuenta de recaudo asignada al cliente (con su QR) para que pueda
 * escanear el código al momento de realizar pagos.
 *
 * Query params:
 *   - token: token de sesión del portal cliente (también se acepta en header x-portal-token)
 *
 * Lógica de resolución de la cuenta:
 *   1. Si el cliente tiene cuentaRecaudoId directo → usar esa cuenta.
 *   2. Si no, pero el cliente tiene categoriaId y la categoría tiene cuentaRecaudoId → usar esa.
 *   3. Si no, devolver la primera cuenta activa como fallback.
 *
 * Respuesta:
 *   {
 *     cuenta: {
 *       codigo, nombre, banco, tipoCuenta, numeroCuenta, titular,
 *       qrImagen: string | null  // data URL de la imagen QR
 *     }
 *   }
 */
export async function GET(req: NextRequest) {
  // Token desde header (preferido) o desde query string (compatibilidad)
  const token = req.headers.get('x-portal-token') || new URL(req.url).searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
  }

  const cliente = await db.cliente.findFirst({
    where: { tokenSesion: token as string },
    include: {
      categoria: { include: { cuentaRecaudo: true } },
      cuentaRecaudo: true,
    },
  })

  if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
    return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
  }

  // === Resolver la cuenta de recaudo del cliente ===
  let cuenta = cliente.cuentaRecaudo
  if (!cuenta && cliente.categoria?.cuentaRecaudo) {
    cuenta = cliente.categoria.cuentaRecaudo
  }
  if (!cuenta) {
    // Fallback: primera cuenta activa
    cuenta = await db.cuentaRecaudo.findFirst({ where: { activa: true } })
  }

  if (!cuenta) {
    return NextResponse.json({
      success: false,
      error: 'No hay cuentas de recaudo configuradas en el sistema.',
    }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    cuenta: {
      id: cuenta.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      banco: cuenta.banco,
      tipoCuenta: cuenta.tipoCuenta,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titular,
      qrImagen: cuenta.qrImagen || null,
    },
  })
}
