// =====================================================
// bot-plantillas.ts — PLANTILLAS MULTI-VARIANTE POR INTENT
// =====================================================
// Cada intent tiene 3-6 plantillas con ${placeholders} que se
// sustituyen dinámicamente. El motor conversacional rota entre
// estas variantes para que el bot nunca repita la misma respuesta
// dos veces seguidas.
//
// Filosofía:
//  - PROSA natural, NO listas numeradas con 1️⃣2️⃣3️⃣
//  - Máximo 2-3 bullets si los hay, y cortos
//  - Emojis solo cuando aportan (no decorativos en cada línea)
//  - Tono cercano pero profesional (asesor real)
//  - Follow-ups contextuales al final
// =====================================================

import type { ContextoCliente } from './bot-cliente-nlu'
import { formatearMoneda } from './finanzas'
import { formatearRelativo } from './bot-conversacional'

function primerNombre(nombre: string): string {
  return nombre.split(' ')[0] || nombre
}

function fmtFecha(fecha: Date | null | string): string {
  if (!fecha) return 'sin fecha registrada'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (isNaN(d.getTime())) return 'sin fecha registrada'
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

// =====================================================
// ESTRUCTURA: cada intent tiene su set de plantillas
// =====================================================

export interface PlantillasIntent {
  intent: string
  plantillas: string[]
  // Para saludo/despedida usamos el composer general
  escalar?: boolean
}

// Pre-computar variables frecuentes para uso en plantillas
interface VarsComunes {
  cliente: string
  clienteCompleto: string
  telefono: string
  email: string
  saldoTotal: string
  capital: string
  interes: string
  cuota: string
  fechaVence: string
  fechaVenceRelativa: string
  cuotasPagadas: number
  numeroCuotas: number
  progreso: number
  diasMora: number
  codigoPrestamo: string
  estadoPrestamo: string
  estadoMoraMensaje: string
  frecuencia: string
  montoPrincipal: string
  saldoCapital: string
  saldoInteres: string
  capitalPagado: string
  tienePrestamos: boolean
  cantidadPrestamos: number
}

function extraerVars(ctx: ContextoCliente): VarsComunes {
  const p = ctx.prestamosActivos[0]
  const progreso = p ? Math.round((p.cuotasPagadas / p.numeroCuotas) * 100) : 0
  const capitalPagado = p ? p.montoPrincipal - p.saldoCapital : 0
  const estadoPrestamo = p?.estado || '—'
  const diasMora = p?.diasMora || 0
  const codigoPrestamo = p?.codigo || '—'

  let estadoMoraMensaje: string
  if (!p) {
    estadoMoraMensaje = 'Actualmente no tienes solicitudes activos.'
  } else if (estadoPrestamo === 'EN_MORA') {
    estadoMoraMensaje = `⚠️ Tu crédito ${codigoPrestamo} tiene ${diasMora} días de mora. Se están generando intereses moratorios diarios sobre la cuota vencida.`
  } else {
    estadoMoraMensaje = `Vas al día con tu crédito ${codigoPrestamo}. ✅`
  }

  return {
    cliente: primerNombre(ctx.cliente.nombre),
    clienteCompleto: ctx.cliente.nombre,
    telefono: ctx.cliente.telefono || 'tu WhatsApp registrado',
    email: ctx.cliente.email || 'tu correo registrado',
    saldoTotal: p ? formatearMoneda(p.saldoTotal) : '$0',
    capital: p ? formatearMoneda(p.saldoCapital) : '$0',
    interes: p ? formatearMoneda(p.saldoInteres) : '$0',
    cuota: p ? formatearMoneda(p.montoCuota) : '$0',
    fechaVence: p ? fmtFecha(p.fechaVencimiento) : 'sin fecha',
    fechaVenceRelativa: p ? formatearRelativo(p.fechaVencimiento) : 'sin fecha',
    cuotasPagadas: p?.cuotasPagadas || 0,
    numeroCuotas: p?.numeroCuotas || 0,
    progreso,
    diasMora,
    codigoPrestamo,
    estadoPrestamo,
    estadoMoraMensaje,
    frecuencia: p?.frecuencia?.toLowerCase() || 'mensual',
    montoPrincipal: p ? formatearMoneda(p.montoPrincipal) : '$0',
    saldoCapital: p ? formatearMoneda(p.saldoCapital) : '$0',
    saldoInteres: p ? formatearMoneda(p.saldoInteres) : '$0',
    capitalPagado: formatearMoneda(capitalPagado),
    tienePrestamos: ctx.prestamosActivos.length > 0,
    cantidadPrestamos: ctx.prestamosActivos.length,
  }
}

// =====================================================
// SALUDO
// =====================================================

export const PLANTILLAS_SALUDO: PlantillasIntent = {
  intent: 'SALUDO',
  plantillas: [
    '¡Hola, ${cliente}! 👋 Cuéntame qué necesitas. Puedo ayudarte con tu saldo, fechas de pago, renovaciones, requisitos para nuevos créditos y trámites del portal. ¿Qué quieres saber?',
    '¡Buenas, ${cliente}! Aquí estoy. ¿Tienes alguna consulta sobre tu solicitud o quieres hacer un trámite?',
    'Holaa ${cliente} 😊 ¿En qué te ayudo hoy? Puedo revisar tu saldo, próximos pagos, o lo que necesites.',
    '¡Hey ${cliente}! Listo para ayudarte. Dime, ¿qué necesitas?',
    'Hola, ${cliente}. Tengo acceso a tu información de solicitud, pagos y trámites del portal. ¿Qué quieres revisar?',
  ],
}

// =====================================================
// SALDO
// =====================================================

export const PLANTILLAS_SALDO: PlantillasIntent = {
  intent: 'SALDO',
  plantillas: [
    // Sin solicitudes activos
    '${cliente}, actualmente no tienes solicitudes activos. Si quieres información para sacar uno nuevo, dime "requisitos" y te explico.',
    'Veo que no tienes créditos activos en este momento, ${cliente}. ¿Quieres que te cuente qué necesitas para solicitar uno?',
    // Con un solicitud
    'Tu saldo pendiente en el crédito ${codigoPrestamo} es de ${saldoTotal}. De eso, ${saldoCapital} es capital y ${saldoInteres} son intereses. Vas en ${cuotasPagadas} de ${numeroCuotas} cuotas (${progreso}%).',
    'Mira ${cliente}, tu crédito ${codigoPrestamo} tiene un saldo de ${saldoTotal}. El capital que te falta es ${saldoCapital} y los intereses devengados son ${saldoInteres}. Llevas ${cuotasPagadas} de ${numeroCuotas} cuotas pagadas.',
    'En el crédito ${codigoPrestamo} debes ${saldoTotal} hasta hoy. Eso se compone de ${saldoCapital} de capital más ${saldoInteres} de interés. Tu avance es del ${progreso}% (${cuotasPagadas}/${numeroCuotas} cuotas).',
    // En mora
    '⚠️ ${cliente}, tu crédito ${codigoPrestamo} está en mora hace ${diasMora} días. El saldo total a pagar es ${saldoTotal} (capital ${saldoCapital} + interés ${saldoInteres} + mora generada). Te recomiendo ponerte al día cuanto antes para evitar más intereses.',
    'Tu saldo actual es ${saldoTotal} en el crédito ${codigoPrestamo}. Llevas ${cuotasPagadas} de ${numeroCuotas} cuotas. El detalle: capital pendiente ${saldoCapital}, interés ${saldoInteres}.',
  ],
}

// =====================================================
// FECHA DE PAGO
// =====================================================

export const PLANTILLAS_FECHA_PAGO: PlantillasIntent = {
  intent: 'FECHA_PAGO',
  plantillas: [
    'Tu próxima cuota del crédito ${codigoPrestamo} vence ${fechaVenceRelativa} (${fechaVence}). El valor es ${cuota} con frecuencia ${frecuencia}. Te recomiendo pagar antes de la fecha para evitar intereses de mora.',
    '${cliente}, la próxima cuota de tu crédito ${codigoPrestamo} es de ${cuota} y vence ${fechaVenceRelativa}. Frecuencia: ${frecuencia}. Si pagas a tiempo, no se generan intereses moratorios.',
    'El próximo pago de tu crédito ${codigoPrestamo} es ${cuota}, ${frecuencia}, y vence ${fechaVence} (o sea, ${fechaVenceRelativa}).',
    'Mira, tu cuota ${frecuencia} de ${cuota} vence ${fechaVenceRelativa}. Crédito ${codigoPrestamo}, ${cuotasPagadas}/${numeroCuotas} cuotas pagadas.',
    'Para tu crédito ${codigoPrestamo}: próxima cuota ${cuota}, vence ${fechaVence}. ${progreso}% completado (${cuotasPagadas}/${numeroCuotas}).',
  ],
}

// =====================================================
// CUOTAS PAGADAS / HISTORIAL
// =====================================================

export const PLANTILLAS_CUOTAS_PAGADAS: PlantillasIntent = {
  intent: 'CUOTAS_PAGADAS',
  plantillas: [
    'Vas en ${cuotasPagadas} de ${numeroCuotas} cuotas (${progreso}%) en el crédito ${codigoPrestamo}. Has abonado ${capitalPagado} al capital. ¡Vas por buen camino!',
    'Vas en ${cuotasPagadas} de ${numeroCuotas} cuotas (${progreso}%) en el crédito ${codigoPrestamo}. Has abonado ${capitalPagado} al capital. Aún falta un poco, pero vas bien.',
    'Tu progreso en el crédito ${codigoPrestamo}: ${cuotasPagadas}/${numeroCuotas} cuotas pagadas, ${progreso}% completado. Del capital inicial (${montoPrincipal}) ya has cancelado ${capitalPagado}.',
    '${cliente}, llevas ${cuotasPagadas} de ${numeroCuotas} cuotas pagadas en el crédito ${codigoPrestamo} (${progreso}%).',
    'En tu crédito ${codigoPrestamo}: ${progreso}% pagado (${cuotasPagadas}/${numeroCuotas} cuotas). Capital abonado: ${capitalPagado} de ${montoPrincipal}.',
  ],
}

// =====================================================
// MÉTODOS DE PAGO
// =====================================================

export const PLANTILLAS_METODOS_PAGO: PlantillasIntent = {
  intent: 'METODOS_PAGO',
  plantillas: [
    'Puedes pagar desde el Portal del Cliente con PSE, Bancolombia transferencia, Nequi, Daviplata o tarjetas en datáfono. También en efectivo en oficina. Si quieres ir directo, entra al Portal → Próximos Pagos y selecciona la cuota.',
    'Tienes varias opciones, ${cliente}: PSE (acredita en minutos), Bancolombia (transferencia o consignación), Nequi, Daviplata, tarjeta o efectivo en oficina. Todo se gestiona desde el Portal → Próximos Pagos.',
    'Lo más rápido es PSE desde el Portal, acredita en minutos. También aceptamos Bancolombia, Nequi, Daviplata, tarjetas y efectivo. Entras al Portal, vas a Próximos Pagos y eliges el método.',
    'Para pagar tu cuota: entra al Portal, ve a "Próximos Pagos", elige la cuota y el método (PSE, Bancolombia, Nequi, Daviplata, tarjeta o efectivo). Confirmas y listo, te llega el comprobante por WhatsApp.',
  ],
}

// =====================================================
// RENOVACIÓN
// =====================================================

export const PLANTILLAS_RENOVACION: PlantillasIntent = {
  intent: 'RENOVACION',
  plantillas: [
    'Para renovar tu crédito: entra al Portal → Solicitar crédito → Renovación. El sistema trae tu saldo pendiente automáticamente y calcula el excedente que te toca. Requisito: estar al día (sin mora). Firmas los TyC con OTP por WhatsApp y listo.',
    '${cliente}, la renovación se hace desde el Portal: vas a "Solicitar crédito" → "Renovación", eliges el crédito actual, pones el nuevo monto que necesitas, y el sistema te dice cuánto te queda libre tras pagar el saldo anterior. Firma con OTP y se desembolsa en 24h.',
    'La renovación reemplaza tu solicitud actual por uno nuevo con el monto que pidas. Se hace desde el Portal → Renovación. Trae tu saldo automáticamente, calcula el excedente, firmas con OTP y se desembolsa. Necesitas estar al día en pagos.',
    'Si estás al día, puedes renovar desde el Portal: Solicitar crédito → Renovación. El sistema paga tu saldo pendiente con parte del nuevo solicitud y te entrega el resto. Firma con OTP por WhatsApp y se desembolsa en 24h hábiles.',
  ],
}

// =====================================================
// REQUISITOS
// =====================================================

export const PLANTILLAS_REQUISITOS: PlantillasIntent = {
  intent: 'REQUISITOS',
  plantillas: [
    'Para un nuevo crédito necesitas: cédula de ciudadanía, teléfono activo con WhatsApp, correo electrónico e ingresos comprobables. Codeudor es opcional (solo para montos altos o plazos largos). Lo solicitas desde el Portal → Solicitar crédito y te responden en máx. 24h hábiles.',
    '${cliente}, los requisitos son sencillos: cédula, WhatsApp activo, correo y ingresos comprobables. Si pides más de $2.000.000 o plazo mayor a 6 meses, te pedimos codeudor. Lo haces todo desde el Portal, subes tu cédula (frente y reverso), firmas TyC con OTP y se desembolsa.',
    'Documentación: cédula, teléfono, correo, ingresos. Para montos altos, codeudor. Proceso: entras al Portal → Solicitar crédito, llenas el formulario, subes fotos de tu cédula, esperas aprobación (24h hábiles máximo), firmas con OTP y recibes el dinero.',
    'Básico: cédula, WhatsApp, correo, ingresos. Para montos desde $2M o plazos largos, codeudor con cédula y ingresos propios. Todo el trámite es online desde el Portal del Cliente.',
  ],
}

// =====================================================
// SIMULADOR
// =====================================================

export const PLANTILLAS_SIMULADOR: PlantillasIntent = {
  intent: 'SIMULADOR',
  plantillas: [
    'Para simular antes de pedir: entra al Portal → Simulador, pones el monto, eliges plazo y frecuencia, y el sistema te calcula el valor de la cuota, el interés total y el total a pagar. La simulación es referencial, la tasa final se confirma al aprobar tu solicitud.',
    'Desde el Portal → Simulador puedes calcular tu cuota antes de solicitar. Ingresa monto, plazo y frecuencia (quincenal o mensual). Te muestra cuota, interés y total. Si te cuadra, puedes continuar con la solicitud directamente.',
    '${cliente}, el simulador está en el Portal: ingresas monto, plazo y frecuencia, y te estima la cuota y el total a pagar. Es solo referencial, la tasa real se confirma al aprobar.',
  ],
}

// =====================================================
// TASA DE INTERÉS
// =====================================================

export const PLANTILLAS_TASA_INTERES: PlantillasIntent = {
  intent: 'TASA_INTERES',
  plantillas: [
    'La tasa aplicada a tu crédito ${codigoPrestamo} es fija sobre el capital inicial. Puedes verla en detalle en el Portal → Créditos → ${codigoPrestamo}. La moratoria solo se aplica sobre cuotas vencidas, no sobre el saldo total.',
    '${cliente}, tu crédito ${codigoPrestamo} tiene una tasa fija sobre el capital inicial. Revisa el detalle en el Portal → Créditos. La tasa moratoria (solo si te atrasas) se calcula sobre la cuota vencida, no sobre todo el saldo.',
    'Tu tasa es fija y está definida en tu contrato. La puedes ver en el Portal → Créditos → ${codigoPrestamo}. Si te atrasas, la mora se calcula solo sobre la cuota vencida (no sobre el saldo total).',
  ],
}

// =====================================================
// MONTO SOLICITUD
// =====================================================

export const PLANTILLAS_MONTO_PRESTAMO: PlantillasIntent = {
  intent: 'MONTO_PRESTAMO',
  plantillas: [
    'Los montos varían por categoría: básica de $100.000 a $1.000.000, intermedia hasta $3.000.000, y premium hasta $10.000.000. El monto aprobado depende de tus ingresos, historial de pagos y capacidad de endeudamiento. El simulador del Portal te da una estimación rápida.',
    'Prestamos desde $100.000 hasta $10.000.000 según tu categoría. El monto exacto depende de tus ingresos comprobables, historial y si tienes codeudor. Usa el simulador del Portal para estimar.',
    '${cliente}, los cupos van desde $100k hasta $10M. La categoría (básica, intermedia, premium) define el tope. El monto aprobado depende de ingresos, historial y codeudor. Simúlalo desde el Portal para tener una idea.',
  ],
}

// =====================================================
// PLAZO
// =====================================================

export const PLANTILLAS_PLAZO: PlantillasIntent = {
  intent: 'PLAZO',
  plantillas: [
    'Los plazos van de 1 a 24 meses, con frecuencia quincenal o mensual. Por ejemplo: $500.000 a 2 meses son 4 cuotas quincenales de aprox. $175.000. $1.000.000 a 6 meses son 6 cuotas mensuales de aprox. $200.000. El simulador del Portal te da el cálculo exacto.',
    'Puedes elegir de 1 a 24 meses, quincenal o mensual. Ejemplo: $1.000.000 a 6 meses, mensual, te da cuotas cercanas a $200.000. $2.000.000 a 12 meses, cuotas similares. Simula desde el Portal para tu caso.',
    '${cliente}, el plazo mínimo es 1 mes y el máximo 24, con cuotas quincenales o mensuales. El simulador del Portal te calcula el valor exacto de la cuota según el monto y plazo que elijas.',
  ],
}

// =====================================================
// FONDO DE GARANTÍA
// =====================================================

export const PLANTILLAS_FONDO_GARANTIA: PlantillasIntent = {
  intent: 'FONDO_GARANTIA',
  plantillas: [
    'El fondo de garantía es opcional — lo activa el gestor al crear el crédito, no todos los solicitudes lo llevan. Cuando aplica, se cobra por separado (no se descuenta del desembolso) y se guarda en una caja exclusiva (CAJA-GARANTIA). Se devuelve al finalizar el solicitud previa verificación de cumplimiento de tus obligaciones.',
    '${cliente}, el fondo de garantía NO es obligatorio. Lo define el gestor crédito por crédito. Si tu solicitud lo tiene activado, el monto (habitualmente 5% del capital) se cobra aparte al iniciar el crédito y se guarda en una caja separada. Se te devuelve al terminar de pagar todas las cuotas.',
    'El fondo de garantía es una protección opcional. No todos los créditos lo llevan: solo los que el gestor determine. Si tu crédito lo tiene, el monto se guarda en CAJA-GARANTIA y se devuelve al finalizar el solicitud. Si tu crédito no lo tiene, no se te cobra nada por este concepto.',
  ],
}

// =====================================================
// MORA
// =====================================================

export const PLANTILLAS_MORA: PlantillasIntent = {
  intent: 'MORA',
  plantillas: [
    '${estadoMoraMensaje} Si te atrasas, se genera interés moratorio diario compuesto sobre la cuota vencida. Recibirás recordatorios por WhatsApp y, tras 60 días de mora, el caso pasa a cobro jurídico. Si tienes dificultad para pagar, te conviene renegociar antes de caer en mora.',
    '${estadoMoraMensaje} La mora genera interés diario compuesto sobre la cuota vencida. Tras 60 días, el caso pasa a cobro jurídico. Si crees que vas a tener problemas para pagar, mejor renegocia antes: escribe "renegociar" y te explico.',
    '${estadoMoraMensaje} Si te atrasas, se genera interés moratorio diario (compuesto) sobre la cuota vencida, te llegan recordatorios por WhatsApp, y después de 60 días el caso pasa a jurídico. Si ves que no podrás pagar a tiempo, escríbeme "renegociar" para ver opciones.',
  ],
}

// =====================================================
// RENEGOCIACIÓN (escala a humano)
// =====================================================

export const PLANTILLAS_RENEGOCIACION: PlantillasIntent = {
  intent: 'RENEGOCIACION',
  escalar: true,
  plantillas: [
    'Entiendo, ${cliente}. La renegociación depende de tu caso específico (monto, días de mora, capacidad de pago). Voy a conectar tu caso con un asesor humano que revisará tu situación y te propondrá opciones: aplazamiento, refinanciación de mora, o plan personalizado. Te contactarán por WhatsApp.',
    '${cliente}, para renegociar necesito que un asesor revise tu caso. Te puede proponer: aplazar una cuota, refinanciar la mora, o armar un plan de pagos personalizado. Ya dejé tu solicitud escalada, te contactan por WhatsApp.',
    'Esto requiere atención personalizada porque depende de tu saldo, días de mora y capacidad de pago. Voy a pasar tu caso a un asesor que te propondrá opciones de renegociación. Ten a mano tu cédula y una propuesta de cuándo podrías pagar.',
  ],
}

// =====================================================
// ESTADO DE CUENTA
// =====================================================

export const PLANTILLAS_ESTADO_CUENTA: PlantillasIntent = {
  intent: 'ESTADO_CUENTA',
  plantillas: [
    'Para descargar tu estado de cuenta en PDF: entra al Portal → Créditos → tu solicitud activo → "Estado de Cuenta" o "Descargar PDF". El PDF trae saldo, cuotas pagadas, próximos vencimientos y movimientos detallados.',
    '${cliente}, el estado de cuenta lo descargas desde el Portal: ve a Créditos, selecciona tu solicitud y dale a "Descargar PDF". Incluye todos los movimientos y el saldo al día.',
    'El PDF del estado de cuenta está en el Portal → Créditos → tu solicitud → botón "Estado de Cuenta". Trae el detalle completo: saldo, cuotas pagadas, próximos vencimientos y movimientos.',
  ],
}

// =====================================================
// PIN
// =====================================================

export const PLANTILLAS_PIN_CAMBIAR: PlantillasIntent = {
  intent: 'PIN_CAMBIAR',
  plantillas: [
    'Para cambiar tu PIN: entra al Portal con tu PIN actual → Mi Perfil → Cambiar PIN → ingresas el actual y el nuevo (4-6 dígitos) → confirmas. Evita secuencias como 1234 o 0000, y no uses tu año de nacimiento.',
    '${cliente}, el cambio de PIN lo haces desde el Portal: Mi Perfil → Cambiar PIN. Pones tu PIN actual, luego el nuevo dos veces. Debe ser de 4 a 6 dígitos, sin secuencias obvias.',
    'Cambia tu PIN desde el Portal: Mi Perfil → Cambiar PIN. Te pide el actual y el nuevo (4-6 dígitos). Te recomiendo no usar fechas de nacimiento ni secuencias tipo 1234.',
  ],
}

export const PLANTILLAS_PIN_OLVIDO: PlantillasIntent = {
  intent: 'PIN_OLVIDO',
  escalar: true,
  plantillas: [
    'Por seguridad, el PIN es un dato cifrado que ni nosotros podemos ver. Voy a pasar tu caso a un asesor que verificará tu identidad y te ayudará a restablecerlo. Ten lista tu cédula y el teléfono registrado.',
    '${cliente}, no podemos ver tu PIN (está cifrado). Lo que hacemos es verificarte y restablecerlo. Ya escalé tu caso a un asesor, te contactan por WhatsApp. Ten tu cédula a mano.',
    'Para restablecer tu PIN, un asesor debe verificarte. Voy a escalar tu caso. Ten lista tu cédula y el correo/WhatsApp que registraste para que confirmen tu identidad.',
  ],
}

// =====================================================
// ACCESO PORTAL
// =====================================================

export const PLANTILLAS_ACCESO_PORTAL: PlantillasIntent = {
  intent: 'ACCESO_PORTAL',
  plantillas: [
    'Para entrar al Portal: usa la URL que te enviamos por WhatsApp al registrar tu primer solicitud. Digitas tu cédula (sin puntos ni espacios) y tu PIN de 4-6 dígitos. Si te sale "Cédula no encontrada", revisa que sea la misma con la que te registraste. Si falla el PIN 5 veces, se bloquea 15 min automáticamente.',
    '${cliente}, entras al Portal con la URL que te mandamos por WhatsApp al primer solicitud. Pones cédula (sin puntos) y PIN. Si te bloquea por intentos, espera 15 minutos y vuelve a intentar. Si no tienes PIN, escríbeme "asesor" para que te lo asignen.',
    'Para acceder: URL del Portal (te la enviamos por WhatsApp), cédula sin puntos ni espacios, y PIN. Si después de 5 intentos falla, se bloquea 15 minutos. Si no recuerdas tu PIN, dime "olvidé mi pin" y te escalo con un asesor.',
  ],
}

export const PLANTILLAS_PORTAL_BLOQUEO: PlantillasIntent = {
  intent: 'PORTAL_BLOQUEO',
  plantillas: [
    'El bloqueo es automático después de 5 intentos fallidos y se libera solo a los 15 minutos. Espera ese tiempo y vuelve a intentar con tu PIN correcto. Si no lo recuerdas, escríbeme "olvidé mi pin" para que un asesor te ayude a restablecerlo.',
    '${cliente}, el bloqueo dura 15 minutos y se quita solo, no necesita intervención manual. Mientras esperas, asegúrate de recordar bien tu PIN. Si no lo recuerdas, después del desbloqueo puedes escribir "olvidé mi pin" para que un asesor te lo restablezca.',
    'Tranquilo, el bloqueo se libera solo en 15 minutos. Si no recuerdas tu PIN, una vez desbloqueado escríbeme "olvidé mi pin" y te conecto con un asesor para restablecerlo.',
  ],
}

// =====================================================
// HORARIOS
// =====================================================

export const PLANTILLAS_HORARIOS: PlantillasIntent = {
  intent: 'HORARIOS',
  plantillas: [
    'Atendemos de lunes a viernes de 8AM a 6PM, y sábados de 9AM a 1PM. Domingos y festivos no hay atención, pero el Portal funciona 24/7. WhatsApp: 3103674546, correo: jsa@jsadr.com.co.',
    '${cliente}, horario de oficina: L-V 8AM-6PM, sábados 9AM-1PM. Fuera de ese horario puedes usar el Portal (24/7) o escribirnos por WhatsApp (3103674546) y respondemos al iniciar el próximo día hábil.',
    'Lunes a viernes 8AM-6PM, sábados 9AM-1PM. WhatsApp 3103674546, correo jsa@jsadr.com.co. El Portal del Cliente está disponible siempre, los 7 días de la semana, las 24 horas.',
  ],
}

// =====================================================
// CONTACTO
// =====================================================

export const PLANTILLAS_CONTACTO: PlantillasIntent = {
  intent: 'CONTACTO',
  plantillas: [
    'Puedes contactarnos por WhatsApp al 3103674546, por correo a jsa@jsadr.com.co, o por el Portal del Cliente. Para consultas específicas sobre tu solicitud, ten siempre a mano tu cédula.',
    '${cliente}, WhatsApp 3103674546, correo jsa@jsadr.com.co. El Portal del Cliente también está disponible 24/7 para autoservicio.',
    'Datos de contacto: WhatsApp 3103674546 (más rápido), correo jsa@jsadr.com.co, o entra al Portal del Cliente. Para cualquier consulta, ten lista tu cédula.',
  ],
}

// =====================================================
// ASESOR HUMANO
// =====================================================

export const PLANTILLAS_ASESOR_HUMANO: PlantillasIntent = {
  intent: 'ASESOR_HUMANO',
  escalar: true,
  plantillas: [
    'Listo, ${cliente}, voy a pasar tu caso con un asesor humano. Te contactan por WhatsApp al ${telefono} en horario de atención (L-V 8AM-6PM, sábados 9AM-1PM). Tu conversación queda marcada como pendiente.',
    'Entendido. Dejo tu caso escalado al equipo de asesores. Te escriben por WhatsApp al ${telefono} en horario hábil. Mientras tanto, si quieres seguir haciendo consultas por aquí, estoy disponible.',
    'Voy a conectar tu caso con un asesor real, ${cliente}. Tu conversación queda registrada y te contactan al ${telefono}. Si quieres, mientras esperas me puedes preguntar otras cosas y te respondo yo.',
  ],
}

// =====================================================
// QUEJAS Y RECLAMOS
// =====================================================

export const PLANTILLAS_QUEJA_RECLAMO: PlantillasIntent = {
  intent: 'QUEJA_RECLAMO',
  escalar: true,
  plantillas: [
    'Lamento lo que pasó, ${cliente}. Tu voz es importante. Voy a escalar tu caso al área de Atención al Cliente con prioridad. Para agilizar, cuéntame en tu próximo mensaje: qué pasó, cuándo (fecha aproximada) y qué solución esperas. Te contactan en menos de 24 horas hábiles.',
    'Entiendo tu inconformidad y lo tomo en serio. Escalo tu caso al equipo de Atención al Cliente, quien te contactará en menos de 24 horas hábiles. Para que vayan preparados, dime qué pasó, cuándo y qué esperas como solución.',
    '${cliente}, voy a registrar tu queja con prioridad. Alguien de Atención al Cliente te escribe en menos de 24h hábiles. Mientras tanto, si me cuentas con detalle qué pasó, cuándo y qué solución buscas, lo dejo todo documentado en el caso.',
  ],
}

// =====================================================
// CODEUDOR
// =====================================================

export const PLANTILLAS_CODEUDOR: PlantillasIntent = {
  intent: 'CODEUDOR',
  plantillas: [
    'El codeudor es opcional. Se pide para montos superiores a $2.000.000, clientes nuevos sin historial, o plazos mayores a 6 meses. Requisitos del codeudor: cédula, ingresos comprobables, no estar reportado en centrales de riesgo, y aceptar la responsabilidad solidaria. También firma TyC con OTP.',
    '${cliente}, el codeudor es opcional pero lo pedimos para montos desde $2M, clientes nuevos o plazos largos. Tu codeudor necesita cédula, ingresos comprobables y aceptar la responsabilidad. Firma con OTP por WhatsApp igual que tú.',
    'El codeudor va para montos desde $2M, plazos largos, o si eres cliente nuevo. Requisitos: cédula, ingresos comprobables, sin reportes en centrales. Firma TyC con OTP igual que el titular.',
  ],
}

// =====================================================
// DESEMBOLSO
// =====================================================

export const PLANTILLAS_DESEMBOLSO: PlantillasIntent = {
  intent: 'DESEMBOLSO',
  plantillas: [
    'Una vez aprobado y firmado tu solicitud, el desembolso se hace en máximo 24 horas hábiles a la cuenta que registraste. Te avisamos por WhatsApp cuando se haga. Si no recibes el dinero en 24h, verifica tus datos bancarios en el Portal o escríbeme "asesor".',
    '${cliente}, el desembolso tarda máximo 24 horas hábiles después de la firma. Va a la cuenta que registraste en la solicitud. Te mandamos confirmación por WhatsApp al hacer la transferencia. Si pasan 24h y no recibes, revisa los datos de tu cuenta en el Portal.',
    'Tras la firma con OTP, se desembolsa en 24 horas hábiles máximo a tu cuenta registrada. Si tu crédito tiene fondo de garantía activado (lo define el gestor al crearlo), el monto del fondo se cobra por separado y se guarda en una caja exclusiva. Te avisamos por WhatsApp al concretarse la transferencia.',
  ],
}

// =====================================================
// PAGO ANTICIPADO
// =====================================================

export const PLANTILLAS_PAGO_ANTICIPADO: PlantillasIntent = {
  intent: 'PAGO_ANTICIPADO',
  escalar: true,
  plantillas: [
    'Sí puedes pagar antes de tiempo. Dos opciones: pago total (saldas toda la deuda) o abono a capital (pagas un monto extra que reduce el capital pendiente). En ambos casos el interés se recalcula sobre el capital restante, así que pagas menos interés total. Para hacerlo, voy a escalar tu caso a un asesor que te calculará el monto exacto.',
    '${cliente}, el pago anticipado es totalmente posible. Puedes saldar todo o solo abonar al capital. Como el interés se recalcula sobre lo que quedes debiendo, te conviene. Para que un asesor te calcule el monto exacto a pagar hoy, voy a escalar tu caso.',
    'Claro que puedes pagar antes. Pago total (todo de una vez) o abono a capital (un monto extra). El interés se ajusta al capital restante, así que ahorras. Te conecto con un asesor para que te dé la cifra exacta al día de hoy.',
  ],
}

// =====================================================
// CUENTA BANCARIA
// =====================================================

export const PLANTILLAS_CUENTA_BANCARIA: PlantillasIntent = {
  intent: 'CUENTA_BANCARIA',
  plantillas: [
    'Tu cuenta registrada se usa para recibir el desembolso y los reembolsos (fondo de garantía, saldos a favor). Para actualizarla: entra al Portal → Mi Perfil → Datos bancarios, pones banco, tipo de cuenta y número, y guardas. Aceptamos Bancolombia, Nequi, Daviplata, BBVA, Davivienda y Banco de Bogotá.',
    '${cliente}, los datos bancarios se actualizan desde el Portal: Mi Perfil → Datos bancarios. Aceptamos Bancolombia, Nequi, Daviplata, BBVA, Davivienda, Banco de Bogotá. Esa cuenta se usa para desembolsos y reembolsos.',
    'Para cambiar tu cuenta: Portal → Mi Perfil → Datos bancarios. Allí editas banco, tipo y número de cuenta. Bancos aceptados: Bancolombia, Nequi, Daviplata, BBVA, Davivienda, Banco de Bogotá.',
  ],
}

// =====================================================
// CANCELAR SOLICITUD
// =====================================================

export const PLANTILLAS_CANCELAR_PRESTAMO: PlantillasIntent = {
  intent: 'CANCELAR_PRESTAMO',
  escalar: true,
  plantillas: [
    'Depende del estado, ${cliente}. Si está en SOLICITUD (no aprobado), se cancela sin costo desde el Portal. Si está PENDIENTE_ACEPTACION (aprobado, sin firmar), se puede cancelar pero queda registrado en tu historial. Si ya está ACTIVO (desembolsado), no se puede cancelar, solo pagar anticipadamente. Voy a escalar tu caso a un asesor para que revise tu situación específica.',
    '${cliente}, la cancelación depende del estado del crédito: si está en solicitud, sí puedes cancelar desde el Portal. Si ya está aprobado pero sin firmar, también pero queda en historial. Si ya está desembolsado, no se cancela, solo se paga anticipadamente. Te conecto con un asesor para tu caso.',
    'Para cancelar: depende del estado. Si no está aprobado, lo cancelas desde el Portal sin costo. Si está aprobado sin firmar, se puede cancelar pero queda registro. Si ya está desembolsado, no se puede cancelar. Escalo tu caso a un asesor para que vea tu situación.',
  ],
}

// =====================================================
// PRIVACIDAD
// =====================================================

export const PLANTILLAS_PRIVACIDAD: PlantillasIntent = {
  intent: 'PRIVACIDAD',
  plantillas: [
    'Tus datos están protegidos con cifrado en tránsito (HTTPS/TLS), PINs y contraseñas con bcrypt, datos sensibles con AES-256. Cumplimos la Ley 1581 de 2012 (Habeas Data colombiano) y no compartimos tus datos con terceros sin tu consentimiento. Puedes ejercer tus derechos de acceso, rectificación y cancelación escribiendo a jsa@jsadr.com.co.',
    '${cliente}, tu información está cifrada y protegida según estándares bancarios. Cumplimos la Ley 1581 de 2012 de Habeas Data. No compartimos datos con terceros sin tu autorización. Para ejercer tus derechos ARCO, escribe a jsa@jsadr.com.co.',
    'Cumplimos con la Ley 1581 de 2012 (Habeas Data). Tus datos están cifrados (HTTPS, bcrypt, AES-256) y no se comparten con terceros sin tu consentimiento. Para acceso, rectificación o cancelación, escribe a jsa@jsadr.com.co.',
  ],
}

// =====================================================
// UBICACIÓN
// =====================================================

export const PLANTILLAS_UBICACION: PlantillasIntent = {
  intent: 'UBICACION',
  plantillas: [
    'Para atención presencial, contáctanos por WhatsApp al 3103674546 y te indicamos la oficina más cercana. La mayoría de trámites se pueden hacer 100% online desde el Portal del Cliente, así que si quieres evitar desplazarte, cuéntame qué necesitas y te oriento.',
    '${cliente}, la atención principal es online (Portal + WhatsApp 3103674546). Si necesitas atención presencial, escríbenos por WhatsApp y te indicamos la oficina más cercana a tu ubicación.',
    'Lo más ágil es hacer el trámite desde el Portal o por WhatsApp (3103674546). Si requieres atención presencial, contáctanos y te decimos la oficina disponible más cercana.',
  ],
}

// =====================================================
// CERTIFICADO / PAZ Y SALVO
// =====================================================

export const PLANTILLAS_CERTIFICADO: PlantillasIntent = {
  intent: 'CERTIFICADO',
  plantillas: [
    'Puedes descargar el certificado de pagos del año desde el Portal → Historial → "Descargar certificado". El paz y salvo aparece cuando terminas de pagar todas las cuotas del solicitud. El estado de cuenta en PDF está en Créditos → tu solicitud → "Descargar PDF". Todos tienen validez oficial.',
    '${cliente}, los certificados se generan automáticamente: el de pagos del año en Portal → Historial, el paz y salvo cuando terminas tu solicitud, y el estado de cuenta en Créditos → tu solicitud. Todos con validez oficial.',
    'Certificado de pagos: Portal → Historial → Descargar. Paz y salvo: disponible al finalizar el solicitud. Estado de cuenta PDF: Créditos → tu solicitud. Todos son válidos oficialmente.',
  ],
}

// =====================================================
// DESPEDIDA
// =====================================================

export const PLANTILLAS_DESPEDIDA: PlantillasIntent = {
  intent: 'DESPEDIDA',
  plantillas: [
    '¡Listo, ${cliente}! Aquí estoy si necesitas algo más. 😊',
    'Perfecto, cualquier cosa me escribes. ¡Buen día!',
    'Dale, quedo atento. ¡Suerte!',
    'Para servirte, ${cliente}. Vuelve cuando quieras.',
    'Genial. Aquí estoy si surge algo más. 👋',
    '¡Gracias a ti! Estoy disponible cuando me necesites.',
  ],
}

// =====================================================
// REGISTRO MAESTRO: intent → plantillas
// =====================================================

export const PLANTILLAS_POR_INTENT: Record<string, PlantillasIntent> = {
  SALUDO: PLANTILLAS_SALUDO,
  SALDO: PLANTILLAS_SALDO,
  FECHA_PAGO: PLANTILLAS_FECHA_PAGO,
  CUOTAS_PAGADAS: PLANTILLAS_CUOTAS_PAGADAS,
  METODOS_PAGO: PLANTILLAS_METODOS_PAGO,
  RENOVACION: PLANTILLAS_RENOVACION,
  REQUISITOS: PLANTILLAS_REQUISITOS,
  SIMULADOR: PLANTILLAS_SIMULADOR,
  TASA_INTERES: PLANTILLAS_TASA_INTERES,
  MONTO_PRESTAMO: PLANTILLAS_MONTO_PRESTAMO,
  PLAZO: PLANTILLAS_PLAZO,
  FONDO_GARANTIA: PLANTILLAS_FONDO_GARANTIA,
  MORA: PLANTILLAS_MORA,
  RENEGOCIACION: PLANTILLAS_RENEGOCIACION,
  ESTADO_CUENTA: PLANTILLAS_ESTADO_CUENTA,
  PIN_CAMBIAR: PLANTILLAS_PIN_CAMBIAR,
  PIN_OLVIDO: PLANTILLAS_PIN_OLVIDO,
  ACCESO_PORTAL: PLANTILLAS_ACCESO_PORTAL,
  PORTAL_BLOQUEO: PLANTILLAS_PORTAL_BLOQUEO,
  HORARIOS: PLANTILLAS_HORARIOS,
  CONTACTO: PLANTILLAS_CONTACTO,
  ASESOR_HUMANO: PLANTILLAS_ASESOR_HUMANO,
  QUEJA_RECLAMO: PLANTILLAS_QUEJA_RECLAMO,
  CODEUDOR: PLANTILLAS_CODEUDOR,
  DESEMBOLSO: PLANTILLAS_DESEMBOLSO,
  PAGO_ANTICIPADO: PLANTILLAS_PAGO_ANTICIPADO,
  CUENTA_BANCARIA: PLANTILLAS_CUENTA_BANCARIA,
  CANCELAR_PRESTAMO: PLANTILLAS_CANCELAR_PRESTAMO,
  PRIVACIDAD: PLANTILLAS_PRIVACIDAD,
  UBICACION: PLANTILLAS_UBICACION,
  CERTIFICADO: PLANTILLAS_CERTIFICADO,
  DESPEDIDA: PLANTILLAS_DESPEDIDA,
}

// Helper expuesto para usar en bot-cliente-nlu
export function obtenerVarsParaContexto(ctx: ContextoCliente): VarsComunes {
  return extraerVars(ctx)
}
