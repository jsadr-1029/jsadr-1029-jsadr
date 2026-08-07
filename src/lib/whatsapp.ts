// =====================================================
// Servicio de Notificaciones WhatsApp v4.12
// Estrategia: 1) WhatsApp Cloud API (Meta)  2) Fallback wa.me link manual
// =====================================================

import { enviarWhatsAppCloudAPI, whatsappCloudConfigurado } from './whatsapp-cloud'

interface ResultadoEnvio {
  exito: boolean
  error?: string
  linkWaMe?: string
  wamid?: string
  canal?: 'WHATSAPP' | 'WA_ME_LINK'
  respuesta?: any
}

/**
 * Limpia el número de teléfono al formato internacional sin "+"
 */
function limpiarTelefono(telefono: string): string {
  let limpio = telefono.replace(/[^\d]/g, '')
  // Si no tiene código de país, asumir Colombia (57)
  if (limpio.length === 10) limpio = '57' + limpio
  // Reforzado: validar longitud mínima y máxima (telefonos internacionales 7-15 dígitos)
  if (limpio.length < 7) {
    throw new Error('Teléfono inválido: demasiado corto (mínimo 7 dígitos)')
  }
  if (limpio.length > 15) {
    throw new Error('Teléfono inválido: demasiado largo (máximo 15 dígitos)')
  }
  return limpio
}

/**
 * Genera un enlace wa.me con el mensaje pre-codificado
 * Abre WhatsApp Web/App con el mensaje listo para enviar
 */
export function generarLinkWaMe(telefono: string, mensaje: string): string {
  const telefonoLimpio = limpiarTelefono(telefono)
  const mensajeCodificado = encodeURIComponent(mensaje)
  return `https://wa.me/${telefonoLimpio}?text=${mensajeCodificado}`
}

/**
 * "Envía" un mensaje de WhatsApp.
 *
 * Estrategia v4.12:
 *   1. Si WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID están configurados, intenta
 *      WhatsApp Cloud API de Meta (envío automático real, retorna wamid).
 *   2. Si Cloud API no está configurado o falla, genera un link wa.me para
 *      envío manual por el administrador.
 *
 * @returns ResultadoEnvio con exito=true si Cloud API envió correctamente,
 *          exito=false + linkWaMe si cae a fallback manual.
 */
export async function enviarWhatsApp(telefono: string, mensaje: string): Promise<ResultadoEnvio> {
  try {
    const telefonoLimpio = limpiarTelefono(telefono)
    if (!telefonoLimpio) {
      return { exito: false, error: 'Número de teléfono inválido' }
    }

    // 1. Intentar WhatsApp Cloud API si está configurado
    if (whatsappCloudConfigurado()) {
      const cloudResult = await enviarWhatsAppCloudAPI(telefono, mensaje)
      if (cloudResult.exito) {
        return {
          exito: true,
          wamid: cloudResult.wamid,
          canal: 'WHATSAPP',
          respuesta: cloudResult.respuesta,
        }
      }
      // Si falla, continuar al fallback wa.me
      console.warn('[WhatsApp] Cloud API falló, fallback a wa.me:', cloudResult.error)
    }

    // 2. Fallback: generar link wa.me para envío manual
    const linkWaMe = generarLinkWaMe(telefono, mensaje)
    return {
      exito: false,
      error: 'PENDIENTE_MANUAL',
      linkWaMe,
      canal: 'WA_ME_LINK',
      respuesta: {
        modo: 'manual',
        telefono: telefonoLimpio,
        link: linkWaMe,
        instrucciones: 'Haga clic en el enlace para abrir WhatsApp y enviar el mensaje al cliente',
      },
    }
  } catch (error: any) {
    console.error('[WhatsApp] Error:', error?.message || error)
    return {
      exito: false,
      error: error?.message || 'Error desconocido al generar enlace WhatsApp',
    }
  }
}

// =====================================================
// PLANTILLAS DE MENSAJES
// =====================================================

export function mensajeSolicitudCreada(d: {
  nombreCliente: string
  codigoPrestamo: string
  monto: number
  cuota: number
  numeroCuotas: number
  fechaPrimerPago: string
}): string {
  return `🏦 *SOLICITUD DE PRÉSTAMO REGISTRADA*

Hola *${d.nombreCliente}*, tu solicitud ha sido creada.

📋 *Detalles:*
• Código: ${d.codigoPrestamo}
• Monto: $${d.monto.toLocaleString('es-CO')}
• Cuota: $${d.cuota.toLocaleString('es-CO')}
• N° Cuotas: ${d.numeroCuotas}
• 1er Pago: ${d.fechaPrimerPago}

Te notificaremos cuando sea aprobada.`
}

export function mensajeAprobacionTyC(d: {
  nombreCliente: string
  codigoPrestamo: string
  monto: number
  cuota: number
  numeroCuotas: number
  tasaAnual: number
  totalPagar: number
  linkAceptacion: string
}): string {
  return `✅ *PRÉSTAMO APROBADO - REQUIERE ACEPTACIÓN*

Hola *${d.nombreCliente}*, tu préstamo ${d.codigoPrestamo} fue aprobado.

📋 *Características del crédito:*
• Monto: $${d.monto.toLocaleString('es-CO')}
• Cuota fija: $${d.cuota.toLocaleString('es-CO')}
• N° cuotas: ${d.numeroCuotas}
• Tasa anual: ${d.tasaAnual}%
• Total a pagar: $${d.totalPagar.toLocaleString('es-CO')}

⚠️ *Para desembolsar el préstamo debes aceptar los Términos y Condiciones.*

👉 Haz clic aquí para revisar y aceptar:
${d.linkAceptacion}

Una vez aceptes, el desembolso se procesará automáticamente.`
}

export function mensajePagoAplicado(d: {
  nombreCliente: string
  codigoPrestamo: string
  montoPagado: number
  cuotaNumero: number
  totalCuotas: number
  saldoRestante: number
  proximoPago: string
  proximoMonto: number
}): string {
  return `✅ *PAGO APLICADO EXITOSAMENTE*

Hola *${d.nombreCliente}*, registramos tu pago.

💵 *Detalle:*
• Préstamo: ${d.codigoPrestamo}
• Cuota: ${d.cuotaNumero}/${d.totalCuotas}
• Pagado: $${d.montoPagado.toLocaleString('es-CO')}

📊 *Estado actual:*
• Saldo restante: $${d.saldoRestante.toLocaleString('es-CO')}
• Próximo pago: ${d.proximoPago}
• Valor cuota: $${d.proximoMonto.toLocaleString('es-CO')}

¡Gracias por tu pago puntual!`
}

export function mensajePrestamoCancelado(d: {
  nombreCliente: string
  codigoPrestamo: string
  montoTotal: number
  fechaCancelacion: string
}): string {
  return `🎉 *PRÉSTAMO CANCELADO*

Felicidades *${d.nombreCliente}*, completaste el pago total.

📋 *Resumen:*
• Código: ${d.codigoPrestamo}
• Total pagado: $${d.montoTotal.toLocaleString('es-CO')}
• Fecha: ${d.fechaCancelacion}

Tu obligación financiera fue *liberada*. ¡Gracias!`
}

export function mensajeRecordatorioPago(d: {
  nombreCliente: string
  codigoPrestamo: string
  montoCuota: number
  fechaVencimiento: string
  diasRestantes: number
  linkPago?: string
}): string {
  const plazoTexto = d.diasRestantes === 1 ? 'mañana' : `en ${d.diasRestantes} días`
  return `⏰ *RECORDATORIO DE PAGO*

Hola *${d.nombreCliente}*, tu cuota vence ${plazoTexto}.

📋 *Detalle:*
• Préstamo: ${d.codigoPrestamo}
• Monto: $${d.montoCuota.toLocaleString('es-CO')}
• Vence: ${d.fechaVencimiento}

${d.linkPago ? `💳 Paga aquí:\n${d.linkPago}` : 'Evita moratorios pagando a tiempo.'}`
}

export function mensajeMora(d: {
  nombreCliente: string
  codigoPrestamo: string
  montoCuota: number
  diasMora: number
  montoMora: number
  totalAdeudado: number
  tasaMora: number
}): string {
  return `⚠️ *AVISO DE MORA*

Hola *${d.nombreCliente}*, tu préstamo presenta mora.

📋 *Estado:*
• Préstamo: ${d.codigoPrestamo}
• Días de mora: ${d.diasMora}
• Cuota pendiente: $${d.montoCuota.toLocaleString('es-CO')}
• Tasa moratoria: ${d.tasaMora}% anual (compuesta diaria)
• Mora generada: $${d.montoMora.toLocaleString('es-CO')}
• *Total a pagar: $${d.totalAdeudado.toLocaleString('es-CO')}*

⚠️ *A los 60 días de mora se iniciará cobro jurídico.*

Contáctanos para regularizar tu pago.`
}

export function mensajeAvisoLegal(d: {
  nombreCliente: string
  codigoPrestamo: string
  abogado: string
  telefonoAbogado: string
  saldoTotal: number
}): string {
  return `⚖️ *AVISO LEGAL - COBRO JUDICIAL*

Estimado/a *${d.nombreCliente}*:

Su préstamo *${d.codigoPrestamo}* con saldo de *$${d.saldoTotal.toLocaleString('es-CO')}* fue derivado a cobro jurídico por incumplimiento de pago (60+ días de mora).

👤 *Abogado asignado:* ${d.abogado}
📞 *Contacto:* ${d.telefonoAbogado}

Comunícate de inmediato para llegar a un acuerdo y evitar:
• Embargo de cuentas
• Embargo de salarios
• Medidas cautelares

*Aún estás a tiempo de resolverlo amistosamente.*`
}

export function mensajeOTPFirma(d: {
  nombreCliente: string
  codigoOtp: string
  tipoDocumento: string
}): string {
  return `🔐 *CÓDIGO DE VERIFICACIÓN DE FIRMA*

Hola *${d.nombreCliente}*, tu código OTP para firmar el documento "${d.tipoDocumento}" es:

🔢 *${d.codigoOtp}*

Este código expira en 5 minutos. No lo compartas con nadie. Si no solicitaste esta firma, ignora este mensaje.`
}

export function mensajeLinkPago(d: {
  nombreCliente: string
  codigoPrestamo: string
  cuotaNumero: number
  monto: number
  linkPago: string
  fechaVencimiento: string
}): string {
  return `💳 *LINK DE PAGO*

Hola *${d.nombreCliente}*, genera tu link de pago para la cuota ${d.cuotaNumero} del préstamo ${d.codigoPrestamo}.

💵 *Monto a pagar:* $${d.monto.toLocaleString('es-CO')}
📅 *Vence:* ${d.fechaVencimiento}

👉 *Paga aquí:*
${d.linkPago}

Una vez pago, el sistema lo registrará automáticamente.`
}

export function mensajeCampaña(d: {
  titulo: string
  descripcion: string
  contenido?: string
}): string {
  return `📢 *${d.titulo}*

${d.descripcion}

${d.contenido || ''}`
}

/**
 * Helper para guardar notificación en BD con linkWaMe
 * Uso:
 *   const { telefono, mensaje, tipo } = ...
 *   const envio = await enviarWhatsApp(telefono, mensaje)
 *   await guardarNotificacion({ db, prestamoId, telefono, tipo, mensaje, envio })
 */
export async function guardarNotificacion(params: {
  db: any
  prestamoId?: string | null
  telefono: string
  tipo: string
  mensaje: string
  envio: ResultadoEnvio
}) {
  const { db, prestamoId, telefono, tipo, mensaje, envio } = params

  // Determinar estado: si exito=true es ENVIADO, si tiene linkWaMe es PENDIENTE_MANUAL, sino FALLIDO
  let estado = 'FALLIDO'
  if (envio.exito) {
    estado = 'ENVIADO'
  } else if (envio.linkWaMe) {
    estado = 'PENDIENTE_MANUAL'
  }

  return db.notificacionLog.create({
    data: {
      prestamoId: prestamoId || null,
      clienteTelefono: telefono,
      tipo,
      mensaje,
      estado,
      error: envio.error || null,
      linkWaMe: envio.linkWaMe || null,
      // v4.12 (QA M09 TC-NOT-003): persistir wamid de WhatsApp Cloud API
      wamid: envio.wamid || null,
      // v4.12 (QA M09 TC-NOT-014): registrar canal usado
      canal: envio.canal || null,
      fechaEnvio: new Date(),
    },
  })
}
