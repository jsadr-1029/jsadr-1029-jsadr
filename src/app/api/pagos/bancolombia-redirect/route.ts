// =====================================================
// /api/pagos/bancolombia-redirect — Maneja redirect tras pago v3.0
// GET: recibe el redirect de Bancolombia después del pago.
// Esta ruta es PÚBLICA (whitelist en proxy).
//
// ⚠️ IMPORTANTE (fix de seguridad): Este endpoint NO actualiza el estado
// del pago en la base de datos. Solo sirve como señal visual para
// redirigir al usuario al frontend con el resultado.
// El único origen de verdad para marcar un pago como APLICADO es el
// WEBHOOK de Bancolombia (/api/pagos/bancolombia-webhook), que valida
// la firma HMAC-SHA256 con el secreto compartido.
// Anteriormente este redirect podía ser abusado pasando ?estado=APPROVED
// en la URL para marcar pagos como pagados sin verificación.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const checkoutId = searchParams.get('checkoutId')
    const pagoId = searchParams.get('pagoId')
    const estado = searchParams.get('estado') || searchParams.get('status')
    const referencia = searchParams.get('referencia') || searchParams.get('reference')
    const transactionId = searchParams.get('transactionId') || searchParams.get('id')

    // Si no hay pagoId ni checkoutId, redirigir a página de error
    if (!pagoId && !checkoutId) {
      return NextResponse.redirect(new URL('/?pago=error&motivo=parametros_invalidos', req.url))
    }

    // Buscar el pago
    const pago = await db.pago.findFirst({
      where: pagoId ? { id: pagoId } : { linkPago: checkoutId || undefined },
      include: { prestamo: { include: { cliente: true } } },
    })

    if (!pago) {
      return NextResponse.redirect(new URL('/?pago=error&motivo=pago_no_encontrado', req.url))
    }

    // Mapear estado de Bancolombia a estado legible para el frontend
    // (NO actualizamos el estado en BD — el webhook se encarga)
    let estadoLegible = 'PENDIENTE'
    switch ((estado || '').toUpperCase()) {
      case 'APPROVED':
      case 'SUCCESS':
      case 'OK':
        estadoLegible = 'APROBADO'
        break
      case 'DECLINED':
      case 'REJECTED':
      case 'FAILED':
      case 'ERROR':
        estadoLegible = 'RECHAZADO'
        break
      case 'PENDING':
      case 'PENDING_VALIDATION':
        estadoLegible = 'PENDIENTE'
        break
      default:
        estadoLegible = (estado || 'DESCONOCIDO').toUpperCase()
    }

    // Solo registramos el redirect en `notas` (auditoría) — NO tocamos el estado.
    await db.pago.update({
      where: { id: pago.id },
      data: {
        referencia: transactionId || referencia || pago.referencia,
        notas: `${pago.notas || ''}\n[Redirect Bancolombia ${new Date().toISOString()}] estado reportado=${estado}, txId=${transactionId}. Estado en BD NO modificado — el webhook validará la firma HMAC antes de aplicar.`,
      },
    })

    // Redirigir al frontend con resultado visual (no persistente)
    const frontendUrl = new URL('/', req.url)
    frontendUrl.searchParams.set('pago', estadoLegible.toLowerCase())
    frontendUrl.searchParams.set('pagoId', pago.id)
    frontendUrl.searchParams.set('codigo', pago.prestamo.codigo)
    if (estado) frontendUrl.searchParams.set('estado', estado)
    frontendUrl.searchParams.set('msg', 'pendiente_confirmacion')

    return NextResponse.redirect(frontendUrl)
  } catch (error) {
    logError('/api/pagos/bancolombia-redirect GET', error)
    return errorResponse('/api/pagos/bancolombia-redirect GET', error)
  }
}
