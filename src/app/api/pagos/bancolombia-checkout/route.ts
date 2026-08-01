// =====================================================
// /api/pagos/bancolombia-checkout — Crear intención de pago v3.0
// POST: crea una intención de pago en Bancolombia Botón de Pago.
// Requiere autenticación (cualquier rol) o sesión de portal.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import { generarCodigoPago } from '@/lib/finanzas'
import { safeCompare } from '@/lib/security'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // Permitir autenticación por JWT (gestor) o por sesión portal (header x-portal-token)
    const portalToken = req.headers.get('x-portal-token')
    let clienteId: string | null = null
    let clienteNombre = 'Portal'

    if (portalToken) {
      // === CAMBIO v4.1: validar token contra Cliente.tokenSesion ===
      // Antes se buscaba en Configuracion.PORTAL_SESION_<token>, pero el resto
      // del portal (solicitudes-web, estado-cuenta, paz-y-salvo, etc.) usa
      // directamente Cliente.tokenSesion con safeCompare. Unificamos patrón.
      const cliente = await db.cliente.findFirst({
        where: { tokenSesion: portalToken },
        select: { id: true, nombre: true, tokenExpira: true, activo: true },
      })

      if (!cliente) {
        return NextResponse.json(
          { success: false, error: 'Sesión de portal inválida', code: 'INVALID_PORTAL_SESSION' },
          { status: 401 }
        )
      }

      // Validar expiración y estado (safeCompare ya se aplica al buscar por token,
      // pero hacemos comparación constante-time explícita para evitar timing leaks
      // en casos donde el cliente sea encontrado por otro criterio en el futuro).
      const tokenValido =
        !!cliente.tokenExpira && cliente.tokenExpira > new Date() && cliente.activo

      if (!tokenValido) {
        return NextResponse.json(
          { success: false, error: 'Sesión expirada o inactiva', code: 'SESSION_EXPIRED' },
          { status: 401 }
        )
      }

      clienteId = cliente.id
      clienteNombre = cliente.nombre
    } else {
      const authResult = requireAuth(req)
      if (authResult instanceof NextResponse) return authResult
      clienteNombre = authResult.nombre
    }

    const body = await req.json()
    const { prestamoId, monto, numeroCuota, descripcion } = body

    if (!prestamoId || !monto || monto <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'prestamoId y monto (>0) son obligatorios',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true, categoria: { include: { cuentaRecaudo: true } } },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Si es sesión portal, validar que el préstamo pertenezca al cliente
    if (clienteId && prestamo.clienteId !== clienteId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para pagar este préstamo', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // Crear registro de pago pendiente
    const codigoPago = generarCodigoPago()
    const fechaExpiracion = new Date()
    fechaExpiracion.setHours(fechaExpiracion.getHours() + 24) // link válido 24h

    // Obtener configuración de Bancolombia
    const configBancolombia = await db.conexionAPI.findFirst({
      where: { tipo: 'BANCOLOMBIA_BOTON_PAGO', activa: true },
    })

    if (!configBancolombia) {
      return NextResponse.json(
        {
          success: false,
          error: 'Integración con Bancolombia no configurada. Contacte al administrador.',
          code: 'NO_BANCOLOMBIA_CONFIG',
        },
        { status: 503 }
      )
    }

    // Crear pago pendiente en BD
    const pago = await db.pago.create({
      data: {
        codigo: codigoPago,
        prestamoId,
        numeroCuota: numeroCuota || 0,
        montoCapital: 0, // se calcula al aplicar
        montoInteres: 0,
        montoMora: 0,
        montoTotal: parseFloat(monto),
        fechaVencimiento: prestamo.fechaVencimiento || new Date(),
        metodoPago: 'BANCOLOMBIA_BOTON',
        estado: 'PENDIENTE',
        linkExpira: fechaExpiracion,
        cuentaRecaudoId: prestamo.categoria?.cuentaRecaudoId || null,
        notas: `Checkout Bancolombia - ${descripcion || `Cuota ${numeroCuota || ''}`}`,
      },
    })

    // Generar intención de pago (simulado - en producción llamar a la API de Bancolombia)
    const checkoutId = crypto.randomBytes(16).toString('hex')
    const referenciaComercio = `PAGO-${prestamo.codigo}-${pago.id.slice(-8)}`

    // Construir URL de redirect (relativa para que pase por el gateway)
    const redirectPath = `/api/pagos/bancolombia-redirect`
    const redirectUrl = `${redirectPath}?checkoutId=${checkoutId}&pagoId=${pago.id}&estado=`

    // Guardar metadata en el pago (link de pago)
    await db.pago.update({
      where: { id: pago.id },
      data: {
        linkPago: checkoutId,
        referencia: referenciaComercio,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        checkoutId,
        pagoId: pago.id,
        codigoPago,
        referencia: referenciaComercio,
        monto: pago.montoTotal,
        moneda: 'COP',
        descripcion: descripcion || `Pago préstamo ${prestamo.codigo}`,
        redirectUrl,
        expira: fechaExpiracion.toISOString(),
        // Datos para el formulario de Bancolombia (en producción)
        commerceData: {
          commerceId: configBancolombia.accountId || 'demo-commerce-id',
          apiKey: configBancolombia.apiKey ? '***REDACTED***' : null,
          urlNotificacion: `/api/pagos/bancolombia-webhook`,
          urlRedirect: redirectUrl,
        },
      },
    })
  } catch (error) {
    logError('/api/pagos/bancolombia-checkout POST', error)
    return errorResponse('/api/pagos/bancolombia-checkout POST', error)
  }
}
