import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enviarWhatsApp, mensajeRecordatorioPago, mensajeMora, guardarNotificacion } from '@/lib/whatsapp'
import { calcularPrestamo, calcularDiasMora, getTasaMoraAnual, calcularMoraCompuesta } from '@/lib/finanzas'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - listar todas las notificaciones
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')

    const where: any = {}
    if (tipo && tipo !== 'all') where.tipo = tipo
    if (estado && estado !== 'all') where.estado = estado

    const notificaciones = await db.notificacionLog.findMany({
      where,
      include: { prestamo: { include: { cliente: true } } },
      orderBy: { fechaEnvio: 'desc' },
      take: 100,
    })

    return NextResponse.json({ success: true, data: notificaciones })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// POST - disparar notificaciones manuales (recordatorios / mora)
export async function POST(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede disparar notificaciones masivas
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const { accion } = body

    let notificacionesEnviadas = 0
    let notificacionesFallidas = 0
    const resultados: any[] = []

    // Obtener préstamos activos
    const prestamosActivos = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
      include: { cliente: true, pagos: true },
    })

    for (const prestamo of prestamosActivos) {
      const calculo = calcularPrestamo({
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia as any,
        fechaDesembolso: prestamo.fechaDesembolso || undefined,
      })

      // Buscar próxima cuota pendiente
      const proximaCuota = calculo.tablaAmortizacion.find((c) => {
        return !prestamo.pagos.some((p) => p.numeroCuota === c.numero)
      })

      if (!proximaCuota) continue

      const diasMora = calcularDiasMora(proximaCuota.fechaVencimiento)
      let mensaje: string | null = null
      let tipoNotificacion: string = ''

      if (accion === 'recordatorios' && diasMora === 0) {
        // Verificar si vence en 1-3 días
        const diasParaVencer = Math.ceil(
          (proximaCuota.fechaVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        if (diasParaVencer >= 0 && diasParaVencer <= 3) {
          mensaje = mensajeRecordatorioPago({
            nombreCliente: prestamo.cliente.nombre,
            codigoPrestamo: prestamo.codigo,
            montoCuota: proximaCuota.montoCuota,
            fechaVencimiento: proximaCuota.fechaVencimiento.toLocaleDateString('es-CO'),
            diasRestantes: diasParaVencer,
          })
          tipoNotificacion = 'RECORDATORIO'
        }
      } else if (accion === 'mora' && diasMora > 0) {
        const moraGenerada = calcularMoraCompuesta(proximaCuota.montoCuota, getTasaMoraAnual(prestamo), diasMora)
        mensaje = mensajeMora({
          nombreCliente: prestamo.cliente.nombre,
          codigoPrestamo: prestamo.codigo,
          montoCuota: proximaCuota.montoCuota,
          diasMora,
          montoMora: moraGenerada,
          totalAdeudado: proximaCuota.montoCuota + moraGenerada,
          tasaMora: getTasaMoraAnual(prestamo),
        })
        tipoNotificacion = 'MORA'

        // Actualizar estado del préstamo a EN_MORA si corresponde
        if (prestamo.estado !== 'EN_MORA') {
          await db.prestamo.update({
            where: { id: prestamo.id },
            data: { estado: 'EN_MORA', diasMora, montoMora: moraGenerada },
          })
        }
      }

      if (mensaje && prestamo.cliente.telefono) {
        const resultado = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)

        await guardarNotificacion({
          db,
          prestamoId: prestamo.id,
          telefono: prestamo.cliente.telefono,
          tipo: tipoNotificacion,
          mensaje,
          envio: resultado,
        })

        if (resultado.exito) notificacionesEnviadas++
        else notificacionesFallidas++

        resultados.push({
          cliente: prestamo.cliente.nombre,
          telefono: prestamo.cliente.telefono,
          tipo: tipoNotificacion,
          exito: resultado.exito,
          error: resultado.error,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        notificacionesEnviadas,
        notificacionesFallidas,
        resultados,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH - actualizar estado de una notificación (marcar como enviada)
export async function PATCH(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede modificar estado de notificaciones
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const { id, estado } = body

    if (!id || !estado) {
      return NextResponse.json(
        { success: false, error: 'id y estado son obligatorios' },
        { status: 400 }
      )
    }

    const actualizado = await db.notificacionLog.update({
      where: { id },
      data: { estado },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
