import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enviarWhatsApp, mensajeRecordatorioPago, mensajeMora, guardarNotificacion } from '@/lib/whatsapp'
import { calcularPrestamo, calcularDiasMora, getTasaMoraDiaria, calcularMoraCompuesta } from '@/lib/finanzas'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { enviarEmail } from '@/lib/email'

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
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const { accion } = body

    let notificacionesEnviadas = 0
    let notificacionesFallidas = 0
    let notificacionesOmitidasOptOut = 0
    let notificacionesOmitidasDuplicado = 0
    let notificacionesEnviadasEmail = 0  // fallback WhatsApp→Email
    const resultados: any[] = []

    // Obtener solicitudes activos
    const prestamosActivos = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
      include: { cliente: true, pagos: true },
    })

    // v4.12 (TC-NOT-012): ventana de deduplicación 24h
    const HACE_24H = new Date(Date.now() - 24 * 60 * 60 * 1000)

    for (const prestamo of prestamosActivos) {
      const calculo = calcularPrestamo({
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraDiaria(prestamo),
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
        // Mora sobre CAPITAL INICIAL PRESTADO (política: % diario sobre capital inicial)
        const moraGenerada = calcularMoraCompuesta(prestamo.montoPrincipal, getTasaMoraDiaria(prestamo), diasMora)
        mensaje = mensajeMora({
          nombreCliente: prestamo.cliente.nombre,
          codigoPrestamo: prestamo.codigo,
          montoCuota: proximaCuota.montoCuota,
          diasMora,
          montoMora: moraGenerada,
          totalAdeudado: proximaCuota.montoCuota + moraGenerada,
          tasaMora: getTasaMoraDiaria(prestamo),
        })
        tipoNotificacion = 'MORA'

        // Actualizar estado del solicitud a EN_MORA si corresponde
        if (prestamo.estado !== 'EN_MORA') {
          await db.prestamo.update({
            where: { id: prestamo.id },
            data: { estado: 'EN_MORA', diasMora, montoMora: moraGenerada },
          })
        }
      }

      if (!mensaje) continue

      // v4.12 (TC-NOT-015): respetar opt-out del cliente
      if (prestamo.cliente.optOutNotificaciones) {
        notificacionesOmitidasOptOut++
        // Log de skip por opt-out (auditoría)
        await db.notificacionLog.create({
          data: {
            prestamoId: prestamo.id,
            clienteTelefono: prestamo.cliente.telefono,
            tipo: tipoNotificacion,
            mensaje,
            estado: 'OMITIDO_OPT_OUT',
            error: 'Cliente desuscrito de notificaciones (optOutNotificaciones=true)',
            canal: 'SKIP',
            fechaEnvio: new Date(),
          },
        })
        resultados.push({
          cliente: prestamo.cliente.nombre,
          telefono: prestamo.cliente.telefono,
          tipo: tipoNotificacion,
          exito: false,
          omitido: 'OPT_OUT',
        })
        continue
      }

      // v4.12 (TC-NOT-012): deduplicación 24h por tipo+prestamoId
      const duplicado = await db.notificacionLog.findFirst({
        where: {
          tipo: tipoNotificacion,
          prestamoId: prestamo.id,
          fechaEnvio: { gte: HACE_24H },
          // Solo contar si fue enviada o quedó pendiente manual (no FALLIDO)
          estado: { in: ['ENVIADO', 'PENDIENTE_MANUAL'] },
        },
        orderBy: { fechaEnvio: 'desc' },
      })
      if (duplicado) {
        notificacionesOmitidasDuplicado++
        // Log de skip por duplicado (auditoría)
        await db.notificacionLog.create({
          data: {
            prestamoId: prestamo.id,
            clienteTelefono: prestamo.cliente.telefono,
            tipo: tipoNotificacion,
            mensaje,
            estado: 'OMITIDO_DUPLICADO_24H',
            error: `Duplicado: ya se envió una notificación igual en las últimas 24h (id=${duplicado.id})`,
            canal: 'SKIP',
            fechaEnvio: new Date(),
          },
        })
        resultados.push({
          cliente: prestamo.cliente.nombre,
          telefono: prestamo.cliente.telefono,
          tipo: tipoNotificacion,
          exito: false,
          omitido: 'DUPLICADO_24H',
          duplicadoDe: duplicado.id,
        })
        continue
      }

      // Intentar WhatsApp si hay teléfono
      let envioExitoso = false
      let canalUsado: string | null = null

      if (prestamo.cliente.telefono) {
        const resultado = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)

        await guardarNotificacion({
          db,
          prestamoId: prestamo.id,
          telefono: prestamo.cliente.telefono,
          tipo: tipoNotificacion,
          mensaje,
          envio: resultado,
        })

        if (resultado.exito) {
          envioExitoso = true
          canalUsado = resultado.canal || 'WHATSAPP'
        }

        resultados.push({
          cliente: prestamo.cliente.nombre,
          telefono: prestamo.cliente.telefono,
          tipo: tipoNotificacion,
          exito: resultado.exito,
          canal: resultado.canal,
          error: resultado.error,
        })
      }

      // v4.12 (TC-NOT-014): Fallback WhatsApp → Email si WhatsApp falló
      if (!envioExitoso && prestamo.cliente.email) {
        try {
          const asunto = tipoNotificacion === 'MORA'
            ? `⚠️ Aviso de mora - Solicitud ${prestamo.codigo}`
            : `⏰ Recordatorio de pago - Solicitud ${prestamo.codigo}`

          const emailResult = await enviarEmail({
            to: prestamo.cliente.email,
            subject: asunto,
            text: mensaje,
            html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${mensaje.replace(/</g, '&lt;')}</pre>`,
          })

          if (emailResult.success) {
            notificacionesEnviadasEmail++
            envioExitoso = true
            canalUsado = 'EMAIL'

            // Log del fallback
            await db.notificacionLog.create({
              data: {
                prestamoId: prestamo.id,
                clienteTelefono: prestamo.cliente.telefono || prestamo.cliente.email,
                tipo: tipoNotificacion,
                mensaje,
                estado: 'ENVIADO',
                canal: 'EMAIL',
                error: null,
                fechaEnvio: new Date(),
              },
            })
            resultados.push({
              cliente: prestamo.cliente.nombre,
              email: prestamo.cliente.email,
              tipo: tipoNotificacion,
              exito: true,
              canal: 'EMAIL',
              fallback: 'WhatsApp falló, enviado por email',
            })
          } else {
            resultados.push({
              cliente: prestamo.cliente.nombre,
              email: prestamo.cliente.email,
              tipo: tipoNotificacion,
              exito: false,
              canal: 'EMAIL_FALLIDO',
              error: emailResult.error,
            })
          }
        } catch (emailErr: any) {
          console.error('[notificaciones] Fallback email falló:', emailErr?.message)
        }
      }

      if (envioExitoso) {
        notificacionesEnviadas++
      } else {
        notificacionesFallidas++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        notificacionesEnviadas,
        notificacionesFallidas,
        notificacionesOmitidasOptOut,
        notificacionesOmitidasDuplicado,
        notificacionesEnviadasEmail,
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
    const authResult = requireRole(req, ['ADMIN'])
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
