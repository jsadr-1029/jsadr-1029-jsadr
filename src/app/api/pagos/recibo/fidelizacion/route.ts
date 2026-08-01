import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'

// =====================================================
// /api/pagos/recibo/fidelizacion — Mensaje de fidelización
// -----------------------------------------------------
// Genera mensajes personalizados para enviar al cliente
// cuando se aplica la ÚLTIMA cuota del préstamo.
//
// POST body:
//   accion: "generar_plantillas"  → devuelve plantillas predefinidas
//   accion: "enviar"              → envía un mensaje personalizado
//     { pagoId, mensaje, telefonoDestino? }
// =====================================================

const PLANTILLAS_FIDELIZACION = [
  {
    id: 'gracias_renovacion',
    titulo: 'Gracias + Invitación a renovar',
    emoji: '🎉',
    asunto: '¡Felicidades! Has terminado tu préstamo',
    generar: (ctx: { nombre: string; codigo: string; montoTotal: string; proximoMonto?: string }) =>
      `¡Hola ${ctx.nombre}! 🎉\n\n` +
      `Queremos felicitarte porque hoy has finalizado tu préstamo ${ctx.codigo} ` +
      `con un cumplimiento del 100%. Tu responsabilidad financiera es un ejemplo. 🙌\n\n` +
      `Como cliente cumplido, tienes disponible una línea de crédito pre-aprobada ` +
      `con tasas preferenciales. ¿Te interesa un nuevo préstamo?\n\n` +
      `Respóndeme y con gusto te asesoro. 🚀`,
  },
  {
    id: 'gracias_sincero',
    titulo: 'Agradecimiento sincero',
    emoji: '💚',
    asunto: 'Gracias por confiar en nosotros',
    generar: (ctx: { nombre: string; codigo: string; montoTotal: string }) =>
      `Hola ${ctx.nombre},\n\n` +
      `Hoy se ha completado el pago de tu préstamo ${ctx.codigo} y queremos darte las gracias ` +
      `de corazón. 🙏\n\n` +
      `Confianzas como la tuya son las que nos impulsan a seguir creciendo. ` +
      `Esperamos seguir siendo tu aliado financiero en el futuro.\n\n` +
      `¡Hasta pronto, amigo! 💚`,
  },
  {
    id: 'renovacion_aumento',
    titulo: 'Oferta de renovación con aumento',
    emoji: '📈',
    asunto: 'Nueva oportunidad con monto mayor',
    generar: (ctx: { nombre: string; codigo: string; montoTotal: string }) =>
      `¡Hola ${ctx.nombre}! 📈\n\n` +
      `Por tu excelente historial de pago en el préstamo ${ctx.codigo}, ` +
      `tu línea de crédito acaba de aumentar. Tienes disponible un nuevo préstamo ` +
      `con un monto mayor y una tasa más baja. 💰\n\n` +
      `¿Te interesa conocer los detalles? Estoy para servirte. 🤝`,
  },
  {
    id: 'beneficios_exclusivos',
    titulo: 'Beneficios exclusivos para cumplidos',
    emoji: '⭐',
    asunto: 'Eres cliente VIP',
    generar: (ctx: { nombre: string; codigo: string; montoTotal: string }) =>
      `Hola ${ctx.nombre}, ⭐\n\n` +
      `Tu excelente comportamiento de pago en el préstamo ${ctx.codigo} te ha convertido ` +
      `en cliente VIP de Jsadr · Aurora Bancaria.\n\n` +
      `A partir de hoy tienes acceso a:\n` +
      `• Aprobación prioritaria de nuevos préstamos 🚀\n` +
      `• Tasas preferenciales exclusivas 💎\n` +
      `• Asesoría financiera personalizada sin costo 📊\n\n` +
      `¿Gustas aprovechar estos beneficios? 🎁`,
  },
  {
    id: 'referido',
    titulo: 'Programa de referidos',
    emoji: '🤝',
    asunto: 'Gana por recomendar',
    generar: (ctx: { nombre: string; codigo: string; montoTotal: string }) =>
      `¡Hola ${ctx.nombre}! 🤝\n\n` +
      `Has terminado tu préstamo ${ctx.codigo} y queremos devolverte el cariño. ` +
      `Por cada amigo o familiar que refieras y adquiera un préstamo con nosotros, ` +
      `recibirás un bono especial. 💰\n\n` +
      `¿Conoces a alguien que necesite un crédito? Solo pásame su contacto. 📲`,
  },
  {
    id: 'libre',
    titulo: 'Mensaje libre',
    emoji: '✏️',
    asunto: 'Personalizado',
    generar: () => '',
  },
]

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { accion } = body

    // === ACCIÓN: generar plantillas ===
    if (accion === 'generar_plantillas') {
      const { pagoId } = body
      if (!pagoId) {
        return NextResponse.json({ success: false, error: 'pagoId requerido' }, { status: 400 })
      }
      const pago = await db.pago.findUnique({
        where: { id: pagoId },
        include: {
          prestamo: { include: { cliente: true, pagos: true } },
        },
      })
      if (!pago) return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })

      // Verificar que sea la última cuota
      const cuotasPagadasSet = new Set(
        pago.prestamo.pagos
          .filter((p: any) => p.estado === 'APLICADO' && !p.esSoloIntereses)
          .map((p: any) => p.numeroCuota)
      )
      const cuotasPendientes = Math.max(0, pago.prestamo.numeroCuotas - cuotasPagadasSet.size)
      const esUltimaCuota = cuotasPendientes === 0 && pago.estado === 'APLICADO'

      if (!esUltimaCuota) {
        return NextResponse.json({
          success: false,
          error: `Este mensaje solo está disponible en la última cuota. Aún hay ${cuotasPendientes} cuota(s) pendiente(s).`,
          cuotasPendientes,
        }, { status: 400 })
      }

      // Generar las plantillas con el contexto del cliente
      const ctx = {
        nombre: pago.prestamo.cliente.nombre.split(' ')[0], // primer nombre
        codigo: pago.prestamo.codigo,
        montoTotal: formatearMoneda(pago.prestamo.montoPagado),
      }
      const plantillas = PLANTILLAS_FIDELIZACION.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        emoji: p.emoji,
        asunto: p.asunto,
        mensaje: p.generar(ctx),
      }))

      return NextResponse.json({
        success: true,
        data: {
          plantillas,
          cliente: {
            nombre: pago.prestamo.cliente.nombre,
            telefono: pago.prestamo.cliente.telefono,
          },
          prestamo: pago.prestamo.codigo,
          esUltimaCuota,
        },
      })
    }

    // === ACCIÓN: enviar mensaje ===
    if (accion === 'enviar') {
      const { pagoId, mensaje, telefonoDestino } = body
      if (!pagoId || !mensaje || mensaje.trim().length < 5) {
        return NextResponse.json({ success: false, error: 'pagoId y mensaje (mínimo 5 caracteres) son obligatorios' }, { status: 400 })
      }

      const pago = await db.pago.findUnique({
        where: { id: pagoId },
        include: { prestamo: { include: { cliente: true, pagos: true } } },
      })
      if (!pago) return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })

      // Verificar última cuota
      const cuotasPagadasSet = new Set(
        pago.prestamo.pagos
          .filter((p: any) => p.estado === 'APLICADO' && !p.esSoloIntereses)
          .map((p: any) => p.numeroCuota)
      )
      const cuotasPendientes = Math.max(0, pago.prestamo.numeroCuotas - cuotasPagadasSet.size)
      const esUltimaCuota = cuotasPendientes === 0 && pago.estado === 'APLICADO'
      if (!esUltimaCuota) {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden enviar mensajes de fidelización en la última cuota.',
        }, { status: 400 })
      }

      const telefono = telefonoDestino || pago.prestamo.cliente.telefono
      const envio = await enviarWhatsApp(telefono, mensaje)
      await guardarNotificacion({
        db,
        prestamoId: pago.prestamoId,
        telefono,
        tipo: 'FIDELIZACION',
        mensaje,
        envio,
      })

      const clientInfo = getClientInfo(req)
      await registrarAuditLog({
        usuarioId: user.id, usuarioNombre: user.nombre,
        accion: 'MENSAJE_FIDELIZACION_ENVIADO', modulo: 'pagos',
        entidadId: pagoId,
        entidadNombre: `Fidelización ${pago.prestamo.cliente.nombre}`,
        detalles: JSON.stringify({
          pagoId, telefono, mensaje: mensaje.slice(0, 200),
          enviado: envio.exito,
        }),
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: 'Mensaje enviado al cliente',
        envio,
      })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida. Use generar_plantillas o enviar.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
