// =====================================================
// bot-datasets-extra.ts — Datasets expandidos de entrenamiento
// =====================================================
// Añade más variantes lingüísticas a cada intent existente para
// mejorar la cobertura del matching fuzzy. Jerga colombiana,
// abreviaciones, errores comunes, frases incompletas.
// =====================================================

import type { ItemEntrenamiento } from './bot-fuzzy-matcher'

// =====================================================
// CHAT CLIENTES — variantes expandidas
// =====================================================

export const DATASET_CHAT_CLIENTES_EXTRA: ItemEntrenamiento[] = [
  // SALUDO (variantes casuales y formales)
  {
    id: 'CC-SALUDO-EXTRA',
    categoria: 'SALUDO',
    pregunta: 'hola, buenas',
    respuesta: '__PLANTILLA_SALUDO__',
    sinonimos: [
      'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
      'que mas', 'q mas', 'que hubo', 'que hay', 'holi', 'holaa', 'holis',
      'hello', 'hi', 'hey', 'oye', 'bonito dia', 'buen dia',
      'saludos', 'cordial saludo', 'estimados', 'hola soy yo',
      'hola de nuevo', 'hola otra vez', 'buenas otra vez',
    ],
  },
  // SALDO (variantes)
  {
    id: 'CC-SALDO-EXTRA',
    categoria: 'SALDOS',
    pregunta: 'cuanto debo',
    respuesta: '__PLANTILLA_SALDO__',
    sinonimos: [
      'cuanto debo', 'cuanto pago', 'cuanto me queda', 'cuanto me falta',
      'mi saldo', 'saldo pendiente', 'saldo actual', 'lo que debo',
      'mi deuda', 'mi obligacion', 'lo que falta', 'pendiente',
      'cuanto llevo', 'cuanto he pagado', 'mi cuenta', 'estado cuenta',
      'como voy', 'cuanto es la deuda', 'saldo total', 'saldo deudor',
      'ver saldo', 'mirar saldo', 'saber saldo', 'consultar saldo',
      'digame cuanto debo', 'deme mi saldo', 'diga mi saldo',
      'cuanto es lo que debo', 'cuanto dinero debo',
      'saldo del prestamo', 'saldo del credito', 'mi prestamo cuanto va',
    ],
  },
  // FECHA DE PAGO (variantes)
  {
    id: 'CC-FECHA-EXTRA',
    categoria: 'PAGOS',
    pregunta: 'cuando es mi proximo pago',
    respuesta: '__PLANTILLA_FECHA_PAGO__',
    sinonimos: [
      'cuando pago', 'cuando es el pago', 'cuando vence', 'cuando toca pagar',
      'fecha de pago', 'fecha de vencimiento', 'fecha limite',
      'mi proxima cuota', 'la siguiente cuota', 'cuando es la cuota',
      'que dia pago', 'que dia toca', 'cuando debo pagar',
      'cuando es mi pago', 'cuando es mi cuota', 'cuando me toca',
      'proximo pago', 'pago proximo', 'siguiente pago',
      'cuando es el vencimiento', 'dia de pago', 'dia que pago',
      'agenda de pagos', 'calendario de pagos', 'mis fechas',
      'cuando es la proxima', 'cuando viene el cobro',
      'cuando es el siguiente corte', 'cuando me cobran',
    ],
  },
  // MÉTODOS DE PAGO (variantes)
  {
    id: 'CC-METODOS-EXTRA',
    categoria: 'PAGOS',
    pregunta: 'como pago',
    respuesta: '__PLANTILLA_METODOS_PAGO__',
    sinonimos: [
      'como pago', 'como hago el pago', 'como consigno', 'como transfiero',
      'donde pago', 'donde consigno', 'donde transfiero',
      'que banco', 'cuenta bancaria para pagar', 'numero de cuenta',
      'bancolombia', 'nequi', 'daviplata', 'pse', 'efecty', 'baloto',
      'tarjeta', 'datafono', 'pago digital', 'pago online', 'pago web',
      'pago electronico', 'pago por internet', 'pagar con tarjeta',
      'pagar con pse', 'formas de pago', 'medios de pago', 'opciones de pago',
      'como abono', 'como hago un abono', 'donde abono',
      'transferencia', 'consignacion', 'giro',
      'pagar en oficina', 'pago presencial',
    ],
  },
  // RENOVACIÓN (variantes)
  {
    id: 'CC-RENOV-EXTRA',
    categoria: 'PRESTAMO',
    pregunta: 'quiero renovar mi credito',
    respuesta: '__PLANTILLA_RENOVACION__',
    sinonimos: [
      'renovar', 'renovacion', 'renovo', 'quiero renovar',
      'refinanciar', 'refinanciacion', 'refinancio',
      'ampliar credito', 'ampliar prestamo', 'ampliar monto',
      'otro prestamo sobre este', 'prestamo nuevo sobre el actual',
      'cuando puedo renovar', 'puedo renovar', 'renovar ya',
      'solicitar renovacion', 'como renuevo', 'como renuevo mi credito',
      'necesito mas dinero', 'necesito otro prestamo', 'mas plata',
      'prestamo adicional', 'refinanciar deuda', 'renovar el credito',
    ],
  },
  // REQUISITOS (variantes)
  {
    id: 'CC-REQ-EXTRA',
    categoria: 'PRESTAMO',
    pregunta: 'que necesito para un prestamo',
    respuesta: '__PLANTILLA_REQUISITOS__',
    sinonimos: [
      'requisitos', 'que necesito', 'que piden', 'que documentos',
      'documentacion', 'papeles', 'documentos necesarios',
      'como solicito', 'como hago un credito', 'como saco un prestamo',
      'tramite', 'como tramito', 'como empiezo',
      'nuevo credito', 'credito nuevo', 'prestamo nuevo',
      'sacar un prestamo', 'pedir un prestamo', 'solicitar plata',
      'requisitos para credito', 'requisitos para prestamo',
      'que me piden', 'que lleva', 'que hay que llevar',
      'primer prestamo', 'soy nuevo', 'no he tenido prestamos',
    ],
  },
  // MORA (variantes)
  {
    id: 'CC-MORA-EXTRA',
    categoria: 'PAGOS',
    pregunta: 'que pasa si no pago',
    respuesta: '__PLANTILLA_MORA__',
    sinonimos: [
      'mora', 'atraso', 'me atrasé', 'me atrase', 'tarde',
      'no pude pagar', 'no pague', 'me quedé sin pagar',
      'cuota vencida', 'vencida', 'vencio', 'se vencio',
      'interes moratorio', 'mora diaria', 'recargo', 'penalizacion',
      'que pasa si atraso', 'que pasa si no pago', 'consecuencias',
      'me cobran mora', 'cuanto es la mora', 'como se calcula la mora',
      'estoy en mora', 'tengo mora', 'dias de mora',
      'se me paso el pago', 'se me olvido pagar', 'me equivoque de fecha',
    ],
  },
  // RENEGOCIACIÓN (variantes)
  {
    id: 'CC-RENEG-EXTRA',
    categoria: 'PAGOS',
    pregunta: 'no puedo pagar',
    respuesta: '__PLANTILLA_RENEGOCIACION__',
    sinonimos: [
      'no puedo pagar', 'no tengo dinero', 'no tengo como pagar',
      'no pude pagar', 'no alcance', 'no me alcanza',
      'renegociar', 'renegociacion', 'negociar deuda',
      'acuerdo de pago', 'plan de pagos', 'reestructurar',
      'aplazar pago', 'postergar', 'prorroga', 'extension',
      'condonar', 'quitar mora', 'perdonar intereses',
      'saldar deuda', 'convenir', 'arreglar',
      'tengo problemas', 'me quedé sin trabajo', 'me liquidaron',
      'me enfermé', 'gasto imprevisto', 'no llego a fin de mes',
    ],
  },
  // ASESOR HUMANO (variantes)
  {
    id: 'CC-ASESOR-EXTRA',
    categoria: 'ASESOR',
    pregunta: 'quiero hablar con un asesor',
    respuesta: '__PLANTILLA_ASESOR_HUMANO__',
    sinonimos: [
      'asesor', 'humano', 'persona', 'operador', 'agente',
      'hablar con alguien', 'hablar con un humano', 'hablar con una persona',
      'llamenme', 'contactenme', 'contactarme',
      'atencion al cliente', 'servicio al cliente',
      'no me ayudo el bot', 'no me sirve el bot', 'no entiendo el bot',
      'representante', 'alguien real', 'alguien en persona',
      'quiero hablar', 'necesito una persona', 'atencion personalizada',
      'donde los llamo', 'telefono de atencion', 'whatsapp de alguien',
    ],
  },
  // DESPEDIDA (variantes)
  {
    id: 'CC-DESP-EXTRA',
    categoria: 'DESPEDIDA',
    pregunta: 'gracias, chao',
    respuesta: '__PLANTILLA_DESPEDIDA__',
    sinonimos: [
      'gracias', 'muchas gracias', 'mil gracias', 'agradezco',
      'perfecto', 'genial', 'excelente', 'muy bien', 'listo',
      'ok', 'okis', 'dale', 'va', 'ya', 'ya esta', 'listo gracias',
      'chao', 'adios', 'hasta luego', 'nos vemos', 'bye',
      'suerte', 'me voy', 'ya me voy', 'hasta pronto',
      'muchisimas gracias', 'super', 'chevere', 'bacano',
      'thx', 'thanks', 'thank you',
    ],
  },
  // CODEUDOR (variantes)
  {
    id: 'CC-CODEUDOR-EXTRA',
    categoria: 'FAQ',
    pregunta: 'necesito codeudor',
    respuesta: '__PLANTILLA_CODEUDOR__',
    sinonimos: [
      'codeudor', 'fiador', 'aval', 'garante', 'avalista',
      'quien puede ser codeudor', 'requisitos del codeudor',
      'sin codeudor', 'no tengo codeudor', 'no tengo fiador',
      'codeudor requisitos', 'que necesita el codeudor',
      'puede ser codeudor mi mama', 'puede ser mi esposo',
      'familiar codeudor', 'amigo codeudor',
    ],
  },
  // DESEMBOLSO (variantes)
  {
    id: 'CC-DESEM-EXTRA',
    categoria: 'FAQ',
    pregunta: 'cuando me depositan',
    respuesta: '__PLANTILLA_DESEMBOLSO__',
    sinonimos: [
      'desembolso', 'cuando me depositan', 'cuando me dan el dinero',
      'cuando recibo el dinero', 'cuando me consignan',
      'donde me depositan', 'cuenta para desembolso',
      'transferencia del prestamo', 'tiempo de desembolso',
      'ya desembolsaron', 'aun no me llega', 'no me han consignado',
      'donde queda el dinero', 'cuando llega el plata',
      'cuando me transferencia', 'demora del desembolso',
    ],
  },
  // TASA INTERÉS (variantes)
  {
    id: 'CC-TASA-EXTRA',
    categoria: 'PRESTAMO',
    pregunta: 'cuanto es el interes',
    respuesta: '__PLANTILLA_TASA_INTERES__',
    sinonimos: [
      'tasa', 'interes', 'tasa de interes', 'tasa anual', 'tasa mensual',
      'cuanto es el interes', 'que tasa cobran', 'que interes cobran',
      'interes moratorio', 'tasa mora', 'interes de mora',
      'porcentaje', 'porcentaje de interes', 'tasa aplicada',
      'interes del prestamo', 'interes del credito', 'como se calcula el interes',
      'tasa fija', 'tasa variable', 'EA', 'tasa efectiva',
    ],
  },
  // MONTO PRÉSTAMO (variantes)
  {
    id: 'CC-MONTO-EXTRA',
    categoria: 'PRESTAMO',
    pregunta: 'cuanto me prestan',
    respuesta: '__PLANTILLA_MONTO_PRESTAMO__',
    sinonimos: [
      'monto', 'monto maximo', 'monto minimo', 'monto disponible',
      'cuanto prestan', 'cuanto me prestan', 'cuanto puedo pedir',
      'limite', 'cupos', 'cupo maximo', 'cupo disponible',
      'valor del prestamo', 'valor maximo', 'cuanto puedo sacar',
      'minimo prestamo', 'maximo prestamo',
      'rango de montos', 'montos disponibles', 'opciones de monto',
    ],
  },
  // PLAZO (variantes)
  {
    id: 'CC-PLAZO-EXTRA',
    categoria: 'PRESTAMO',
    pregunta: 'a cuantos meses',
    respuesta: '__PLANTILLA_PLAZO__',
    sinonimos: [
      'plazo', 'cuantos meses', 'cuanto tiempo', 'duracion',
      'plazo maximo', 'plazo minimo', 'plazo del prestamo',
      'cuotas', 'cuantas cuotas', 'numero de cuotas',
      'frecuencia', 'frecuencia de pago', 'quincenal o mensual',
      'cada cuanto pago', 'cada cuanto se paga',
      'plazos disponibles', 'opciones de plazo',
    ],
  },
  // HORARIOS (variantes)
  {
    id: 'CC-HOR-EXTRA',
    categoria: 'INFO',
    pregunta: 'a que hora atienden',
    respuesta: '__PLANTILLA_HORARIOS__',
    sinonimos: [
      'horario', 'horarios', 'a que hora', 'cuando atienden',
      'dias habiles', 'horario de oficina', 'horario atencion',
      'estan abiertos', 'que dia atienden', 'fin de semana',
      'sabados', 'domingos', 'festivos', 'horario laboral',
      'a que hora abren', 'a que hora cierran',
      'atienden hoy', 'atienden manana', 'atienden lunes',
    ],
  },
  // CONTACTO (variantes)
  {
    id: 'CC-CONT-EXTRA',
    categoria: 'INFO',
    pregunta: 'telefono de contacto',
    respuesta: '__PLANTILLA_CONTACTO__',
    sinonimos: [
      'contacto', 'telefono', 'whatsapp', 'correo', 'email',
      'numero de contacto', 'como los contacto', 'datos de contacto',
      'donde los llamo', 'llamar', 'comunicarme',
      'linea de atencion', 'numero de atencion', 'celular',
      'contactar', 'contactarlos', 'como comunicarme',
      'numero telefonico', 'whatsapp numero',
    ],
  },
  // PIN (variantes)
  {
    id: 'CC-PIN-EXTRA',
    categoria: 'PORTAL',
    pregunta: 'cambiar pin',
    respuesta: '__PLANTILLA_PIN_CAMBIAR__',
    sinonimos: [
      'cambiar pin', 'nuevo pin', 'cambiar mi pin', 'cambiar clave',
      'cambiar contrasena', 'quiero cambiar pin', 'cambiar el pin',
      'modificar pin', 'actualizar pin', 'cambiar acceso',
      'cambiar codigo', 'cambiar mi codigo', 'cambiar mi clave',
    ],
  },
  {
    id: 'CC-PIN-OLVIDO-EXTRA',
    categoria: 'PORTAL',
    pregunta: 'olvide mi pin',
    respuesta: '__PLANTILLA_PIN_OLVIDO__',
    sinonimos: [
      'olvide mi pin', 'olvide el pin', 'olvide mi clave',
      'no me acuerdo del pin', 'no me acuerdo de la clave',
      'perdi mi pin', 'perdi la clave', 'perdi el pin',
      'recuperar pin', 'recuperar clave', 'resetear pin',
      'reestablecer pin', 'no se mi pin', 'no se la clave',
      'olvidé pin', 'no recuerdo', 'se me olvido',
    ],
  },
  // ACCESO PORTAL (variantes)
  {
    id: 'CC-ACCESO-EXTRA',
    categoria: 'PORTAL',
    pregunta: 'como entro al portal',
    respuesta: '__PLANTILLA_ACCESO_PORTAL__',
    sinonimos: [
      'como entro', 'como accedo', 'donde me registro',
      'no puedo entrar', 'no me deja entrar', 'no puedo ingresar',
      'error al entrar', 'como inicio sesion', 'login',
      'iniciar sesion', 'entrar al portal', 'pagina del portal',
      'url del portal', 'donde es el portal', 'cual es la pagina',
      'enlace del portal', 'link del portal',
    ],
  },
  // CERTIFICADO / PAZ Y SALVO (variantes)
  {
    id: 'CC-CERT-EXTRA',
    categoria: 'FAQ',
    pregunta: 'paz y salvo',
    respuesta: '__PLANTILLA_CERTIFICADO__',
    sinonimos: [
      'certificado de pagos', 'certificacion de pagos', 'paz y salvo',
      'carta de paz y salvo', 'historial de pagos certificado',
      'certificado para desprendible', 'declaracion de pagos',
      'pazysalvo', 'paz y salvo pdf', 'carta paz y salvo',
      'certificado de deuda', 'certificado de saldo',
    ],
  },
  // QUEJA / RECLAMO (variantes)
  {
    id: 'CC-QUEJA-EXTRA',
    categoria: 'ASESOR',
    pregunta: 'quiero reclamar',
    respuesta: '__PLANTILLA_QUEJA_RECLAMO__',
    sinonimos: [
      'queja', 'reclamo', 'reclamacion', 'quejarme', 'reclamar',
      'denuncia', 'no estoy de acuerdo', 'mal servicio',
      'mal atendido', 'insatisfecho', 'problema con',
      'disputa', 'inconforme', 'me quejo', 'quiero reclamar',
      'pqrs', 'pqr', 'pqrsvc', 'derecho de peticion',
      'tutela', 'queja formal', 'queja oficial',
    ],
  },
]

// =====================================================
// ADMIN BOTS — variantes para bots internos
// =====================================================

export const DATASET_ADMIN_BOTS_EXTRA: ItemEntrenamiento[] = [
  // ASISTENTE PERSONAL
  {
    id: 'AP-METAS-EXTRA',
    categoria: 'METAS',
    pregunta: 'cuales son mis metas',
    respuesta: 'Tus metas activas están en el panel de Dashboard. Puedes crear nuevas desde Asistente Personal → Metas. ¿Quieres que te muestre el progreso de alguna en particular?',
    sinonimos: [
      'metas', 'mis metas', 'cuales son mis metas', 'objetivos',
      'que metas tengo', 'ver metas', 'mis objetivos',
      'metas activas', 'progreso de metas', 'avance de metas',
    ],
  },
  {
    id: 'AP-PRESUP-EXTRA',
    categoria: 'PRESUPUESTO',
    pregunta: 'como voy con el presupuesto',
    respuesta: 'Tu presupuesto del mes está en Dashboard → Presupuesto. Te muestro lo ejecutado vs lo presupuestado por categoría. ¿Quieres ver una categoría específica?',
    sinonimos: [
      'presupuesto', 'mi presupuesto', 'como voy con el presupuesto',
      'gastos del mes', 'ejecucion presupuestal', 'presupuesto mensual',
      'cuanto he gastado', 'limite de gasto', 'categoria de gasto',
    ],
  },
  {
    id: 'AP-ALERTAS-EXTRA',
    categoria: 'ALERTAS',
    pregunta: 'tengo alertas',
    respuesta: 'Tienes alertas activas. Las críticas son las que requieren atención inmediata. ¿Quieres que te las liste por prioridad?',
    sinonimos: [
      'alertas', 'tengo alertas', 'notificaciones', 'avisos',
      'que alertas tengo', 'alertas activas', 'alertas criticas',
      'avisos importantes', 'notificaciones pendientes',
    ],
  },

  // ASISTENTE COBROS
  {
    id: 'CO-CARTERA-EXTRA',
    categoria: 'CARTERA',
    pregunta: 'como esta la cartera',
    respuesta: 'El estado de cartera está en el panel de Cobros. Puedes ver morosos por días, saldo total en mora, y distribución por rangos. ¿Quieres el detalle de algún cliente?',
    sinonimos: [
      'cartera', 'estado de cartera', 'como esta la cartera',
      'cartera vencida', 'cartera morosa', 'saldo en mora',
      'clientes en mora', 'morosos', 'atrasos',
      'cartera total', 'cartera por vencer', 'cartera vencida',
      'indice de morosidad', 'ratio de mora',
    ],
  },
  {
    id: 'CO-CLIENTES-MORA-EXTRA',
    categoria: 'CARTERA',
    pregunta: 'quienes estan en mora',
    respuesta: 'Los clientes en mora están listados en Cobros → Morosos, ordenados por días de atraso. ¿Quieres que filtre por días específicos (más de 30, 60, 90)?',
    sinonimos: [
      'quienes estan en mora', 'clientes en mora', 'morosos',
      'quienes deben', 'quienes se atrasaron', 'lista de mora',
      'deudores', 'cuentas vencidas', 'atrasados',
      'quienes no han pagado', 'morosidad',
    ],
  },
  {
    id: 'CO-RECORDATORIOS-EXTRA',
    categoria: 'COBRO',
    pregunta: 'enviar recordatorios',
    respuesta: 'Puedes disparar recordatorios masivos desde Cobros → Recordatorios. Se envían por WhatsApp a los clientes con cuota vencida o por vencer. ¿Quieres ejecutar un envío ahora?',
    sinonimos: [
      'recordatorios', 'enviar recordatorios', 'mandar recordatorios',
      'recordar pago', 'cobrar', 'gestionar cobro',
      'whatsapp masivo', 'enviar whatsapp', 'recordatorios automaticos',
      'notificar pago', 'avisar vencimiento',
    ],
  },

  // ASISTENTE PRÉSTAMOS
  {
    id: 'PR-SIMULAR-EXTRA',
    categoria: 'SIMULACION',
    pregunta: 'simular prestamo',
    respuesta: 'Puedo simular un préstamo. Dime: monto, plazo en meses, frecuencia (quincenal/mensual) y tasa. Te calculo cuota, interés total y total a pagar.',
    sinonimos: [
      'simular', 'simulacion', 'simular prestamo', 'simular credito',
      'calcular cuota', 'cuanto seria la cuota', 'cuanto pagaria',
      'calcular prestamo', 'simular tasa', 'calcular interes',
      'proyectar prestamo', 'estimar cuota', 'cuota estimada',
    ],
  },
  {
    id: 'PR-RENTABILIDAD-EXTRA',
    categoria: 'RENTABILIDAD',
    pregunta: 'como va la rentabilidad',
    respuesta: 'La rentabilidad del portafolio está en Préstamos → Rentabilidad. Incluye interés devengado, mora cobrada y rentabilidad efectiva. ¿Quieres verlo por categoría de crédito?',
    sinonimos: [
      'rentabilidad', 'como va la rentabilidad', 'rentabilidad del mes',
      'interes devengado', 'ganancia', 'utilidad',
      'roi', 'retorno', 'ingresos financieros',
      'rentabilidad portafolio', 'rendimiento',
    ],
  },

  // ASESOR JURÍDICO
  {
    id: 'JU-CRONOLOGIAS-EXTRA',
    categoria: 'JURIDICO',
    pregunta: 'ver cronologias',
    respuesta: 'Las cronologías de casos jurídicos están en el panel de Jurídico. Cada caso muestra eventos, fechas y siguiente paso. ¿Quieres abrir un caso específico?',
    sinonimos: [
      'cronologias', 'cronologia', 'ver cronologias',
      'casos juridicos', 'seguimiento de casos', 'historial juridico',
      'expedientes', 'casos activos', 'casos en curso',
      'mis casos', 'casos asignados',
    ],
  },
  {
    id: 'JU-CANDIDATOS-EXTRA',
    categoria: 'JURIDICO',
    pregunta: 'quienes van a cobro juridico',
    respuesta: 'Los clientes candidatos a cobro jurídico (60+ días de mora) están en Jurídico → Candidatos. ¿Quieres iniciar el proceso para alguno?',
    sinonimos: [
      'candidatos', 'quienes van a juridico', 'cobro juridico',
      'pasar a juridico', 'casos para abogado', 'demanda',
      'proceso juridico', 'reportar a centrales', 'datacredito',
      'clientes para demandar', 'mora alta',
    ],
  },
  {
    id: 'JU-LEY-USURA-EXTRA',
    categoria: 'JURIDICO',
    pregunta: 'que es la ley de usura',
    respuesta: 'La Ley de Usura (Estatuto Orgánico del Sistema Financiero, art. 305) fija un tope máximo al interés que se puede cobrar: 1.5 veces la tasa corriente certificado por la Superfinanciera. Cobrar por encima es delito. ¿Necesitas el tope actual?',
    sinonimos: [
      'ley de usura', 'usura', 'tope de interes', 'interes maximo legal',
      'tasa de usura', 'limite de interes', 'interes prohibido',
      'delito de usura', 'superfinanciera usura', 'tope legal',
    ],
  },

  // CIBERSEGURIDAD
  {
    id: 'CB-ESTADO-EXTRA',
    categoria: 'SEGURIDAD',
    pregunta: 'como esta la seguridad',
    respuesta: 'El estado de ciberseguridad está en Seguridad → Dashboard. Incluye hallazgos activos, score de seguridad y eventos recientes. ¿Quieres el detalle de algún hallazgo?',
    sinonimos: [
      'seguridad', 'como esta la seguridad', 'estado de seguridad',
      'ciberseguridad', 'hackeo', 'vulnerabilidad',
      'amenazas', 'riesgos', 'incidentes',
      'auditoria seguridad', 'hardening', 'estado de ciberseguridad',
    ],
  },
  {
    id: 'CB-HALLAZGOS-EXTRA',
    categoria: 'SEGURIDAD',
    pregunta: 'que hallazgos hay',
    respuesta: 'Los hallazgos de seguridad están en Seguridad → Hallazgos. Se ordenan por severidad (crítico, alto, medio, bajo). ¿Quieres ver solo los críticos?',
    sinonimos: [
      'hallazgos', 'vulnerabilidades', 'que hallazgos hay',
      'problemas de seguridad', 'debilidades', 'fallos de seguridad',
      'issues de seguridad', 'hallazgos criticos', 'vulnerabilidades activas',
    ],
  },

  // DEVOPS SENTINEL
  {
    id: 'DO-ESTADO-EXTRA',
    categoria: 'DEVOPS',
    pregunta: 'estado del sistema',
    respuesta: 'El sistema está operativo. Salud general, uptime, latencia y eventos recientes están en DevOps → Estado. ¿Quieres ver las métricas en detalle?',
    sinonimos: [
      'estado', 'estado del sistema', 'como esta el sistema',
      'salud del sistema', 'uptime', 'disponibilidad',
      'latencia', 'rendimiento', 'performance',
      'servidores', 'infraestructura', 'sistema operativo',
    ],
  },

  // ASISTENTE EJECUTIVO
  {
    id: 'AE-DASHBOARD-EXTRA',
    categoria: 'EJECUTIVO',
    pregunta: 'dashboard ejecutivo',
    respuesta: 'El dashboard ejecutivo está en Inicio → Dashboard. Incluye KPIs clave: cartera total, morosidad, rentabilidad, clientes activos. ¿Quieres profundizar en alguno?',
    sinonimos: [
      'dashboard', 'dashboard ejecutivo', 'kpi', 'kpis',
      'metricas clave', 'indicadores', 'resumen ejecutivo',
      'panel principal', 'metricas del dia', 'como vamos',
    ],
  },
  {
    id: 'AE-ANOMALIAS-EXTRA',
    categoria: 'EJECUTIVO',
    pregunta: 'hay anomalias',
    respuesta: 'Las anomalías detectadas por el sistema están en Ejecutivo → Anomalías. Incluyen patrones inusuales en pagos, desembolsos, accesos. ¿Quieres el detalle?',
    sinonimos: [
      'anomalias', 'hay anomalias', 'anomalias detectadas',
      'patrones inusuales', 'comportamientos atipicos', 'alertas inteligentes',
      'ia deteccion', 'deteccion anomala', 'outliers',
    ],
  },
]

// =====================================================
// EXPORT: dataset unificado
// =====================================================

export const DATASET_EXTRA_UNIFICADO: ItemEntrenamiento[] = [
  ...DATASET_CHAT_CLIENTES_EXTRA,
  ...DATASET_ADMIN_BOTS_EXTRA,
]
