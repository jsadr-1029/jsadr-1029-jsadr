// =====================================================
// Recordatorios automáticos de pago (v4.4)
// =====================================================
//
// Este módulo envía recordatorios automáticos a los clientes cuyas
// cuotas vencen hoy o mañana (faltando 1 día). Respeta la preferencia
// de notificación de cada cliente:
//   - WHATSAPP: solo WhatsApp al teléfono registrado
//   - EMAIL:    solo correo electrónico
//   - AMBOS:    WhatsApp + correo
//   - NINGUNO:  no se envía nada
//
// Para evitar duplicados, marca Pago.recordatorioEnviadoEn con la
// fecha del envío. Solo reenvía si la fecha del último envío es
// diferente a hoy (es decir, máximo 1 recordatorio por día por cuota).
//
// WhatsApp: usa la función existente enviarWhatsApp() que genera un
//           link wa.me para envío manual del gestor (NO auto-envío
//           real — requiere integración con WhatsApp Business API).
// Email:    usa enviarEmail() que sí envía automáticamente vía Brevo
//           HTTPS API (con fallback SMTP). Este canal SÍ es automático.
// =====================================================

import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email'
import { enviarWhatsApp, mensajeRecordatorioPago, guardarNotificacion } from '@/lib/whatsapp'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { enviarEmailPlantilla, enviarWhatsappPlantilla } from '@/lib/plantillas'

export interface ResultadoRecordatorio {
  totalCuotasProcesadas: number
  recordatoriosEnviados: number
  whatsappGenerados: number
  emailsEnviados: number
  omitidosSinPref: number
  omitidosPrefNinguno: number
  errores: string[]
  detalle: Array<{
    cliente: string
    cedula: string
    prestamoCodigo: string
    numeroCuota: number
    fechaVencimiento: string
    medios: string
    estado: string
  }>
}

/**
 * Función principal: busca pagos pendientes con vencimiento hoy o mañana,
 * y envía recordatorios según la preferencia del cliente.
 *
 * @returns ResultadoRecordatorio con estadísticas del envío.
 */
export async function enviarRecordatoriosPago(): Promise<ResultadoRecordatorio> {
  const resultado: ResultadoRecordatorio = {
    totalCuotasProcesadas: 0,
    recordatoriosEnviados: 0,
    whatsappGenerados: 0,
    emailsEnviados: 0,
    omitidosSinPref: 0,
    omitidosPrefNinguno: 0,
    errores: [],
    detalle: [],
  }

  // === Ventana de tiempo: hoy 00:00 hasta pasado mañana 00:00 ===
  // Es decir, cuotas que vencen HOY o MAÑANA. El recordatorio se envía
  // el día anterior al vencimiento (o el mismo día si vence hoy).
  const ahora = new Date()
  const inicioHoy = new Date(ahora)
  inicioHoy.setHours(0, 0, 0, 0)
  const pasadoManana = new Date(inicioHoy)
  pasadoManana.setDate(pasadoManana.getDate() + 2) // 00:00 del día después de mañana

  // === Buscar pagos PENDIENTE con vencimiento en [hoy, mañana] ===
  // Y que NO se haya enviado recordatorio hoy (recordatorioEnviadoEn != hoy)
  const pagosPendientes = await db.pago.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: {
        gte: inicioHoy,
        lt: pasadoManana,
      },
      // Filtrar los que ya se les envió recordatorio HOY
      // (recordatorioEnviadoEn es null o es de un día anterior)
      OR: [
        { recordatorioEnviadoEn: null },
        { recordatorioEnviadoEn: { lt: inicioHoy } },
      ],
    },
    include: {
      prestamo: {
        include: {
          cliente: true,
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  resultado.totalCuotasProcesadas = pagosPendientes.length

  for (const pago of pagosPendientes) {
    const cliente = pago.prestamo.cliente
    const prestamo = pago.prestamo
    const diasRestantes = Math.ceil(
      (pago.fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
    )

    try {
      // Determinar preferencia (default WHATSAPP si es null)
      const pref = cliente.preferenciaNotificacion || 'WHATSAPP'

      if (pref === 'NINGUNO') {
        resultado.omitidosPrefNinguno++
        resultado.detalle.push({
          cliente: cliente.nombre,
          cedula: cliente.cedula,
          prestamoCodigo: prestamo.codigo || '',
          numeroCuota: pago.numeroCuota,
          fechaVencimiento: formatearFecha(pago.fechaVencimiento),
          medios: '—',
          estado: 'Omitido (cliente optó por NINGUNO)',
        })
        // Aun así marcar como enviado para no re-procesar
        await db.pago.update({
          where: { id: pago.id },
          data: {
            recordatorioEnviadoEn: ahora,
            recordatorioMedios: 'NINGUNO',
          },
        })
        continue
      }

      const mediosEnviados: string[] = []

      // === Enviar WhatsApp si la preferencia es WHATSAPP o AMBOS ===
      if (pref === 'WHATSAPP' || pref === 'AMBOS') {
        // Intentar primero con plantilla editable de BD; fallback a mensajeRecordatorioPago()
        const tplResult = await enviarWhatsappPlantilla(
          'RECORDATORIO_PAGO_WA',
          cliente.telefono,
          {
            clienteNombre: cliente.nombre,
            prestamoCodigo: prestamo.codigo || '',
            montoCuota: pago.montoTotal,
            numeroCuota: pago.numeroCuota,
            totalCuotas: prestamo.numeroCuotas,
            fechaVencimiento: pago.fechaVencimiento,
            diasRestantes,
          },
          { prestamoId: prestamo.id, guardarLog: true }
        )

        let mensaje = ''
        if (tplResult.success && tplResult.usadaPlantilla) {
          // Plantilla de BD usada — el log ya se guardó dentro de enviarWhatsappPlantilla
          mensaje = '(plantilla BD)'
        } else {
          // Fallback: usar función legacy
          mensaje = mensajeRecordatorioPago({
            nombreCliente: cliente.nombre,
            codigoPrestamo: prestamo.codigo || '',
            montoCuota: pago.montoTotal,
            fechaVencimiento: formatearFecha(pago.fechaVencimiento),
            diasRestantes: Math.max(0, diasRestantes),
          })
          const envioWa = await enviarWhatsApp(cliente.telefono, mensaje)
          await guardarNotificacion({
            db,
            prestamoId: prestamo.id,
            telefono: cliente.telefono,
            tipo: 'RECORDATORIO',
            mensaje,
            envio: envioWa,
          })
        }
        mediosEnviados.push('WhatsApp')
        resultado.whatsappGenerados++
      }

      // === Enviar Email si la preferencia es EMAIL o AMBOS ===
      if (pref === 'EMAIL' || pref === 'AMBOS') {
        if (cliente.email) {
          const diasRestantesTexto = diasRestantes === 0 ? 'hoy' : 'mañana'
          // Intentar primero con plantilla editable de BD; fallback a HTML local
          const tplResult = await enviarEmailPlantilla(
            'RECORDATORIO_PAGO_EMAIL',
            cliente.email,
            {
              clienteNombre: cliente.nombre,
              prestamoCodigo: prestamo.codigo || '',
              montoCuota: pago.montoTotal,
              numeroCuota: pago.numeroCuota,
              totalCuotas: prestamo.numeroCuotas,
              fechaVencimiento: pago.fechaVencimiento,
              diasRestantesTexto,
              diasRestantes,
            }
          )

          if (tplResult.success && tplResult.usadaPlantilla) {
            mediosEnviados.push('Email')
            resultado.emailsEnviados++
          } else {
            // Fallback: usar HTML local
            const asunto = `⏰ Recordatorio: tu cuota vence ${diasRestantesTexto}`
            const html = generarHtmlRecordatorioEmail({
              nombreCliente: cliente.nombre,
              codigoPrestamo: prestamo.codigo || '',
              montoCuota: pago.montoTotal,
              fechaVencimiento: pago.fechaVencimiento,
              diasRestantes,
            })

            const envioEmail = await enviarEmail({
              to: cliente.email,
              subject: asunto,
              text: `Hola ${cliente.nombre}, te recordamos que tu cuota ${pago.numeroCuota} del préstamo ${prestamo.codigo} por ${formatearMoneda(pago.montoTotal)} vence el ${formatearFecha(pago.fechaVencimiento)}. Evita moratorios pagando a tiempo.`,
              html,
            })

            if (envioEmail.success) {
              mediosEnviados.push('Email')
              resultado.emailsEnviados++
            } else {
              resultado.errores.push(`Email fallido a ${cliente.email} (${cliente.nombre}): ${envioEmail.error || 'desconocido'}`)
            }
          }
        } else {
          resultado.errores.push(`Cliente ${cliente.nombre} (${cliente.cedula}) sin email, no se pudo enviar recordatorio por correo.`)
        }
      }

      // === Marcar como enviado en el pago ===
      const mediosStr = mediosEnviados.join('+') || 'NINGUNO'
      await db.pago.update({
        where: { id: pago.id },
        data: {
          recordatorioEnviadoEn: ahora,
          recordatorioMedios: mediosStr,
        },
      })

      if (mediosEnviados.length > 0) {
        resultado.recordatoriosEnviados++
      } else {
        resultado.omitidosSinPref++
      }

      resultado.detalle.push({
        cliente: cliente.nombre,
        cedula: cliente.cedula,
        prestamoCodigo: prestamo.codigo || '',
        numeroCuota: pago.numeroCuota,
        fechaVencimiento: formatearFecha(pago.fechaVencimiento),
        medios: mediosStr,
        estado: 'Enviado',
      })
    } catch (e: any) {
      resultado.errores.push(`Error procesando pago ${pago.id} (cuota ${pago.numeroCuota} del préstamo ${prestamo.codigo}): ${e?.message || 'desconocido'}`)
      resultado.detalle.push({
        cliente: cliente.nombre,
        cedula: cliente.cedula,
        prestamoCodigo: prestamo.codigo || '',
        numeroCuota: pago.numeroCuota,
        fechaVencimiento: formatearFecha(pago.fechaVencimiento),
        medios: '—',
        estado: `Error: ${e?.message || 'desconocido'}`,
      })
    }
  }

  return resultado
}

/**
 * Genera el HTML del correo de recordatorio de pago.
 */
function generarHtmlRecordatorioEmail(d: {
  nombreCliente: string
  codigoPrestamo: string
  montoCuota: number
  fechaVencimiento: Date
  diasRestantes: number
}): string {
  const plazoTexto = d.diasRestantes === 0 ? 'hoy' : 'mañana'
  const fechaFormateada = formatearFecha(d.fechaVencimiento)
  const montoFormateado = formatearMoneda(d.montoCuota)

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recordatorio de Pago</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">⏰ Recordatorio de Pago</h1>
            <p style="color:#c7d2fe;margin:6px 0 0 0;font-size:13px;">Tu cuota vence ${plazoTexto}</p>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>${d.nombreCliente}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Te recordamos que tienes una cuota pendiente que <strong>vence ${plazoTexto}</strong>.
              Paga a tiempo para evitar intereses moratorios.
            </p>

            <!-- Tarjeta de detalle -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:8px;">Préstamo</td>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:8px;text-align:right;">Cuota</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;font-weight:600;color:#1f2937;padding-bottom:16px;">${d.codigoPrestamo}</td>
                    <td style="font-size:15px;font-weight:600;color:#1f2937;padding-bottom:16px;text-align:right;">Cuota</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:6px;">Fecha de vencimiento</td>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:6px;text-align:right;">Monto a pagar</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;font-weight:600;color:#1f2937;">${fechaFormateada}</td>
                    <td style="font-size:18px;font-weight:700;color:#dc2626;text-align:right;">${montoFormateado}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- CTA -->
            <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;">
              💡 Para realizar tu pago, ingresa al portal del cliente:
            </p>
            <p style="margin:0 0 24px 0;">
              <a href="https://jsadr.com.co/login" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Ingresar al Portal</a>
            </p>

            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático. Si ya realizaste el pago, ignora este correo.<br>
              Para soporte, contacta a tu gestor.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              © ${new Date().getFullYear()} JSADR · Sistema de Gestión de Préstamos
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
