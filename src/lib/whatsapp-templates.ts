// Plantillas de mensajes WhatsApp para diferentes escenarios del sistema de solicitudes

import { formatCOP, formatDate } from './format'

type PlantillaContext = {
  clienteNombre: string
  monto?: number
  codigo?: string
  fechaVencimiento?: Date | string
  cuota?: number
  numeroCuota?: number
  totalCuotas?: number
  diasMora?: number
  saldoPendiente?: number
  otp?: string
  tasaInteres?: number
  plazoMeses?: number
  enlacePortal?: string
  banco?: string
  cuenta?: string
}

export function tplSolicitudPrestamo(ctx: PlantillaContext): string {
  return [
    `🏦 *SOLICITUD DE SOLICITUD REGISTRADA*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Hemos registrado tu solicitud de solicitud:`,
    `📋 Código: *${ctx.codigo}*`,
    ctx.monto ? `💰 Monto solicitado: *${formatCOP(ctx.monto)}*` : '',
    ctx.plazoMeses ? `📅 Plazo: *${ctx.plazoMeses} meses*` : '',
    ctx.tasaInteres ? `📈 Tasa: *${ctx.tasaInteres}% mensual*` : '',
    ``,
    `Te notificaremos en cuanto sea aprobada.`,
    ``,
    `_Mensaje automático - Por favor no respondas a este número_`,
  ].filter(Boolean).join('\n')
}

export function tplAprobacionPrestamo(ctx: PlantillaContext): string {
  return [
    `✅ *SOLICITUD APROBADO*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `¡Tu solicitud *${ctx.codigo}* fue aprobado!`,
    ctx.monto ? `💰 Monto: *${formatCOP(ctx.monto)}*` : '',
    ctx.cuota ? `💵 Cuota: *${formatCOP(ctx.cuota)}*` : '',
    ctx.numeroCuota && ctx.totalCuotas ? `📅 Cuotas: *${ctx.numeroCuota}/${ctx.totalCuotas}*` : '',
    ctx.fechaVencimiento ? `🗓️ Primer vencimiento: *${formatDate(ctx.fechaVencimiento)}*` : '',
    ``,
    `Para desembolsar, confirma tu aceptación:`,
    ctx.enlacePortal ? `🔗 ${ctx.enlacePortal}` : ``,
    ``,
    `_Mensaje automático - Por favor no respondas_`,
  ].filter(Boolean).join('\n')
}

export function tplDesembolso(ctx: PlantillaContext): string {
  return [
    `💸 *DESEMBOLSO REALIZADO*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Te informamos que se realizó el desembolso:`,
    `📋 Solicitud: *${ctx.codigo}*`,
    ctx.monto ? `💰 Monto: *${formatCOP(ctx.monto)}*` : '',
    ctx.banco && ctx.cuenta ? `🏦 Cuenta: ${ctx.banco} ****${ctx.cuenta?.slice(-4)}` : '',
    ``,
    `Tu solicitud quedó ACTIVO.`,
    ``,
    `_Mensaje automático_`,
  ].filter(Boolean).join('\n')
}

export function tplRecordatorioPago(ctx: PlantillaContext): string {
  return [
    `⏰ *RECORDATORIO DE PAGO*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Te recordamos tu próxima cuota:`,
    `📋 Solicitud: *${ctx.codigo}*`,
    ctx.cuota ? `💵 Valor cuota: *${formatCOP(ctx.cuota)}*` : '',
    ctx.numeroCuota && ctx.totalCuotas ? `📅 Cuota: *${ctx.numeroCuota}/${ctx.totalCuotas}*` : '',
    ctx.fechaVencimiento ? `🗓️ Vence: *${formatDate(ctx.fechaVencimiento)}*` : '',
    ``,
    `Evita cargos por mora realizando tu pago a tiempo.`,
    ``,
    `_Mensaje automático - Por favor no respondas_`,
  ].filter(Boolean).join('\n')
}

export function tplAvisoMora(ctx: PlantillaContext): string {
  return [
    `⚠️ *PAGO VENCIDO*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Tu pago del solicitud *${ctx.codigo}* está vencido:`,
    ctx.cuota ? `💵 Cuota: *${formatCOP(ctx.cuota)}*` : '',
    ctx.diasMora ? `⏱️ Días de mora: *${ctx.diasMora}*` : '',
    ctx.saldoPendiente ? `💰 Saldo pendiente: *${formatCOP(ctx.saldoPendiente)}*` : '',
    ``,
    `🚨 Genera intereses de mora diarios.`,
    `Regulariza cuanto antes para evitar mayor afectación.`,
    ``,
    `_Mensaje automático_`,
  ].filter(Boolean).join('\n')
}

export function tplPagoConfirmado(ctx: PlantillaContext): string {
  return [
    `✅ *PAGO CONFIRMADO*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Hemos registrado tu pago:`,
    `📋 Solicitud: *${ctx.codigo}*`,
    ctx.monto ? `💰 Monto recibido: *${formatCOP(ctx.monto)}*` : '',
    ctx.numeroCuota && ctx.totalCuotas ? `📅 Cuota: *${ctx.numeroCuota}/${ctx.totalCuotas}*` : '',
    ctx.saldoPendiente !== undefined ? `💵 Saldo pendiente: *${formatCOP(ctx.saldoPendiente)}*` : '',
    ``,
    `¡Gracias por tu pago puntual!`,
    ``,
    `_Mensaje automático_`,
  ].filter(Boolean).join('\n')
}

export function tplOTP(ctx: PlantillaContext): string {
  return [
    `🔐 *CÓDIGO DE VERIFICACIÓN*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Tu código de verificación es:`,
    ``,
    `*${ctx.otp}*`,
    ``,
    `⏱️ Válido por 10 minutos.`,
    `🔒 No compartas este código con nadie.`,
    ``,
    `_Mensaje automático - Por favor no respondas_`,
  ].filter(Boolean).join('\n')
}

export function tplCobroJuridico(ctx: PlantillaContext): string {
  return [
    `⚖️ *AVISO COBRO JURÍDICO*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Tu solicitud *${ctx.codigo}* fue derivado a cobro jurídico:`,
    ctx.saldoPendiente ? `💰 Saldo total: *${formatCOP(ctx.saldoPendiente)}*` : '',
    ctx.diasMora ? `⏱️ Días de mora: *${ctx.diasMora}*` : '',
    ``,
    `Comunicate urgentemente para evitar mayores consecuencias legales.`,
    ``,
    `_Mensaje automático_`,
  ].filter(Boolean).join('\n')
}

export function tplEstadoCuenta(ctx: PlantillaContext): string {
  return [
    `📊 *ESTADO DE CUENTA*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Resumen de tu solicitud *${ctx.codigo}*:`,
    ctx.saldoPendiente !== undefined ? `💰 Saldo pendiente: *${formatCOP(ctx.saldoPendiente)}*` : '',
    ctx.cuota ? `💵 Próxima cuota: *${formatCOP(ctx.cuota)}*` : '',
    ctx.fechaVencimiento ? `🗓️ Próximo vencimiento: *${formatDate(ctx.fechaVencimiento)}*` : '',
    ctx.numeroCuota && ctx.totalCuotas ? `📅 Cuotas pagadas: *${ctx.numeroCuota}/${ctx.totalCuotas}*` : '',
    ``,
    `_Mensaje automático_`,
  ].filter(Boolean).join('\n')
}

export function tplBienvenidaCliente(ctx: PlantillaContext): string {
  return [
    `👋 *BIENVENIDO(A)*`,
    ``,
    `Hola *${ctx.clienteNombre}*,`,
    ``,
    `Tu cuenta fue creada exitosamente.`,
    `Ya puedes acceder al portal del cliente para:`,
    `✓ Ver tus solicitudes`,
    `✓ Simular nuevos solicitudes`,
    `✓ Consultar saldos y pagos`,
    `✓ Firmar documentos`,
    ``,
    ctx.enlacePortal ? `🔗 Accede aquí: ${ctx.enlacePortal}` : ``,
    ``,
    `_Mensaje automático_`,
  ].filter(Boolean).join('\n')
}

// Mapa de tipos a funciones
export const PLANTILLAS_NOTIF = {
  SOLICITUD: tplSolicitudPrestamo,
  APROBACION: tplAprobacionPrestamo,
  DESEMBOLSO: tplDesembolso,
  RECORDATORIO_PAGO: tplRecordatorioPago,
  MORA: tplAvisoMora,
  PAGO_CONFIRMADO: tplPagoConfirmado,
  OTP: tplOTP,
  JURIDICO: tplCobroJuridico,
  ESTADO_CUENTA: tplEstadoCuenta,
  BIENVENIDA: tplBienvenidaCliente,
} as const

export type TipoNotificacion = keyof typeof PLANTILLAS_NOTIF
