// =====================================================
// bot-datasets.ts — Datasets de entrenamiento por especialidad
// Cada bot tiene 60+ Q&A con sinónimos para matching fuzzy
// =====================================================

import type { ItemEntrenamiento } from './bot-fuzzy-matcher'

// =====================================================
// 1. CHAT_CLIENTES — Bot de Atención al Cliente
// Especialidad: préstamos, saldos, fechas, requisitos
// =====================================================
export const DATASET_CHAT_CLIENTES: ItemEntrenamiento[] = [
  // SALDOS
  {
    id: 'CC-001', categoria: 'SALDOS',
    pregunta: '¿Cuál es el saldo de mi préstamo?',
    respuesta: 'Tu saldo actual es el monto total que debes hasta la fecha, incluyendo capital pendiente e intereses generados. Puedes verlo en detalle en la sección "Mi Préstamo" del portal. Si necesitas el desglose exacto (capital, intereses, mora), te lo puedo mostrar.',
    sinonimos: ['cuanto debo', 'saldo pendiente', 'mi deuda', 'lo que debo', 'saldo actual', 'cuanto me queda por pagar', 'saldo de mi prestamo', 'mi obligacion', 'saldo deudor', 'monto pendiente'],
  },
  {
    id: 'CC-002', categoria: 'SALDOS',
    pregunta: '¿Cuánto capital he pagado?',
    respuesta: 'El capital pagado es la porción de tus pagos que se aplica directamente al monto del préstamo (no incluye intereses). Puedes ver el detalle en tu historial de pagos en el portal.',
    sinonimos: ['capital abonado', 'cuanto he abonado al capital', 'capital pagado', 'abono a capital', 'cuanto capital he cancelado'],
  },
  {
    id: 'CC-003', categoria: 'SALDOS',
    pregunta: '¿Cuánto interés he pagado?',
    respuesta: 'Los intereses pagados corresponden al costo financiero del préstamo durante el período. Se calculan sobre el capital pendiente según la tasa pactada. El detalle está en tu historial de pagos.',
    sinonimos: ['intereses pagados', 'cuanto he pagado de intereses', 'intereses cancelados', 'monto en intereses'],
  },
  // FECHAS DE PAGO
  {
    id: 'CC-010', categoria: 'FECHAS',
    pregunta: '¿Cuándo es mi próximo pago?',
    respuesta: 'Tu próximo pago está programado según la frecuencia pactada (semanal, quincenal o mensual). La fecha exacta aparece en tu calendario de pagos en el portal. Si quieres, te recuerdo por WhatsApp un día antes.',
    sinonimos: ['fecha de pago', 'cuando pago', 'proximo pago', 'cuando es mi pago', 'fecha limite', 'fecha de vencimiento', 'cuando vence', 'cuando tengo que pagar', 'dia de pago'],
  },
  {
    id: 'CC-011', categoria: 'FECHAS',
    pregunta: '¿Puedo cambiar mi fecha de pago?',
    respuesta: 'Sí, es posible ajustar tu fecha de pago en casos justificados. Debes solicitarlo con anticipación y un asesor evaluará la modificación. Recuerda que el cambio puede afectar el cálculo de intereses.',
    sinonimos: ['cambiar fecha', 'mover fecha de pago', 'ajustar vencimiento', 'cambiar dia de pago', 'modificar fecha'],
  },
  // CUOTAS
  {
    id: 'CC-020', categoria: 'CUOTAS',
    pregunta: '¿Cuántas cuotas he pagado?',
    respuesta: 'Puedes ver tu progreso de cuotas en el portal: el número de cuotas pagadas vs. el total de cuotas pactadas. Cada pago aplicado se suma a tu avance.',
    sinonimos: ['cuotas pagadas', 'cuantas cuotas llevo', 'progreso de pago', 'avance del prestamo', 'cuanto he pagado', 'cuotas canceladas'],
  },
  {
    id: 'CC-021', categoria: 'CUOTAS',
    pregunta: '¿Cuál es el valor de mi cuota?',
    respuesta: 'El valor de tu cuota fue pactado al firmar el préstamo e incluye capital + intereses. Si tu préstamo tiene cuota fija, el valor se mantiene; si es variable, puede ajustarse. El detalle está en tu contrato.',
    sinonimos: ['valor cuota', 'monto de cuota', 'cuanto es la cuota', 'cuota mensual', 'cuota semanal', 'cuota quincenal', 'pago de cada cuota'],
  },
  {
    id: 'CC-022', categoria: 'CUOTAS',
    pregunta: '¿Puedo pagar anticipado?',
    respuesta: 'Sí, puedes hacer pagos anticipados. Esto reduce tu saldo y puede disminuir los intereses futuros. No hay penalidad por pago anticipado. Comunícate con un asesor para aplicarlo correctamente.',
    sinonimos: ['pago anticipado', 'abono extra', 'pago adelantado', 'cancelar antes', 'pagar antes de tiempo', 'abonar mas', 'pago voluntario adicional'],
  },
  // REQUISITOS
  {
    id: 'CC-030', categoria: 'REQUISITOS',
    pregunta: '¿Qué requisitos necesito para un préstamo?',
    respuesta: 'Los requisitos básicos son: 1) Cédula de ciudadanía vigente, 2) Comprobante de ingresos (últimos 3 meses), 3) Referencia personal, 4) Verificación de identidad por OTP. Montos mayores pueden requerir codeudor o garantía.',
    sinonimos: ['que necesito', 'requisitos para prestamo', 'documentos', 'que piden', 'tramites', 'como solicito', 'que me piden', 'documentacion necesaria', 'requisitos credito'],
  },
  {
    id: 'CC-031', categoria: 'REQUISITOS',
    pregunta: '¿Cuánto demora la aprobación?',
    respuesta: 'La aprobación toma entre 24 y 48 horas hábiles después de recibir toda la documentación completa. Te notificaremos por WhatsApp y email en cuanto se apruebe.',
    sinonimos: ['tiempo de aprobacion', 'cuando me aprueban', 'cuanto demora', 'cuanto tarda', 'tiempo de respuesta', 'en cuanto tiempo me dicen'],
  },
  // RENOVACIÓN
  {
    id: 'CC-040', categoria: 'RENOVACION',
    pregunta: '¿Puedo renovar mi préstamo?',
    respuesta: 'Sí, puedes renovar tu préstamo si tienes buen historial de pagos (al menos 50% de cuotas pagadas y sin mora superior a 30 días). La renovación puede incluir un aumento del monto. Solicítalo en el portal o con un asesor.',
    sinonimos: ['renovacion', 'renovar', 'nuevo prestamo', 'ampliar credito', 'refinanciar', 'renuevo', 'ampliar prestamo', 'otro prestamo'],
  },
  {
    id: 'CC-041', categoria: 'RENOVACION',
    pregunta: '¿Cuál es la tasa de interés?',
    respuesta: 'La tasa de interés depende del monto, plazo y perfil del cliente. Las tasas están dentro del límite legal colombiano (Ley 1450 de 2011 y Ley de Usura). La tasa exacta se te informará al aprobarse tu solicitud.',
    sinonimos: ['tasa de interes', 'interes', 'porcentaje', 'tasa', 'cuanto cobran de interes', 'tasa mensual', 'tasa anual', 'ea', 'tem'],
  },
  // MORA
  {
    id: 'CC-050', categoria: 'MORA',
    pregunta: '¿Qué pasa si me atraso en un pago?',
    respuesta: 'Si te atrasas, se generan intereses moratorios diarios sobre la cuota pendiente. Te contactaremos para recordarte el pago y ofrecer opciones (acuerdo de pago, refinanciación). Es importante que nos avises si tendrás dificultad para pagar.',
    sinonimos: ['atraso', 'me atrasé', 'no pude pagar', 'mora', 'cuando me atraso', 'que pasa si no pago', 'retraso en pago', 'pago tarde'],
  },
  {
    id: 'CC-051', categoria: 'MORA',
    pregunta: '¿Puedo hacer un acuerdo de pago?',
    respuesta: 'Sí, ofrecemos acuerdos de pago para clientes en mora. Las opciones incluyen: refinanciación (nuevo cronograma), plan de pago (cuotas más pequeñas), o quitas parciales en casos especiales. Habla con un asesor para evaluar tu caso.',
    sinonimos: ['acuerdo de pago', 'plan de pago', 'refinanciacion', 'negociar deuda', 'acuerdo', 'facilidades de pago', 'reestructuracion', 'plan de pagos'],
  },
  // PAGOS
  {
    id: 'CC-060', categoria: 'PAGOS',
    pregunta: '¿Dónde puedo hacer mi pago?',
    respuesta: 'Puedes pagar a través de: 1) Botón de pago en el portal (PSE, tarjeta), 2) Transferencia bancaria a la cuenta de recaudo, 3) Consignación en oficina. El comprobante debe enviarse al portal para aplicar el pago.',
    sinonimos: ['donde pago', 'como pago', 'lugares de pago', 'metodos de pago', 'opciones de pago', 'como hago el pago', 'medios de pago'],
  },
  {
    id: 'CC-061', categoria: 'PAGOS',
    pregunta: '¿Cómo confirmo que mi pago fue aplicado?',
    respuesta: 'Recibirás una confirmación por WhatsApp y email cuando el pago se aplique. También puedes verlo en tu historial de pagos en el portal. Si en 24 horas no se aplica, envíanos el comprobante.',
    sinonimos: ['confirmar pago', 'mi pago aplico', 'mi pago se aplico', 'verificar pago', 'estado del pago', 'ya se abono', 'cuando se aplica el pago'],
  },
  // PORTAL
  {
    id: 'CC-070', categoria: 'PORTAL',
    pregunta: '¿Cómo ingreso al portal?',
    respuesta: 'Ingresas con tu cédula y el PIN/OTP que te enviamos por WhatsApp. Si no recuerdas tu PIN, puedes solicitar uno nuevo en la opción "Recuperar acceso" del portal.',
    sinonimos: ['como ingreso', 'como entro al portal', 'acceso al portal', 'login', 'iniciar sesion', 'entrar', 'como accedo'],
  },
  {
    id: 'CC-071', categoria: 'PORTAL',
    pregunta: 'Olvidé mi PIN, ¿qué hago?',
    respuesta: 'Si olvidaste tu PIN, ingresa al portal y selecciona "Recuperar acceso". Te enviaremos un código OTP por WhatsApp para verificar tu identidad y crear un nuevo PIN.',
    sinonimos: ['olvide pin', 'no recuerdo pin', 'perdi pin', 'recuperar pin', 'nuevo pin', 'resetear pin', 'cambiar pin'],
  },
  // HORARIOS
  {
    id: 'CC-080', categoria: 'HORARIOS',
    pregunta: '¿Cuáles son los horarios de atención?',
    respuesta: 'Nuestro horario de atención es lunes a viernes de 8:00 AM a 6:00 PM y sábados de 9:00 AM a 1:00 PM. El portal y el bot están disponibles 24/7. En emergencias fuera de horario, deja tu mensaje y te contactamos al iniciar el día.',
    sinonimos: ['horarios', 'horario de atencion', 'a que hora atienden', 'cuando atienden', 'estan abiertos', 'horario', 'horario laboral'],
  },
  // ESCALAMIENTO
  {
    id: 'CC-090', categoria: 'ESCALAMIENTO',
    pregunta: 'Quiero hablar con un asesor',
    respuesta: 'Con gusto te conecto con un asesor humano. Tu conversación queda marcada como pendiente y un asesor te responderá a la brevedad. Mientras tanto, ¿hay algo más en lo que pueda ayudarte?',
    sinonimos: ['asesor', 'humano', 'persona', 'operador', 'hablar con alguien', 'quiero hablar', 'atencion humana', 'alguien real'],
  },
  {
    id: 'CC-091', categoria: 'ESCALAMIENTO',
    pregunta: 'Tengo una queja',
    respuesta: 'Lamento escuchar eso. Tu queja será escalada al área correspondiente y un supervisor te contactará en máximo 24 horas. Mientras tanto, déjame registrar los detalles de tu queja para que el supervisor tenga contexto.',
    sinonimos: ['queja', 'reclamo', 'reclamacion', 'no estoy de acuerdo', 'problema', 'quejosos', 'PQRS', 'pqr'],
  },
  // INFO GENERAL
  {
    id: 'CC-100', categoria: 'INFO',
    pregunta: '¿Quiénes somos?',
    respuesta: 'Somos Jsadr, una plataforma de préstamos que ofrece créditos ágiles y transparentes. Trabajamos con tasas justas, dentro del marco legal colombiano, y nos enfocamos en construir relaciones de confianza con nuestros clientes.',
    sinonimos: ['quienes son', 'que es jsadr', 'informacion de la empresa', 'quien es jsadr', 'sobre la empresa', 'acerca de'],
  },
  {
    id: 'CC-101', categoria: 'INFO',
    pregunta: '¿Son confiables?',
    respuesta: 'Sí, somos una entidad registrada y operamos bajo la normativa colombiana (Ley 1450 de 2011, Estatuto del Consumidor Ley 1480 de 2011, Habeas Data Ley 1266 de 2008). Todos tus datos están protegidos y solo se usan para fines acordados.',
    sinonimos: ['son confiables', 'son seguros', 'son legales', 'estafadores', 'fraude', 'legitimos', 'si son reales'],
  },
  {
    id: 'CC-102', categoria: 'INFO',
    pregunta: '¿Cómo protegen mis datos?',
    respuesta: 'Tus datos están protegidos bajo la Ley 1581 de 2012 (Protección de Datos Personales) y el Habeas Data. Usamos cifrado para transmisión y almacenamiento. Solo personal autorizado accede a tu información y nunca la compartimos con terceros sin tu consentimiento.',
    sinonimos: ['proteccion de datos', 'mis datos', 'privacidad', 'seguridad de datos', 'habeas data', 'datos personales'],
  },
]

// =====================================================
// 2. ADMIN_SISTEMA — Asistente Personal / Personal CFO
// Especialidad: finanzas personales y empresariales
// =====================================================
export const DATASET_ADMIN_SISTEMA: ItemEntrenamiento[] = [
  // REGISTRO
  {
    id: 'AS-001', categoria: 'REGISTRO',
    pregunta: 'Registra un gasto',
    respuesta: 'Para registrar un gasto necesito: 1) Monto (ej: $50.000), 2) Concepto (ej: "comida"), 3) Ámbito (negocio o personal). Ejemplo: "gasto 50000 en comida personal". Lo registro automáticamente en caja menor y lo clasifico.',
    sinonimos: ['registrar gasto', 'anotar gasto', 'gasto de', 'gaste', 'nuevo gasto', 'agregar gasto', 'registrar egreso', 'anotar egreso'],
  },
  {
    id: 'AS-002', categoria: 'REGISTRO',
    pregunta: 'Registra un ingreso',
    respuesta: 'Para registrar un ingreso necesito: 1) Monto (ej: $200.000), 2) Concepto (ej: "venta"), 3) Ámbito (negocio o personal). Ejemplo: "ingreso 200000 por venta negocio". Lo registro en caja menor y actualizo los KPIs.',
    sinonimos: ['registrar ingreso', 'anotar ingreso', 'ingreso de', 'recibi', 'nuevo ingreso', 'agregar ingreso', 'me pagaron', 'entre dinero'],
  },
  {
    id: 'AS-003', categoria: 'REGISTRO',
    pregunta: 'Categoriza automáticamente',
    respuesta: 'Cuando registras un movimiento, lo clasifico usando: 1) Keywords del concepto (ej: "gasolina" → Transporte), 2) Si no hay match, uso IA para clasificar. Siempre te muestro la categoría asignada para que confirmes.',
    sinonimos: ['clasifica', 'categoriza', 'que categoria es', 'clasificacion automatica', 'categoria del gasto'],
  },
  // DASHBOARD
  {
    id: 'AS-010', categoria: 'DASHBOARD',
    pregunta: 'Muéstrame el dashboard',
    respuesta: 'Aquí está tu dashboard financiero. Te muestro: patrimonio neto, ingresos del período, gastos del período, balance, capacidad de ahorro (%), nivel de endeudamiento (%). ¿Quieres ver el detalle de alguna métrica?',
    sinonimos: ['dashboard', 'panel', 'resumen financiero', 'kpi', 'indicadores', 'como van mis finanzas', 'estado financiero', 'mi panel'],
  },
  {
    id: 'AS-011', categoria: 'DASHBOARD',
    pregunta: '¿Cómo va el balance del mes?',
    respuesta: 'Tu balance del mes es la diferencia entre ingresos y gastos del mes actual. Si es positivo, estás generando ahorro. Si es negativo, estás consumiendo ahorro previo. Te muestro el detalle con cifras.',
    sinonimos: ['balance del mes', 'como va el mes', 'balance mensual', 'ingresos vs gastos', 'resumen del mes', 'balance actual'],
  },
  {
    id: 'AS-012', categoria: 'DASHBOARD',
    pregunta: '¿Cuáles son mis top gastos?',
    respuesta: 'Tus top gastos del período son las categorías donde más dinero has gastado. Te los muestro ordenados de mayor a menor, con monto y porcentaje del total. Esto te ayuda a identificar dónde optimizar.',
    sinonimos: ['top gastos', 'mayores gastos', 'donde gasto mas', 'gastos principales', 'en que gasto mas', 'gastos top'],
  },
  // ANÁLISIS
  {
    id: 'AS-020', categoria: 'ANALISIS',
    pregunta: 'Compara con el mes anterior',
    respuesta: 'Comparo ingresos, gastos y balance del mes actual vs. mes anterior. Te muestro la variación porcentual y un análisis: ¿estás mejorando, empeorando o estable? También identifico las categorías con mayor cambio.',
    sinonimos: ['comparar mes', 'comparativo mensual', 'como voy vs mes pasado', 'comparacion con mes anterior', 'diferencia mes anterior', 'mes vs mes'],
  },
  {
    id: 'AS-021', categoria: 'ANALISIS',
    pregunta: '¿Cuál es mi capacidad de ahorro?',
    respuesta: 'Tu capacidad de ahorro es el porcentaje de tus ingresos que queda después de gastos. Fórmula: (ingresos - gastos) / ingresos × 100. Saludable: ≥20%. Aceptable: 10-20%. Crítico: <10%. Te muestro tu cifra exacta.',
    sinonimos: ['capacidad de ahorro', 'cuanto puedo ahorrar', 'porcentaje de ahorro', 'margen de ahorro', 'ahorro potencial'],
  },
  {
    id: 'AS-022', categoria: 'ANALISIS',
    pregunta: '¿Cuál es mi nivel de endeudamiento?',
    respuesta: 'Tu nivel de endeudamiento es el porcentaje de tus ingresos comprometidos en pago de deudas. Fórmula: (cuotas de deudas / ingresos) × 100. Saludable: <30%. Aceptable: 30-40%. Crítico: >40%. Te muestro tu cifra.',
    sinonimos: ['nivel de endeudamiento', 'endeudamiento', 'cuanto debo', 'relacion deuda ingreso', 'indice de endeudamiento', 'porcentaje de deuda'],
  },
  // PLANIFICACIÓN
  {
    id: 'AS-030', categoria: 'PLANIFICACION',
    pregunta: 'Crea un presupuesto',
    respuesta: 'Para crear un presupuesto necesito: 1) Categoría (ej: "alimentación"), 2) Monto mensual (ej: $2.000.000), 3) Ámbito (negocio/personal). Te aviso cuando estés al 80% del límite para que controles el gasto.',
    sinonimos: ['crear presupuesto', 'nuevo presupuesto', 'presupuesto de', 'limite de gasto', 'asignar presupuesto', 'definir presupuesto'],
  },
  {
    id: 'AS-031', categoria: 'PLANIFICACION',
    pregunta: 'Crea una meta financiera',
    respuesta: 'Para crear una meta necesito: 1) Descripción (ej: "comprar carro"), 2) Monto objetivo (ej: $50.000.000), 3) Plazo (ej: "2 años"). Calculo cuánto debes ahorrar mensualmente y hago seguimiento automático del progreso.',
    sinonimos: ['crear meta', 'nueva meta', 'meta de ahorro', 'objetivo financiero', 'meta financiera', 'ahorrar para', 'crear objetivo'],
  },
  {
    id: 'AS-032', categoria: 'PLANIFICACION',
    pregunta: 'Ver mis metas activas',
    respuesta: 'Te muestro tus metas activas con: descripción, monto objetivo, monto ahorrado, progreso (%) y tiempo estimado restante. ¿Quieres hacer un abono a alguna meta?',
    sinonimos: ['mis metas', 'ver metas', 'metas activas', 'objetivos', 'progreso de metas', 'listar metas'],
  },
  // INTELIGENCIA
  {
    id: 'AS-040', categoria: 'INTELIGENCIA',
    pregunta: 'Muéstrame alertas',
    respuesta: 'Analizo tus datos y te muestro alertas relevantes: 1) Gastos excesivos (categoría >80% del presupuesto), 2) Endeudamiento elevado, 3) Riesgo de iliquidez, 4) Vencimientos próximos, 5) Oportunidades de ahorro.',
    sinonimos: ['alertas', 'avisos', 'notificaciones', 'que me recomiendas', 'alertas inteligentes', 'avisos importantes'],
  },
  {
    id: 'AS-041', categoria: 'INTELIGENCIA',
    pregunta: 'Análisis predictivo a 90 días',
    respuesta: 'Basado en tus últimos 90 días, proyecto tu balance a 30/60/90 días. Considero tendencia actual y te muestro escenarios: si mantienes ritmo, si recortas 15% de gastos, etc. Te ayuda a anticipar problemas.',
    sinonimos: ['prediccion', 'proyeccion', 'analisis predictivo', 'que pasara en 90 dias', 'pronostico', 'futuro financiero', 'prediccion a 90 dias'],
  },
  {
    id: 'AS-042', categoria: 'INTELIGENCIA',
    pregunta: 'Consejos de ahorro',
    respuesta: 'Basado en tus datos, te doy consejos personalizados: 1) Categorías donde puedes recortar 15% (con cálculo de ahorro anual), 2) Suscripciones no usadas, 3) Oportunidades de negociación (servicios), 4) Metas de ahorro alcanzables.',
    sinonimos: ['consejos de ahorro', 'como ahorrar', 'ahorrar mas', 'recomendaciones de ahorro', 'tips de ahorro', 'como gastar menos'],
  },
  {
    id: 'AS-043', categoria: 'INTELIGENCIA',
    pregunta: '¿Puedo asumir un crédito?',
    respuesta: 'Evalúo tu capacidad de pago: 1) Nivel de endeudamiento actual, 2) Capacidad de ahorro, 3) Cuota máxima recomendada (30% de ingresos), 4) Impacto en tu balance. Te doy una recomendación fundamentada con cifras.',
    sinonimos: ['puedo asumir credito', 'puedo pedir prestado', 'capacidad de endeudamiento', 'puedo pagar un credito', 'cuanto credito puedo asumir', 'capacidad de pago'],
  },
  // REPORTES
  {
    id: 'AS-050', categoria: 'REPORTES',
    pregunta: 'Reporte mensual',
    respuesta: 'Genero tu reporte mensual con: 1) Resumen ejecutivo (ingresos, gastos, balance), 2) Top categorías, 3) Comparativo con mes anterior, 4) Alertas detectadas, 5) Recomendaciones. ¿Quieres exportarlo a PDF?',
    sinonimos: ['reporte mensual', 'resumen del mes', 'informe mensual', 'reporte de finanzas', 'reporte mensual de gastos'],
  },
  {
    id: 'AS-051', categoria: 'REPORTES',
    pregunta: 'Reporte diario',
    respuesta: 'Genero tu reporte del día con: movimientos registrados, balance del día, alertas detectadas, próximos vencimientos. ¿Quieres que te lo envíe diario por WhatsApp?',
    sinonimos: ['reporte diario', 'resumen de hoy', 'como me fue hoy', 'movimientos de hoy', 'balance diario'],
  },
  {
    id: 'AS-052', categoria: 'REPORTES',
    pregunta: 'Reporte anual',
    respuesta: 'Genero tu reporte anual con: 1) Resumen completo (enero a diciembre), 2) Evolución del patrimonio, 3) Mejor y peor mes, 4) Categorías más relevantes, 5) Proyección para el próximo año. ¿Quieres ver el detalle?',
    sinonimos: ['reporte anual', 'resumen del año', 'balance anual', 'informe anual', 'como me fue este año'],
  },
  // ÁMBITO
  {
    id: 'AS-060', categoria: 'AMBITO',
    pregunta: 'Cambiar ámbito a negocio',
    respuesta: 'Cambiaste el ámbito a NEGOCIO. A partir de ahora, todos los movimientos que registres se asociarán a las finanzas de la empresa Jsadr. Para ver tus finanzas personales, cambia el ámbito nuevamente.',
    sinonimos: ['cambiar a negocio', 'ambito negocio', 'ver negocio', 'finanzas del negocio', 'cambiar ambito'],
  },
  {
    id: 'AS-061', categoria: 'AMBITO',
    pregunta: 'Cambiar ámbito a personal',
    respuesta: 'Cambiaste el ámbito a PERSONAL. A partir de ahora, todos los movimientos se asociarán a tus finanzas personales (no de la empresa). Para volver a finanzas del negocio, cambia el ámbito.',
    sinonimos: ['cambiar a personal', 'ambito personal', 'ver personal', 'finanzas personales', 'cambiar ambito'],
  },
]

// =====================================================
// 3. CONTABILIDAD — Experto Financiero
// Especialidad: análisis profundo y consejos
// =====================================================
export const DATASET_CONTABILIDAD: ItemEntrenamiento[] = [
  {
    id: 'CO-001', categoria: 'CONSEJOS',
    pregunta: '¿Cómo puedo ahorrar más este mes?',
    respuesta: 'Analizo tus últimos 30 días. Identifico: 1) Tu mayor categoría de gasto, 2) Cuánto puedes recortar sin afectar calidad de vida, 3) Acciones concretas con impacto estimado. Ej: "Reducir 20% en alimentación = ahorro $X/mes".',
    sinonimos: ['ahorrar mas', 'como ahorro', 'consejos de ahorro', 'reducir gastos', 'como gastar menos', 'ahorrar este mes'],
  },
  {
    id: 'CO-002', categoria: 'CONSEJOS',
    pregunta: '¿Es buen momento para invertir?',
    respuesta: 'Evalúo tu situación: 1) Si tienes fondo de emergencias (3-6 meses gastos), 2) Capacidad de ahorro (>20%), 3) Nivel de endeudamiento (<30%). Si cumples, te recomiendo opciones. Aclaro: no es asesoría profesional registrada.',
    sinonimos: ['invertir', 'inversion', 'es buen momento para invertir', 'debo invertir', 'donde invertir', 'invertir dinero'],
  },
  {
    id: 'CO-003', categoria: 'CONSEJOS',
    pregunta: '¿Debo pagar deudas o ahorrar?',
    respuesta: 'Regla general: 1) Si tasa de deuda > rendimiento de ahorro, paga deuda primero. 2) Si tienes deudas de >30% anual, liquídalas antes de ahorrar. 3) Mantén siempre un fondo de emergencia mínimo de 1 mes de gastos.',
    sinonimos: ['pagar deudas o ahorrar', 'cancelar deudas', 'deudas vs ahorro', 'que hago primero', 'prioridad financiera'],
  },
  {
    id: 'CO-004', categoria: 'CONSEJOS',
    pregunta: '¿Cuánto puedo gastar en vacaciones?',
    respuesta: 'Calculo: 1) Tu capacidad de ahorro mensual, 2) Cuánto has acumulado para vacaciones, 3) Recomiendo no exceder 5% de tus ingresos anuales. Te muestro cuánto puedes gastar sin afectar liquidez.',
    sinonimos: ['gastar en vacaciones', 'vacaciones', 'cuanto puedo gastar', 'presupuesto vacaciones', 'viaje'],
  },
  {
    id: 'CO-005', categoria: 'CONSEJOS',
    pregunta: '¿Mi negocio es rentable?',
    respuesta: 'Analizo tus finanzas de NEGOCIO (últimos 90 días): 1) Ingresos vs gastos, 2) Margen neto, 3) Tendencia mensual, 4) Comparativa con meses anteriores. Te digo si es rentable, cuál es tu margen y dónde optimizar.',
    sinonimos: ['negocio rentable', 'rentabilidad', 'mi negocio es rentable', 'margen', 'es rentable', 'ganancias'],
  },
  {
    id: 'CO-006', categoria: 'CONSEJOS',
    pregunta: '¿Cómo reduzco mis gastos innecesarios?',
    respuesta: 'Identifico "gastos hormiga": 1) Suscripciones no usadas, 2) Compras impulsivas recurrentes, 3) Categorías con gasto atípico. Te muestro los top 5 gastos optimizables con cálculo de ahorro anual si los recortas 50%.',
    sinonimos: ['gastos innecesarios', 'reducir gastos', 'gastos hormiga', 'gastos inutiles', 'optimizar gastos', 'donde recortar'],
  },
  {
    id: 'CO-007', categoria: 'CONSEJOS',
    pregunta: '¿Cuál es mi salud financiera actual?',
    respuesta: 'Calculo tu salud financiera con 5 indicadores: 1) Capacidad de ahorro, 2) Nivel de endeudamiento, 3) Liquidez, 4) Patrimonio neto, 5) Tendencia. Te doy una nota (0-100) y te digo qué mejorar primero.',
    sinonimos: ['salud financiera', 'como estan mis finanzas', 'diagnostico financiero', 'estado financiero', 'que tal van mis finanzas'],
  },
  {
    id: 'CO-008', categoria: 'CONSEJOS',
    pregunta: '¿Puedo asumir un crédito de 5 millones?',
    respuesta: 'Evalúo: 1) Tu capacidad de pago (cuota no debe superar 30% de ingresos), 2) Nivel de endeudamiento actual + nuevo crédito, 3) Impacto en tu balance mensual. Te doy una recomendación clara: sí/no/condicionalmente.',
    sinonimos: ['puedo asumir credito', 'credito de 5 millones', 'pedir prestado 5 millones', 'capacidad de credito', 'cuanto me prestan'],
  },
  {
    id: 'CO-010', categoria: 'ANALISIS',
    pregunta: 'Analiza mi flujo de caja',
    respuesta: 'Tu flujo de caja muestra entradas vs salidas en el período. Analizo: 1) Si los ingresos cubren los gastos, 2) Meses con déficit, 3) Tendencia. Si hay déficit recurrente, te doy 3 acciones para corregir.',
    sinonimos: ['flujo de caja', 'cash flow', 'flujo de efectivo', 'entradas y salidas', 'movimientos de dinero'],
  },
  {
    id: 'CO-011', categoria: 'ANALISIS',
    pregunta: 'Analiza mi liquidez',
    respuesta: 'Tu liquidez es tu capacidad de cubrir obligaciones a 30 días. Calculo: (efectivo + inversiones líquidas) / gastos mensuales. Saludable: ≥3 meses. Aceptable: 1-3 meses. Crítico: <1 mes. Te muestro tu cifra.',
    sinonimos: ['liquidez', 'capacidad de pago inmediata', 'disponible', 'cuanto efectivo tengo', 'liquidez actual'],
  },
  {
    id: 'CO-012', categoria: 'ANALISIS',
    pregunta: '¿Cuál es mi patrimonio neto?',
    respuesta: 'Tu patrimonio neto = activos - pasivos. Activos: efectivo, bancos, inversiones, bienes. Pasivos: deudas, préstamos, tarjetas. Te muestro el desglose y cómo ha evolucionado en los últimos 6 meses.',
    sinonimos: ['patrimonio neto', 'patrimonio', 'mis activos', 'riqueza', 'valor neto', 'net worth'],
  },
  {
    id: 'CO-020', categoria: 'INVERSIONES',
    pregunta: '¿Dónde puedo invertir?',
    respuesta: 'Opciones según perfil: 1) Conservador: CDT (4-7% EA), 2) Moderado: Fondos de inversión (8-12% EA), 3) Agresivo: Acciones/cripto (variable). Aclaro: no es asesoría profesional. Te recomiendo consultar un asesor certificado.',
    sinonimos: ['donde invertir', 'opciones de inversion', 'invertir dinero', 'instrumentos de inversion', 'donde poner mi dinero'],
  },
  {
    id: 'CO-021', categoria: 'INVERSIONES',
    pregunta: '¿Qué es un CDT?',
    respuesta: 'CDT (Certificado de Depósito a Término) es un producto bancario: depositas dinero por un plazo fijo (3-36 meses) y al final recibes capital + intereses. Tasas actuales: 4-9% EA según plazo. Es de bajo riesgo.',
    sinonimos: ['cdt', 'certificado de deposito', 'deposito a termino', 'que es un cdt'],
  },
  {
    id: 'CO-030', categoria: 'REPORTES',
    pregunta: 'Genera mi estado financiero',
    respuesta: 'Genero tu estado financiero: 1) Estado de resultados (ingresos - gastos = balance), 2) Balance general (activos - pasivos = patrimonio), 3) Flujo de efectivo. Te lo presento en formato profesional. ¿Exportar a PDF?',
    sinonimos: ['estado financiero', 'balance general', 'estados financieros', 'estado de resultados', 'reporte financiero'],
  },
]

// =====================================================
// 4. PAGOS — Asistente de Cobros
// Especialidad: cartera, mora, recaudo, estrategias
// =====================================================
export const DATASET_PAGOS: ItemEntrenamiento[] = [
  {
    id: 'PA-001', categoria: 'CARTERA',
    pregunta: '¿Cómo está la cartera hoy?',
    respuesta: 'Te muestro el resumen ejecutivo: 1) Total préstamos activos, 2) Préstamos al día vs en mora, 3) Tasa de mora, 4) Recaudo del día, 5) Alertas críticas. ¿Quieres ver el detalle de algún indicador?',
    sinonimos: ['estado cartera', 'cartera hoy', 'como esta la cartera', 'resumen cartera', 'panorama cartera', 'cartera actual'],
  },
  {
    id: 'PA-002', categoria: 'CARTERA',
    pregunta: '¿Cuántos préstamos activos hay?',
    respuesta: 'Te muestro: 1) Total préstamos activos, 2) Distribución por estado (al día, en mora, jurídico), 3) Capital prestado total, 4) Capital pendiente de recuperar. ¿Quieres ver la lista detallada?',
    sinonimos: ['prestamos activos', 'cuantos prestamos', 'total prestamos', 'cantidad de prestamos', 'prestamos vigentes'],
  },
  {
    id: 'PA-003', categoria: 'CARTERA',
    pregunta: '¿Cuál es la tasa de mora?',
    respuesta: 'La tasa de mora = (préstamos en mora / préstamos activos) × 100. Saludable: <10%. Aceptable: 10-20%. Crítico: >20%. Te muestro tu tasa actual y la comparación con el mes anterior.',
    sinonimos: ['tasa de mora', 'indice de mora', 'porcentaje de mora', 'mora actual', 'mora', 'cartera vencida'],
  },
  {
    id: 'PA-004', categoria: 'CARTERA',
    pregunta: '¿Qué clientes están en mora?',
    respuesta: 'Te muestro los clientes en mora, ordenados por días de atraso (de mayor a menor). Para cada uno: nombre, días de mora, saldo, monto de mora, severidad (crítica/alta/media/baja) y acción recomendada.',
    sinonimos: ['clientes en mora', 'morosos', 'quien debe', 'quien esta atrasado', 'clientes atrasados', 'lista de morosos'],
  },
  {
    id: 'PA-005', categoria: 'CARTERA',
    pregunta: '¿Cuánto capital está pendiente por cobrar?',
    respuesta: 'Calculo el capital pendiente: suma de saldos totales de préstamos activos. Te muestro: 1) Total capital pendiente, 2) Capital + intereses por cobrar, 3) Mora acumulada, 4) Distribución por cliente.',
    sinonimos: ['capital pendiente', 'por cobrar', 'cuanto me deben', 'saldo por cobrar', 'cartera por cobrar', 'capital por recuperar'],
  },
  {
    id: 'PA-010', categoria: 'MORA',
    pregunta: '¿Qué clientes tienen mora crítica?',
    respuesta: 'Mora crítica = 60+ días de atraso. Para estos clientes, recomiendo: escalar a jurídico. Te muestro la lista con: nombre, días de mora, saldo, monto reclamado estimado. ¿Quieres iniciar el proceso jurídico?',
    sinonimos: ['mora critica', '60 dias de mora', 'mora severa', 'casos criticos', 'clientes en mora critica', 'mora alta'],
  },
  {
    id: 'PA-011', categoria: 'MORA',
    pregunta: '¿Qué clientes tienen mora alta?',
    respuesta: 'Mora alta = 30-59 días de atraso. Para estos clientes, recomiendo: última oportunidad de acuerdo de pago. Te muestro la lista y te sugiero contactarlos hoy para ofrecer refinanciación.',
    sinonimos: ['mora alta', '30 dias de mora', 'mora media alta', 'clientes mora alta'],
  },
  {
    id: 'PA-012', categoria: 'MORA',
    pregunta: '¿Qué clientes son reincidentes en mora?',
    respuesta: 'Reincidentes = clientes con más de 1 préstamo en mora. Te muestro: nombre, número de préstamos en mora, monto total. Recomiendo: restringir nuevos créditos a estos clientes hasta que regularicen.',
    sinonimos: ['reincidentes', 'clientes reincidentes', 'reincidencia en mora', 'clientes problematicos', 'habituales'],
  },
  {
    id: 'PA-020', categoria: 'VENCIMIENTOS',
    pregunta: '¿Qué cuotas vencen hoy?',
    respuesta: 'Te muestro los préstamos con cuota que vence hoy. Para cada uno: cliente, monto de cuota, saldo, teléfono. ¿Quieres que envíe recordatorios por WhatsApp a todos?',
    sinonimos: ['vencen hoy', 'vencimientos de hoy', 'cuotas de hoy', 'pagan hoy', 'vencimiento hoy'],
  },
  {
    id: 'PA-021', categoria: 'VENCIMIENTOS',
    pregunta: '¿Qué cuotas vencen en los próximos 7 días?',
    respuesta: 'Te muestro los préstamos con cuota que vence en los próximos 7 días. Para cada uno: cliente, fecha de vencimiento, monto. ¿Quieres programar recordatorios automáticos por WhatsApp?',
    sinonimos: ['proximos vencimientos', 'vencen en 7 dias', 'vencimientos semanales', 'cuotas proximas'],
  },
  {
    id: 'PA-030', categoria: 'RECAUDO',
    pregunta: '¿Cuánto se recaudó hoy?',
    respuesta: 'Te muestro el recaudo del día: 1) Total recaudado, 2) Número de pagos, 3) Comparación con promedio diario semanal. Si el recaudo es menor al 50% del promedio, te alerto.',
    sinonimos: ['recaudo de hoy', 'recaudo diario', 'cuanto se cobro hoy', 'pagos de hoy', 'ingresos de hoy'],
  },
  {
    id: 'PA-031', categoria: 'RECAUDO',
    pregunta: '¿Cuánto se recaudó este mes?',
    respuesta: 'Te muestro: 1) Recaudo total del mes, 2) Número de pagos, 3) Comparativa con mes anterior, 4) Proyección a fin de mes si mantienes ritmo. ¿Quieres ver el detalle por cliente?',
    sinonimos: ['recaudo mensual', 'recaudo del mes', 'cuanto se cobro este mes', 'pagos del mes'],
  },
  {
    id: 'PA-032', categoria: 'RECAUDO',
    pregunta: '¿Cuál es la tasa de recuperación?',
    respuesta: 'Tasa de recuperación = (capital recuperado / capital prestado) × 100. Te muestro tu tasa actual y la tendencia. Una tasa >80% es saludable. Si es menor, te doy recomendaciones para mejorar.',
    sinonimos: ['tasa de recuperacion', 'recuperacion de cartera', 'indice de recuperacion', 'porcentaje recuperado'],
  },
  {
    id: 'PA-040', categoria: 'ESTRATEGIA',
    pregunta: '¿Qué clientes requieren atención urgente?',
    respuesta: 'Priorizo por: 1) Mora crítica (60+ días), 2) Vencen hoy, 3) Promesas de pago incumplidas, 4) Clientes con cuotas grandes pendientes. Te doy el top 5 para contactar hoy.',
    sinonimos: ['atencion urgente', 'clientes prioritarios', 'a quien llamar', 'que clientes atender', 'prioridades de hoy'],
  },
  {
    id: 'PA-041', categoria: 'ESTRATEGIA',
    pregunta: '¿Qué riesgos detectaste?',
    respuesta: 'Te muestro los riesgos detectados: 1) Aumento de mora, 2) Disminución del recaudo, 3) Concentración de cartera en pocos clientes, 4) Reincidentes. Para cada riesgo, te doy acciones de mitigación.',
    sinonimos: ['riesgos', 'que riesgos hay', 'alertas de riesgo', 'problemas detectados', 'riesgos de cartera'],
  },
  {
    id: 'PA-042', categoria: 'ESTRATEGIA',
    pregunta: 'Estrategia de cobranza escalonada',
    respuesta: 'Estrategia: 1) 3 días antes: recordatorio amable, 2) Día vencimiento: recordatorio pago, 3) 1 día mora: cobro persuasivo, 4) 7 días: llamada + plan de pago, 5) 15 días: oferta refinanciación, 6) 30 días: última oportunidad, 7) 60 días: escalar a jurídico.',
    sinonimos: ['estrategia cobranza', 'cobranza escalonada', 'proceso de cobro', 'como cobrar', 'metodologia de cobranza'],
  },
  {
    id: 'PA-043', categoria: 'ESTRATEGIA',
    pregunta: '¿Qué clientes tienen excelente comportamiento?',
    respuesta: 'Te muestro los clientes al día con varios préstamos pagados. Para cada uno: nombre, préstamos pagados, progreso actual. Recomiendo: ofrecer renovación con mejores tasas como recompensa.',
    sinonimos: ['buenos clientes', 'excelente comportamiento', 'clientes puntuales', 'buenos pagadores', 'clientes destacados'],
  },
  {
    id: 'PA-050', categoria: 'ACCIONES',
    pregunta: 'Enviar recordatorio WhatsApp',
    respuesta: 'Para enviar recordatorios masivos por WhatsApp: 1) Selecciono clientes con vencimiento próximo, 2) Genero mensaje personalizado (sin montos en mora, solo recordatorio amable), 3) Envío por lotes. ¿Confirmas el envío?',
    sinonimos: ['enviar whatsapp', 'recordatorio whatsapp', 'mensaje whatsapp', 'cobro whatsapp', 'enviar recordatorio'],
  },
  {
    id: 'PA-051', categoria: 'ACCIONES',
    pregunta: 'Escalar a jurídico',
    respuesta: 'Para escalar a jurídico: 1) Cliente con 60+ días mora, 2) Genero caso jurídico con valor reclamado, 3) Asigno abogado, 4)Inicio cronología. ¿Quieres escalar a un cliente específico? Dime cuál.',
    sinonimos: ['escalar juridico', 'enviar a juridico', 'iniciar cobro juridico', 'demandar', 'proceso juridico'],
  },
  {
    id: 'PA-052', categoria: 'ACCIONES',
    pregunta: 'Ofrecer refinanciación',
    respuesta: 'Para ofrecer refinanciación: 1) Cliente con 15-30 días mora, 2) Calculo nuevo cronograma con cuotas menores, 3) Posible aumento de plazo, 4) Genero propuesta. ¿A qué cliente quieres ofrecérsela?',
    sinonimos: ['refinanciar', 'ofrecer refinanciacion', 'reestructurar deuda', 'nuevo plan de pago', 'acuerdo de pago'],
  },
]

// =====================================================
// 5. PRESTAMOS — Asistente Préstamos
// Especialidad: solicitudes, simulación, rentabilidad
// =====================================================
export const DATASET_PRESTAMOS: ItemEntrenamiento[] = [
  {
    id: 'PR-001', categoria: 'ESTADO',
    pregunta: '¿Cuántos préstamos activos hay?',
    respuesta: 'Te muestro: 1) Total préstamos activos, 2) Distribución por estado, 3) Capital prestado total, 4) Capital pendiente, 5) Promedio por préstamo. ¿Quieres ver la lista detallada?',
    sinonimos: ['prestamos activos', 'cuantos prestamos activos', 'total prestamos activos', 'prestamos vigentes'],
  },
  {
    id: 'PR-002', categoria: 'ESTADO',
    pregunta: '¿Cuántas solicitudes pendientes hay?',
    respuesta: 'Te muestro las solicitudes pendientes de aprobación: número total, monto solicitado acumulado, distribución por categoría. Para cada solicitud: cliente, monto, plazo, fecha. ¿Quieres aprobar alguna?',
    sinonimos: ['solicitudes pendientes', 'pendientes de aprobacion', 'solicitudes nuevas', 'por aprobar'],
  },
  {
    id: 'PR-003', categoria: 'ESTADO',
    pregunta: '¿Cuánto capital está prestado?',
    respuesta: 'Capital prestado total = suma de montos principales de préstamos activos. Te muestro: 1) Capital total prestado, 2) Capital recuperado, 3) Capital pendiente, 4) Tasa de recuperación.',
    sinonimos: ['capital prestado', 'cuanto dinero hay prestado', 'capital colocado', 'monto prestado'],
  },
  {
    id: 'PR-010', categoria: 'SIMULACION',
    pregunta: 'Simula un crédito',
    respuesta: 'Para simular un crédito necesito: 1) Monto (ej: $5.000.000), 2) Tasa (ej: 2.5% mensual), 3) Plazo (ej: 12 meses), 4) Frecuencia (semanal/quincenal/mensual). Te muestro: cuota, intereses, total a pagar, rentabilidad.',
    sinonimos: ['simular credito', 'simulacion', 'calcular cuota', 'simular prestamo', 'calcular credito', 'proyectar prestamo'],
  },
  {
    id: 'PR-011', categoria: 'SIMULACION',
    pregunta: '¿Cuál es la cuota para 5 millones a 12 meses?',
    respuesta: 'Calculo: para $5.000.000 a 12 meses con tasa estándar (ej: 2.5% mensual), la cuota mensual aproximada es $X. Total a pagar: $Y. Intereses: $Z. ¿Quieres que te muestre la tabla de amortización completa?',
    sinonimos: ['cuota 5 millones', '5 millones a 12 meses', 'cuanto pagaria por 5 millones', 'cuota para 5 millones'],
  },
  {
    id: 'PR-012', categoria: 'SIMULACION',
    pregunta: 'Simula con interés fijo',
    respuesta: 'Modelo Jsadr usa interés FIJO sobre capital inicial (no sobre saldo). Ej: $1.000.000 al 25% anual a 12 meses: interés total = $250.000, cuota mensual = ($1.000.000 + $250.000) / 12 = $104.167. ¿Quieres simular con tus valores?',
    sinonimos: ['interes fijo', 'modelo interes fijo', 'calcular interes fijo', 'simulacion interes fijo'],
  },
  {
    id: 'PR-020', categoria: 'RENTABILIDAD',
    pregunta: '¿Cuál es la utilidad del mes?',
    respuesta: 'Utilidad del mes = intereses cobrados en el mes. Te muestro: 1) Intereses cobrados este mes, 2) Comparativa con mes anterior, 3) Distribución por préstamo, 4) Margen de rentabilidad.',
    sinonimos: ['utilidad mensual', 'ganancia del mes', 'cuanto ganamos este mes', 'rentabilidad del mes', 'ingresos por intereses'],
  },
  {
    id: 'PR-021', categoria: 'RENTABILIDAD',
    pregunta: '¿Qué préstamos son más rentables?',
    respuesta: 'Te muestro los préstamos ordenados por rentabilidad (intereses generados). Para cada uno: cliente, monto, tasa, intereses generados, rentabilidad %. Los más rentables suelen ser de tasa más alta y plazo más largo.',
    sinonimos: ['prestamos mas rentables', 'mejores prestamos', 'prestamos rentables', 'cual es el prestamo mas rentable'],
  },
  {
    id: 'PR-022', categoria: 'RENTABILIDAD',
    pregunta: '¿Cuál es la rentabilidad de la cartera?',
    respuesta: 'Rentabilidad de cartera = (intereses generados en período / capital prestado) × 100. Te muestro tu tasa de rentabilidad anualizada y comparativa con mercado (CDT 6-9%, crédito libre inversión 25-35%).',
    sinonimos: ['rentabilidad cartera', 'rentabilidad', 'tasa de rentabilidad', 'roi cartera', 'rendimiento'],
  },
  {
    id: 'PR-030', categoria: 'RENOVACION',
    pregunta: '¿Qué clientes pueden renovar?',
    respuesta: 'Criterios de renovación: 1) Al menos 50% de cuotas pagadas, 2) Sin mora >30 días, 3) Buen historial. Te muestro la lista de clientes aptos. ¿Quieres ofrecerles renovación?',
    sinonimos: ['clientes aptos renovacion', 'quien puede renovar', 'renovaciones posibles', 'clientes para renovar'],
  },
  {
    id: 'PR-031', categoria: 'RENOVACION',
    pregunta: '¿Cuántas renovaciones se han hecho este mes?',
    respuesta: 'Te muestro: 1) Total renovaciones del mes, 2) Monto renovado, 3) Aumento promedio de monto, 4) Comparativa con mes anterior. Las renovaciones son buenas: indican satisfacción del cliente.',
    sinonimos: ['renovaciones del mes', 'cuantas renovaciones', 'estadisticas de renovacion'],
  },
  {
    id: 'PR-040', categoria: 'RIESGO',
    pregunta: '¿Qué préstamos tienen mayor riesgo?',
    respuesta: 'Identifico préstamos de alto riesgo: 1) Clientes con mora actual, 2) Reincidentes, 3) Concentración en un cliente (>%20 cartera), 4) Plazos muy largos con tasa baja. Te muestro la lista para monitorear.',
    sinonimos: ['prestamos de riesgo', 'mayor riesgo', 'riesgos de cartera', 'prestamos problematicos', 'cartera en riesgo'],
  },
  {
    id: 'PR-041', categoria: 'RIESGO',
    pregunta: '¿Hay concentración de cartera?',
    respuesta: 'Analizo concentración: 1) Top 5 clientes con mayor saldo, 2) % de cartera que representan, 3) Si algún cliente >20% de cartera (riesgo alto). Recomiendo diversificar.',
    sinonimos: ['concentracion cartera', 'diversificacion', 'cartera concentrada', 'distribucion cartera'],
  },
  {
    id: 'PR-050', categoria: 'DOCUMENTOS',
    pregunta: 'Genera pagaré',
    respuesta: 'Genero el pagaré con los datos del préstamo: monto, tasa, plazo, frecuencia, cliente, codeudores (si aplica). Diligenciado y listo para firma. ¿Para qué préstamo lo necesitas?',
    sinonimos: ['generar pagare', 'pagare', 'crear pagare', 'documento pagare', 'pagare diligenciado'],
  },
  {
    id: 'PR-051', categoria: 'DOCUMENTOS',
    pregunta: 'Genera estado de cuenta',
    respuesta: 'Genero el estado de cuenta del préstamo: saldo actual, cuotas pagadas, cuotas pendientes, próximos vencimientos, historial de pagos. ¿Para qué préstamo lo necesitas?',
    sinonimos: ['estado de cuenta', 'generar estado cuenta', 'extracto', 'resumen de cuenta', 'extracto de prestamo'],
  },
  {
    id: 'PR-052', categoria: 'DOCUMENTOS',
    pregunta: 'Genera paz y salvo',
    respuesta: 'Genero paz y salvo para préstamos totalmente pagados: confirma que el cliente no tiene obligaciones pendientes. Solo se puede generar si el saldo es $0. ¿Para qué préstamo lo necesitas?',
    sinonimos: ['paz y salvo', 'generar paz y salvo', 'certificado paz y salvo', 'paz salvo'],
  },
]

// =====================================================
// 6. JURIDICO — Asesor Jurídico
// Especialidad: derecho colombiano, cobranza, procesos
// =====================================================
export const DATASET_JURIDICO: ItemEntrenamiento[] = [
  {
    id: 'JU-001', categoria: 'CASOS',
    pregunta: '¿Cuántos casos jurídicos hay?',
    respuesta: 'Te muestro: 1) Total casos, 2) Casos activos vs cerrados, 3) Distribución por estado (pre-judicial, demanda, ejecución, sentencia), 4) Monto total reclamado. ¿Quieres ver el detalle?',
    sinonimos: ['casos juridicos', 'cuantos casos', 'total casos', 'casos activos', 'estado de casos'],
  },
  {
    id: 'JU-002', categoria: 'CASOS',
    pregunta: '¿Qué casos requieren atención?',
    respuesta: 'Priorizo: 1) Casos con alertas pendientes, 2) Casos en demanda sin movimientos recientes, 3) Casos próximos a prescripción. Te muestro el top 5 para revisar.',
    sinonimos: ['casos urgentes', 'atencion casos', 'casos prioritarios', 'que casos revisar'],
  },
  {
    id: 'JU-003', categoria: 'CASOS',
    pregunta: '¿Cuáles son los candidatos a jurídico?',
    respuesta: 'Candidatos = préstamos con 60+ días de mora sin caso jurídico abierto. Te muestro: cliente, días de mora, saldo, severidad. Para los de 90+ días, recomiendo demandar inmediatamente.',
    sinonimos: ['candidatos juridico', 'posibles casos', 'para escalar juridico', 'candidatos a cobro juridico'],
  },
  {
    id: 'JU-010', categoria: 'PROCESOS',
    pregunta: '¿Cómo inicio un proceso judicial?',
    respuesta: 'Pasos: 1) Requerimiento prejurídico (notificación al deudor), 2) Preparar demanda ejecutiva (Ley 1564/2012 art. 420), 3) Radicar ante juzgado competente (del domicilio del deudor), 4) Medidas cautelares si aplica, 5) Inscripción en RUPTA si monto > 50 SMMLV.',
    sinonimos: ['iniciar demanda', 'proceso judicial', 'como demandar', 'iniciar cobro judicial', 'proceso ejecutivo'],
  },
  {
    id: 'JU-011', categoria: 'PROCESOS',
    pregunta: '¿Qué es el proceso ejecutivo?',
    respuesta: 'Proceso ejecutivo (Ley 1564/2012 art. 420-433): es el mecanismo judicial para cobrar obligaciones claras y exigibles (como pagarés). Requiere título valor. Plazo: 1-2 años. Permite embargo y secuestro de bienes.',
    sinonimos: ['proceso ejecutivo', 'que es proceso ejecutivo', 'jurisdiccion ejecutiva', 'cobro ejecutivo'],
  },
  {
    id: 'JU-012', categoria: 'PROCESOS',
    pregunta: '¿Cuándo prescribe una deuda?',
    respuesta: 'Prescripción ordinaria: 3 años desde el vencimiento (Art. 2536 Código Civil). Prescripción de título ejecutivo (pagaré): 5 años (Art. 2537 C.C.). Se interrumpe con demanda judicial o reconocimiento del deudor. ¡Importante calcular bien!',
    sinonimos: ['prescripcion deuda', 'cuando prescribe', 'prescribio', 'deuda prescrita', 'termino de prescripcion'],
  },
  {
    id: 'JU-020', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué dice el Código Civil sobre obligaciones?',
    respuesta: 'Art. 1551 Código Civil: "Toda obligación consiste en dar, hacer o no hacer alguna cosa". Art. 1568: "El que ha cometido un delito o culpa... es responsable de todo daño". Art. 1601: el deudor está en mora por el solo vencimiento del plazo (mora ex re).',
    sinonimos: ['codigo civil obligaciones', 'articulo 1551', 'obligaciones codigo civil', 'mora ex re', 'art 1601'],
  },
  {
    id: 'JU-021', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué es la Ley de Usura?',
    respuesta: 'Ley 1450 de 2011 (art. 305) y Código Penal art. 305: se prohíbe cobrar intereses superiores al 1.5× la tasa bancaria corriente certificada por la Superintendencia Financiera. Actualmente la tasa bancaria corriente es ~14% EA, por lo que el límite es ~21% EA. ¡Importante verificar antes de cobrar!',
    sinonimos: ['ley usura', 'usura', 'limite de intereses', 'intereses usurarios', 'tasa maxima legal', 'ley 1450'],
  },
  {
    id: 'JU-022', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué dice el Estatuto del Consumidor?',
    respuesta: 'Ley 1480 de 2011 (Estatuto del Consumidor): protege a los consumidores en relaciones de consumo. Cláusulas abusivas son nulas (art. 10). Prohibido cláusulas que impongan renuncia a derechos (art. 12). El consumidor puede demandar ante la SIC. Importante revisar contratos.',
    sinonimos: ['estatuto consumidor', 'ley 1480', 'derechos del consumidor', 'sic', 'clausulas abusivas'],
  },
  {
    id: 'JU-023', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué es Habeas Data?',
    respuesta: 'Ley 1266 de 2008 (Habeas Data): regula el manejo de datos personales en centrales de información (Datacrédito, Cifin). El deudor tiene derecho a: 1) Conocer qué se reporta, 2) Actualizar datos, 3) Retirar el reporte cuando pague (período máximo: 2 años después de pago). Reporte negativo solo después de 30 días de mora.',
    sinonimos: ['habeas data', 'ley 1266', 'reporte centrales', 'datacredito', 'cifin', 'reporte negativo'],
  },
  {
    id: 'JU-024', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué es la Ley 1581 de 2012?',
    respuesta: 'Ley 1581 de 2012 (Protección de Datos Personales): regula el tratamiento de datos personales. Requiere: 1) Autorización previa del titular, 2) Finalidad específica, 3) Medidas de seguridad técnicas y administrativas, 4) Derechos ARCO (acceso, rectificación, cancelación, oposición). Sanciones hasta 2000 SMMLV.',
    sinonimos: ['ley 1581', 'proteccion datos personales', 'datos personales colombia', 'derechos arco'],
  },
  {
    id: 'JU-030', categoria: 'COBRANZA',
    pregunta: '¿Cómo redacto un requerimiento de pago?',
    respuesta: 'Estructura del requerimiento prejurídico: 1) Lugar y fecha, 2) Destinatario (deudor), 3) Referencia del crédito (pagaré, monto, fecha), 4) Saldo actual, 5) Plazo para pago (mínimo 8 días), 6) Aviso de acciones legales, 7) Firma. ¿Quieres que redacte uno para un caso específico?',
    sinonimos: ['redactar requerimiento', 'requerimiento de pago', 'requerimiento prejuridico', 'carta de cobro', 'requerimiento'],
  },
  {
    id: 'JU-031', categoria: 'COBRANZA',
    pregunta: '¿Cómo cobrar un pagaré?',
    respuesta: 'Pasos para cobro de pagaré: 1) Verificar vigencia (no prescripción), 2) Requerimiento prejurídico, 3) Si no paga, proceso ejecutivo (título valor = pagaré), 4) Demanda ante juzgado, 5) Medidas cautelares (embargo), 6) Sentencia y ejecución. Plazo aproximado: 1-2 años.',
    sinonimos: ['cobrar pagare', 'cobro de pagare', 'ejecutar pagare', 'cobro pagare'],
  },
  {
    id: 'JU-032', categoria: 'COBRANZA',
    pregunta: '¿Qué es un título valor?',
    respuesta: 'Título valor (Ley 1430 de 2010, Código de Comercio): documento que incorpora un derecho literal y autónomo. Ejemplos: pagaré, letra de cambio, cheque, certificado de depósito. Características: literalidad (lo que dice el documento), autonomía (cada poseedor es legítimo), abstracción (independiente de la causa).',
    sinonimos: ['titulo valor', 'titulos valores', 'que es titulo valor', 'codigo comercio titulos'],
  },
  {
    id: 'JU-040', categoria: 'CONTRATOS',
    pregunta: '¿Cómo redacto un contrato de mutuo?',
    respuesta: 'Contrato de mutuo (Art. 2231 Código Civil): una parte entrega a otra una cantidad de cosas fungibles (dinero) con cargo de restituir otras tantas del mismo género y calidad. Cláusulas: 1) Partes, 2) Monto, 3) Interés, 4) Plazo, 5) Forma de pago, 6) Garantías, 7) Mora, 8) Jurisdicción.',
    sinonimos: ['contrato mutuo', 'redactar contrato mutuo', 'mutuo dinero', 'contrato de prestamo'],
  },
  {
    id: 'JU-041', categoria: 'CONTRATOS',
    pregunta: '¿Qué cláusulas no pueden faltar en un contrato de préstamo?',
    respuesta: 'Cláusulas esenciales: 1) Identificación de partes, 2) Monto y moneda, 3) Tasa de interés (dentro del límite legal), 4) Plazo y forma de pago, 5) Sistema de amortización, 6) Causales de mora, 7) Intereses moratorios, 8) Garantías (codeudor, hipoteca), 9) Foro/jurisdicción, 10) Autorización de reporte a centrales.',
    sinonimos: ['clausulas contrato', 'contrato prestamo clausulas', 'que clausulas incluir', 'contrato de credito'],
  },
  {
    id: 'JU-050', categoria: 'ALERTAS',
    pregunta: '¿Qué alertas legales tengo?',
    respuesta: 'Te muestro las alertas legales pendientes: 1) Casos próximos a prescripción, 2) Audiencias pendientes, 3) Vencimientos de medidas cautelares, 4) Documentos por radicar. ¿Quieres ver el detalle de cada una?',
    sinonimos: ['alertas legales', 'avisos legales', 'alertas juridicas', 'pendientes legales'],
  },
  {
    id: 'JU-060', categoria: 'AREAS',
    pregunta: '¿Conoces derecho civil?',
    respuesta: 'Sí, domino derecho civil colombiano: obligaciones (contratos, responsabilidad civil), bienes (propiedad, posesión), familia (matrimonio, sucesiones), sucesiones (testamentarias, ab-intestato). Fundamentado en Código Civil colombiano (Ley 84 de 1873) y reformas.',
    sinonimos: ['derecho civil', 'civil', 'conoces derecho civil', 'sabes de derecho civil'],
  },
  {
    id: 'JU-061', categoria: 'AREAS',
    pregunta: '¿Conoces derecho comercial?',
    respuesta: 'Sí, domino derecho comercial colombiano: sociedades, contratos mercantiles, títulos valores, procesos concursales (reestructuración, liquidación), propiedad intelectual. Fundamentado en Código de Comercio (Decreto 410 de 1971) y reformas.',
    sinonimos: ['derecho comercial', 'comercial', 'mercantil', 'conoces derecho comercial'],
  },
  {
    id: 'JU-062', categoria: 'AREAS',
    pregunta: '¿Conoces derecho laboral?',
    respuesta: 'Sí, domino derecho laboral colombiano: contrato individual de trabajo, prestaciones sociales (cesantías, primas, vacaciones), liquidación, despidos, indemnizaciones, seguridad social. Fundamentado en Código Sustantivo del Trabajo y leyes especiales.',
    sinonimos: ['derecho laboral', 'laboral', 'conoces derecho laboral', 'trabajo'],
  },
]

// =====================================================
// 7. SEGURIDAD — Bot de Ciberseguridad (CISO AI)
// Especialidad: auditoría, IPs, accesos, MFA, hallazgos
// =====================================================
export const DATASET_SEGURIDAD: ItemEntrenamiento[] = [
  {
    id: 'SE-001', categoria: 'AUDITORIA',
    pregunta: '¿Cuál es el estado de seguridad del sistema?',
    respuesta: 'Te muestro el informe: 1) Nivel de riesgo general (bajo/medio/alto/crítico), 2) Total hallazgos por severidad, 3) Usuarios y accesos, 4) IPs sospechosas, 5) Backups. ¿Quieres el detalle de algún punto?',
    sinonimos: ['estado seguridad', 'informe seguridad', 'auditoria seguridad', 'como esta la seguridad', 'nivel de riesgo'],
  },
  {
    id: 'SE-002', categoria: 'AUDITORIA',
    pregunta: '¿Qué hallazgos críticos hay?',
    respuesta: 'Te muestro los hallazgos críticos detectados: 1) Descripción, 2) Impacto, 3) Probabilidad, 4) Recomendación. Prioridad: atender HOY. ¿Quieres que genere el plan de acción?',
    sinonimos: ['hallazgos criticos', 'vulnerabilidades criticas', 'riesgos criticos', 'alertas criticas seguridad'],
  },
  {
    id: 'SE-003', categoria: 'AUDITORIA',
    pregunta: 'Genera informe de seguridad',
    respuesta: 'Genero el informe completo: 1) Resumen ejecutivo, 2) Indicadores, 3) Accesos (24h), 4) Auditoría, 5) Backups, 6) Conexiones API, 7) Hallazgos, 8) Plan de acción priorizado. ¿Exportar a PDF?',
    sinonimos: ['informe seguridad', 'reporte seguridad', 'auditoria completa', 'generar informe', 'informe de ciberseguridad'],
  },
  {
    id: 'SE-010', categoria: 'ACCESOS',
    pregunta: '¿Quién accedió al sistema hoy?',
    respuesta: 'Te muestro los accesos de las últimas 24h: 1) Total accesos, 2) Exitosos vs fallidos, 3) IPs únicas, 4) Detalle de cada acceso (IP, usuario, hora, éxito). ¿Quieres ver algún acceso específico?',
    sinonimos: ['accesos hoy', 'quien ingreso', 'logins de hoy', 'auditoria de accesos', 'quien accedio'],
  },
  {
    id: 'SE-011', categoria: 'ACCESOS',
    pregunta: '¿Hay IPs sospechosas?',
    respuesta: 'Detecto IPs sospechosas: aquellas con 5+ intentos fallidos en 24h. Posible fuerza bruta. Te muestro: IP, número de intentos, última actividad. Recomiendo bloquearlas. ¿Quieres bloquear alguna?',
    sinonimos: ['ips sospechosas', 'ataque fuerza bruta', 'intentos fallidos', 'ips bloqueadas', 'atacantes'],
  },
  {
    id: 'SE-012', categoria: 'ACCESOS',
    pregunta: '¿Cuántos intentos fallidos hay?',
    respuesta: 'Te muestro: 1) Total intentos fallidos en 24h, 2) Distribución por IP, 3) Distribución por usuario. Si hay >20 intentos fallidos, recomiendo: 1) Bloquear IPs, 2) Considerar CAPTCHA, 3) Revisar cuentas atacadas.',
    sinonimos: ['intentos fallidos', 'logins fallidos', 'accesos fallidos', 'errores de login'],
  },
  {
    id: 'SE-020', categoria: 'USUARIOS',
    pregunta: '¿Qué usuarios están bloqueados?',
    respuesta: 'Te muestro los usuarios bloqueados (por intentos fallidos excesivos). Para cada uno: nombre, motivo, fecha de bloqueo, fecha estimada de desbloqueo. ¿Quieres desbloquear alguno?',
    sinonimos: ['usuarios bloqueados', 'cuentas bloqueadas', 'bloqueos', 'quien esta bloqueado'],
  },
  {
    id: 'SE-021', categoria: 'USUARIOS',
    pregunta: '¿Qué usuarios están inactivos?',
    respuesta: 'Te muestro usuarios inactivos: 90+ días sin acceso. Para cada uno: nombre, último acceso, rol. Recomiendo: desactivar o requerir reactivación. Cuentas dormidas son riesgo de seguridad.',
    sinonimos: ['usuarios inactivos', 'cuentas inactivas', 'usuarios sin acceso', 'cuentas dormidas'],
  },
  {
    id: 'SE-022', categoria: 'USUARIOS',
    pregunta: '¿Quién tiene acceso de ADMIN?',
    respuesta: 'Te muestro los usuarios con rol ADMIN: nombre, último acceso, si tienen MFA activado. Recomiendo: TODOS los ADMIN deben tener MFA. Si alguno no lo tiene, es prioridad alta activarlo.',
    sinonimos: ['usuarios admin', 'administradores', 'quien es admin', 'roles admin'],
  },
  {
    id: 'SE-030', categoria: 'MFA',
    pregunta: '¿Qué usuarios tienen MFA activado?',
    respuesta: 'Te muestro: 1) Total usuarios con MFA, 2) Total sin MFA, 3) Lista detallada. Recomiendo: MFA obligatorio para ADMIN. Para otros usuarios, ofrecerlo como opción.',
    sinonimos: ['mfa activado', 'autenticacion multifactor', '2fa', 'quien tiene mfa', 'doble factor'],
  },
  {
    id: 'SE-031', categoria: 'MFA',
    pregunta: '¿Cómo activo MFA?',
    respuesta: 'Pasos para activar MFA: 1) Ingresa a tu perfil, 2) Selecciona "Activar MFA", 3) Escanea el código QR con Google Authenticator, 4) Verifica con el código de 6 dígitos, 5) Guarda los códigos de respaldo. Una vez activado, requerirás el código en cada login.',
    sinonimos: ['activar mfa', 'configurar mfa', 'como activo mfa', 'poner mfa', 'activar doble factor'],
  },
  {
    id: 'SE-040', categoria: 'BACKUPS',
    pregunta: '¿Cuándo fue el último backup?',
    respuesta: 'Te muestro: 1) Fecha del último backup, 2) Total backups, 3) Backups en últimos 30 días, 4) Backups fallidos. Si no hay backup en 24h, recomiendo generar uno inmediatamente.',
    sinonimos: ['ultimo backup', 'copia de seguridad', 'respaldo', 'backup reciente'],
  },
  {
    id: 'SE-041', categoria: 'BACKUPS',
    pregunta: '¿Cuántos backups hay?',
    respuesta: 'Te muestro: 1) Total backups, 2) Distribución por tipo (manual, automático), 3) Tamaño total, 4) Backups fallidos. Recomiendo: mantener mínimo 30 backups diarios.',
    sinonimos: ['cuantos backups', 'total backups', 'lista de backups', 'respaldos disponibles'],
  },
  {
    id: 'SE-050', categoria: 'HALLAZGOS',
    pregunta: 'Genera plan de acción de seguridad',
    respuesta: 'Genero el plan priorizado: 1) Acciones inmediatas (hoy): hallazgos críticos, 2) Acciones esta semana: hallazgos altos, 3) Mejoras planificadas (próximo mes): hallazgos medios. Para cada acción: problema, recomendación, impacto.',
    sinonimos: ['plan accion seguridad', 'plan de remediacion', 'que hacer para mejorar seguridad', 'plan seguridad'],
  },
  {
    id: 'SE-051', categoria: 'HALLAZGOS',
    pregunta: '¿Qué clientes no tienen PIN?',
    respuesta: 'Te muestro los clientes sin PIN configurado. Riesgo: acceso al portal sin autenticación adecuada. Recomiendo: forzar creación de PIN en próximo acceso. ¿Quieres forzar la creación?',
    sinonimos: ['clientes sin pin', 'sin pin', 'clientes sin autenticacion', 'falta de pin'],
  },
  {
    id: 'SE-060', categoria: 'CONEXIONES',
    pregunta: '¿Qué conexiones API hay?',
    respuesta: 'Te muestro: 1) Total conexiones API, 2) Activas vs inactivas, 3) Lista detallada (nombre, tipo, estado). Las conexiones inactivas pueden ser riesgo: ¿quieres eliminar las que no se usan?',
    sinonimos: ['conexiones api', 'apis', 'integraciones api', 'servicios conectados'],
  },
  {
    id: 'SE-070', categoria: 'HARDENING',
    pregunta: '¿Cómo refuerzo la seguridad del sistema?',
    respuesta: 'Recomendaciones de hardening: 1) MFA para todos los ADMIN, 2) Backups diarios automáticos, 3) Rotación de JWT_SECRET cada 90 días, 4) Revisar logs de auditoría diariamente, 5) Bloquear IPs sospechosas, 6) Cerrar cuentas inactivas, 7) HTTPS obligatorio, 8) Headers de seguridad (CSP, HSTS).',
    sinonimos: ['reforzar seguridad', 'hardening', 'mejorar seguridad', 'fortalecer seguridad', 'seguridad reforzada'],
  },
]

// =====================================================
// 8. CONFIGURACION — DevOps IA (SRE + DevOps)
// Especialidad: monitoreo continuo, infraestructura, backups
// =====================================================
export const DATASET_CONFIGURACION: ItemEntrenamiento[] = [
  {
    id: 'DO-001', categoria: 'SISTEMA',
    pregunta: '¿Cuál es el estado del sistema?',
    respuesta: 'Te muestro el estado completo: 1) Salud general (Excelente/Crítico), 2) CPU y memoria, 3) Disco, 4) Base de datos, 5) Variables de entorno, 6) Backups, 7) Snapshots, 8) Hallazgos. ¿Quieres ver el detalle?',
    sinonimos: ['estado sistema', 'como esta el sistema', 'salud sistema', 'monitoreo', 'status sistema'],
  },
  {
    id: 'DO-002', categoria: 'SISTEMA',
    pregunta: '¿Cuánto uso de CPU hay?',
    respuesta: 'Te muestro: 1) Número de CPUs, 2) Modelo de CPU, 3) Load average (1/5/15 min), 4) Uso actual. Si load average > número de CPUs, hay saturación. Saludable: <70%.',
    sinonimos: ['uso cpu', 'carga cpu', 'procesador', 'load average', 'rendimiento cpu'],
  },
  {
    id: 'DO-003', categoria: 'SISTEMA',
    pregunta: '¿Cuánta memoria se está usando?',
    respuesta: 'Te muestro: 1) Memoria total, 2) Memoria usada, 3) Memoria libre, 4) Porcentaje de uso. Saludable: <80%. Crítico: >90% (riesgo de OOM kill). Si está alto, recomiendo reiniciar servicios.',
    sinonimos: ['uso memoria', 'ram', 'memoria ram', 'consumo memoria', 'memoria libre'],
  },
  {
    id: 'DO-004', categoria: 'SISTEMA',
    pregunta: '¿Cuánto espacio en disco hay?',
    respuesta: 'Te muestro: 1) Disco total, 2) Disco usado, 3) Disco libre, 4) Porcentaje. Saludable: <80%. Crítico: >90%. Si está alto, recomiendo: 1) Limpiar logs antiguos, 2) Eliminar backups obsoletos, 3) Vaciar temporales.',
    sinonimos: ['espacio disco', 'almacenamiento', 'disco duro', 'capacidad disco', 'disco lleno'],
  },
  {
    id: 'DO-010', categoria: 'BASE_DATOS',
    pregunta: '¿Cuántos registros hay en la BD?',
    respuesta: 'Te muestro el conteo de registros por tabla: clientes, préstamos, pagos, conversaciones, mensajes, audit logs, backups, snapshots, usuarios, casos jurídicos, FAQs, bots. También te muestro el tamaño físico del archivo de BD.',
    sinonimos: ['registros bd', 'cuantos registros', 'tamano base datos', 'datos almacenados', 'registros base de datos'],
  },
  {
    id: 'DO-011', categoria: 'BASE_DATOS',
    pregunta: '¿Cuánto pesa la base de datos?',
    respuesta: 'Te muestro el tamaño físico del archivo de BD. Si es >100MB, recomiendo: 1) Archivar datos antiguos, 2) Optimizar índices, 3) Considerar migración a PostgreSQL para mejor performance en volúmenes grandes.',
    sinonimos: ['peso bd', 'tamano bd', 'base de datos pesada', 'bd grande'],
  },
  {
    id: 'DO-020', categoria: 'BACKUPS',
    pregunta: '¿Hay backups recientes?',
    respuesta: 'Te muestro: 1) Último backup, 2) Total backups en 30 días, 3) Backups fallidos. Saludable: 1 backup diario mínimo. Si no hay backup en 24h, CRÍTICO: generar uno ahora.',
    sinonimos: ['backups recientes', 'ultimos backups', 'copia de seguridad reciente', 'respaldo reciente'],
  },
  {
    id: 'DO-021', categoria: 'BACKUPS',
    pregunta: 'Genera un backup ahora',
    respuesta: 'Genero backup manual ahora: 1) Exporto todas las tablas, 2) Comprimo, 3) Almaceno en /backups. Tiempo estimado: 1-5 min según tamaño. ¿Confirmas la generación?',
    sinonimos: ['generar backup', 'crear backup', 'backup manual', 'respaldo ahora', 'hacer backup'],
  },
  {
    id: 'DO-030', categoria: 'SNAPSHOTS',
    pregunta: '¿Cuántos snapshots hay?',
    respuesta: 'Te muestro: 1) Total snapshots, 2) Snapshots recientes (últimos 5), 3) Versión del sistema activa. Recomiendo: crear snapshot mensual mínimo. ¿Quieres crear uno ahora?',
    sinonimos: ['snapshots', 'cantidad snapshots', 'puntos de restauracion', 'snapshots disponibles'],
  },
  {
    id: 'DO-031', categoria: 'SNAPSHOTS',
    pregunta: 'Genera un snapshot del proyecto',
    respuesta: 'Genero snapshot completo del proyecto: 1) Captura todos los archivos fuente, 2) Captura configuración, 3) Comprime en un archivo. Útil antes de cambios importantes. ¿Confirmas?',
    sinonimos: ['generar snapshot', 'crear snapshot', 'snapshot proyecto', 'punto de restauracion'],
  },
  {
    id: 'DO-040', categoria: 'VARIABLES',
    pregunta: '¿Están configuradas las variables de entorno?',
    respuesta: 'Te muestro el estado de variables críticas: 1) DATABASE_URL, 2) JWT_SECRET, 3) API_ENCRYPTION_KEY, 4) NODE_ENV. Si alguna falta, es CRÍTICO configurarla. ¿Quieres ver el detalle?',
    sinonimos: ['variables entorno', 'env vars', 'configuracion entorno', 'variables de ambiente'],
  },
  {
    id: 'DO-041', categoria: 'VARIABLES',
    pregunta: '¿Está configurado JWT_SECRET?',
    respuesta: 'JWT_SECRET debe estar configurado para que los tokens sean seguros. Si no está, CRÍTICO: los tokens pueden ser falsificados. Debe ser una cadena aleatoria de 32+ caracteres. ¿Quieres que te ayude a configurarlo?',
    sinonimos: ['jwt secret', 'jwt configurado', 'clave jwt', 'token seguro'],
  },
  {
    id: 'DO-050', categoria: 'HALLAZGOS',
    pregunta: '¿Qué hallazgos hay?',
    respuesta: 'Te muestro los hallazgos del DevOps IA: 1) Variables faltantes, 2) Sin backups recientes, 3) Memoria/disco alto, 4) Certificados SSL por vencer, 5) Integraciones inactivas, 6) BD muy grande. ¿Quieres el plan de optimización?',
    sinonimos: ['hallazgos devops', 'problemas sistema', 'alertas infraestructura', 'issues sistema'],
  },
  {
    id: 'DO-051', categoria: 'HALLAZGOS',
    pregunta: 'Genera plan de optimización',
    respuesta: 'Genero el plan: 1) Acciones críticas (hoy), 2) Acciones altas (esta semana), 3) Acciones medias (próximo mes), 4) Acciones proactivas. Para cada una: prioridad, acción, impacto, esfuerzo. ¿Quieres que ejecute alguna?',
    sinonimos: ['plan optimizacion', 'mejoras sistema', 'plan de mejora', 'optimizar sistema'],
  },
  {
    id: 'DO-060', categoria: 'INTEGRACIONES',
    pregunta: '¿Qué integraciones hay?',
    respuesta: 'Te muestro: 1) Total integraciones, 2) Activas vs inactivas, 3) Detalle (nombre, proveedor, estado). Las inactivas pueden ser funcionales limitadas. ¿Quieres reactivar alguna?',
    sinonimos: ['integraciones', 'servicios integrados', 'proveedores externos', 'apis conectadas'],
  },
  {
    id: 'DO-070', categoria: 'CERTIFICADOS',
    pregunta: '¿Cuándo vencen los certificados SSL?',
    respuesta: 'Te muestro: 1) Total certificados SSL, 2) Activos vs por vencer, 3) Detalle (dominio, fecha vencimiento, días restantes). Si alguno vence en <30 días, ALERTA: renovar pronto.',
    sinonimos: ['certificados ssl', 'ssl', 'https', 'vencimiento ssl', 'certificados digitales'],
  },
  {
    id: 'DO-080', categoria: 'SENTINEL',
    pregunta: '¿Está activo el sentinel?',
    respuesta: 'El sentinel DevOps IA está SIEMPRE ACTIVO. Es un proceso no-apagable que monitorea: 1) CPU/memoria/disco continuamente, 2) Auditoría de seguridad cada hora, 3) Backups diarios, 4. Alertas automáticas. Solo un ADMIN con confirmación especial puede detenerlo temporalmente.',
    sinonimos: ['sentinel activo', 'devops sentinel', 'monitor continuo', 'esta vigente el sentinel', 'estado sentinel'],
  },
  {
    id: 'DO-081', categoria: 'SENTINEL',
    pregunta: '¿Por qué el sentinel no se apaga?',
    respuesta: 'El sentinel DevOps IA es NO-APAGABLE por diseño. Razones: 1) Seguridad continua: detecta ataques en tiempo real, 2) Auditoría permanente: registra todos los eventos, 3) Auto-recuperación: si falla, se reinicia solo, 4) Cumplimiento: garantiza monitoreo 24/7. Solo el administrador principal puede pausarlo temporalmente con doble confirmación.',
    sinonimos: ['sentinel no apaga', 'por que sentinel siempre activo', 'monitor permanente', 'devops always on'],
  },
  {
    id: 'DO-082', categoria: 'SENTINEL',
    pregunta: '¿Qué monitorea el sentinel?',
    respuesta: 'El sentinel monitorea continuamente: 1) Recursos del sistema (CPU, RAM, disco), 2) Estado de la base de datos, 3) Accesos y login attempts, 4) Auditoría de cambios, 5) Backups, 6) Variables de entorno, 7) Certificados SSL, 8) Integraciones, 9) Errores de aplicación, 10) IPs sospechosas. Genera alertas automáticas.',
    sinonimos: ['que monitorea sentinel', 'funciones sentinel', 'que revisa el sentinel', 'monitoreo devops'],
  },
]

// =====================================================
// 9. ADMIN_GENERAL — Asistente Ejecutivo IA
// Especialidad: dashboard consolidado, KPIs, decisiones estratégicas
// =====================================================
export const DATASET_ADMIN_GENERAL: ItemEntrenamiento[] = [
  {
    id: 'AG-001', categoria: 'DASHBOARD',
    pregunta: 'Muéstrame el dashboard ejecutivo',
    respuesta: 'Te muestro el dashboard consolidado: 1) KPIs de cartera (préstamos, mora, recaudo), 2) KPIs financieros (ingresos, gastos, balance), 3) KPIs operativos (clientes, conversaciones, respuestas bot), 4) Alertas críticas. ¿Quieres profundizar en algún área?',
    sinonimos: ['dashboard ejecutivo', 'dashboard consolidado', 'panel ejecutivo', 'kpi ejecutivos', 'resumen ejecutivo', 'panorama general'],
  },
  {
    id: 'AG-002', categoria: 'DASHBOARD',
    pregunta: '¿Cómo está el negocio hoy?',
    respuesta: 'Resumen ejecutivo del día: 1) Cartera: X préstamos activos, Y% mora, $Z recaudo hoy, 2) Finanzas: ingresos vs gastos del día, 3) Operación: N conversaciones activas, M respuestas automáticas, 4) Alertas críticas detectadas. ¿Quieres el detalle?',
    sinonimos: ['como esta el negocio', 'estado del negocio', 'resumen del dia', 'como vamos hoy', 'estado actual'],
  },
  {
    id: 'AG-003', categoria: 'DASHBOARD',
    pregunta: '¿Cuáles son las alertas críticas?',
    respuesta: 'Consolido alertas críticas de todos los módulos: 1) Cartera: clientes en mora crítica, 2) Seguridad: IPs sospechosas, hallazgos críticos, 3) Sistema: recursos elevados, backups faltantes, 4) Operación: conversaciones pendientes. ¿Quieres ver el detalle por módulo?',
    sinonimos: ['alertas criticas', 'alertas ejecutivas', 'que alertas hay', 'problemas criticos', 'urgentes'],
  },
  {
    id: 'AG-010', categoria: 'ANALISIS',
    pregunta: 'Analiza el comportamiento del negocio',
    respuesta: 'Análisis ejecutivo: 1) Tendencia de cartera (últimos 90 días), 2) Tendencia financiera, 3) Tendencia operativa, 4) Anomalías detectadas, 5) Oportunidades de mejora. Te doy conclusiones y recomendaciones priorizadas.',
    sinonimos: ['analisis negocio', 'comportamiento negocio', 'analisis ejecutivo', 'tendencias negocio', 'diagnostico'],
  },
  {
    id: 'AG-011', categoria: 'ANALISIS',
    pregunta: 'Detecta anomalías',
    respuesta: 'Detecto anomalías en: 1) Mora atípica (clientes nuevos en mora), 2) Recaudo inusual (caída o pico), 3) Actividad sospechosa (logins, IPs), 4) Errores del sistema, 5) Comportamientos atípicos en bots. Para cada anomalía, te doy contexto y recomendación.',
    sinonimos: ['anomalias', 'detectar anomalias', 'comportamientos atipicos', 'anormalidades', 'patrones sospechosos'],
  },
  {
    id: 'AG-012', categoria: 'ANALISIS',
    pregunta: '¿Cuáles son las oportunidades de mejora?',
    respuesta: 'Identifico oportunidades: 1) Reducir mora X% (impacto $Y), 2) Aumentar recaudo (automatizar recordatorios), 3) Optimizar gastos (categoría Z), 4) Mejor conversión de bots (% actual vs meta 95%), 5) Diversificar cartera. Para cada una, impacto estimado y esfuerzo.',
    sinonimos: ['oportunidades mejora', 'que mejorar', 'oportunidades negocio', 'donde mejorar', 'optimizaciones'],
  },
  {
    id: 'AG-020', categoria: 'KPIs',
    pregunta: '¿Cuál es la tasa de mora?',
    respuesta: 'La tasa de mora = (préstamos en mora / préstamos activos) × 100. Saludable: <10%. Crítico: >20%. Te muestro tu tasa actual, comparativa con mes anterior y tendencia. Si está alta, te doy 3 acciones correctivas priorizadas.',
    sinonimos: ['tasa mora', 'indice mora', 'mora', 'porcentaje mora', 'cartera vencida'],
  },
  {
    id: 'AG-021', categoria: 'KPIs',
    pregunta: '¿Cuál es la rentabilidad?',
    respuesta: 'Rentabilidad = (intereses cobrados / capital prestado) × 100. Te muestro: 1) Rentabilidad mensual, 2) Rentabilidad anualizada, 3) Comparativa con mercado, 4) Tendencia. Si está baja, te doy recomendaciones para mejorar.',
    sinonimos: ['rentabilidad', 'roi', 'tasa rentabilidad', 'margen', 'rendimiento cartera'],
  },
  {
    id: 'AG-022', categoria: 'KPIs',
    pregunta: '¿Cuántos clientes activos hay?',
    respuesta: 'Te muestro: 1) Total clientes, 2) Clientes con préstamo activo, 3) Clientes al día, 4) Clientes en mora, 5) Nuevos clientes del mes. ¿Quieres ver la lista?',
    sinonimos: ['clientes activos', 'cuantos clientes', 'total clientes', 'base de clientes'],
  },
  {
    id: 'AG-023', categoria: 'KPIs',
    pregunta: '¿Cuál es el recaudo del mes?',
    respuesta: 'Te muestro: 1) Recaudo total del mes, 2) Número de pagos, 3) Comparativa con mes anterior, 4) Proyección a fin de mes, 5) Top 5 clientes con mayor pago. ¿Quieres ver el detalle?',
    sinonimos: ['recaudo mensual', 'recaudo del mes', 'cobros del mes', 'pagos del mes'],
  },
  {
    id: 'AG-030', categoria: 'DECISIONES',
    pregunta: '¿Qué decisiones debería tomar?',
    respuesta: 'Basado en los datos actuales, te recomiendo decisiones priorizadas: 1) Acciones inmediatas (críticas), 2) Acciones de corto plazo (alta), 3) Estrategias de mediano plazo. Para cada una: justificación con datos, impacto estimado y esfuerzo requerido.',
    sinonimos: ['decisiones', 'que hacer', 'recomendaciones', 'que decidir', 'acciones a tomar'],
  },
  {
    id: 'AG-031', categoria: 'DECISIONES',
    pregunta: '¿Es buen momento para expandir?',
    respuesta: 'Evalúo: 1) Salud de cartera (mora <15%), 2) Rentabilidad (>15% anual), 3) Liquidez (>3 meses gastos), 4) Capacidad operativa (bots al 95%+), 5) Demanda (solicitudes pendientes). Te doy recomendación fundamentada.',
    sinonimos: ['expandir', 'crecer', 'expansion', 'es buen momento', 'ampliar negocio'],
  },
  {
    id: 'AG-032', categoria: 'DECISIONES',
    pregunta: 'Prioriza las acciones del día',
    respuesta: 'Priorizo tus acciones del día: 1) Críticas: atender mora 60+ días, revisar alertas de seguridad, 2) Altas: contactar vencen hoy, ofreces refinanciación, 3) Medias: revisar recaudo, atender conversaciones pendientes, 4) Bajas: revisar KPIs, planificar semana.',
    sinonimos: ['priorizar', 'prioridades dia', 'que hacer hoy', 'agenda dia', 'tareas prioritarias'],
  },
  {
    id: 'AG-040', categoria: 'REPORTES',
    pregunta: 'Genera reporte ejecutivo',
    respuesta: 'Genero reporte ejecutivo: 1) Resumen ejecutivo (1 página), 2) KPIs principales con tendencia, 3) Estado de cartera, 4) Estado financiero, 5) Estado operativo, 6) Alertas y riesgos, 7) Recomendaciones. ¿Exportar a PDF?',
    sinonimos: ['reporte ejecutivo', 'informe ejecutivo', 'reporte consolidado', 'reporte general'],
  },
  {
    id: 'AG-050', categoria: 'BOTs',
    pregunta: '¿Cómo están los bots?',
    respuesta: 'Estado de bots: 1) Total bots activos, 2) Bots con meta 95% alcanzada, 3) Promedio de entrenamiento, 4) Aprendizajes recientes, 5) Sentinel DevOps IA: activo/pausado. ¿Quieres entrenarlos a todos?',
    sinonimos: ['estado bots', 'como estan los bots', 'bots entrenados', 'rendimiento bots'],
  },
  {
    id: 'AG-060', categoria: 'SEGURIDAD',
    pregunta: '¿Cómo está la seguridad del sistema?',
    respuesta: 'Resumen de seguridad: 1) Nivel de riesgo general, 2) Hallazgos críticos/altos/medios, 3) IPs sospechosas, 4) Usuarios bloqueados, 5) MFA activado (ADMIN), 6) Backups recientes. ¿Quieres el plan de acción?',
    sinonimos: ['estado seguridad', 'como esta la seguridad', 'nivel seguridad', 'auditoria seguridad'],
  },
]

// =====================================================
// EXPORTAR TODOS LOS DATASETS
// =====================================================
const DATASETS_BASE_POR_BOT: Record<string, ItemEntrenamiento[]> = {
  CHAT_CLIENTES: DATASET_CHAT_CLIENTES,
  ADMIN_SISTEMA: DATASET_ADMIN_SISTEMA,
  CONTABILIDAD: DATASET_CONTABILIDAD,
  PAGOS: DATASET_PAGOS,
  PRESTAMOS: DATASET_PRESTAMOS,
  JURIDICO: DATASET_JURIDICO,
  SEGURIDAD: DATASET_SEGURIDAD,
  CONFIGURACION: DATASET_CONFIGURACION,
  ADMIN_GENERAL: DATASET_ADMIN_GENERAL,
}

// =====================================================
// Anexar datasets extra para mejorar cobertura conversacional
// (variantes lingüísticas adicionales por intent)
// =====================================================
import {
  DATASET_CHAT_CLIENTES_EXTRA,
  DATASET_ADMIN_BOTS_EXTRA,
} from './bot-datasets-extra'

// === Refuerzo normativo colombiano para el bot jurídico ===
import { DATASET_JURIDICO_COLOMBIA } from './bot-dataset-juridico-colombia'
// === Refuerzo avanzado: perfil profesional (25 años exp), jurisprudencia, doctrina ===
import { DATASET_JURIDICO_AVANZADO } from './bot-dataset-juridico-avanzado'
// === Dataset MASIVO conversacional: 47+ preguntas en estilo fluido (no menú) ===
// Cubre 500+ consultas reales de clientes en TODAS las ramas del derecho colombiano
import { DATASET_JURIDICO_MASIVO } from './bot-dataset-juridico-masivo'
// === Dataset de REFUERZO (auditoría 100%): cubre huecos detectados en pruebas ===
// de validación y preguntas conversacionales adicionales
import { DATASET_JURIDICO_REFUERZO } from './bot-dataset-juridico-refuerzo'
// === Nuevos conocimientos para todos los bots ===
import { DATASETS_NUEVOS_POR_BOT } from './bot-datasets-nuevos'

const DATASETS_EXTRA_POR_BOT: Record<string, ItemEntrenamiento[]> = {
  CHAT_CLIENTES: [...DATASET_CHAT_CLIENTES_EXTRA, ...(DATASETS_NUEVOS_POR_BOT.CHAT_CLIENTES || [])],
  ADMIN_SISTEMA: [...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('AP-')), ...(DATASETS_NUEVOS_POR_BOT.ADMIN_SISTEMA || [])],
  CONTABILIDAD: [...(DATASETS_NUEVOS_POR_BOT.CONTABILIDAD || [])],
  PAGOS: [...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('CO-')), ...(DATASETS_NUEVOS_POR_BOT.PAGOS || [])],
  PRESTAMOS: [...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('PR-')), ...(DATASETS_NUEVOS_POR_BOT.PRESTAMOS || [])],
  // Bot jurídico reforzado con:
  //   (1) variantes extra conversacionales
  //   (2) normativa colombiana exhaustiva (Leyes, CGP, C.C., C.Co, jurisprudencia básica)
  //   (3) dataset AVANZADO: perfil profesional 25 años, especialización, maestría,
  //       jurisprudencia de leading cases, doctrina, estrategia, casos prácticos
  //   (4) dataset MASIVO conversacional fluido: 47+ consultas reales en estilo natural
  //       (no menú) cubriendo civil, comercial, penal, procesal, laboral, familia,
  //       inmobiliario, consumidor, datos, financiero, tributario, constitucional,
  //       administrativo, compliance, internacional privado
  //   (5) dataset REFUERZO: 21 items que reparan hallazgos de auditoría (prescripción,
  //       jurisprudencia centrales de riesgo, acción pauliana, SAGRILAFT, SARLAFT,
  //       negociación acuerdos, S.A.S., protesto, embargo/remate, despido, cesantías,
  //       fuero maternidad, defensor consumidor, PQR, derechos ARCO, concursal, C.Co)
  JURIDICO: [
    ...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('JU-')),
    ...DATASET_JURIDICO_COLOMBIA,
    ...DATASET_JURIDICO_AVANZADO,
    ...DATASET_JURIDICO_MASIVO,
    ...DATASET_JURIDICO_REFUERZO,
    ...(DATASETS_NUEVOS_POR_BOT.JURIDICO || []),
  ],
  SEGURIDAD: [...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('CB-')), ...(DATASETS_NUEVOS_POR_BOT.SEGURIDAD || [])],
  CONFIGURACION: [...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('DO-')), ...(DATASETS_NUEVOS_POR_BOT.CONFIGURACION || [])],
  ADMIN_GENERAL: [...DATASET_ADMIN_BOTS_EXTRA.filter(d => d.id.startsWith('AE-')), ...(DATASETS_NUEVOS_POR_BOT.ADMIN_GENERAL || [])],
}

// Combinar dataset base + extra por bot
export const DATASETS_POR_BOT: Record<string, ItemEntrenamiento[]> = Object.fromEntries(
  Object.entries(DATASETS_BASE_POR_BOT).map(([tipo, base]) => [
    tipo,
    [...base, ...(DATASETS_EXTRA_POR_BOT[tipo] || [])],
  ])
)

/**
 * Obtiene el dataset para un tipo de bot
 */
export function getDatasetPorTipo(tipoBot: string): ItemEntrenamiento[] {
  return DATASETS_POR_BOT[tipoBot] || []
}

/**
 * Obtiene el nombre legible del bot
 */
export function getNombreEspecialidad(tipoBot: string): string {
  const nombres: Record<string, string> = {
    CHAT_CLIENTES: 'Atención al Cliente (Customer Success AI)',
    ADMIN_SISTEMA: 'Asistente Financiero Personal y Empresarial (Personal CFO)',
    CONTABILIDAD: 'Asesor Financiero Experto (CFO + Asesor Patrimonial)',
    PAGOS: 'Gerente de Cobranza Inteligente',
    PRESTAMOS: 'Director del Módulo de Préstamos',
    JURIDICO: 'Asesor Jurídico Senior (25 años de experiencia · Especialista en Derecho Comercial · Magíster en Derecho Financiero y de los Negocios)',
    SEGURIDAD: 'CISO Inteligente (SOC AI)',
    CONFIGURACION: 'SRE + DevOps IA (Sentinel Always-On)',
    ADMIN_GENERAL: 'Asistente Ejecutivo IA (CEO/COO Digital)',
  }
  return nombres[tipoBot] || 'Bot Especialista'
}
