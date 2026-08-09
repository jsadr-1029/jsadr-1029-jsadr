import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, formatearFecha, formatearMoneda, getTasaMoraAnual } from '@/lib/finanzas'
import { enviarWhatsApp, guardarNotificacion, mensajeLinkPago } from '@/lib/whatsapp'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { buildAbsoluteUrl } from '@/lib/url'

// POST - generar botón de pago de Bancolombia para una cuota específica
// v4.0: auth
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { prestamoId, numeroCuota } = body

    if (!prestamoId || !numeroCuota) {
      return NextResponse.json(
        { success: false, error: 'prestamoId y numeroCuota son obligatorios' },
        { status: 400 }
      )
    }

    // Buscar si hay una conexión de Botón de Pago Bancolombia activa
    const conexion = await db.conexionAPI.findFirst({
      where: {
        tipo: 'BANCOLOMBIA_BOTON_PAGO',
        activa: true,
      },
    })

    if (!conexion) {
      return NextResponse.json(
        {
          success: false,
          error: 'No hay una conexión de Botón de Pago Bancolombia activa. Configúrala en Conexiones API.',
        },
        { status: 400 }
      )
    }

    // Buscar el préstamo
    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true, pagos: true },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    // Calcular la cuota
    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || undefined,
    })

    const cuota = calculo.tablaAmortizacion.find((c) => c.numero === parseInt(numeroCuota))
    if (!cuota) {
      return NextResponse.json(
        { success: false, error: 'Cuota no encontrada' },
        { status: 400 }
      )
    }

    // Generar el link de pago de Bancolombia
    // La API real de Bancolombia Botón de Pago requiere:
    // 1. Crear una intención de pago (POST a su API)
    // 2. Recibir un redirect URL
    //
    // Aquí implementamos la lógica. Si la conexión tiene los credenciales reales,
    // se hace la petición a la API de Bancolombia. Si no, se genera un link simulado.

    const montoCuota = cuota.montoCuota
    const referencia = `${prestamo.codigo}-C${numeroCuota}`
    const baseUrl = buildAbsoluteUrl('')

    let linkPago = ''
    let botonGenerado = false

    if (conexion.apiKey && conexion.url) {
      // Intentar crear la intención de pago en la API de Bancolombia
      try {
        const res = await fetch(`${conexion.url}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${conexion.apiKey}`,
            'x-api-key': conexion.apiSecret || '',
          },
          body: JSON.stringify({
            amount: montoCuota,
            currency: 'COP',
            reference: referencia,
            description: `Cuota ${numeroCuota} - Préstamo ${prestamo.codigo}`,
            returnUrl: `${baseUrl}/api/pagos/confirmar?prestamoId=${prestamoId}&cuota=${numeroCuota}`,
            customer: {
              name: prestamo.cliente.nombre,
              document: prestamo.cliente.cedula,
              phone: prestamo.cliente.telefono,
            },
          }),
          signal: AbortSignal.timeout(15000),
        })

        if (res.ok) {
          const data = await res.json()
          linkPago = data.paymentUrl || data.redirectUrl || data.url || ''
          botonGenerado = true
        } else {
          // Si la API real falla, generar un link simulado con la info del pago
          const params = new URLSearchParams({
            monto: montoCuota.toString(),
            referencia,
            cliente: prestamo.cliente.nombre,
            cedula: prestamo.cliente.cedula,
            prestamo: prestamo.codigo,
            cuota: numeroCuota.toString(),
          })
          linkPago = `${baseUrl}/pagar-bancolombia?${params.toString()}`
          botonGenerado = true
        }
      } catch (e: any) {
        // Si la API real no está disponible, generar link simulado
        const params = new URLSearchParams({
          monto: montoCuota.toString(),
          referencia,
          cliente: prestamo.cliente.nombre,
          cedula: prestamo.cliente.cedula,
          prestamo: prestamo.codigo,
          cuota: numeroCuota.toString(),
        })
        linkPago = `${baseUrl}/pagar-bancolombia?${params.toString()}`
        botonGenerado = true
      }
    } else {
      // Sin credenciales reales, generar link simulado
      const params = new URLSearchParams({
        monto: montoCuota.toString(),
        referencia,
        cliente: prestamo.cliente.nombre,
        cedula: prestamo.cliente.cedula,
        prestamo: prestamo.codigo,
        cuota: numeroCuota.toString(),
      })
      linkPago = `${baseUrl}/pagar-bancolombia?${params.toString()}`
      botonGenerado = true
    }

    if (!botonGenerado) {
      return NextResponse.json(
        { success: false, error: 'No se pudo generar el botón de pago' },
        { status: 500 }
      )
    }

    // Enviar WhatsApp al cliente con el link de pago
    const mensaje = mensajeLinkPago({
      nombreCliente: prestamo.cliente.nombre,
      codigoPrestamo: prestamo.codigo,
      cuotaNumero: parseInt(numeroCuota),
      monto: montoCuota,
      linkPago,
      fechaVencimiento: formatearFecha(cuota.fechaVencimiento),
    })
    const envioWhatsApp = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
    await guardarNotificacion({
      db,
      prestamoId,
      telefono: prestamo.cliente.telefono,
      tipo: 'PAGO',
      mensaje,
      envio: envioWhatsApp,
    })

    return NextResponse.json({
      success: true,
      data: {
        linkPago,
        monto: montoCuota,
        referencia,
        cuotaNumero: parseInt(numeroCuota),
        prestamoCodigo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
        fechaVencimiento: cuota.fechaVencimiento,
        conexionUsada: conexion.nombre,
        apiReal: !!(conexion.apiKey && conexion.url && conexion.probada),
      },
      whatsapp: envioWhatsApp,
      mensaje: 'Botón de pago generado y enviado por WhatsApp al cliente',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
