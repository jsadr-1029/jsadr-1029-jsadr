// =====================================================
// preguntas-entrenamiento-bots.ts
// Base de conocimiento de entrenamiento (Q&A) para los 9 bots del sistema Jsadr
// Incluye 50+ preguntas y respuestas por bot, organizadas por categoría,
// con sinónimos en lenguaje natural colombiano.
// =====================================================

// =====================================================
// Tipos
// =====================================================

export type TipoBot =
  | 'CHAT_CLIENTES'
  | 'ADMIN_SISTEMA'
  | 'CONTABILIDAD'
  | 'PAGOS'
  | 'PRESTAMOS'
  | 'JURIDICO'
  | 'SEGURIDAD'
  | 'ADMIN_GENERAL'
  | 'CONFIGURACION'

export interface PreguntaEntrenamiento {
  pregunta: string
  sinonimos: string[]
  respuesta: string
}

export interface CategoriaPreguntas {
  nombre: string
  preguntas: PreguntaEntrenamiento[]
}

export interface PreguntasBot {
  tipoBot: TipoBot
  nombreBot: string
  descripcion: string
  categorias: CategoriaPreguntas[]
}

// =====================================================
// Utilidad interna: normalización de texto
// =====================================================
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// =====================================================
// 1. CHAT_CLIENTES — Atención al Cliente
// =====================================================
const PREGUNTAS_CHAT_CLIENTES: PreguntasBot = {
  tipoBot: 'CHAT_CLIENTES',
  nombreBot: 'Clientes',
  descripcion: 'Bot de atención al cliente para consultas de saldo, pagos, renovaciones y trámites.',
  categorias: [
    {
      nombre: 'Consultas Generales',
      preguntas: [
        {
          pregunta: 'Hola, ¿qué puedo hacer aquí?',
          sinonimos: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'que hago aqui', 'ayuda', 'menu', 'opciones', 'en que me puedes ayudar', 'que ofrecen'],
          respuesta:
            '¡Hola! Soy el asistente de Clientes de Jsadr. Puedo ayudarte con:\n' +
            '• Consultar tu saldo y cuotas\n' +
            '• Ver fecha de tu próximo pago\n' +
            '• Informarte sobre renovaciones y requisitos\n' +
            '• Conectarte con un asesor humano\n\n' +
            'Escribe lo que necesitas y con gusto te ayudo.',
        },
        {
          pregunta: '¿Cuáles son las opciones del menú?',
          sinonimos: ['menu', 'opciones', 'que puedo hacer', 'lista de opciones', 'comandos', 'que servicios ofrecen'],
          respuesta:
            'Menú principal:\n' +
            '1. Consultar saldo\n' +
            '2. Fecha de pago\n' +
            '3. Cuotas pagadas\n' +
            '4. Estado de cuenta\n' +
            '5. Renovación de crédito\n' +
            '6. Requisitos para nuevo préstamo\n' +
            '7. Hablar con asesor\n' +
            'Escribe el número o la opción que necesites.',
        },
        {
          pregunta: '¿Cómo funciona este chat?',
          sinonimos: ['como funciona', 'como se usa', 'que es esto', 'para que sirve', 'como interactuo'],
          respuesta:
            'Este chat te permite resolver tus consultas de crédito 24/7. Solo escribe tu pregunta en lenguaje natural y te responderé al instante. Si necesitas un asesor humano, dímelo y te conectaré.',
        },
        {
          pregunta: '¿En qué horario atienden?',
          sinonimos: ['horario', 'horarios', 'atienden', 'a que hora', 'dias habiles', 'fin de semana', 'sabado', 'domingo'],
          respuesta:
            'Nuestro horario de atención humana es lunes a viernes de 8:00 a.m. a 6:00 p.m. y sábados de 9:00 a.m. a 1:00 p.m. Yo, el bot, estoy disponible 24/7 para tus consultas.',
        },
        {
          pregunta: '¿Dónde quedan las oficinas?',
          sinonimos: ['donde quedan', 'direccion', 'ubicacion', 'sede', 'oficina', 'como llego'],
          respuesta:
            'Nuestras oficinas principales están en la Carrera 15 # 93-47, Bogotá. También podemos coordinar una visita o enviarte un asesor si lo prefieres.',
        },
        {
          pregunta: '¿Cuál es el número de WhatsApp?',
          sinonimos: ['whatsapp', 'numero de contacto', 'telefono', 'celular', 'como los contacto', 'numero de telefono'],
          respuesta:
            'Puedes contactarnos por WhatsApp al +57 320 123 4567. Está disponible en horario laboral. Para urgencias fuera de horario, déjame tu consulta y te responderemos primero hora del siguiente día hábil.',
        },
        {
          pregunta: '¿Pueden llamarme?',
          sinonimos: ['llamenme', 'llamada', 'telefoneo', 'me llaman', 'contacto telefonico', 'quiero que me llamen'],
          respuesta:
            'Claro, con gusto te llamamos. Confírmame tu número de teléfono y el mejor horario para contactarte. Un asesor te llamará en el siguiente horario hábil.',
        },
      ],
    },
    {
      nombre: 'Estado de Cuenta y Saldo',
      preguntas: [
        {
          pregunta: '¿Cuánto debo actualmente?',
          sinonimos: ['saldo', 'cuanto debo', 'mi deuda', 'lo que debo', 'mi obligacion', 'saldo pendiente', 'cuanto me queda', 'saldo actual'],
          respuesta:
            'Para consultar tu saldo actual necesito verificar tu identidad. Por favor confirma tu número de cédula y te muestro el saldo de tu préstamo, la cuota y la fecha del próximo pago.',
        },
        {
          pregunta: '¿Cuánto me falta para terminar de pagar?',
          sinonimos: ['cuanto me falta', 'lo que falta', 'restante', 'cuanto queda', 'para terminar de pagar', 'saldo restante'],
          respuesta:
            'Tu saldo pendiente corresponde al capital más los intereses generados hasta hoy. Para darte el valor exacto, confirma tu cédula y te muestro el desglose completo del saldo.',
        },
        {
          pregunta: '¿Me das mi estado de cuenta?',
          sinonimos: ['estado de cuenta', 'extracto', 'resumen', 'detalle de mi prestamo', 'movimientos', 'historial completo'],
          respuesta:
            'Con gusto. El estado de cuenta incluye: capital, intereses, cuotas pagadas, saldo y fecha de vencimiento. Indícame a qué correo te lo envío o si prefieres verlo aquí mismo.',
        },
        {
          pregunta: '¿Cuál es mi cuota mensual?',
          sinonimos: ['cuota', 'valor de la cuota', 'cuanto es la cuota', 'pago mensual', 'cuota mensual', 'cuota quincenal', 'mi cuota'],
          respuesta:
            'Tu cuota depende del monto, la tasa y el plazo de tu préstamo. Confirma tu cédula y te indico el valor exacto de la cuota y la frecuencia pactada (mensual, quincenal o semanal).',
        },
        {
          pregunta: '¿Por qué mi saldo subió?',
          sinonimos: ['saldo subio', 'aumento el saldo', 'porque subio', 'me cobraron mas', 'interes', 'por que aumento'],
          respuesta:
            'El saldo puede subir por intereses generados días de mora, gastos de cobranza o seguros. Si estás al día, debería mantenerse o bajar con cada pago. Cuéntame si tu pago está al corriente y reviso tu caso.',
        },
        {
          pregunta: '¿Qué pasa si no tengo préstamos activos?',
          sinonimos: ['no tengo prestamo', 'sin prestamos', 'no debo nada', 'no tengo creditos', 'cero prestamos'],
          respuesta:
            'Si no tienes préstamos activos, ¡felicitaciones por estar al día! Si quieres solicitar uno nuevo, puedo informarte sobre los requisitos y montos disponibles. ¿Te interesa?',
        },
        {
          pregunta: '¿Puedo ver el detalle de los intereses?',
          sinonimos: ['detalle intereses', 'como se calculan los intereses', 'desglose intereses', 'tasa de interes', 'tasa', 'interes diario'],
          respuesta:
            'Los intereses se calculan sobre el saldo capital a la tasa pactada en tu contrato. Si quieres, te envío el desglose detallado con la tasa efectiva anual y el cálculo día por día.',
        },
      ],
    },
    {
      nombre: 'Pagos y Cuotas',
      preguntas: [
        {
          pregunta: '¿Cuándo es mi próximo pago?',
          sinonimos: ['fecha de pago', 'cuando pago', 'proximo pago', 'vencimiento', 'cuando vence', 'fecha limite', 'cuando es mi pago'],
          respuesta:
            'Tu fecha de pago está definida en tu contrato. Confirma tu cédula y te indico la fecha exacta del próximo vencimiento y los días restantes para que no te retrases.',
        },
        {
          pregunta: '¿Cuántas cuotas he pagado?',
          sinonimos: ['cuotas pagadas', 'cuantas cuotas', 'progreso', 'avance', 'cuanto he pagado', 'historial de pagos', 'que he pagado'],
          respuesta:
            'Para ver tu avance necesito validar tu identidad. Te puedo mostrar: cuotas pagadas vs total, último pago registrado y próximas cuotas. Confirma tu cédula para continuar.',
        },
        {
          pregunta: '¿Dónde puedo hacer mi pago?',
          sinonimos: ['donde pago', 'como pago', 'lugares de pago', 'puntos de pago', 'pagar', 'hacer el pago'],
          respuesta:
            'Puedes pagar por:\n' +
            '• PSE desde nuestra web\n' +
            '• Efectivo en Baloto, Supergiros y Efecty\n' +
            '• Consignación a la cuenta de ahorros Bancolombia XXXX\n' +
            '• Convenio con corresponsales Davivienda\n\n' +
            'Recuerda enviar el comprobante para aplicarlo a tu cuenta.',
        },
        {
          pregunta: '¿Puedo pagar antes de la fecha?',
          sinonimos: ['pagar antes', 'pago anticipado', 'adelantar pago', 'abonar antes', 'pago adelantado'],
          respuesta:
            '¡Claro! El pago anticipado es bienvenido y puede reducir los intereses. Puedes abonar el monto de la cuota o más. Si quieres cancelar el préstamo por completo, te calculo el saldo a fecha de hoy.',
        },
        {
          pregunta: '¿Qué pasa si pago tarde?',
          sinonimos: ['pago tarde', 'mora', 'atraso', 'retraso', 'pagar despues', 'fecha pasada'],
          respuesta:
            'Un pago atrasado genera intereses moratorios y puede afectar tu reporte en Datacrédito. Te recomiendo pagar lo antes posible. Si tienes dificultad, podemos evaluar un acuerdo de pago.',
        },
        {
          pregunta: '¿Mi pago ya quedó registrado?',
          sinonimos: ['mi pago', 'ya pago', 'aplicaron el pago', 'registro el pago', 'consignacion', 'no aparece mi pago'],
          respuesta:
            'Los pagos tardan entre 1 y 24 horas en reflejarse según el canal. Si enviaste el comprobante y no se ve reflejado en 24 horas, escríbenos el número de transacción y lo verificamos de inmediato.',
        },
        {
          pregunta: '¿Puedo cambiar la fecha de pago?',
          sinonimos: ['cambiar fecha', 'otra fecha', 'mover fecha', 'modificar fecha de pago', 'reprogramar'],
          respuesta:
            'Cambiar la fecha de pago requiere una reestructuración del crédito. Si tienes buenas referencias de pago, podemos estudiarlo. Indícame qué fecha te convendría y consulto con el área.',
        },
      ],
    },
    {
      nombre: 'Renovación y Nuevo Crédito',
      preguntas: [
        {
          pregunta: '¿Ya puedo renovar mi crédito?',
          sinonimos: ['renovar', 'renovacion', 'renuevo', 'ya puedo renovar', 'refinanciar', 'ampliar credito'],
          respuesta:
            'La renovación suele estar disponible cuando has pagado al menos el 50% del préstamo y estás al día. Confirma tu cédula y te digo si ya calificas y por qué monto.',
        },
        {
          pregunta: '¿Cuánto me pueden prestar?',
          sinonimos: ['monto', 'cuanto me prestan', 'monto disponible', 'cupo', 'linea de credito', 'cuanto me dan'],
          respuesta:
            'El monto depende de tu capacidad de pago, historial y referencia. En general ofrecemos desde $200.000 hasta $5.000.000. Si me das tu cédula, te puedo dar una pre-aprobación estimada.',
        },
        {
          pregunta: '¿Cuáles son los requisitos para un nuevo préstamo?',
          sinonimos: ['requisitos', 'que necesito', 'documentos', 'que piden', 'tramite', 'como solicito'],
          respuesta:
            'Requisitos básicos:\n' +
            '• Cédula colombiana vigente\n' +
            '• Ingresos comprobables (mínimo 1 SMMLV)\n' +
            '• Antigüedad laboral mínima 6 meses\n' +
            '• Referencia personal y comercial\n' +
            '• No reportado en Datacrédito con mora superior a 30 días',
        },
        {
          pregunta: '¿Qué tasas manejan?',
          sinonimos: ['tasa', 'tasas', 'interes', 'tasa de interes', 'tasa mensual', 'tasa anual', 'cuanto es el interes'],
          respuesta:
            'Manejamos tasas desde 1.2% mensual (19.6% EA) según el monto y el perfil del cliente. La tasa exacta se define al estudiar tu solicitud. ¿Quieres que un asesor te contacte con una propuesta personalizada?',
        },
        {
          pregunta: '¿Cuánto demora la aprobación?',
          sinonimos: ['demora', 'cuanto demora', 'tiempo de aprobacion', 'cuando me responden', 'aprobacion rapida'],
          respuesta:
            'La aprobación toma entre 2 y 24 horas hábiles desde que recibimos la documentación completa. Si todo está en orden, el desembolso se realiza el mismo día de la aprobación.',
        },
        {
          pregunta: '¿Hacen préstamos sin codeudor?',
          sinonimos: ['sin codeudor', 'sin fiador', 'sin aval', 'solo yo', 'sin respaldo', 'libre inversion'],
          respuesta:
            'Para montos hasta $1.500.000 con buen historial, podemos aprobar sin codeudor. Para montos mayores, normalmente requerimos un codeudor con capacidad de pago. ¿Qué monto tienes pensado solicitar?',
        },
        {
          pregunta: '¿Desembolsan el mismo día?',
          sinonimos: ['desembolso mismo dia', 'mismo dia', 'desembolso rapido', 'cuando me desembolsan', 'ahora mismo'],
          respuesta:
            'Sí, si tu solicitud se aprueba antes de las 2:00 p.m., el desembolso se hace el mismo día a tu cuenta o por GIIF/SURED. Después de esa hora, se realiza al día hábil siguiente.',
        },
      ],
    },
    {
      nombre: 'Requisitos y Trámites',
      preguntas: [
        {
          pregunta: '¿Cómo solicito un crédito por primera vez?',
          sinonimos: ['como solicito', 'primera vez', 'nuevo cliente', 'como hago', 'donde empiezo'],
          respuesta:
            'Para solicitar tu primer crédito:\n' +
            '1. Diligencia el formulario web o WhatsApp\n' +
            '2. Envía foto de cédula y último comprobante de ingresos\n' +
            '3. Espera la validación (máx. 24 h)\n' +
            '4. Recibe la oferta y firma digital\n' +
            '5. ¡Desembolso a tu cuenta!',
        },
        {
          pregunta: '¿Qué documentos debo llevar?',
          sinonimos: ['documentos', 'que llevar', 'que papeles', 'requisitos documentales', 'documentacion'],
          respuesta:
            'Documentos básicos:\n' +
            '• Cédula original (ambos lados)\n' +
            '• Comprobante de ingresos (últimos 2)\n' +
            '• Recibo de servicio público (residencia)\n' +
            '• Referencias personales (2)\n\n' +
            'Para empleados: certificado laboral. Para independientes: extractos bancarios de los últimos 3 meses.',
        },
        {
          pregunta: '¿Aceptan pensionados?',
          sinonimos: ['pensionados', 'jubilado', 'pension', 'tercera edad', 'adulto mayor'],
          respuesta:
            'Sí, aceptamos pensionados con pensión vigente. Necesitamos comprobante de pensión (colpensiones o fondo privado) y cédula. El monto máximo se calcula sobre la pensión mensual.',
        },
        {
          pregunta: '¿Préstamos a desempleados?',
          sinonimos: ['desempleado', 'sin empleo', 'sin trabajo', 'sin ingresos', 'no trabajo'],
          respuesta:
            'Para clientes sin ingresos comprobables, evaluamos con un codeudor que sí cumpla los requisitos. También existen modalidades con garantía real (vehículo, por ejemplo). ¿Tienes algún codeudor en mente?',
        },
        {
          pregunta: '¿Puedo sacar un crédito con mi cónyuge?',
          sinonimos: ['conyuge', 'esposo', 'esposa', 'conjunto', 'compartido', 'con mi pareja'],
          respuesta:
            'Sí, pueden solicitar un crédito mancomunado. Ambos firman como deudores solidarios y se suman los ingresos. Trae los documentos de ambos y con gusto los estudiamos.',
        },
        {
          pregunta: '¿Cómo cambio mis datos personales?',
          sinonimos: ['cambiar datos', 'actualizar datos', 'modificar telefono', 'cambiar correo', 'cambiar direccion'],
          respuesta:
            'Para actualizar tus datos personales, escríbenos por WhatsApp o correo con cédula adjunta y los nuevos datos. Por seguridad, los cambios se validan con una llamada de confirmación.',
        },
        {
          pregunta: '¿Cómo cancelo definitivamente el crédito?',
          sinonimos: ['cancelar', 'cancelacion total', 'pago total', 'liquidar', 'saldar', 'terminar credito'],
          respuesta:
            'Para cancelar por completo, te calculamos el valor de liquidación a la fecha (capital + intereses causados). Una vez pagado, te enviamos el paz y salvo en máximo 5 días hábiles.',
        },
      ],
    },
    {
      nombre: 'Soporte y Asistencia',
      preguntas: [
        {
          pregunta: 'Quiero hablar con un asesor humano',
          sinonimos: ['asesor', 'humano', 'persona', 'hablar con alguien', 'no entiendo', 'no me sirve', 'ejecutivo'],
          respuesta:
            'Con gusto te conecto con un asesor. Déjame tu nombre, cédula y un número de contacto. Te llamarán en el siguiente horario hábil. Si es urgente, marca la opción 1 en el menú principal.',
        },
        {
          pregunta: 'No me llega el código de verificación',
          sinonimos: ['no me llega codigo', 'codigo otp', 'no recibo codigo', 'sms de verificacion', 'token', 'no llega mensaje'],
          respuesta:
            'Si no recibes el código:\n' +
            '1. Verifica cobertura de tu celular\n' +
            '2. Revisa spam o SMS bloqueados\n' +
            '3. Espera hasta 5 minutos\n' +
            'Si persiste, solicito un reenvío manual con un asesor.',
        },
        {
          pregunta: 'Olvidé mi PIN',
          sinonimos: ['olvide pin', 'perdi pin', 'no me acuerdo', 'recuperar pin', 'olvide clave', 'pin bloqueado'],
          respuesta:
            'Para recuperar tu PIN de forma segura:\n' +
            '1. Ingresa a "Olvidé mi PIN" en el portal\n' +
            '2. Verifica tu identidad con cédula y selfie\n' +
            '3. Recibe un PIN temporal por SMS\n' +
            '4. Cámbialo al ingresar por primera vez',
        },
        {
          pregunta: '¿Cómo reclamo por un cobro mal aplicado?',
          sinonimos: ['reclamo', 'cobro mal aplicado', 'me cobraron mal', 'cobro erroneo', 'queja', 'peticion'],
          respuesta:
            'Lamento la inconveniencia. Para tu reclamo escríbenos a jsa@jsadr.com.co con:\n' +
            '• Tu cédula\n' +
            '• Fecha y valor del cobro\n' +
            '• Comprobante si lo tienes\n' +
            'Te responderemos en máximo 5 días hábiles según la ley.',
        },
        {
          pregunta: 'Mi préstamo no aparece en el sistema',
          sinonimos: ['no aparece', 'no veo mi prestamo', 'desaparecio', 'no encuentro', 'no existe'],
          respuesta:
            'Esto puede deberse a que el préstamo ya está cancelado, o a un error temporal. Confirma tu cédula y el código del préstamo para verificar en el sistema. Si hay error, lo escalamos al área técnica.',
        },
        {
          pregunta: '¿Cómo reporto un fraude?',
          sinonimos: ['fraude', 'estafa', 'robo de identidad', 'suplantacion', 'no fui yo'],
          respuesta:
            'Para reportar fraude, llama inmediatamente a nuestra línea de seguridad al 018000-XXX-XXX. Bloquearemos tu cuenta en segundos. Luego presenta el reporte ante la Fiscalía para iniciar la investigación.',
        },
        {
          pregunta: '¿Cómo doy de baja mi cuenta?',
          sinonimos: ['dar de baja', 'cancelar cuenta', 'cerrar cuenta', 'eliminar cuenta', 'darse de baja'],
          respuesta:
            'Para dar de baja tu cuenta, debes tener todos tus créditos cancelados. Envía la solicitud por escrito con cédula adjunta y procesamos la baja en máximo 10 días hábiles.',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'El sistema no responde',
          sinonimos: ['no responde', 'sistema caido', 'lento', 'trabado', 'no carga', 'error'],
          respuesta:
            'Si el sistema presenta lentitud o errores, intenta en 5 minutos. Si persiste, reporta el mensaje de error específico y lo escalamos al equipo DevOps. Disculpa la inconveniencia.',
        },
        {
          pregunta: 'No tengo cédula a la mano',
          sinonimos: ['no tengo cedula', 'perdi cedula', 'no la encuentro', 'sin cedula'],
          respuesta:
            'Sin cédula no puedo validar tu identidad por seguridad. Si la tienes en el celular o la recuerdas, puedo confirmar datos. Si no, te tocará recuperar primero tu cédula física o digital.',
        },
        {
          pregunta: 'Hablé con otro asesor y no me resolvió',
          sinonimos: ['otro asesor', 'no me resolvio', 'mal servicio', 'queja de asesor', 'atencion deficiente'],
          respuesta:
            'Lamento la experiencia. Cuéntame tu caso detalladamente y registro el seguimiento con prioridad. Si prefieres, escalo a un supervisor que te contactará en máximo 24 horas.',
        },
        {
          pregunta: '¿Pueden devolverme mi dinero?',
          sinonimos: ['devolucion', 'reembolso', 'devolver dinero', 'me cobraron de mas', 'quiero mi plata de vuelta'],
          respuesta:
            'Si hubo un cobro indebido, lo revisamos y, si aplica, devolvemos el valor en máximo 8 días hábiles. Escríbenos el caso con comprobantes para iniciar el estudio.',
        },
        {
          pregunta: '¿Estoy reportado en Datacrédito?',
          sinonimos: ['datacredito', 'reportado', 'central de riesgo', 'buró', 'reporte negativo'],
          respuesta:
            'Si tienes mora superior a 30 días, es probable que estés reportado. Si ya pagaste, el reporte tarda hasta 30 días en actualizarse. Para casos específicos, confirma tu cédula y lo reviso.',
        },
        {
          pregunta: 'Me equivocé de cuenta al pagar',
          sinonimos: ['pague mal', 'cuenta equivocada', 'consignacion erronea', 'pague a otra cuenta'],
          respuesta:
            'Si pagaste a una cuenta errónea, escríbenos inmediatamente con el comprobante. Iniciamos un proceso de devolución que toma de 5 a 15 días hábiles según el banco.',
        },
        {
          pregunta: '¿Puedo tener dos préstamos al tiempo?',
          sinonimos: ['dos prestamos', 'varios creditos', 'prestamos multiples', 'mas de uno'],
          respuesta:
            'Sí, es posible tener más de un préstamo siempre que tu capacidad de pago lo permita (cuota total no debe superar el 30% de tu ingreso). Si tienes uno activo y quieres otro, evaluamos tu capacidad.',
        },
      ],
    },
    {
      nombre: 'Preguntas Frecuentes Adicionales',
      preguntas: [
        {
          pregunta: '¿Puedo pagar con tarjeta de crédito?',
          sinonimos: ['tarjeta credito', 'tarjeta', 'pagar con tarjeta', 'credito tarjeta', 'datafono'],
          respuesta:
            'Sí aceptamos tarjetas de crédito vía Wompi. Recargo del 4% por uso de tarjeta (comisión bancaria). Para pagos recurrentes recomendamos PSE (sin recargo) o efectivo.',
        },
        {
          pregunta: '¿El préstamo tiene seguro de vida?',
          sinonimos: ['seguro vida', 'seguro', 'seguro desgravamen', 'muerte saldo'],
          respuesta:
            'Todos nuestros préstamos incluyen seguro de desgravamen que cubre el saldo en caso de fallecimiento. Costo: 0.15% mensual sobre saldo. Opcional: seguro de invalidez (+0.10%) y seguro de desempleo (+0.20%).',
        },
        {
          pregunta: '¿Me descuentan de la nómina?',
          sinonimos: ['nomina', 'descuento nomina', 'libranza', 'descuento directo', 'pago nomina'],
          respuesta:
            'Si tu empresa tiene convenio con Jsadr, podemos hacer descuento por libranza. Esto mejora tu tasa (hasta -0.5%). Pregúntale a RRHH si tu empresa ya está afiliada, o nosotros la contactamos.',
        },
        {
          pregunta: '¿Cómo recibo el paz y salvo?',
          sinonimos: ['paz y salvo', 'libranza', 'certificacion pago', 'finiquito', 'carta pago'],
          respuesta:
            'El paz y salvo se genera automáticamente al cancelar el 100% del saldo. Se envía por correo en máximo 5 días hábiles con firma digital del representante legal. Si no lo recibes, escríbenos.',
        },
        {
          pregunta: '¿El préstamo aparece en mi reporte?',
          sinonimos: ['aparece reporte', 'datacredito', 'central riesgo', 'reporte positivo'],
          respuesta:
            'Sí, reportamos a Datacrédito mensualmente. Si pagas bien: aparece como cuenta al día (positivo para tu historial). Si tienes mora >30 días: reporte negativo. Los reportes positivos mejoran tu score.',
        },
        {
          pregunta: '¿Puedo sacar otro préstamo en otro banco?',
          sinonimos: ['otro banco', 'otra entidad', 'otro prestamo externo', 'segundo banco'],
          respuesta:
            'Sí, pero ten en cuenta que el otro banco consultará tu carga financiera en Datacrédito. Si tu nivel de endeudamiento supera el 30%, te pueden negar. Te recomiendo esperar a reducir tu saldo con Jsadr.',
        },
        {
          pregunta: '¿Qué es la libranza?',
          sinonimos: ['libranza', 'que es libranza', 'credito libranza', 'descuento directo'],
          respuesta:
            'La libranza es un crédito que se descuenta directamente de tu salario. Requiere convenio entre Jsadr y tu empleador. Ventajas: tasa más baja, no te preocupa la fecha de pago. Desventaja: descuento obligatorio.',
        },
        {
          pregunta: '¿Cuándo puedo pedir el segundo préstamo?',
          sinonimos: ['segundo prestamo', 'cuando pido otro', 'nuevo credito', 'otro credito'],
          respuesta:
            'Puedes solicitar un segundo préstamo cuando: llevas 3+ meses pagando el actual, estás al día, y tu capacidad de pago lo permite. Calificas automáticamente al pagar el 30% del actual. ¿Quieres que revise tu caso?',
        },
        {
          pregunta: '¿Hacen préstamos para véhicule?',
          sinonimos: ['vehiculo', 'carro', 'moto', 'prestamo vehiculo', 'automotor'],
          respuesta:
            'Sí, tenemos crédito vehicular con tasa preferencial (1.0% mensual). El vehículo queda en prenda. Requisitos: prima mínima 20%, seguro obligatorio, y revisión técnica. ¿Quieres simulación para un vehículo específico?',
        },
      ],
    },
  ],
}

// =====================================================
// 2. ADMIN_SISTEMA — Asistente Personal (CFO personal)
// =====================================================
const PREGUNTAS_ADMIN_SISTEMA: PreguntasBot = {
  tipoBot: 'ADMIN_SISTEMA',
  nombreBot: 'Asistente Personal',
  descripcion: 'Asistente personal tipo CFO: organiza tareas, agenda, finanzas personales y recordatorios.',
  categorias: [
    {
      nombre: 'Organización Personal',
      preguntas: [
        {
          pregunta: '¿Qué tengo pendiente para hoy?',
          sinonimos: ['pendientes hoy', 'agenda de hoy', 'tareas de hoy', 'que tengo hoy', 'mis pendientes', 'plan del dia'],
          respuesta:
            'Estos son tus pendientes de hoy:\n' +
            '• 9:00 a.m. — Reunión con el equipo comercial\n' +
            '• 11:30 a.m. — Llamar al cliente Pérez\n' +
            '• 2:00 p.m. — Revisar reporte de cartera\n' +
            '• 4:00 p.m. — Firmar contratos nuevos\n' +
            '¿Quieres que posponga o reasigne algo?',
        },
        {
          pregunta: '¿Cómo está mi semana?',
          sinonimos: ['mi semana', 'panorama semanal', 'como va la semana', 'resumen semana'],
          respuesta:
            'Tu semana está al 60% de avance. Tienes 3 reuniones pendientes, 2 tareas en retraso y 1 deadline el viernes. Te recomiendo priorizar las tareas en mora antes del cierre de semana.',
        },
        {
          pregunta: '¿Me organizas mi día?',
          sinonimos: ['organiza mi dia', 'planifica mi dia', 'agenda del dia', 'estructura mi dia', 'distribuye mi tiempo'],
          respuesta:
            'Te propongo este bloque de tiempo:\n' +
            '• 8-9 a.m.: Email y revisión diaria\n' +
            '• 9-11 a.m.: Tarea más importante (deep work)\n' +
            '• 11-12: Reuniones cortas\n' +
            '• 2-4: Trabajo operativo\n' +
            '• 4-5: Cierre y planeación del día siguiente',
        },
        {
          pregunta: '¿Cómo voy con mis objetivos del mes?',
          sinonimos: ['objetivos mes', 'metas del mes', 'avance mensual', 'como voy', 'progreso mensual'],
          respuesta:
            'Avance de objetivos del mes:\n' +
            '• Meta 1 (Cerrar 5 contratos): 3/5 ✅ 60%\n' +
            '• Meta 2 (Recaudo $10M): $7.2M / 72%\n' +
            '• Meta 3 (Capacitación equipo): 2/4 sesiones ✅ 50%\n' +
            'Vamos por buen camino. ¿Quieres ajustar alguna meta?',
        },
        {
          pregunta: '¿Qué tengo acumulado sin hacer?',
          sinonimos: ['acumulado', 'atrasado', 'atrasos', 'sin hacer', 'pendientes viejos', 'cola de tareas'],
          respuesta:
            'Tienes 7 tareas en atraso:\n' +
            '• Revisar propuesta de Juan (3 días)\n' +
            '• Responder email de proveedor (2 días)\n' +
            '• Actualizar dashboard (5 días)\n' +
            'Te sugiero abordarlas por antigüedad o impacto. ¿Empiezo por alguna?',
        },
        {
          pregunta: '¿Me ayudas a priorizar?',
          sinonimos: ['priorizar', 'prioridad', 'que hago primero', 'organiza por prioridad', 'ordena tareas'],
          respuesta:
            'Matriz de priorización (urgente vs importante):\n' +
            '1. Urgente e importante: Llamar a cliente con mora\n' +
            '2. Importante no urgente: Planeación estratégica\n' +
            '3. Urgente no importante: Firma de documentos\n' +
            '4. Ni urgente ni importante: Email no críticos\n' +
            'Empieza por el cuadrante 1.',
        },
      ],
    },
    {
      nombre: 'Recordatorios y Tareas',
      preguntas: [
        {
          pregunta: 'Recuérdame llamar a mi mamá a las 5',
          sinonimos: ['recuerdame', 'recordatorio', 'no me olvides', 'avisame a las', 'programa recordatorio'],
          respuesta:
            'Recordatorio creado ✅\n' +
            '• Acción: Llamar a mamá\n' +
            '• Hora: 5:00 p.m.\n' +
            '• Notificación: Push + WhatsApp\n' +
            'Te aviso 10 minutos antes. ¿Algo más?',
        },
        {
          pregunta: 'Agrega una tarea: enviar reporte',
          sinonimos: ['agrega tarea', 'nueva tarea', 'crear tarea', 'anade tarea', 'tarea nueva'],
          respuesta:
            'Tarea creada ✅\n' +
            '• Descripción: Enviar reporte\n' +
            '• Prioridad: Media\n' +
            '• Vencimiento: Hoy\n' +
            '¿Le asigno fecha o persona responsable?',
        },
        {
          pregunta: '¿Cuántas tareas tengo en total?',
          sinonimos: ['cuantas tareas', 'total de tareas', 'lista completa', 'cuantas pendientes'],
          respuesta:
            'Resumen de tareas:\n' +
            '• Total: 23\n' +
            '• En progreso: 4\n' +
            '• Pendientes: 15\n' +
            '• Atrasadas: 4\n' +
            '¿Quieres verlas agrupadas por proyecto o por prioridad?',
        },
        {
          pregunta: 'Marca como hecha la tarea de reporte',
          sinonimos: ['marca como hecha', 'completada', 'ya hice', 'termine', 'cierra tarea', 'tarea lista'],
          respuesta:
            'Tarea "Enviar reporte" marcada como completada ✅. Quedan 14 pendientes y 4 atrasadas. ¿Quieres que pase la siguiente a "en progreso"?',
        },
        {
          pregunta: 'Pospón la reunión del jueves',
          sinonimos: ['pospone', 'reprogramar', 'cambiar fecha', 'mover reunion', 'aplazar'],
          respuesta:
            'Reunión del jueves pospuesta. ¿Para qué fecha la reprogramo? Te sugiero opciones:\n' +
            '• Viernes 10 a.m.\n' +
            '• Lunes 9 a.m.\n' +
            '• Martes 3 p.m.',
        },
        {
          pregunta: '¿Qué recordatorios tengo activos?',
          sinonimos: ['recordatorios activos', 'mis recordatorios', 'que recordatorios', 'alarmas'],
          respuesta:
            'Recordatorios activos:\n' +
            '• Hoy 5:00 p.m. — Llamar a mamá\n' +
            '• Mañana 8:00 a.m. — Pagar factura de luz\n' +
            '• Viernes 2:00 p.m. — Cita médica\n' +
            '¿Elimino o edito alguno?',
        },
        {
          pregunta: 'No me llegó el recordatorio',
          sinonimos: ['no me llego', 'no avise', 'no sonó', 'no me notifico', 'no recibi recordatorio'],
          respuesta:
            'Reviso el historial de notificaciones. Si falló, puede ser por permisos o conexión. Verifica que tengas notificaciones activas en el navegador o app. Si persiste, escalo a soporte técnico.',
        },
      ],
    },
    {
      nombre: 'Finanzas Personales (CFO)',
      preguntas: [
        {
          pregunta: '¿Cuánto dinero me queda este mes?',
          sinonimos: ['cuanto me queda', 'saldo mes', 'plata disponible', 'mi presupuesto', 'liquidez'],
          respuesta:
            'Tu liquidez a fin de mes:\n' +
            '• Ingresos recibidos: $4.500.000\n' +
            '• Gastos hasta hoy: $2.800.000\n' +
            '• Disponible: $1.700.000\n' +
            'Proyección de cierre: $900.000 después de gastos fijos pendientes.',
        },
        {
          pregunta: '¿En qué gasté más este mes?',
          sinonimos: ['en que gaste', 'mayor gasto', 'donde gaste mas', 'gastos fuertes', 'categoría top'],
          respuesta:
            'Top 3 de gastos del mes:\n' +
            '1. Vivienda — $1.400.000 (50%)\n' +
            '2. Mercado — $620.000 (22%)\n' +
            '3. Transporte — $310.000 (11%)\n' +
            'El 17% restante se reparte en entretenimiento, salud y otros.',
        },
        {
          pregunta: '¿Cuánto he ahorrado este año?',
          sinonimos: ['ahorro anual', 'ahorrado este año', 'total ahorrado', 'mis ahorros'],
          respuesta:
            'Ahorrado en el año: $8.200.000\n' +
            '• Enero: $800.000\n' +
            '• Febrero: $1.200.000\n' +
            '• Marzo: $1.500.000\n' +
            '• Abril-Julio: $4.700.000\n' +
            'Vas 18% por encima del año anterior. ¡Excelente!',
        },
        {
          pregunta: '¿Puedo permitirme comprar un carro?',
          sinonimos: ['comprar carro', 'comprar auto', 'puedo comprar', 'capacidad de compra', 'cuanto puedo gastar'],
          respuesta:
            'Análisis de capacidad:\n' +
            '• Tu ingreso mensual: $4.500.000\n' +
            '• Recomendado en cuota vehículo: 15% = $675.000\n' +
            '• Cuota + seguro + mantenimiento: ~$850.000\n' +
            'Conclusión: ajustado, pero viable si entradas son >= $30M (20%). ¿Quieres una simulación?',
        },
        {
          pregunta: '¿Cómo voy con mi meta de ahorro?',
          sinonimos: ['meta ahorro', 'objetivo de ahorro', 'progreso meta', 'como voy con la meta'],
          respuesta:
            'Meta de ahorro 2024: $12.000.000\n' +
            '• Avance: $8.200.000 (68%)\n' +
            '• Restante: $3.800.000\n' +
            '• Meses restantes: 5\n' +
            '• Cuota mensual sugerida: $760.000\n' +
            'Vas por buen camino para cumplirla.',
        },
        {
          pregunta: '¿Cuánto gasto en suscripciones?',
          sinonimos: ['suscripciones', 'netsuscripciones', 'servicios mensuales', 'recurrente', 'membean netflix spotify'],
          respuesta:
            'Suscripciones activas:\n' +
            '• Netflix: $26.000\n' +
            '• Spotify: $14.000\n' +
            '• Gimnasio: $80.000\n' +
            '• iCloud: $4.000\n' +
            'Total mensual: $124.000 ($1.488.000 al año)\n' +
            '¿Cancelamos alguna que no uses?',
        },
        {
          pregunta: '¿Cuál es mi patrimonio neto?',
          sinonimos: ['patrimonio', 'patrimonio neto', 'mi riqueza', 'balance personal'],
          respuesta:
            'Patrimonio neto estimado:\n' +
            '• Activos: $45.500.000 (ahorros + inversiones + vehículo)\n' +
            '• Pasivos: $12.300.000 (préstamo + tarjeta)\n' +
            '• Patrimonio neto: $33.200.000\n' +
            'Crecimiento anual: 12%.',
        },
      ],
    },
    {
      nombre: 'Calendario y Agenda',
      preguntas: [
        {
          pregunta: '¿Qué tengo mañana?',
          sinonimos: ['manana', 'que tengo manana', 'agenda manana', 'plan de manana'],
          respuesta:
            'Agenda de mañana:\n' +
            '• 8:30 a.m. — Standup con equipo\n' +
            '• 10:00 a.m. — Cita médica\n' +
            '• 1:00 p.m. — Almuerzo con cliente\n' +
            '• 4:00 p.m. — Cierre contable mes\n' +
            'Tienes 30 min libres entre 11:30 y 12:00. ¿Te programo algo ahí?',
        },
        {
          pregunta: '¿Tengo conflictos en mi agenda?',
          sinonimos: ['conflictos', 'choques', 'superposicion', 'cruces', 'topes'],
          respuesta:
            'Detecté 1 conflicto:\n' +
            '• Jueves 10-11 a.m.: "Reunión comercial" se cruza con "Capacitación equipo"\n' +
            '¿Muevo la capacitación a viernes 3 p.m.?',
        },
        {
          pregunta: '¿Cuándo tengo tiempo libre esta semana?',
          sinonimos: ['tiempo libre', 'espacios libres', 'huecos', 'disponibilidad', 'cuando estoy libre'],
          respuesta:
            'Espacios libres esta semana:\n' +
            '• Martes 11-12 a.m. (1 h)\n' +
            '• Miércoles 3-4 p.m. (1 h)\n' +
            '• Viernes 4-6 p.m. (2 h)\n' +
            'Total disponible: 4 horas. ¿Asigno algo productivo o descanso?',
        },
        {
          pregunta: 'Agenda una reunión con Carlos',
          sinonimos: ['agenda reunion', 'programa reunion', 'crea reunion', 'agendar cita', 'organiza encuentro'],
          respuesta:
            'Para agendar la reunión con Carlos necesito:\n' +
            '• Fecha y hora tentativa\n' +
            '• Duración\n' +
            '• Modalidad (presencial/virtual)\n' +
            '• Tema\n' +
            '¿Tienes preferencia? Te propongo mañana 10 a.m. virtual.',
        },
        {
          pregunta: '¿Cuándo es mi próxima cita médica?',
          sinonimos: ['cita medica', 'proxima cita', 'control medico', 'doctor'],
          respuesta:
            'Tu próxima cita médica es el jueves a las 10:00 a.m. con el Dr. Gómez (general). Recuerda llevar los exámenes de sangre. ¿Quieres un recordatorio el día anterior?',
        },
        {
          pregunta: 'Cancela la reunión del viernes',
          sinonimos: ['cancela reunion', 'eliminar reunion', 'borra cita', 'no hacer reunion'],
          respuesta:
            'Reunión del viernes cancelada ✅. ¿Notifico a los asistentes? Puedo enviar un mensaje automático reprogramando o simplemente cancelando.',
        },
        {
          pregunta: '¿Cuántas reuniones tengo esta semana?',
          sinonimos: ['cuantas reuniones', 'total reuniones', 'conteo de reuniones'],
          respuesta:
            'Esta semana tienes 12 reuniones programadas:\n' +
            '• Lunes: 3\n' +
            '• Martes: 2\n' +
            '• Miércoles: 4\n' +
            '• Jueves: 2\n' +
            '• Viernes: 1\n' +
            'Total: 9 horas. ¿Demasiadas? Te puedo bloquear tiempo sin reuniones.',
        },
      ],
    },
    {
      nombre: 'Notas y Documentos',
      preguntas: [
        {
          pregunta: 'Toma nota: idea para nuevo producto',
          sinonimos: ['toma nota', 'anota', 'guarda nota', 'registrar idea', 'apunta esto'],
          respuesta:
            'Nota guardada ✅\n' +
            '• Contenido: "Idea para nuevo producto"\n' +
            '• Fecha: hoy\n' +
            '• Etiqueta: #ideas #producto\n' +
            '¿Le agrego más detalle o la dejo así?',
        },
        {
          pregunta: '¿Dónde guardé las notas de la última reunión?',
          sinonimos: ['notas de reunion', 'donde guarde', 'buscar nota', 'minutas', 'acta'],
          respuesta:
            'Encontré 3 notas relacionadas:\n' +
            '1. Reunión comercial 12-08 — Carpeta "Comercial"\n' +
            '2. Reunión equipo 14-08 — Carpeta "Equipo"\n' +
            '3. Reunión cliente Pérez 15-08 — Carpeta "Clientes"\n' +
            '¿Cuál quieres abrir?',
        },
        {
          pregunta: '¿Tengo documentos pendientes por firmar?',
          sinonimos: ['firmar', 'pendientes firma', 'documentos por firmar', 'contratos sin firma'],
          respuesta:
            'Tienes 4 documentos pendientes de firma:\n' +
            '• Contrato cliente González\n' +
            '• Renovación proveedor internet\n' +
            '• Acuerdo de confidencialidad — asesor nuevo\n' +
            '• Autorización débito banco\n' +
            '¿Firmamos electrónicamente ahora?',
        },
        {
          pregunta: 'Sube este archivo a la nube',
          sinonimos: ['sube archivo', 'guarda en la nube', 'almacena', 'subir documento'],
          respuesta:
            'Para subir el archivo necesito que lo adjuntes aquí o indiques la ruta. Lo guardo en tu carpeta personal con copia de seguridad automática. ¿En qué carpeta específica?',
        },
        {
          pregunta: '¿Dónde encuentro mis contratos?',
          sinonimos: ['mis contratos', 'donde estan contratos', 'buscar contratos', 'documentos legales'],
          respuesta:
            'Tus contratos están organizados en:\n' +
            '• /Documentos/Contratos/Laborales\n' +
            '• /Documentos/Contratos/Arrendamiento\n' +
            '• /Documentos/Contratos/Servicios\n' +
            '¿Quieres que abra alguno en específico?',
        },
        {
          pregunta: 'Genera un resumen de este documento',
          sinonimos: ['resumen documento', 'sintetiza', 'hazme resumen', 'extrae resumen'],
          respuesta:
            'Para resumir, adjunta el documento o pega el texto aquí. Te genero un resumen ejecutivo de máximo 5 puntos clave. Si es largo, puedo hacer resumen por secciones.',
        },
        {
          pregunta: 'Traduce este texto al inglés',
          sinonimos: ['traduce', 'traduccion', 'al ingles', 'a otro idioma'],
          respuesta:
            'Con gusto lo traduzco. Pega el texto y te lo devuelvo en inglés. Si necesitas otro idioma (portugués, francés, italiano), dímelo. La traducción mantiene el tono profesional.',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'No encuentro lo que buscaba',
          sinonimos: ['no encuentro', 'no aparece', 'no esta', 'no veo', 'perdi un dato'],
          respuesta:
            'Para ayudarte mejor, dime:\n' +
            '• Tipo de información (nota, tarea, documento, contacto)\n' +
            '• Fecha aproximada\n' +
            '• Palabras clave\n' +
            'Con eso hago una búsqueda profunda en todo tu historial.',
        },
        {
          pregunta: 'Borré algo por error',
          sinonimos: ['borre', 'elimine', 'perdi', 'papelera', 'restaurar'],
          respuesta:
            'Los elementos eliminados van a la papelera por 30 días. ¿Qué eliminaste? Te puedo mostrar la papelera y restaurarlo. Si ya pasaron 30 días, lo siento, no se puede recuperar.',
        },
        {
          pregunta: '¿Y si no tengo tareas pendientes?',
          sinonimos: ['no tengo tareas', 'sin tareas', 'todo al dia', 'lista vacia'],
          respuesta:
            '¡Excelente! Todo está al día. ¿Quieres que:\n' +
            '• Planifique tareas para los próximos días\n' +
            '• Sugiera objetivos nuevos\n' +
            '• Solo descanses? 😄',
        },
        {
          pregunta: 'El recordatorio sonó mal hora',
          sinonimos: ['hora equivocada', 'sonó mal', 'error de hora', 'mal horario'],
          respuesta:
            'Si la hora del recordatorio fue incorrecta, puedo deberse a zona horaria o cambio de horario verano/invierno. Verifica tu zona horaria en configuración. Edito el recordatorio y lo confirmo.',
        },
        {
          pregunta: '¿Puedes sincronizar con Google Calendar?',
          sinonimos: ['google calendar', 'sincronizar', 'integrar', 'conectar calendario', 'outlook'],
          respuesta:
            'Sí, podemos sincronizar con Google Calendar y Outlook. Vas a Configuración → Integraciones → Calendarios y autorizas. Una vez conectado, todos los eventos se sincronizan automáticamente.',
        },
        {
          pregunta: '¿Cómo exporto mis datos?',
          sinonimos: ['exportar', 'descargar datos', 'backup', 'respaldar'],
          respuesta:
            'Puedes exportar todos tus datos en formato JSON o CSV. Vas a Configuración → Privacidad → Exportar datos. El archivo se genera en máximo 24 horas y se envía a tu correo registrado.',
        },
        {
          pregunta: 'Perdí acceso a mi cuenta',
          sinonimos: ['perdi acceso', 'no puedo entrar', 'bloqueado', 'recuperar cuenta'],
          respuesta:
            'Para recuperar acceso:\n' +
            '1. Usa "Olvidé mi contraseña"\n' +
            '2. Verifica identidad con cédula + selfie\n' +
            '3. Si no funciona, contacta soporte con tu cédula\n' +
            'No compartas datos sensibles por canales no oficiales.',
        },
      ],
    },
    {
      nombre: 'Productividad y Hábitos',
      preguntas: [
        {
          pregunta: 'Iniciar técnica Pomodoro',
          sinonimos: ['pomodoro', 'tecnica pomodoro', '25 minutos', 'enfocado', 'bloque foco'],
          respuesta:
            'Pomodoro iniciado ⏱️\n• 25 min de foco\n• 5 min descanso\n• Cada 4 ciclos: descanso largo 15 min\nTe aviso al terminar cada bloque. ¿Quieres que bloquee notificaciones durante el foco?',
        },
        {
          pregunta: 'Crear hábito diario',
          sinonimos: ['habito', 'rutina', 'crea habito', 'nuevo habito', 'rutina diaria'],
          respuesta:
            'Para crear hábito necesito:\n• Nombre (ej: leer 15 min)\n• Frecuencia (diaria, semanal)\n• Horario preferido\n• Recordatorio (sí/no)\n• Duración meta (21, 66 días)\nTe hago seguimiento diario.',
        },
        {
          pregunta: '¿Cómo voy con mis hábitos?',
          sinonimos: ['mis habitos', 'racha habito', 'progreso habitos', 'como voy'],
          respuesta:
            'Tus hábitos activos (3):\n• Leer 15 min: 12 días de racha ✅\n• Ejercicio: 5 días de racha ✅\n• Meditar: racha rota ayer ❌\nMejor racha histórica: 28 días. ¿Reiniciamos meditación?',
        },
        {
          pregunta: 'Bloques de tiempo para hoy',
          sinonimos: ['bloques tiempo', 'time blocking', 'calendario bloques', 'organizar bloques'],
          respuesta:
            'Bloques sugeridos para hoy:\n• 8-9: Email + plan\n• 9-11: Deep work (tarea crítica)\n• 11-12: Reuniones\n• 12-1: Almuerzo + descanso\n• 2-4: Trabajo operativo\n• 4-5: Cierre + planeación\n¿Lo aplico al calendario?',
        },
        {
          pregunta: 'Cómo evitar distracciones',
          sinonimos: ['distracciones', 'concentracion', 'enfocarme', 'no distraerme'],
          respuesta:
            'Tips para tu día:\n• Silencia notificaciones no críticas (te ayudo)\n• Cierra pestañas no esenciales\n• Usa sala/espacio dedicado\n• Técnica 2 minutos (tareas rápidas)\n• Descanso cada 90 min (ritmo ultradiano)\n¿Bloqueo redes sociales durante el foco?',
        },
        {
          pregunta: 'Cómo delegar tareas',
          sinonimos: ['delegar', 'pasar tareas', 'asignar a otros', 'como delegar'],
          respuesta:
            'Framework para delegar:\n1. Identifica tarea repetitiva (no estratégica)\n2. Selecciona persona con capacidad\n3. Define resultado esperado (no proceso)\n4. Acuerda plazos y entregables\n5. Monitorea sin microgestión\n6. Reconoce el trabajo\n¿Tienes una tarea candidata?',
        },
        {
          pregunta: 'Descansos efectivos',
          sinonimos: ['descanso', 'break', 'pausa', 'descansar'],
          respuesta:
            'Descansos efectivos (no en pantalla):\n• 5 min cada 25 (Pomodoro)\n• 15 min cada 2 horas\n• Caminar, estirar, agua\n• Evita revisar teléfono\n• Respira 4-7-8 para relajar\n¿Programo descansos en tu agenda?',
        },
        {
          pregunta: 'Hábitos financieros sanos',
          sinonimos: ['habitos financieros', 'finanzas personales', 'salud financiera habito'],
          respuesta:
            'Hábitos financieros recomendados:\n1. Págate primero (10-20% al ahorro)\n2. Revisa gastos semanalmente\n3. Mantén fondo emergencia (3-6 meses)\n4. Invierte el excedente\n5. Evita deudas de consumo\n6. Revisa suscripciones cada trimestre\n¿Te ayudo a implementar uno?',
        },
        {
          pregunta: 'Análisis de mi semana',
          sinonimos: ['analisis semana', 'review semana', 'retrospectiva', 'que aprendi'],
          respuesta:
            'Análisis de tu semana:\n✅ Logros: 8 tareas completadas, 2 metas\n⚠️ Retos: 3 tareas atrasadas, sobrecarga miércoles\n📊 Tiempo: 35% deep work, 25% reuniones, 40% operativo\n💡 Aprendizaje: bloquear martes por mañana para focus\n¿Lo aplico a la próxima semana?',
        },
      ],
    },
  ],
}

// =====================================================
// 3. CONTABILIDAD — Experto Financiero
// =====================================================
const PREGUNTAS_CONTABILIDAD: PreguntasBot = {
  tipoBot: 'CONTABILIDAD',
  nombreBot: 'Experto Financiero',
  descripcion: 'Asesor financiero para registrar movimientos, presupuestos, metas y proyecciones.',
  categorias: [
    {
      nombre: 'Registro de Movimientos',
      preguntas: [
        {
          pregunta: 'Registrar gasto de $50.000 en mercado',
          sinonimos: ['gasto', 'gaste', 'pague', 'compre', 'me costo', 'me salio', 'egreso', 'salida de dinero'],
          respuesta:
            'Gasto registrado ✅\n' +
            '• Monto: $50.000\n' +
            '• Categoría: Mercado\n' +
            '• Fecha: hoy\n' +
            '• Cuenta: Efectivo\n' +
            'Saldo restante en categoría Mercado del mes: $210.000.',
        },
        {
          pregunta: 'Registrar ingreso de $2.000.000 por venta',
          sinonimos: ['ingreso', 'recibi', 'gane', 'cobre', 'me pagaron', 'me depositaron', 'venta', 'vendi', 'sueldo', 'salario', 'comision'],
          respuesta:
            'Ingreso registrado ✅\n' +
            '• Monto: $2.000.000\n' +
            '• Origen: Venta\n' +
            '• Fecha: hoy\n' +
            '• Cuenta: Bancolombia\n' +
            '¿Aplico retención de impuestos automáticamente?',
        },
        {
          pregunta: '¿Cómo categorizo un gasto?',
          sinonimos: ['categorizar', 'categoria', 'clasificar', 'tipo de gasto', 'a que categoria'],
          respuesta:
            'Categorías sugeridas:\n' +
            '• Vivienda (arriendo, servicios)\n' +
            '• Alimentación (mercado, restaurantes)\n' +
            '• Transporte (gasolina, parqueadero)\n' +
            '• Salud (medicamentos, consultas)\n' +
            '• Entretenimiento (cine, streaming)\n' +
            '• Educación (cursos, libros)\n' +
            '• Otros\n' +
            '¿Cuál aplico a tu gasto?',
        },
        {
          pregunta: 'Registrar transferencia entre cuentas',
          sinonimos: ['transferencia', 'mover entre cuentas', 'traslado', 'transferir'],
          respuesta:
            'Transferencia registrada ✅\n' +
            'Indica origen, destino y monto. Se descuenta de una y se suma a otra sin afectar tus totales. ¿Quieres que la marque como movimiento recurrente?',
        },
        {
          pregunta: 'Registrar pago de tarjeta de crédito',
          sinonimos: ['pago tarjeta', 'tarjeta de credito', 'abono tarjeta', 'pago tarjeta'],
          respuesta:
            'Pago registrado ✅\n' +
            '• Monto: $XXX\n' +
            '• Tarjeta: XXXX-1234\n' +
            '• Tipo: Pago de saldo\n' +
            'Tu nuevo saldo disponible es $XXX. ¿Quieres ver el detalle de intereses?',
        },
        {
          pregunta: 'Editar un gasto que registré mal',
          sinonimos: ['editar gasto', 'modificar', 'corregir', 'cambiar monto', 'actualizar movimiento'],
          respuesta:
            'Para editar, indícame qué movimiento corregir. Puedo cambiar monto, categoría, fecha o descripción. Te muestro los últimos 5 movimientos para que selecciones cuál editar.',
        },
        {
          pregunta: 'Eliminar un movimiento',
          sinonimos: ['eliminar', 'borrar movimiento', 'quitar', 'suprimir'],
          respuesta:
            'Puedo eliminar el movimiento. Antes te pido confirmar: ¿estás seguro? La eliminación es irreversible (aunque queda en auditoría). Dime el movimiento exacto a borrar.',
        },
      ],
    },
    {
      nombre: 'Análisis y Dashboard',
      preguntas: [
        {
          pregunta: '¿Cómo van mis finanzas?',
          sinonimos: ['balance', 'dashboard', 'resumen', 'como van mis finanzas', 'cuanto tengo', 'mi plata', 'mi dinero', 'mi saldo', 'salud financiera', 'panorama', 'situacion financiera'],
          respuesta:
            'Resumen financiero del mes:\n' +
            '• Ingresos: $4.500.000\n' +
            '• Gastos: $3.200.000\n' +
            '• Balance: +$1.300.000\n' +
            '• Ahorro: 29%\n' +
            'Tu salud financiera es BUENA. Llevas 3 meses consecutivos con balance positivo.',
        },
        {
          pregunta: '¿Cuál es mi balance del mes?',
          sinonimos: ['balance mes', 'balance mensual', 'resultado del mes', 'diferencia ingresos gastos'],
          respuesta:
            'Balance del mes:\n' +
            'Ingresos: $4.500.000\n' +
            'Gastos: $3.200.000\n' +
            'Balance neto: +$1.300.000\n' +
            'Comparado con el mes anterior: +12% en ahorro.',
        },
        {
          pregunta: 'Compara este mes con el anterior',
          sinonimos: ['comparativo', 'compara', 'comparar', 'mes anterior', 'vs mes', 'evolucion', 'cambio', 'antes vs ahora'],
          respuesta:
            'Comparativo mes vs mes:\n' +
            '• Ingresos: $4.5M vs $4.2M (+7%)\n' +
            '• Gastos: $3.2M vs $3.5M (-9%)\n' +
            '• Ahorro: $1.3M vs $0.7M (+85%)\n' +
            'Redujiste gastos en entretenimiento y comida externa. ¡Buen trabajo!',
        },
        {
          pregunta: '¿En qué gasto más?',
          sinonimos: ['gasto mas', 'mayor gasto', 'donde gasto mas', 'top de gastos', 'categoría mas alta'],
          respuesta:
            'Top 3 categorías de gasto del mes:\n' +
            '1. Vivienda — $1.400.000 (44%)\n' +
            '2. Mercado — $620.000 (19%)\n' +
            '3. Transporte — $310.000 (10%)\n' +
            'El restante 27% se reparte en otras categorías.',
        },
        {
          pregunta: '¿Cómo está mi flujo de caja?',
          sinonimos: ['flujo de caja', 'cash flow', 'flujo', 'liquidez', 'disponible'],
          respuesta:
            'Flujo de caja actual:\n' +
            '• Caja y bancos: $1.800.000\n' +
            '• Por cobrar (próx 30 días): $1.200.000\n' +
            '• Por pagar (próx 30 días): $850.000\n' +
            '• Liquidez proyectada: $2.150.000\n' +
            'Cobertura de obligaciones: 2.1x — saludable.',
        },
        {
          pregunta: '¿Cuáles son mis ingresos vs egresos?',
          sinonimos: ['ingresos vs egresos', 'ingresos gastos', 'comparacion ingresos', 'relacion'],
          respuesta:
            'Ingresos vs Egresos (mes actual):\n' +
            '• Ingresos totales: $4.500.000 (100%)\n' +
            '• Egresos totales: $3.200.000 (71%)\n' +
            '• Excedente: $1.300.000 (29%)\n' +
            'Tu ratio de ahorro está por encima del recomendado (20%).',
        },
        {
          pregunta: '¿Cuándo se me acaba el dinero?',
          sinonimos: ['cuando se me acaba', 'cuanto aguanta', 'runway', 'hasta cuando llego', 'supervivencia'],
          respuesta:
            'Con tu ritmo actual de gasto ($106.000/día), tu liquidez de $1.800.000 te alcanza para 17 días. Si ingresa la cuenta por cobrar de $1.2M, se extiende a 28 días.',
        },
      ],
    },
    {
      nombre: 'Presupuestos y Metas',
      preguntas: [
        {
          pregunta: 'Crear presupuesto mensual',
          sinonimos: ['presupuesto', 'presupuestar', 'limite', 'tope de gasto', 'control de gasto'],
          respuesta:
            'Para crear tu presupuesto mensual necesito los topes por categoría. Te sugiero la regla 50/30/20:\n' +
            '• Necesidades (50%): $2.250.000\n' +
            '• Deseos (30%): $1.350.000\n' +
            '• Ahorro (20%): $900.000\n' +
            '¿Aceptas esta distribución o la ajustamos?',
        },
        {
          pregunta: '¿Cómo voy con mi presupuesto de mercado?',
          sinonimos: ['presupuesto mercado', 'limite mercado', 'cuanto me queda mercado'],
          respuesta:
            'Presupuesto mercado del mes: $800.000\n' +
            'Gastado: $590.000 (74%)\n' +
            'Disponible: $210.000 (26%)\n' +
            'Vas bien, pero cuidado: quedan 8 días y el ritmo sugiere $262.000 más. ¿Ajusto el tope?',
        },
        {
          pregunta: 'Me pasé del presupuesto',
          sinonimos: ['me pase', 'excedi', 'sobre tope', 'presupuesto rebasado'],
          respuesta:
            'Te pasaste en:\n' +
            '• Entretenimiento: +$45.000 (+30%)\n' +
            '• Restaurantes: +$30.000 (+25%)\n' +
            'Te recomiendo compensar reduciendo $75.000 de otra categoría o ajustar el tope. ¿Qué prefieres?',
        },
        {
          pregunta: 'Crear meta de ahorro para vacaciones',
          sinonimos: ['meta de', 'crear meta', 'objetivo de', 'ahorrar para', 'fondo de', 'quiero comprar', 'meta financiera'],
          respuesta:
            'Meta creada ✅\n' +
            '• Objetivo: Vacaciones\n' +
            '• Monto meta: $5.000.000\n' +
            '• Plazo: 10 meses\n' +
            '• Aporte mensual sugerido: $500.000\n' +
            '¿Programo transferencia automática mensual?',
        },
        {
          pregunta: '¿Cómo voy con mi meta de vacaciones?',
          sinonimos: ['avance meta', 'progreso meta vacaciones', 'como voy con vacaciones'],
          respuesta:
            'Meta vacaciones:\n' +
            '• Objetivo: $5.000.000\n' +
            '• Ahorrado: $2.500.000 (50%)\n' +
            '• Restante: $2.500.000\n' +
            '• Meses faltantes: 5\n' +
            '• Aporte mensual requerido: $500.000 (vas justo)',
        },
        {
          pregunta: 'Cuántas metas activas tengo',
          sinonimos: ['cuantas metas', 'mis metas', 'lista de metas', 'objetivos activos'],
          respuesta:
            'Metas activas: 3\n' +
            '1. Vacaciones — 50% ($2.5M/$5M)\n' +
            '2. Imprevistos — 75% ($3.75M/$5M)\n' +
            '3. Computador nuevo — 20% ($1M/$5M)\n' +
            'Total ahorrado en metas: $7.250.000.',
        },
        {
          pregunta: 'Eliminar meta de ahorro',
          sinonimos: ['eliminar meta', 'borrar meta', 'cancelar meta', 'ya no quiero esa meta'],
          respuesta:
            'Para eliminar una meta necesito confirmar cuál. ¿Qué hago con el dinero ahorrado?:\n' +
            '• Transferir a otra meta\n' +
            '• Mover a cuenta general\n' +
            '• Cancelar sin mover\n' +
            'Indícame la opción.',
        },
      ],
    },
    {
      nombre: 'Consejos y Recomendaciones',
      preguntas: [
        {
          pregunta: '¿Cómo puedo ahorrar más?',
          sinonimos: ['como ahorrar', 'ahorrar mas', 'reducir gastos', 'gastar menos', 'economizar', 'tips de ahorro', 'consejos de ahorro', 'estrategias de ahorro', 'como gastar menos'],
          respuesta:
            'Tips personalizados para ti:\n' +
            '1. Tus gastos en restaurantes subieron 22% — cocina 1 día más en casa\n' +
            '2. Tienes 3 suscripciones sin usar: ahorro $40.000/mes\n' +
            '3. Negocia tu plan celular: posible ahorro $20.000/mes\n' +
            'Ahorro proyectado: $60.000/mes ($720.000/año).',
        },
        {
          pregunta: '¿Qué gastos puedo recortar?',
          sinonimos: ['recortar', 'reducir', 'que quito', 'donde ahorro', 'recorte de gastos'],
          respuesta:
            'Gastos prescindibles detectados:\n' +
            '• 2 suscripciones sin uso ($30.000/mes)\n' +
            '• Comidas externas excesivas (puede reducir 30% = $90.000)\n' +
            '• Taxi cuando hay bus cercano ($50.000/mes)\n' +
            '• Productos de marca en mercado ($80.000/mes)\n' +
            'Total posible: $250.000/mes',
        },
        {
          pregunta: '¿Me conviene invertir?',
          sinonimos: ['invertir', 'inversion', 'donde invertir', 'que invierto', 'rendimientos'],
          respuesta:
            'Con tu perfil (conservador) y liquidez de $1.8M, te sugiero:\n' +
            '• 60% CDT Bancolombia (11% EA)\n' +
            '• 30% Fondo mutuo de bajo riesgo\n' +
            '• 10% Cripto estable (USDC) para diversificar\n' +
            'Proyección: rendimiento 9-12% EA. ¿Quieres simulación detallada?',
        },
        {
          pregunta: '¿Cómo elimino deudas rápido?',
          sinonimos: ['eliminar deudas', 'saldar deudas', 'pagar deudas', 'librarme de deudas', 'salir de deudas'],
          respuesta:
            'Estrategia "bola de nieve":\n' +
            '1. Lista deudas de menor a mayor saldo\n' +
            '2. Paga mínimo en todas\n' +
            '3. Destina extra a la más pequeña\n' +
            '4. Al pagarla, repite con la siguiente\n' +
            'Tus deudas: tarjeta $850K, préstamo Jsadr $1.2M. Empieza por la tarjeta.',
        },
        {
          pregunta: '¿Cómo me preparo para emergencias?',
          sinonimos: ['emergencias', 'fondo de emergencia', 'imprevistos', 'prepararse'],
          respuesta:
            'Fondo de emergencia recomendado: 3-6 meses de gastos básicos.\n' +
            'Tus gastos básicos: $2.5M/mes\n' +
            'Meta: $7.5M a $15M\n' +
            'Actualmente tienes $3.75M (50% del mínimo)\n' +
            'Te faltan $3.75M. Aporte mensual sugerido: $400.000 (10 meses).',
        },
        {
          pregunta: '¿Qué me recomiendas hacer este mes?',
          sinonimos: ['recomendacion', 'que hago', 'consejo', 'sugerencia', 'que me recomiendas', 'mejoras'],
          respuesta:
            'Mis 3 recomendaciones del mes:\n' +
            '1. Cancela 2 suscripciones sin uso → ahorro $30K/mes\n' +
            '2. Abre un CDT con $500K de tu liquidez (rendimiento $55K)\n' +
            '3. Paga $200K extra a la tarjeta (ahorra $35K en intereses)\n' +
            'Beneficio total: $1.4M en 12 meses.',
        },
        {
          pregunta: '¿Cómo mejoro mi score crediticio?',
          sinonimos: ['score', 'datacredito', 'historial', 'puntuacion', 'calificacion', 'riesgo'],
          respuesta:
            'Para mejorar tu score:\n' +
            '1. Paga a tiempo siempre (mayor impacto)\n' +
            '2. Mantén baja utilización de tarjetas (<30%)\n' +
            '3. No cierres líneas antiguas\n' +
            '4. Diversifica tipos de crédito\n' +
            '5. Evita múltiples consultas simultáneas\n' +
            'Con seguimiento, subes 50-100 puntos en 6 meses.',
        },
      ],
    },
    {
      nombre: 'Predicciones y Proyecciones',
      preguntas: [
        {
          pregunta: '¿Cómo estaré fin de año?',
          sinonimos: ['prediccion', 'predecir', 'pronostico', 'proyeccion', 'futuro', 'que pasara', 'como estare', 'escenario', 'simulacion', 'forecast', 'prever'],
          respuesta:
            'Proyección a fin de año (basada en tendencia actual):\n' +
            '• Ingresos estimados: $54M\n' +
            '• Gastos estimados: $40M\n' +
            '• Balance neto: +$14M\n' +
            '• Ahorro total año: $14M\n' +
            'Con 80% de confianza. Escenario pesimista: $9M; optimista: $18M.',
        },
        {
          pregunta: '¿Cuándo podré comprar casa?',
          sinonimos: ['comprar casa', 'cuando podre', 'meta vivienda', 'apartamento', 'inmueble'],
          respuesta:
            'Simulación compra vivienda:\n' +
            '• Valor inmueble: $250M\n' +
            '• Cuota inicial (20%): $50M\n' +
            '• Ahorro actual: $8M\n' +
            '• Ahorro mensual: $1.3M\n' +
            '• Tiempo para cuota inicial: ~32 meses\n' +
            '¿Quieres optimizar el ahorro para reducir el plazo?',
        },
        {
          pregunta: '¿Cuándo seré millonario?',
          sinonimos: ['millonario', 'cuando tenga 1000 millones', 'millon', 'riqueza'],
          respuesta:
            'Con tu ahorro mensual de $1.3M invertido al 10% EA:\n' +
            '• $100M en ~22 años\n' +
            '• $500M en ~38 años\n' +
            '• $1.000M en ~46 años\n' +
            'Para acelerar: aumenta ingreso, sube rendimiento o reduce gastos.',
        },
        {
          pregunta: '¿Qué pasa si pierdo el empleo?',
          sinonimos: ['perder empleo', 'sin empleo', 'escenario pesimista', 'desempleo', 'que pasa si'],
          respuesta:
            'Escenario pérdida de empleo:\n' +
            '• Liquidez actual: $1.8M\n' +
            '• Fondo emergencia: $3.75M\n' +
            '• Total disponible: $5.55M\n' +
            '• Gastos mensuales: $3.2M\n' +
            '• Tiempo de supervivencia: ~1.7 meses\n' +
            'Te recomiendo reforzar fondo emergencia a $9.6M (3 meses).',
        },
        {
          pregunta: '¿Cuánto tendré en 5 años?',
          sinonimos: ['en 5 anos', 'proyeccion 5 anos', 'mediano plazo', 'futuro 5 anos'],
          respuesta:
            'Proyección a 5 años:\n' +
            '• Escenario base: ahorro $1.3M/mes al 9% → $98M\n' +
            '• Optimista (+15% ahorro, 11%): $135M\n' +
            '• Pesimista (-10% ahorro, 7%): $72M\n' +
            '¿Quieres ver el detalle mes a mes?',
        },
        {
          pregunta: '¿Cómo impacto un gasto grande?',
          sinonimos: ['impacto gasto', 'gasto grande', 'que pasa si compro', 'simular compra'],
          respuesta:
            'Indícame el monto del gasto grande y te muestro:\n' +
            '• Impacto en liquidez inmediata\n' +
            '• Impacto en meta de ahorro\n' +
            '• Tiempo de recuperación\n' +
            '• Recomendación (aprobar o diferir)\n' +
            '¿Cuál es el monto?',
        },
        {
          pregunta: '¿Conviene sacar un crédito?',
          sinonimos: ['sacar credito', 'conviene prestamo', 'endeudarme', 'pedir prestamo'],
          respuesta:
            'Para evaluar si conviene, dime:\n' +
            '• Monto del crédito\n' +
            '• Plazo\n' +
            '• Tasa ofrecida\n' +
            '• Uso del dinero\n' +
            'Te calculo el costo total y comparo con tu capacidad de pago. Como regla: si el crédito es para inversión con retorno > tasa, conviene.',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'No tengo movimientos este mes',
          sinonimos: ['sin movimientos', 'mes vacio', 'no hay datos', 'cero movimientos'],
          respuesta:
            'No hay movimientos registrados este mes. ¿Quieres:\n' +
            '• Importar extracto bancario\n' +
            '• Registrar manualmente\n' +
            '• Conectar cuenta bancaria vía API\n' +
            'Sin datos no puedo generar análisis. ¿Cómo procedemos?',
        },
        {
          pregunta: 'Mi categoría no existe',
          sinonimos: ['categoria nueva', 'no existe categoria', 'crear categoria', 'agregar categoria'],
          respuesta:
            'Puedo crear categorías personalizadas. Indícame:\n' +
            '• Nombre\n' +
            '• Tipo (gasto/ingreso)\n' +
            '• Color (opcional)\n' +
            '• Presupuesto mensual (opcional)\n' +
            '¿Cuál quieres crear?',
        },
        {
          pregunta: 'Hay un gasto que no reconozco',
          sinonimos: ['no reconozco', 'gasto sospechoso', 'fraude', 'no fui yo'],
          respuesta:
            'Si hay un gasto que no reconoces, puede ser:\n' +
            '1. Cargo de suscripción olvidada\n' +
            '2. Cargo bancario\n' +
            '3. Fraude\n' +
            '¿Cuál es el monto y la fecha? Lo reviso. Si es fraude, te indico cómo reportarlo al banco.',
        },
        {
          pregunta: 'Mi extracto no cuadra',
          sinonimos: ['no cuadra', 'diferencia', 'descuadre', 'no coincide', 'ajuste'],
          respuesta:
            'Descuadres comunes:\n' +
            '• Cargos pendientes de aplicar\n' +
            '• Comisiones no registradas\n' +
            '• Doble registro\n' +
            'Indícame el monto de diferencia y te ayudo a encontrar el origen. Reviso los últimos 30 movimientos.',
        },
        {
          pregunta: '¿Cómo importo un extracto bancario?',
          sinonimos: ['importar extracto', 'cargar extracto', 'subir banco', 'xlsx extracto'],
          respuesta:
            'Para importar un extracto:\n' +
            '1. Descarga el extracto en formato Excel o CSV desde tu banco\n' +
            '2. Súbelo aquí\n' +
            '3. Mapeo automáticamente las columnas\n' +
            '4. Te muestro los movimientos detectados para confirmar\n' +
            '5. Importo los confirmados',
        },
        {
          pregunta: '¿Cómo exporto reportes contables?',
          sinonimos: ['exportar', 'reporte', 'pdf', 'excel', 'contabilidad'],
          respuesta:
            'Puedo exportar en PDF, Excel o CSV los siguientes reportes:\n' +
            '• Estado de resultados\n' +
            '• Flujo de caja\n' +
            '• Balance general\n' +
            '• Detalle por categoría\n' +
            '• Comparativo mensual\n' +
            '¿Cuál necesitas y en qué formato?',
        },
        {
          pregunta: '¿Cómo manejo impuestos?',
          sinonimos: ['impuestos', 'declaracion', 'renta', 'iva', 'dian', 'retencion'],
          respuesta:
            'Para impuestos puedo:\n' +
            '• Calcular retención sugerida por cada ingreso\n' +
            '• Generar reporte anual para declaración de renta\n' +
            '• Marcar gastos deducibles\n' +
            '• Estimar impuesto a pagar\n' +
            'No reemplazo a un contador certificado, pero te facilito la información. ¿Qué necesitas?',
        },
      ],
    },
    {
      nombre: 'Inversiones e Impuestos',
      preguntas: [
        {
          pregunta: '¿Qué tipos de inversión existen?',
          sinonimos: ['tipos inversion', 'instrumentos', 'donde invertir', 'opciones inversion'],
          respuesta:
            'Tipos de inversión:\n• Renta fija: CDT, bonos, fondos conservadores (bajo riesgo)\n• Renta variable: acciones, ETFs (mayor riesgo)\n• Alternativos: cripto, real estate, private equity\n• Mixtos: fondos balanceados\nTu perfil (conservador): recomiendo 70% renta fija, 30% variable.',
        },
        {
          pregunta: 'CDT vs fondo mutuo',
          sinonimos: ['cdt vs fondo', 'comparativa cdt', 'fondo vs cdt', 'rendimiento cdt'],
          respuesta:
            'Comparativa:\n• CDT: 11-13% EA, plazo fijo, no liquidez\n• Fondo mutuo conservador: 9-11% EA, liquidez diaria\n• Fondo mutuo equilibrado: 12-15% EA, liquidez T+1\nSi no necesitas la plata: CDT. Si quieres liquidez: fondo mutuo.',
        },
        {
          pregunta: '¿Cuándo debo declarar renta?',
          sinonimos: ['declarar renta', 'cuando declaro', 'obligado declarar', 'umbral renta'],
          respuesta:
            'Estás obligado a declarar si (2024):\n• Patrimonio bruto >$163.000.000\n• Ingresos brutos >$50.800.000\n• Consumos tarjeta >$50.800.000\n• Compras y consumos >$50.800.000\n• Consignaciones bancarias >$50.800.000\n¿Tu caso supera algún umbral?',
        },
        {
          pregunta: 'Deducciones tributarias',
          sinonimos: ['deducciones', 'descontable', 'renta exenta', 'beneficio tributario'],
          respuesta:
            'Deducciones válidas:\n• Salud y pensión: 100%\n• Intereses vivienda (casa habitacional): hasta 1.200 UVT/año\n• Dependientes: 10% del ingreso (máx 32 UVT)\n• Aportes AFC: 30% del ingreso (máx 3.800 UVT)\n• Aportes a pensión voluntaria\n• Prepagada y educação (topes)\n¿Te ayudo a estimarlas?',
        },
        {
          pregunta: 'Retención en la fuente',
          sinonimos: ['retencion fuente', 'retefuente', 'retencion', 'descuento impuesto'],
          respuesta:
            'Retención en la fuente:\n• Empleados: aplicada por empleador según tabla\n• Independientes: 11-19% según actividad\n• Mínimo no sometido: 95 UVT ($4.000.000 aprox)\n• Si te retienen de más: devolución en declaración\n¿Calculas retención sugerida para un ingreso?',
        },
        {
          pregunta: 'IVA para independientes',
          sinonimos: ['iva', 'iva independiente', 'responsable iva', 'no responsable'],
          respuesta:
            'Responsabilidad de IVA:\n• Ingresos >$6.000 UVT ($285M 2024): responsable obligatorio\n• Si <umbral y prestas servicios: no responsable (pero opcional)\n• Si vendes bienes excluidos/exentos: caso especial\n• Tarifa general: 19%\n• Bienes y servicios excluidos: 0%\n¿Cuál es tu actividad?',
        },
        {
          pregunta: 'Renta exenta',
          sinonimos: ['renta exenta', 'ingreso no constitutivo', 'beneficio renta'],
          respuesta:
            'Rentas exentas (no pagan impuesto):\n• 25% del ingreso laboral (tope 790 UVT)\n• Pensiones hasta 1.000 UVT\n• Indemnizaciones laborales\n• Ahorro en AFC (tope 3.800 UVT)\n• Aportes voluntarios a pensión (tope 3.800 UVT)\nTe pueden ahorrar hasta 25% de impuesto.',
        },
        {
          pregunta: 'Planificación tributaria',
          sinonimos: ['planificacion tributaria', 'optimizar impuestos', 'estrategia fiscal'],
          respuesta:
            'Estrategias de planificación:\n1. Maximiza AFC y pensión voluntaria\n2. Prepagada y dependentes\n3. Cronograma de ingresos (repartir años)\n4. Inversiones con beneficios (renta exenta)\n5. Donaciones deducibles\n6. Estructura jurídica (persona vs empresa)\nRecomendado: revisión con contador en octubre.',
        },
        {
          pregunta: '¿Cuánto debo en impuestos?',
          sinonimos: ['cuanto debo', 'impuesto a pagar', 'estimacion', 'cuenta impuesto'],
          respuesta:
            'Estimación de impuesto anual:\nPara calcular necesito:\n• Ingresos brutos del año\n• Costos y deducciones\n• Patrimonio al 31/dic\nTe estimo el impuesto a pagar y proyección de retención. ¿Tienes los datos o los extraigo del sistema?',
        },
      ],
    },
  ],
}

// =====================================================
// 4. PAGOS — Asistente de Cobros (Gerente de cobranza)
// =====================================================
const PREGUNTAS_PAGOS: PreguntasBot = {
  tipoBot: 'PAGOS',
  nombreBot: 'Asistente de Cobros',
  descripcion: 'Gerente de cobranza: gestión de cartera, morosos, recordatorios y acuerdos de pago.',
  categorias: [
    {
      nombre: 'Gestión de Cartera',
      preguntas: [
        {
          pregunta: '¿Cómo está la cartera hoy?',
          sinonimos: ['cartera', 'estado cartera', 'resumen cartera', 'panorama cartera'],
          respuesta:
            'Resumen de cartera hoy:\n' +
            '• Total cartera: $145.000.000\n' +
            '• Al día: $98M (67%)\n' +
            '• Mora 1-30 días: $25M (17%)\n' +
            '• Mora 31-60 días: $14M (10%)\n' +
            '• Mora 60+ días: $8M (6%)\n' +
            'Índice de morosidad: 33%. Meta: <25%.',
        },
        {
          pregunta: '¿Cuántos clientes en mora?',
          sinonimos: ['clientes mora', 'cuantos morosos', 'deudores', 'cuenta mora'],
          respuesta:
            'Clientes en mora: 47\n' +
            '• Mora leve (1-30): 28\n' +
            '• Mora media (31-60): 12\n' +
            '• Mora alta (61-90): 5\n' +
            '• Mora crítica (90+): 2\n' +
            '¿Quieres que genere acciones por segmento?',
        },
        {
          pregunta: '¿Quién debe más dinero?',
          sinonimos: ['quien debe mas', 'top deudores', 'mayores deudas', 'los que mas deben'],
          respuesta:
            'Top 5 deudores por saldo:\n' +
            '1. Pérez, Carlos — $2.4M (45 días)\n' +
            '2. Gómez, Ana — $1.8M (28 días)\n' +
            '3. Rodríguez, Juan — $1.6M (62 días)\n' +
            '4. Martínez, Laura — $1.3M (15 días)\n' +
            '5. Sánchez, Pedro — $1.1M (89 días)\n' +
            '¿Inicio gestión individual?',
        },
        {
          pregunta: '¿Cuánto se recaudó esta semana?',
          sinonimos: ['recaudo semana', 'lo recaudado', 'cuanto cobramos', 'ingresos cobranza'],
          respuesta:
            'Recaudo de la semana: $12.450.000\n' +
            '• Lunes: $2.1M\n' +
            '• Martes: $3.4M\n' +
            '• Miércoles: $1.8M\n' +
            '• Jueves: $2.7M\n' +
            '• Viernes: $2.45M\n' +
            'Cumplimiento: 89% de la meta semanal ($14M).',
        },
        {
          pregunta: '¿Qué clientes pagaron hoy?',
          sinonimos: ['pagos hoy', 'quienes pagaron', 'recibidos hoy', 'pagos del dia'],
          respuesta:
            'Pagos registrados hoy: 8\n' +
            '1. Pérez — $150.000 (cuota mensual)\n' +
            '2. Gómez — $80.000 (abono)\n' +
            '3. Rodríguez — $200.000 (cuota + atraso)\n' +
            '... y 5 más.\n' +
            'Total recaudado: $1.250.000. ¿Quieres ver el detalle?',
        },
        {
          pregunta: '¿Cuál es mi índice de morosidad?',
          sinonimos: ['indice mora', 'mora', 'porcentaje mora', 'índice de morosidad', 'cartera vencida'],
          respuesta:
            'Índice de morosidad (IM): 33%\n' +
            '• Cartera total: $145M\n' +
            '• Cartera vencida: $47M\n' +
            '• Meta: <25%\n' +
            'Estás 8 puntos por encima de meta. Recomiendo refuerzo en mora 30-60 días.',
        },
        {
          pregunta: '¿Cómo se compara la mora con el mes pasado?',
          sinonimos: ['comparativa mora', 'mora mes anterior', 'evolucion mora', 'variance'],
          respuesta:
            'Comparativo mora mes vs mes:\n' +
            '• Mes actual: 33% ($47M)\n' +
            '• Mes anterior: 38% ($54M)\n' +
            '• Variación: -5 puntos (-13%)\n' +
            'Mejora sostenida por tercer mes. ¡Buen trabajo!',
        },
      ],
    },
    {
      nombre: 'Seguimiento a Morosos',
      preguntas: [
        {
          pregunta: '¿Qué debo cobrar hoy?',
          sinonimos: ['cobrar hoy', 'gestion de hoy', 'tareas cobranza', 'a quienes llamo'],
          respuesta:
            'Plan de cobranza de hoy (12 gestiones):\n' +
            '• 5 llamadas a mora 30-60 días (alta prioridad)\n' +
            '• 4 WhatsApp a mora 1-30 días\n' +
            '• 3 SMS a mora leve\n' +
            '¿Empiezo por las llamadas de mayor mora?',
        },
        {
          pregunta: '¿Quiénes están en mora crítica?',
          sinonimos: ['mora critica', '90 dias', 'mora alta', 'criticos', 'rojos'],
          respuesta:
            'Clientes en mora crítica (90+ días): 2\n' +
            '1. Sánchez, Pedro — $1.1M (89 días)\n' +
            '2. Torres, María — $780.000 (95 días)\n' +
            'Acción recomendada: escalar a jurídico en 1 semana si no pagan. ¿Genero carta prejurídica?',
        },
        {
          pregunta: 'Generar recordatorios de pago',
          sinonimos: ['recordatorios', 'avisos de pago', 'sms recordatorio', 'whatsapp pago'],
          respuesta:
            'Recordatorios automáticos generados: 87\n' +
            '• 35 SMS -3 días antes del vencimiento\n' +
            '• 28 WhatsApp día del vencimiento\n' +
            '• 24 SMS +1 día de mora\n' +
            '¿Programo el envío ahora?',
        },
        {
          pregunta: 'Enviar mensaje masivo a morosos',
          sinonimos: ['mensaje masivo', 'broadcast', 'envio masivo', 'sms masivo'],
          respuesta:
            'Mensaje masivo listo para 47 morosos:\n' +
            '• Plantilla: "Recordatorio amistoso de pago"\n' +
            '• Canal: WhatsApp\n' +
            '• Costo estimado: $4.700\n' +
            'Tasa esperada de respuesta: 30%\n' +
            '¿Confirmo el envío?',
        },
        {
          pregunta: '¿Quién lleva más días sin pagar?',
          sinonimos: ['mas dias sin pagar', 'atraso mas largo', 'antiguedad mora', 'mayor atraso'],
          respuesta:
            'Top antigüedad de mora:\n' +
            '1. Torres, María — 95 días\n' +
            '2. Sánchez, Pedro — 89 días\n' +
            '3. Ramírez, Luis — 73 días\n' +
            '4. Vargas, Carmen — 68 días\n' +
            '5. Castro, Diego — 62 días\n' +
            'Sánchez y Torres son candidatos claros a jurídico.',
        },
        {
          pregunta: 'Llamar a los que más deben',
          sinonimos: ['llamar deudores', 'gestion telefonica', 'campaign calls', 'campaña telefonica'],
          respuesta:
            'Campaña telefónica armada para 5 clientes:\n' +
            '1. Pérez, Carlos — Tel: 320 XXX — $2.4M\n' +
            '2. Gómez, Ana — Tel: 311 XXX — $1.8M\n' +
            '3. Rodríguez, Juan — Tel: 315 XXX — $1.6M\n' +
            '4. Martínez, Laura — Tel: 300 XXX — $1.3M\n' +
            '5. Sánchez, Pedro — Tel: 318 XXX — $1.1M\n' +
            '¿Inicio con Pérez?',
        },
        {
          pregunta: '¿Qué debo hacer con los que no responden?',
          sinonimos: ['no responden', 'sin contacto', 'no localizados', 'no contestan'],
          respuesta:
            'Clientes sin contacto (12):\n' +
            'Acciones recomendadas:\n' +
            '1. Reintento WhatsApp en horario diferente\n' +
            '2. Llamada desde otro número\n' +
            '3. Email (si tienes)\n' +
            '4. Visita domiciliaria (mora >60 días)\n' +
            '5. Verificar referencia personal\n' +
            '¿Inicio con la opción 1?',
        },
      ],
    },
    {
      nombre: 'Recordatorios y Comunicaciones',
      preguntas: [
        {
          pregunta: 'Crear recordatorio para cliente Pérez',
          sinonimos: ['recordatorio cliente', 'crear recordatorio', 'programar aviso', 'avisar a cliente'],
          respuesta:
            'Recordatorio creado ✅\n' +
            '• Cliente: Pérez, Carlos\n' +
            '• Acción: Llamar mañana 10 a.m.\n' +
            '• Notificación: Push + email\n' +
            '¿Asocio el recordatorio a su expediente de cobro?',
        },
        {
          pregunta: 'Enviar SMS de pago',
          sinonimos: ['enviar sms', 'sms pago', 'mensaje texto', 'recordatorio sms'],
          respuesta:
            'Plantillas SMS disponibles:\n' +
            '1. Vencimiento -3 días: amistoso\n' +
            '2. Vencimiento día: recordatorio\n' +
            '3. Mora +1 día: amable con consecuencias\n' +
            '4. Mora +7 días: fuerte con oferta acuerdo\n' +
            '¿Cuál envío y a quién?',
        },
        {
          pregunta: 'Enviar WhatsApp con factura',
          sinonimos: ['whatsapp factura', 'enviar factura', 'comprobante whatsapp', 'factura por whatsapp'],
          respuesta:
            'Para enviar factura por WhatsApp necesito:\n' +
            '• ID del préstamo\n' +
            '• Período a facturar\n' +
            'Te genero el PDF y lo envío al WhatsApp registrado del cliente. ¿Procedo?',
        },
        {
          pregunta: '¿Qué plantillas tengo disponibles?',
          sinonimos: ['plantillas', 'templates', 'mensajes predefinidos', 'texto base'],
          respuesta:
            'Plantillas disponibles (14):\n' +
            '• Bienvenida cliente\n' +
            '• Confirmación pago recibido\n' +
            '• Vencimiento -3, 0, +1, +7 días\n' +
            '• Acuerdo de pago propuesto\n' +
            '• Acuerdo incumplido\n' +
            '• Preaviso jurídico\n' +
            '• Paz y salvo\n' +
            '¿Edito o creo una nueva?',
        },
        {
          pregunta: 'Personalizar mensaje a cliente',
          sinonimos: ['personalizar', 'mensaje personalizado', 'editar texto', 'modificar plantilla'],
          respuesta:
            'Para personalizar, dime:\n' +
            '• Plantilla base (opcional)\n' +
            '• Cliente destino\n' +
            '• Variables a reemplazar (monto, fecha, etc.)\n' +
            '• Mensaje personalizado\n' +
            'Lo guardo como plantilla nueva o envío único.',
        },
        {
          pregunta: 'Programar envío automático mensual',
          sinonimos: ['envio automatico', 'programar mensual', 'recurrente', 'automatizar cobranza'],
          respuesta:
            'Automatización configurada ✅\n' +
            '• Día: 25 de cada mes\n' +
            '• Canal: WhatsApp\n' +
            '• Plantilla: Recordatorio vencimiento\n' +
            '• Clientes: 87 activos\n' +
            '¿Confirmo la programación?',
        },
        {
          pregunta: '¿Cuántos mensajes envié este mes?',
          sinonimos: ['mensajes enviados', 'estadisticas envio', 'volumen mensual', 'cuantos envie'],
          respuesta:
            'Estadística de envíos del mes:\n' +
            '• SMS: 342 enviados, 78% entregados\n' +
            '• WhatsApp: 524 enviados, 91% leídos\n' +
            '• Emails: 198 enviados, 65% abiertos\n' +
            '• Llamadas: 167 realizadas, 54% contestadas\n' +
            'Costo total: $87.000.',
        },
      ],
    },
    {
      nombre: 'Acuerdos de Pago',
      preguntas: [
        {
          pregunta: 'Proponer acuerdo de pago',
          sinonimos: ['acuerdo pago', 'facilidades', 'refinanciacion', 'plan de pago'],
          respuesta:
            'Para proponer un acuerdo necesito:\n' +
            '• Cliente\n' +
            '• Saldo actual\n' +
            '• Capacidad de pago del cliente\n' +
            '• Plazo propuesto\n' +
            'Te genero 3 opciones: conservadora, equilibrada y flexible. ¿Con qué cliente empezamos?',
        },
        {
          pregunta: 'Calcular cuota de acuerdo',
          sinonimos: ['calcular cuota', 'simular acuerdo', 'cuota nueva', 'reestructurar'],
          respuesta:
            'Simulación acuerdo de pago:\n' +
            '• Saldo: $1.500.000\n' +
            '• Plazo: 12 meses\n' +
            '• Tasa: 1.5% mensual\n' +
            '• Cuota mensual: $137.000\n' +
            '¿Acepta el cliente o ajustamos plazo?',
        },
        {
          pregunta: 'Registrar acuerdo firmado',
          sinonimos: ['registrar acuerdo', 'guardar acuerdo', 'firmar acuerdo', 'formalizar'],
          respuesta:
            'Acuerdo registrado ✅\n' +
            '• Cliente: Pérez, Carlos\n' +
            '• Saldo refinanciado: $1.500.000\n' +
            '• Cuota: $137.000 × 12 meses\n' +
            '• Primera cuota: 15 de octubre\n' +
            'Genero el documento para firma electrónica.',
        },
        {
          pregunta: '¿Cuántos acuerdos activos hay?',
          sinonimos: ['acuerdos activos', 'acuerdos vigentes', 'cuantos acuerdos', 'lista acuerdos'],
          respuesta:
            'Acuerdos activos: 18\n' +
            '• Al día: 12 (67%)\n' +
            '• Con atraso: 4 (22%)\n' +
            '• Incumplidos: 2 (11%)\n' +
            'Total saldo en acuerdos: $24.5M\n' +
            'Tasa de cumplimiento: 89%.',
        },
        {
          pregunta: 'Cliente incumplió el acuerdo',
          sinonimos: ['incumplio', 'acuerdo roto', 'no pago acuerdo', 'incumplimiento'],
          respuesta:
            'Procedimiento ante incumplimiento:\n' +
            '1. Llamada de seguimiento inmediata\n' +
            '2. Carta formal de incumplimiento (3 días)\n' +
            '3. Si no paga en 7 días: pierde condiciones especiales\n' +
            '4. Si no paga en 15 días: pasa a jurídico\n' +
            '¿Inicio el paso 1 ahora?',
        },
        {
          pregunta: 'Cancelar acuerdo de pago',
          sinonimos: ['cancelar acuerdo', 'romper acuerdo', 'anular acuerdo', 'terminar'],
          respuesta:
            'Para cancelar un acuerdo necesito:\n' +
            '• Motivo (incumplimiento, solicitud cliente, etc.)\n' +
            '• Cliente afectado\n' +
            '• Nueva condición (regularización o jurídico)\n' +
            'El acuerdo queda en historial pero se cancela activo. ¿Procedo?',
        },
        {
          pregunta: '¿Cuál es la tasa de éxito de acuerdos?',
          sinonimos: ['tasa exito', 'efectividad acuerdos', 'cumplimiento', 'recuperacion acuerdos'],
          respuesta:
            'Estadística de acuerdos últimos 6 meses:\n' +
            '• Acuerdos firmados: 67\n' +
            '• Cumplidos: 54 (81%)\n' +
            '• Incumplidos: 13 (19%)\n' +
            '• Recuperación total: $42.5M\n' +
            'Tasa éxito: 81% (meta 80%). ¡Vamos bien!',
        },
      ],
    },
    {
      nombre: 'Reportes de Cobranza',
      preguntas: [
        {
          pregunta: 'Generar reporte de cartera',
          sinonimos: ['reporte cartera', 'generar reporte', 'informe cartera', 'exportar cartera'],
          respuesta:
            'Reporte de cartera generado ✅\n' +
            '• Fecha corte: hoy\n' +
            '• Total cartera: $145M\n' +
            '• Clientes: 247\n' +
            '• Mora: 33%\n' +
            'Formato: Excel + PDF\n' +
            '¿Te lo envío por correo o lo descargas aquí?',
        },
        {
          pregunta: 'Reporte de recaudo mensual',
          sinonimos: ['reporte recaudo', 'recaudo mensual', 'informe recaudo', 'cierre mensual'],
          respuesta:
            'Reporte de recaudo del mes:\n' +
            '• Total recaudado: $48.5M\n' +
            '• Meta: $50M (97%)\n' +
            '• Mejor día: día 15 ($3.4M)\n' +
            '• Mejor gestor: Ana (78% de cumplimiento)\n' +
            'Adjunto el Excel con detalle por cliente.',
        },
        {
          pregunta: 'Comparativo de gestores',
          sinonimos: ['comparativo gestores', 'ranking gestores', 'desempeno cobradores', 'equipo cobranza'],
          respuesta:
            'Ranking gestores del mes:\n' +
            '1. Ana Martínez — 92% cumplimiento, $14.2M\n' +
            '2. Carlos López — 88%, $12.8M\n' +
            '3. Laura Gómez — 81%, $9.5M\n' +
            '4. Pedro Ruiz — 73%, $7.2M\n' +
            '5. Diana Vargas — 65%, $4.8M\n' +
            'Recomiendo coaching con Diana.',
        },
        {
          pregunta: 'Reporte de mora por antigüedad',
          sinonimos: ['mora antiguedad', 'aging', 'mora por rangos', 'antiguedad de saldo'],
          respuesta:
            'Reporte mora por antigüedad:\n' +
            '• 1-30 días: $25M (28 clientes)\n' +
            '• 31-60 días: $14M (12 clientes)\n' +
            '• 61-90 días: $5M (5 clientes)\n' +
            '• 90+ días: $3M (2 clientes)\n' +
            'El 53% de la mora es reciente (1-30 días) — recuperable.',
        },
        {
          pregunta: 'Reporte de clientes nuevos',
          sinonimos: ['clientes nuevos', 'altas del mes', 'nuevos prestamos', 'adquisicion'],
          respuesta:
            'Clientes nuevos del mes: 34\n' +
            '• Monto desembolsado: $42.8M\n' +
            '• Ticket promedio: $1.26M\n' +
            '• Plazo promedio: 14 meses\n' +
            '• Tasa promedio: 1.4% mensual\n' +
            'Crecimiento: +18% vs mes anterior.',
        },
        {
          pregunta: 'Reporte de castigos',
          sinonimos: ['castigos', 'cartera castigada', 'siniestros', 'perdidas'],
          respuesta:
            'Castigos del mes: $1.8M (3 clientes)\n' +
            '• Cliente X — $780K (mora 180 días, judicial sin éxito)\n' +
            '• Cliente Y — $620K (fallecido, sin herederos)\n' +
            '• Cliente Z — $400K (fraude comprobado)\n' +
            'Tasa de castigo: 1.2% (meta <2%). Aceptable.',
        },
        {
          pregunta: 'Reporte ejecutivo para gerencia',
          sinonimos: ['reporte gerencia', 'ejecutivo', 'tablero gerencial', 'kpi cobranza'],
          respuesta:
            'Reporte ejecutivo mensual:\n' +
            '• Cartera total: $145M (+5% MoM)\n' +
            '• Recaudo: $48.5M (97% meta)\n' +
            '• Mora: 33% (-5pp MoM)\n' +
            '• Castigos: $1.8M (1.2%)\n' +
            '• Nuevos clientes: 34 (+18%)\n' +
            '• NPS clientes: 78\n' +
            'Conclusión: mejora sostenida, vigilar mora 60+ días.',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'No hay pagos registrados hoy',
          sinonimos: ['sin pagos', 'no hay recaudo', 'dia sin pagos', 'cero recaudo'],
          respuesta:
            'Hoy no hay pagos registrados todavía. Posibles causas:\n' +
            '• Aún no se han aplicado (cargos pendientes)\n' +
            '• Día no laboral (festivo, domingo)\n' +
            '• Error de sincronización bancaria\n' +
            '¿Quieres que verifique la sincronización con PSE y Bancolombia?',
        },
        {
          pregunta: 'Cliente pagó pero sigue en mora',
          sinonimos: ['pago pero sigue mora', 'pago no aplicado', 'desactualizado', 'pago no reflejado'],
          respuesta:
            'Si el cliente pagó pero sigue en mora, reviso:\n' +
            '1. Si el pago fue recibido en cuenta\n' +
            '2. Si se aplicó al préstamo correcto\n' +
            '3. Si cubre la totalidad de la cuota\n' +
            'Indícame el cliente y el comprobante. Lo regularizo de inmediato.',
        },
        {
          pregunta: 'Cliente fallecido',
          sinonimos: ['fallecido', 'muerte', 'deceso', 'fallecimiento'],
          respuesta:
            'Procedimiento por fallecimiento:\n' +
            '1. Solicitar registro civil de defunción\n' +
            '2. Verificar si hay codeudor o herederos\n' +
            '3. Si hay codeudor: traslado de obligación\n' +
            '4. Si no: iniciar proceso sucesoral\n' +
            '5. Si irrecoverable: castigo contable\n' +
            '¿Tienes el registro civil?',
        },
        {
          pregunta: 'Cliente reporta fraude',
          sinonimos: ['fraude', 'suplantacion', 'no fue el', 'robo identidad'],
          respuesta:
            'Procedimiento fraude:\n' +
            '1. Bloquear cuenta inmediatamente\n' +
            '2. Solicitar denuncia ante Fiscalía\n' +
            '3. Iniciar investigación interna\n' +
            '4. Reportar a Datacrédito como "en disputa"\n' +
            '5. Escalar a seguridad y jurídico\n' +
            '¿Tienes el caso específico?',
        },
        {
          pregunta: 'Doble cobro a cliente',
          sinonimos: ['doble cobro', 'cobro duplicado', 'cobro multiple'],
          respuesta:
            'Procedimiento doble cobro:\n' +
            '1. Verificar en sistema (2 transacciones?)\n' +
            '2. Si fue error: devolución en 5 días hábiles\n' +
            '3. Compensación: 1 cuota gratis por la molestia\n' +
            '4. Carta de disculpa formal\n' +
            'Indícame el cliente y monto.',
        },
        {
          pregunta: 'No puedo contactar al cliente',
          sinonimos: ['no contacto', 'sin contacto', 'no localizado', 'telefono errado'],
          respuesta:
            'Cliente no localizable:\n' +
            '• Verificar teléfonos alternativos\n' +
            '• Contactar referencias personales\n' +
            '• Buscar en redes sociales (sin acoso)\n' +
            '• Visita domiciliaria (mora >60 días)\n' +
            '• Si imposible: reportar como "no localizable" y evaluar castigo\n' +
            '¿Cuál es el cliente?',
        },
        {
          pregunta: 'Cliente pide quitar el reporte negativo',
          sinonimos: ['quitar reporte', 'borrar datacredito', 'limpiar historial', 'sacar de mora'],
          respuesta:
            'Para retirar reporte negativo en Datacrédito:\n' +
            '1. Debe pagar la totalidad de la obligación\n' +
            '2. Actualizamos reporte en máximo 30 días\n' +
            '3. El historial negativo se mantiene 2 años\n' +
            'No eliminamos histórico, solo actualizamos a "al día". Es lo que permite la ley.',
        },
      ],
    },
    {
      nombre: 'Estrategias Avanzadas de Cobranza',
      preguntas: [
        {
          pregunta: 'Segmentar morosos por perfil',
          sinonimos: ['segmentar morosos', 'perfil deudor', 'clusters mora', 'tipologia moroso'],
          respuesta:
            'Segmentación de morosos:\n• Olvidadizos (40%): pagan con recordatorio\n• Dificultad temporal (30%): necesitan acuerdo\n• Estratégicos (20%): negocian duro\n• Evasivos (10%): requieren acción legal\nPor segmento, customizo mensaje y estrategia. ¿Quieres la lista?',
        },
        {
          pregunta: 'Mejores horarios para llamar',
          sinonimos: ['horarios llamar', 'mejor hora', 'cuando llamar', 'efectividad horario'],
          respuesta:
            'Horarios más efectivos (basado en datos):\n• Martes-jueves: mejores días\n• 10-11 a.m.: 45% respuesta\n• 4-5 p.m.: 38% respuesta\n• Evitar: lunes mañana, viernes tarde\n• Festivos: 0% efectividad\n¿Reordeno la campaña con estos horarios?',
        },
        {
          pregunta: 'Técnicas de negociación',
          sinonimos: ['negociacion', 'tecnicas cobro', 'argumentos', 'persuasion'],
          respuesta:
            'Técnicas efectivas:\n1. Empatía primero: "entiendo la situación"\n2. Pregunta abierta: "¿qué pasó?"\n3. Ofrece opciones, no impongas\n4. Silencio estratégico después de oferta\n5. Anclaje: empieza con propuesta alta\n6. Concesiones condicionadas\n7. Cierre con acuerdo escrito\n¿Quieres un script específico?',
        },
        {
          pregunta: 'Manejar excusas comunes',
          sinonimos: ['excusas', 'objeciones', 'el cliente dice', 'como responder'],
          respuesta:
            'Excusas frecuentes y respuestas:\n• "No tengo plata": ofrecer acuerdo 3 cuotas\n• "No me llega el dinero": verificar cuenta\n• "Se me olvidó": programar auto-pago\n• "Voy a pagar mañana": pedir fecha exacta\n• "La cuota subió": explicar intereses mora\n• "No fui yo": validar identidad\n¿Cuál excusa quieres manejar?',
        },
        {
          pregunta: 'Indicadores de cobranza',
          sinonimos: ['indicadores cobranza', 'kpis cobro', 'metricas gestion', 'rendimiento'],
          respuesta:
            'KPIs de cobranza:\n• Tasa de recuperación: 42% (meta 40%) ✅\n• Promedio días de cobro: 38 días (meta 35)\n• Costo por peso recuperado: $0.08\n• Gestiones por cliente: 4.2\n• Conversión de acuerdos: 81%\n¿Quieres ver el desglose por gestor?',
        },
        {
          pregunta: 'Comisiones de gestores',
          sinonimos: ['comisiones', 'pago gestores', 'incentivos', 'esquema comision'],
          respuesta:
            'Esquema comisiones:\n• Base: $1.5M mes\n• Variable: 3% de recaudo\n• Bonus por meta: $500K si supera 90%\n• Bonus por recuperación difícil: 5%\n• Penalización: -10% si mora sube\n¿Quieres ver la liquidación del mes?',
        },
        {
          pregunta: 'Incentivos por recuperación',
          sinonimos: ['incentivos', 'premios', 'bonus recuperacion', 'gamificacion'],
          respuesta:
            'Programa de incentivos:\n• "Gestor del mes": $1M bonus + día libre\n• Mayor recuperación: 1% adicional\n• Acuerdos exitosos: $50K c/u\n• Cero quejas: $200K\n• Ranking trimestral: $3M (1ro), $2M (2do), $1M (3ro)\n¿Reconocemos a alguien?',
        },
        {
          pregunta: 'Script de cobranza',
          sinonimos: ['script', 'guion cobro', 'texto llamar', 'que decir'],
          respuesta:
            'Script sugerido (mora temprana):\n1. Saludo: "Hola, soy [nombre] de Jsadr"\n2. Identidad: confirma cédula del cliente\n3. Motivo: "Te llamo por tu cuota de [fecha]"\n4. Empatía: "¿Hubo algún inconveniente?"\n5. Opciones: ofrece pago/acuerdo\n6. Cierre: confirma fecha y monto\n¿Te genero el script por etapa?',
        },
        {
          pregunta: 'Auditar gestiones de cobro',
          sinonimos: ['auditar gestiones', 'control calidad', 'revision gestores', 'qa cobranza'],
          respuesta:
            'Auditoría de gestiones:\n1. Selecciona muestra aleatoria (10%)\n2. Escucha llamadas grabadas\n3. Verifica protocolo seguido\n4. Califica: 0-100 (cortesía, claridad, cierre)\n5. Identifica oportunidades\n6. Feedback al gestor\nMeta promedio: 85/100. ¿Inicio auditoría mensual?',
        },
      ],
    },
  ],
}

// =====================================================
// 5. PRESTAMOS — Asistente Préstamos (Director de préstamos)
// =====================================================
const PREGUNTAS_PRESTAMOS: PreguntasBot = {
  tipoBot: 'PRESTAMOS',
  nombreBot: 'Asistente Préstamos',
  descripcion: 'Director de préstamos: solicitud, aprobación, seguimiento y renovación de créditos.',
  categorias: [
    {
      nombre: 'Solicitud de Créditos',
      preguntas: [
        {
          pregunta: '¿Cómo solicito un préstamo?',
          sinonimos: ['solicitar', 'como pido', 'nuevo credito', 'tramitar', 'solicitud de prestamo'],
          respuesta:
            'Para solicitar un préstamo:\n' +
            '1. Diligencia el formulario (datos personales, laborales, financieros)\n' +
            '2. Adjunta cédula y comprobante de ingresos\n' +
            '3. Sistema valida y pre-aprueba en 5 minutos\n' +
            '4. Asesor confirma y desembolsa\n' +
            '¿Quieres iniciar el formulario?',
        },
        {
          pregunta: '¿Cuánto puedo pedir prestado?',
          sinonimos: ['cuanto puedo pedir', 'monto maximo', 'cupo disponible', 'limite prestamo'],
          respuesta:
            'Tu cupo máximo estimado: $2.500.000\n' +
            'Calculado con base en:\n' +
            '• Ingresos: $3.500.000\n' +
            '• Capacidad de pago (30%): $1.050.000\n' +
            '• Plazo: 24 meses\n' +
            '¿Quieres ver la simulación de cuotas?',
        },
        {
          pregunta: '¿Qué documentos necesito?',
          sinonimos: ['documentos', 'requisitos', 'que llevo', 'que piden'],
          respuesta:
            'Documentos requeridos:\n' +
            '• Cédula colombiana (foto ambos lados)\n' +
            '• Comprobante de ingresos (2 últimos)\n' +
            '• Recibo de servicio público (residencia)\n' +
            '• Referencia personal (1)\n' +
            '• Si empleado: certificado laboral\n' +
            '• Si independiente: extracto bancario 3 meses',
        },
        {
          pregunta: '¿Cuánto demora la aprobación?',
          sinonimos: ['demora aprobacion', 'cuanto demora', 'tiempo respuesta', 'aprobacion'],
          respuesta:
            'Tiempo de aprobación:\n' +
            '• Pre-aprobación automática: 5 minutos\n' +
            '• Validación manual: 2-24 horas hábiles\n' +
            '• Desembolso: mismo día si se aprueba antes de 2 p.m.\n' +
            'Tiempo total promedio: 6 horas.',
        },
        {
          pregunta: '¿Puedo pedir sin historial crediticio?',
          sinonimos: ['sin historial', 'primera vez', 'sin datacredito', 'nuevo en sistema'],
          respuesta:
            'Sí, atendemos clientes sin historial (primera vez). Para estos casos:\n' +
            '• Monto máximo inicial: $500.000\n' +
            '• Tasa: 1.8% mensual\n' +
            '• Codeudor obligatorio\n' +
            '• Plazo: 12 meses\n' +
            'Al pagar bien la primera, mejoras condiciones.',
        },
        {
          pregunta: '¿Hacen préstamos a pensionados?',
          sinonimos: ['pensionados', 'jubilados', 'pension', 'tercera edad'],
          respuesta:
            'Sí, aceptamos pensionados:\n' +
            '• Edad máxima al desembolso: 80 años\n' +
            '• Monto máximo: 4x pensión mensual\n' +
            '• Plazo máximo: hasta 24 meses\n' +
            '• Requisitos: comprobante pensión y cédula\n' +
            '¿Cuál es tu pensión mensual?',
        },
        {
          pregunta: '¿Aceptan codeudor?',
          sinonimos: ['codeudor', 'fiador', 'aval', 'con aval'],
          respuesta:
            'Sí, aceptamos codeudor para:\n' +
            '• Aumentar el monto del préstamo\n' +
            '• Mejorar la tasa\n' +
            '• Compensar ingresos insuficientes\n' +
            'El codeudor debe tener:\n' +
            '• Ingresos comprobables\n' +
            '• Buen historial crediticio\n' +
            '• No estar reportado negativamente',
        },
      ],
    },
    {
      nombre: 'Aprobación y Análisis',
      preguntas: [
        {
          pregunta: '¿Cómo se evalúa una solicitud?',
          sinonimos: ['evaluar', 'analisis credito', 'criterios', 'como se aprueba'],
          respuesta:
            'Criterios de evaluación:\n' +
            '1. Capacidad de pago (40% peso)\n' +
            '2. Historial crediticio (30%)\n' +
            '3. Estabilidad laboral (15%)\n' +
            '4. Antigüedad residencia (5%)\n' +
            '5. Referencias (5%)\n' +
            '6. Score interno Jsadr (5%)\n' +
            'Score mínimo aprobación: 650/1000.',
        },
        {
          pregunta: '¿Mi solicitud fue aprobada?',
          sinonimos: ['fue aprobada', 'estado solicitud', 'ya aprobaron', 'que paso con mi solicitud'],
          respuesta:
            'Para ver el estado de tu solicitud necesito:\n' +
            '• Número de solicitud, o\n' +
            '• Cédula del solicitante\n' +
            'Te muestro: fecha, estado actual, próxima actualización. Si fue aprobada, te indico condiciones.',
        },
        {
          pregunta: '¿Por qué rechazaron mi solicitud?',
          sinonimos: ['rechazada', 'porque no aprobaron', 'negada', 'motivo rechazo'],
          respuesta:
            'Motivos comunes de rechazo:\n' +
            '• Capacidad de pago insuficiente (50%)\n' +
            '• Reporte negativo en Datacrédito (25%)\n' +
            '• Información inconsistente (15%)\n' +
            '• Edad fuera de rango (5%)\n' +
            '• Antigüedad laboral insuficiente (5%)\n' +
            'Indícame tu cédula y te digo el motivo específico.',
        },
        {
          pregunta: '¿Puedo apelar una decisión?',
          sinonimos: ['apelar', 'reconsideracion', 'volver a evaluar', 'segunda instancia'],
          respuesta:
            'Sí, puedes apelar. Procedimiento:\n' +
            '1. Solicita reconsideración dentro de 30 días\n' +
            '2. Aporta nueva información (ingresos adicionales, codeudor, garantía)\n' +
            '3. Comité de crédito revisa en 5 días hábiles\n' +
            '4. Decisión final notificada por escrito\n' +
            '¿Quieres iniciar la apelación?',
        },
        {
          pregunta: '¿Qué tasa se me aplica?',
          sinonimos: ['tasa aplicada', 'mi tasa', 'interes asignado', 'que tasa me toca'],
          respuesta:
            'Tasa asignada según tu perfil:\n' +
            '• Score 750+: 1.2% mensual (15.4% EA)\n' +
            '• Score 650-749: 1.4% mensual (18.1% EA)\n' +
            '• Score 550-649: 1.7% mensual (22.4% EA)\n' +
            '• Score <550: 1.9% mensual (25.3% EA)\n' +
            'Confirma tu cédula para ver tu score y tasa exacta.',
        },
        {
          pregunta: '¿Pueden bajar la tasa?',
          sinonimos: ['bajar tasa', 'mejor tasa', 'negociar tasa', 'reducir interes'],
          respuesta:
            'Para bajar tu tasa:\n' +
            '• Aporta codeudor con buen historial: -0.2%\n' +
            '• Ofrece garantía real (vehículo): -0.3%\n' +
            '• Reduce el plazo a la mitad: -0.2%\n' +
            '• Tienes préstamos anteriores bien pagados: -0.2%\n' +
            'Combinando todas, puedes llegar a 1.0% mensual.',
        },
        {
          pregunta: '¿Cuánto desembolsan y cuándo?',
          sinonimos: ['desembolso', 'cuando me pagan', 'monto desembolsado', 'como recibo'],
          respuesta:
            'Desembolso:\n' +
            '• Medio: cuenta bancaria, Nequi, Daviplata o G&G\n' +
            '• Tiempo: mismo día si aprueba antes de 2 p.m.\n' +
            '• Costo: $5.000 por estudio + 1% por desembolso\n' +
            '• Recibes: monto aprobado menos costos\n' +
            'Ejemplo: $2M aprobados → recibes $1.975M',
        },
      ],
    },
    {
      nombre: 'Seguimiento de Préstamos',
      preguntas: [
        {
          pregunta: '¿Cuántos préstamos activos hay?',
          sinonimos: ['prestamos activos', 'cuantos activos', 'cartera activa', 'cantidad creditos'],
          respuesta:
            'Préstamos activos: 247\n' +
            '• Al día: 200 (81%)\n' +
            '• En mora leve (1-30): 28 (11%)\n' +
            '• En mora media (31-60): 12 (5%)\n' +
            '• En mora alta (60+): 7 (3%)\n' +
            'Total cartera activa: $145M.',
        },
        {
          pregunta: '¿Cómo va un préstamo específico?',
          sinonimos: ['prestamo especifico', 'estado prestamo', 'detalle credito', 'ver prestamo'],
          respuesta:
            'Para ver un préstamo específico necesito:\n' +
            '• Código del préstamo (ej. PRS-2024-0123), o\n' +
            '• Cédula del cliente\n' +
            'Te muestro: estado, saldo, cuotas pagadas, próximo vencimiento y días de mora.',
        },
        {
          pregunta: '¿Cuánto falta para terminar un préstamo?',
          sinonimos: ['cuanto falta', 'para terminar', 'restante', 'lo que queda'],
          respuesta:
            'Indícame el código del préstamo. Te muestro:\n' +
            '• Cuotas restantes\n' +
            '• Saldo pendiente\n' +
            '• Fecha de finalización estimada\n' +
            '• Posibilidad de pago anticipado con descuento',
        },
        {
          pregunta: '¿Cuáles vencen esta semana?',
          sinonimos: ['vencen semana', 'vencimientos proximos', 'cuotas por vencer', 'esta semana'],
          respuesta:
            'Préstamos con vencimiento esta semana: 18\n' +
            '• Lunes: 3 vencimientos ($340.000)\n' +
            '• Martes: 4 ($520.000)\n' +
            '• Miércoles: 2 ($180.000)\n' +
            '• Jueves: 5 ($610.000)\n' +
            '• Viernes: 4 ($430.000)\n' +
            'Total esperado: $2.08M',
        },
        {
          pregunta: '¿Cuáles se desembolsaron hoy?',
          sinonimos: ['desembolsos hoy', 'nuevos creditos hoy', 'aprobados hoy'],
          respuesta:
            'Desembolsos de hoy: 7\n' +
            '1. Pérez — $1.5M (24 meses)\n' +
            '2. Gómez — $800K (12 meses)\n' +
            '3. Rodríguez — $2.2M (24 meses)\n' +
            '4. Martínez — $1.1M (18 meses)\n' +
            '... y 3 más\n' +
            'Total desembolsado: $9.4M',
        },
        {
          pregunta: '¿Cuál es el ticket promedio?',
          sinonimos: ['ticket promedio', 'monto promedio', 'promedio prestamo', 'ticket'],
          respuesta:
            'Ticket promedio del mes: $1.240.000\n' +
            '• Mínimo: $200.000\n' +
            '• Mediana: $950.000\n' +
            '• Máximo: $4.500.000\n' +
            '• Moda: $1.000.000\n' +
            'Comparado mes anterior: +7%.',
        },
        {
          pregunta: '¿Cuántos préstamos hay en mora?',
          sinonimos: ['prestamos mora', 'en mora', 'cartera vencida', 'cuantos en mora'],
          respuesta:
            'Préstamos en mora: 47\n' +
            '• 1-30 días: 28\n' +
            '• 31-60 días: 12\n' +
            '• 61-90 días: 5\n' +
            '• 90+ días: 2\n' +
            'Saldo total en mora: $47M (33% de cartera)',
        },
      ],
    },
    {
      nombre: 'Renovaciones',
      preguntas: [
        {
          pregunta: '¿Quién es elegible para renovación?',
          sinonimos: ['renovacion elegible', 'quien renueva', 'candidatos renovacion'],
          respuesta:
            'Clientes elegibles para renovación: 87\n' +
            'Criterios cumplidos:\n' +
            '• 50%+ del préstamo pagado\n' +
            '• Sin mora en los últimos 6 meses\n' +
            '• Al día en el último pago\n' +
            '¿Quieres la lista con sus cupos pre-aprobados?',
        },
        {
          pregunta: '¿Cuánto se le puede renovar a Pérez?',
          sinonimos: ['renovar perez', 'cupo renovacion', 'monto renovacion'],
          respuesta:
            'Para Pérez, Carlos:\n' +
            '• Préstamo actual: $1.500.000 (saldo $720K)\n' +
            '• Historial: excelente, 0 días mora\n' +
            '• Cupo renovación: $1.500.000 adicional\n' +
            '• Tasa: 1.3% mensual (mejoró 0.1% por buen pago)\n' +
            '¿Le envío la oferta?',
        },
        {
          pregunta: 'Enviar oferta de renovación masiva',
          sinonimos: ['oferta masiva', 'campana renovacion', 'enviar renovaciones', 'masivo renovacion'],
          respuesta:
            'Campaña de renovación armada para 87 clientes:\n' +
            '• Canal: WhatsApp + email\n' +
            '• Plantilla: "Oferta exclusiva de renovación"\n' +
            '• Monto total ofertado: $108M\n' +
            '• Tasa promedio: 1.4%\n' +
            '• Conversión esperada: 35%\n' +
            '¿Confirmo el envío?',
        },
        {
          pregunta: '¿Cuántas renovaciones se han hecho este mes?',
          sinonimos: ['renovaciones mes', 'cuantas renovaciones', 'renovaciones mensuales'],
          respuesta:
            'Renovaciones del mes: 23\n' +
            '• Monto total: $34.5M\n' +
            '• Ticket promedio: $1.5M\n' +
            '• Tasa promedio: 1.4%\n' +
            '• Tasa conversión: 26% (de 87 elegibles)\n' +
            'Comparado mes anterior: +12%.',
        },
        {
          pregunta: '¿Puedo mejorar la tasa en renovación?',
          sinonimos: ['mejorar tasa renovacion', 'bajar tasa', 'oferta mejor tasa'],
          respuesta:
            'Para mejorar la tasa en renovación:\n' +
            '• 12 meses sin mora: -0.1%\n' +
            '• 24 meses sin mora: -0.2%\n' +
            '• Aumento de ingreso comprobable: -0.1%\n' +
            '• Adiciona codeudor: -0.1%\n' +
            '• Acortar plazo 50%: -0.2%\n' +
            'Cliente con 24 meses impecable puede pasar de 1.5% a 1.0%.',
        },
        {
          pregunta: 'Renovar con ampliación de monto',
          sinonimos: ['ampliar monto', 'renovar mas', 'ampliacion cupo', 'mas plata'],
          respuesta:
            'Para ampliar monto en renovación:\n' +
            '• Se cancela préstamo actual (con saldo)\n' +
            '• Se desembolsa nuevo préstamo = saldo + ampliación\n' +
            '• Cliente recibe solo la ampliación\n' +
            '• Condición: capacidad de pago lo permita\n' +
            'Ejemplo: saldo $720K + nuevo $1.5M → recibe $780K',
        },
        {
          pregunta: 'Cliente rechazó la renovación',
          sinonimos: ['rechazo renovacion', 'no acepto', 'no renuevo', 'no quiere renovar'],
          respuesta:
            'Si el cliente rechaza la renovación:\n' +
            '1. Preguntar motivo (tasa, plazo, no necesita)\n' +
            '2. Si es tasa: contraoferta con codeudor\n' +
            '3. Si es plazo: ajustar a mayor plazo\n' +
            '4. Registrar motivo para análisis\n' +
            '5. Reintentar en 60 días\n' +
            '¿Tienes el motivo del rechazo?',
        },
      ],
    },
    {
      nombre: 'Reportes de Cartera',
      preguntas: [
        {
          pregunta: '¿Cómo va la cartera del mes?',
          sinonimos: ['cartera mes', 'estado cartera', 'panorama mensual', 'como va cartera'],
          respuesta:
            'Cartera del mes:\n' +
            '• Total desembolsado: $42.8M (34 créditos)\n' +
            '• Total recaudado: $48.5M\n' +
            '• Saldo activo: $145M\n' +
            '• Mora: 33% (-5pp MoM)\n' +
            '• Castigos: $1.8M\n' +
            'Crecimiento neto: +4%.',
        },
        {
          pregunta: 'Reporte de nuevos desembolsos',
          sinonimos: ['nuevos desembolsos', 'reporte desembolsos', 'altas credito'],
          respuesta:
            'Nuevos desembolsos del mes: 34\n' +
            '• Monto: $42.8M\n' +
            '• Ticket promedio: $1.26M\n' +
            '• Plazo promedio: 14 meses\n' +
            '• Tasa promedio: 1.4%\n' +
            '• Por canal: 60% web, 30% WhatsApp, 10% oficina',
        },
        {
          pregunta: 'Proyección de cartera',
          sinonimos: ['proyeccion cartera', 'forecast cartera', 'estimacion cartera'],
          respuesta:
            'Proyección próximos 3 meses:\n' +
            '• Mes +1: $152M (renovaciones +10%, mora 30%)\n' +
            '• Mes +2: $158M (mora 28%)\n' +
            '• Mes +3: $165M (mora 25% meta)\n' +
            '• Recaudo proyectado: $150M trimestre\n' +
            '• Utilidad estimada: $14M',
        },
        {
          pregunta: 'Reporte por segmento de cliente',
          sinonimos: ['segmento cliente', 'reporte segmentado', 'por tipo cliente'],
          respuesta:
            'Cartera por segmento:\n' +
            '• Empleados: 65% ($94M)\n' +
            '• Independientes: 22% ($32M)\n' +
            '• Pensionados: 8% ($12M)\n' +
            '• Otros: 5% ($7M)\n' +
            'Mora por segmento:\n' +
            '• Empleados: 28%\n' +
            '• Independientes: 41%\n' +
            '• Pensionados: 18% (mejor)',
        },
        {
          pregunta: 'Reporte de rentabilidad',
          sinonimos: ['rentabilidad', 'roi creditos', 'margen cartera'],
          respuesta:
            'Rentabilidad cartera (últimos 12 meses):\n' +
            '• Ingresos por intereses: $28.5M\n' +
            '• Costo fondeo: $4.2M\n' +
            '• Gasto operativo: $6.8M\n' +
            '• Castigos: $7.5M\n' +
            '• Utilidad neta: $10M\n' +
            '• ROA cartera: 6.9%\n' +
            '• ROE: 18.2%',
        },
        {
          pregunta: 'Comparativa con el sector',
          sinonimos: ['comparativa sector', 'benchmark', 'vs competencia', 'indicadores sector'],
          respuesta:
            'Comparativa con sector microcrédito Colombia:\n' +
            '• Tu tasa promedio: 1.4% mensual vs sector 1.7%\n' +
            '• Tu mora: 33% vs sector 28%\n' +
            '• Tu castigo: 1.2% vs sector 1.8%\n' +
            '• Tu rentabilidad: 6.9% vs sector 5.5%\n' +
            'Conclusión: más rentable pero con mora a mejorar.',
        },
        {
          pregunta: '¿Cuál es el rendimiento por gestor?',
          sinonimos: ['rendimiento gestor', 'por gestor', 'productividad', 'comisiones gestor'],
          respuesta:
            'Rendimiento por gestor (mes):\n' +
            '1. Ana: $14M colocados, 95% cumplimiento\n' +
            '2. Carlos: $12M colocados, 88%\n' +
            '3. Laura: $9.5M, 81%\n' +
            '4. Pedro: $7.2M, 73%\n' +
            'Comisión total pagada: $4.3M (3% del colocado)',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'No hay solicitudes nuevas',
          sinonimos: ['sin solicitudes', 'no hay nuevas', 'dia sin altas', 'cola vacia'],
          respuesta:
            'No hay solicitudes nuevas hoy. Posibles causas:\n' +
            '• Día no hábil\n' +
            '• Baja temporada\n' +
            '• Problema con el formulario web\n' +
            'Recomendación: revisar tráfico web y campaña de marketing. ¿Quieres proponer una campaña?',
        },
        {
          pregunta: 'Cliente con score muy bajo',
          sinonimos: ['score bajo', 'cliente riesgoso', 'perfil alto riesgo', 'malo historial'],
          respuesta:
            'Cliente con score bajo (<550):\n' +
            'Opciones:\n' +
            '• Rechazo directo (riesgo muy alto)\n' +
            '• Préstamo con codeudor sólido\n' +
            '• Préstamo con garantía real\n' +
            '• Microcrédito $300K máximo, tasa 2%\n' +
            '• Programa de reconstrucción crediticia\n' +
            '¿Qué aplica?',
        },
        {
          pregunta: 'Solicitud duplicada',
          sinonimos: ['solicitud duplicada', 'doble solicitud', 'repetida'],
          respuesta:
            'Si detecto solicitud duplicada:\n' +
            '1. Identifico la más reciente\n' +
            '2. Cancelo la anterior\n' +
            '3. Notifico al cliente\n' +
            '4. Continúo el proceso con la vigente\n' +
            'Indícame las solicitudes para revisar.',
        },
        {
          pregunta: 'Cliente mintió en información',
          sinonimos: ['mintio', 'informacion falsa', 'fraude solicitud', 'datos inconsistentes'],
          respuesta:
            'Si el cliente mintió en información:\n' +
            '1. Detener el proceso inmediatamente\n' +
            '2. Reportar a Datacrédito como "alerta fraude"\n' +
            '3. Bloquear en sistema (no nuevas solicitudes)\n' +
            '4. Si ya desembolsado: escalar a jurídico\n' +
            '5. Reportar a la Fiscalía si corresponde',
        },
        {
          pregunta: 'Cliente falleció con saldo pendiente',
          sinonimos: ['fallecido saldo', 'muerte con deuda', 'fallecimiento prestamo'],
          respuesta:
            'Procedimiento por fallecimiento con saldo:\n' +
            '1. Solicitar registro civil de defunción\n' +
            '2. Cobrar al codeudor (si existe)\n' +
            '3. Si no: reclamar a herederos vía sucesión\n' +
            '4. Si sin herederos: castigo contable\n' +
            '5. Reportar defunción a Datacrédito\n' +
            'Tiempo máximo proceso: 12 meses',
        },
        {
          pregunta: 'Error en el desembolso',
          sinonimos: ['error desembolso', 'monto equivocado', 'cuenta errada'],
          respuesta:
            'Si hubo error en desembolso:\n' +
            '1. Detener transacción inmediatamente\n' +
            '2. Contactar banco para reversión\n' +
            '3. Reembolsar si fue de más\n' +
            '4. Comunicar al cliente\n' +
            '5. Ajustar el préstamo en sistema\n' +
            'Indícame el caso y lo escalo urgente.',
        },
        {
          pregunta: '¿Cómo cambio el monto aprobado?',
          sinonimos: ['cambiar monto', 'modificar aprobacion', 'ajustar cupo', 'revisar monto'],
          respuesta:
            'Cambiar monto aprobado requiere:\n' +
            '1. Reevaluación de capacidad de pago\n' +
            '2. Aprobación de comité (si sube >20%)\n' +
            '3. Nueva firma de contrato\n' +
            '4. Notificación al cliente\n' +
            'Indícame el caso y el motivo del cambio.',
        },
      ],
    },
    {
      nombre: 'Análisis Avanzado de Crédito',
      preguntas: [
        {
          pregunta: '¿Cómo se calcula el score interno?',
          sinonimos: ['score interno', 'como se calcula score', 'modelo scoring', 'algoritmo score'],
          respuesta:
            'Score interno Jsadr (0-1000):\n• Historial pago Jsadr: 35%\n• Capacidad de pago: 25%\n• Buró externo: 20%\n• Estabilidad laboral: 10%\n• Antigüedad como cliente: 5%\n• Demografía: 5%\nRecalculado mensualmente. Clientes sin historial usan modelo alternativo.',
        },
        {
          pregunta: 'Análisis de capacidad de pago',
          sinonimos: ['capacidad pago', 'analisis capacidad', 'flujo disponible', 'ratio endeudamiento'],
          respuesta:
            'Capacidad de pago del cliente:\n• Ingreso neto: $3.500.000\n• Gastos básicos (50%): $1.750.000\n• Deudas actuales: $400.000\n• Disponible: $1.350.000\n• Máx. cuota nueva (30%): $1.050.000\n¿Aprueba préstamo? Sí, hasta cuota $1.05M.',
        },
        {
          pregunta: 'Verificación de ingresos',
          sinonimos: ['verificar ingresos', 'validar ingresos', 'comprobar', 'fuente ingresos'],
          respuesta:
            'Verificación de ingresos:\n1. Empleado: certificado laboral + desprendibles 2 meses\n2. Independiente: extractos bancarios 3 meses + declaración renta\n3. Comerciante: registro cámara comercio + extractos\n4. Cruzar con base datos (RIT, planilla)\n5. Llamada confirmación empleador\nFraude detectado en 3-5% de casos.',
        },
        {
          pregunta: 'Cruzar con buró externo',
          sinonimos: ['buro externo', 'datacredito cifin', 'central riesgo', 'historial externo'],
          respuesta:
            'Cruce con buró:\n• Datacrédito: reporte principal\n• CIFIN: reporte secundario\n• Verifica: cuentas activas, mora, consultas recientes\n• Score externo: 650+ aprobado\n• Alertas: más de 3 consultas en 30 días\n• Cruzar con declaración cliente\n¿Hago la consulta para un caso?',
        },
        {
          pregunta: 'Indicadores de fraude',
          sinonimos: ['indicadores fraude', 'red flags', 'alerta fraude', 'sintomas'],
          respuesta:
            'Red flags de fraude:\n• Inconsistencias en documentos\n• Múltiples solicitudes simultáneas\n• Teléfono/empleador sin verificar\n• Ingresos no proporcionales al estilo\n• Cédula con datos alterados\n• Selfie vs cédula: rostro no coincide\n• Mismo IP múltiples solicitudes\n¿Tienes un caso sospechoso?',
        },
        {
          pregunta: 'Estrategias de pricing',
          sinonimos: ['pricing', 'estrategia tasa', 'tarifa dinamica', 'tasa optimizada'],
          respuesta:
            'Estrategia pricing Jsadr:\n• Score-based: tasa según riesgo (1.2-1.9%)\n• Volume-based: descuento por monto\n• Loyalty-based: -0.2% por segunda+ operación\n• Channel-based: -0.1% si es 100% digital\n• Seasonal: promociones temporada baja\nMeta: margen 18% manteniendo conversión 45%.\n¿Ajustamos tasas?',
        },
        {
          pregunta: 'Segmentación de clientes',
          sinonimos: ['segmentacion clientes', 'tipos cliente', 'clusters', 'perfilamiento'],
          respuesta:
            'Segmentos Jsadr:\n• Premium (5%): score 800+, ingresos $5M+\n• Estándar (60%): score 650-799\n• Crecimiento (25%): score 550-649\n• Riesgoso (10%): score <550\nEstrategia por segmento: Premium (VIP), Estándar (masivo), Crecimiento (educación financiera), Riesgoso (rechazo/garantía).',
        },
        {
          pregunta: 'Cross-selling',
          sinonimos: ['cross selling', 'venta cruzada', 'oferta adicional', 'complemento'],
          respuesta:
            'Cross-selling por cliente:\n• Cliente con 1 préstamo al día: ofrecer 2do (60% conversión)\n• Score 750+: oferta seguro vida (-10%)\n• Sin ahorro: producto fondo mutuo\n• Empleado con convenio: libranza\n• Cumpleaños: oferta personalizada\nTasa conversión actual: 18%. Meta: 25%.',
        },
        {
          pregunta: 'Modelo de probabilidad de impago',
          sinonimos: ['pd', 'probabilidad impago', 'modelo riesgo', 'pd modelo'],
          respuesta:
            'Modelo PD (Probability of Default):\n• Variables: score, edad, ingresos, mora histórica\n• PD 12 meses por score:\n  - 750+: 2%\n  - 650-749: 8%\n  - 550-649: 18%\n  - <550: 35%\n• LGD (pérdida dado impago): 45%\n• EAD (exposición): saldo al impago\n¿Quieres el cálculo para un cliente?',
        },
      ],
    },
  ],
}

// =====================================================
// 6. JURIDICO — Asesor Jurídico
// =====================================================
const PREGUNTAS_JURIDICO: PreguntasBot = {
  tipoBot: 'JURIDICO',
  nombreBot: 'Asesor Jurídico',
  descripcion: 'Asesor jurídico para procesos prejurídicos, demandas, contratos y cobros jurídicos.',
  categorias: [
    {
      nombre: 'Consultas Legales',
      preguntas: [
        {
          pregunta: '¿Cuándo es viable demandar a un cliente?',
          sinonimos: ['demandar', 'cuando demandar', 'viabilidad demanda', 'iniciar demanda'],
          respuesta:
            'Es viable demandar cuando:\n' +
            '• El cliente lleva 90+ días en mora\n' +
            '• Se agotaron gestiones prejurídicas\n' +
            '• Hay contrato firmado y obligación clara\n' +
            '• Monto justifica costos del proceso\n' +
            '• Hay bienes embargables o ingresos embargables\n' +
            '¿Tienes un caso específico?',
        },
        {
          pregunta: '¿Cuánto cuesta un proceso judicial?',
          sinonimos: ['costo demanda', 'cuanto cobra abogado', 'gastos judiciales', 'honorarios'],
          respuesta:
            'Costo aproximado proceso ejecutivo:\n' +
            '• Honorarios abogado: 10-15% del recuperado\n' +
            '• Agotamiento de vía: $80.000\n' +
            '• Demandas y notificaciones: $200.000\n' +
            '• Avalúos y peritajes: $300.000-500.000\n' +
            '• Total: $580K-780K + honorarios\n' +
            'Se justifica con deuda >$2M.',
        },
        {
          pregunta: '¿Cuánto demora un proceso judicial?',
          sinonimos: ['demora proceso', 'cuanto dura', 'tiempo juicio', 'duracion'],
          respuesta:
            'Duración estimada por tipo:\n' +
            '• Proceso ejecutivo (más rápido): 12-18 meses\n' +
            '• Proceso monitorio: 8-12 meses\n' +
            '• Mandamiento de pago: 10-15 meses\n' +
            '• Cobro persuasivo (prejurídico): 1-3 meses\n' +
            'Factores: congestión juzgado, defensa del deudor.',
        },
        {
          pregunta: '¿Qué pasa si el cliente no tiene bienes?',
          sinonimos: ['sin bienes', 'no tiene con que pagar', 'insolvente', 'sin embargo'],
          respuesta:
            'Si el cliente es insolvente:\n' +
            '• El proceso se prolonga sin recuperación inmediata\n' +
            '• Se puede obtener "sentencia a perseverar"\n' +
            '• Se inscribe en BPM (Búsqueda de Patrimonios)\n' +
            '• Si mejora situación económica: cobro inmediato\n' +
            '• Vigencia de la sentencia: 10 años\n' +
            'En algunos casos conviene castigar.',
        },
        {
          pregunta: '¿Cuál es la jurisdicción competente?',
          sinonimos: ['jurisdiccion', 'competencia', 'juez competente', 'donde demandar'],
          respuesta:
            'Jurisdicción competente para cobros:\n' +
            '• Proceso ejecutivo: Juez Civil Municipal (cuantía <150 SMMLV) o Circuit (mayor)\n' +
            '• Competencia: domicilio del demandado\n' +
            '• Si hay cláusula contractual: se respeta\n' +
            '• Para pequeña cuantía: también notario puede conciliar\n' +
            '¿Tienes contrato para revisar cláusulas?',
        },
        {
          pregunta: '¿Puedo embargar el salario?',
          sinonimos: ['embargo salario', 'embargo nomina', 'retencion judicial', 'descuento'],
          respuesta:
            'Embargo de salario:\n' +
            '• Sí es posible, con límites legales\n' +
            '• Mínimo inembargable: 1 SMMLV mensual\n' +
            '• Exceso hasta 5 SMMLV: 30% embargable\n' +
            '• Exceso entre 5-10 SMMLV: 50%\n' +
            '• Exceso >10 SMMLV: 70%\n' +
            '• Pensión y cesantías: reglas especiales',
        },
        {
          pregunta: '¿Cómo se calculan los intereses moratorios?',
          sinonimos: ['intereses moratorios', 'tasa mora', 'recargo', 'interes legal'],
          respuesta:
            'Intereses moratorios:\n' +
            '• Lo pactado en contrato (máx. 1.5x interés bancario corriente)\n' +
            '• Si no pactado: interés legal (6% anual + moratorio)\n' +
            '• Cálculo: diario sobre saldo vencido\n' +
            '• Tope legal: 1.5x interés bancario (Suprema Corte)\n' +
            '• Capitalización: solo si pactado\n' +
            'Verifica tu contrato.',
        },
      ],
    },
    {
      nombre: 'Procesos Prejurídicos',
      preguntas: [
        {
          pregunta: 'Iniciar proceso prejurídico',
          sinonimos: ['iniciar prejuridico', 'gestion previa', 'aviso prejuridico', 'antes de demanda'],
          respuesta:
            'Para iniciar proceso prejurídico necesito:\n' +
            '• Cliente y código de préstamo\n' +
            '• Días de mora (debe ser >30)\n' +
            '• Historial de gestiones previas\n' +
            'Proceso:\n' +
            '1. Carta formal de cobro\n' +
            '2. Llamada con testigo\n' +
            '3. Visita domiciliaria\n' +
            '4. Última carta (preaviso jurídico)\n' +
            '5. Si no responde: paso a jurídico',
        },
        {
          pregunta: 'Generar carta de cobro prejurídico',
          sinonimos: ['carta cobro', 'generar carta', 'carta formal', 'requerimiento'],
          respuesta:
            'Carta prejurídica lista ✅\n' +
            '• Cliente: [nombre]\n' +
            '• Saldo: $XXX\n' +
            '• Días mora: XX\n' +
            '• Plazo para pagar: 8 días\n' +
            '• Aviso: si no paga, se inicia demanda\n' +
            '¿La envío por correo certificado y WhatsApp?',
        },
        {
          pregunta: '¿Cuántos prejurídicos hay activos?',
          sinonimos: ['prejuridicos activos', 'cuantos prejuridicos', 'lista prejuridico'],
          respuesta:
            'Procesos prejurídicos activos: 14\n' +
            '• Etapa 1 (carta inicial): 6\n' +
            '• Etapa 2 (seguimiento): 5\n' +
            '• Etapa 3 (última carta): 3\n' +
            'Promedio días en proceso: 22 días\n' +
            'Tasa de recuperación: 42%',
        },
        {
          pregunta: 'Agotamiento de vía previa',
          sinonimos: ['agotamiento via', 'via previa', 'requisito demanda', 'cumplimiento'],
          respuesta:
            'Agotamiento de vía previa:\n' +
            'Requisitos antes de demandar:\n' +
            '1. Carta formal de cobro (8 días)\n' +
            '2. Llamada con testigo\n' +
            '3. Visita domiciliaria con acta\n' +
            '4. Última carta (15 días)\n' +
            '5. Constancia de no pago\n' +
            'Sin esto, el juez rechaza la demanda.',
        },
        {
          pregunta: 'Conciliación prejurídica',
          sinonimos: ['conciliacion', 'acuerdo prejuridico', 'centro conciliacion', 'acuerdo'],
          respuesta:
            'Conciliación prejurídica:\n' +
            '• Se cita al cliente a centro de conciliación\n' +
            '• Asiste abogado de Jsadr\n' +
            '• Se acuerda plan de pago\n' +
            '• Acta conciliatoria = título ejecutivo\n' +
            '• Si incumple: proceso ejecutivo inmediato\n' +
            'Costo: $50.000 (asume el cliente)',
        },
        {
          pregunta: 'Mediación con codeudor',
          sinonimos: ['mediacion codeudor', 'cobrar codeudor', 'solidario', 'aval'],
          respuesta:
            'Mediación con codeudor:\n' +
            '• Codeudor es solidario: cobrable directamente\n' +
            '• Se notifica y requiere pago\n' +
            '• Si no paga: demanda simultánea a ambos\n' +
            '• Estrategia: presión a codeudor suele funcionar\n' +
            '• Codeudor luego cobra al deudor principal\n' +
            '¿Tienes el código del préstamo?',
        },
        {
          pregunta: 'Cerrar proceso prejurídico',
          sinonimos: ['cerrar prejuridico', 'terminar proceso', 'finalizar', 'pago recibido'],
          respuesta:
            'Para cerrar proceso prejurídico necesito:\n' +
            '• Confirmación de pago total (o acuerdo firmado)\n' +
            '• Cuenta de cobro cancelada\n' +
            '• Cierre formal en sistema\n' +
            '• Generación de paz y salvo\n' +
            '• Notificación al cliente\n' +
            '¿Procedo con el cierre?',
        },
      ],
    },
    {
      nombre: 'Demandas y Cobros Jurídicos',
      preguntas: [
        {
          pregunta: 'Iniciar demanda ejecutiva',
          sinonimos: ['demanda ejecutiva', 'iniciar demanda', 'proceso ejecutivo', 'mandamiento'],
          respuesta:
            'Para iniciar demanda ejecutiva necesito:\n' +
            '1. Título ejecutivo (contrato + paz y salvo pendiente)\n' +
            '2. Agotamiento de vía previa\n' +
            '3. Documentos: cédula deudor, contrato, estado de cuenta\n' +
            '4. Poder a abogado\n' +
            '5. Pago de agencias judiciales\n' +
            'Te genero el documento de inicio. ¿Procedo?',
        },
        {
          pregunta: '¿Cuántas demandas activas hay?',
          sinonimos: ['demandas activas', 'procesos judiciales', 'cuantas demandas'],
          respuesta:
            'Demandas activas: 9\n' +
            '• Ejecutivas: 6\n' +
            '• Monitorias: 2\n' +
            '• Otros: 1\n' +
            'Distribución:\n' +
            '• Juzgados Bogotá: 5\n' +
            '• Juzgados Medellín: 3\n' +
            '• Juzgados Cali: 1\n' +
            'Valor total: $14.5M',
        },
        {
          pregunta: 'Estado de una demanda específica',
          sinonimos: ['estado demanda', 'como va juicio', 'avance proceso', 'radicado'],
          respuesta:
            'Para ver el estado de una demanda necesito:\n' +
            '• Radicado del proceso, o\n' +
            '• Nombre del demandado\n' +
            'Te muestro: juzgado, última actuación, próxima audiencia, valor demandado, recuperado hasta ahora.',
        },
        {
          pregunta: 'Medidas cautelares',
          sinonimos: ['medidas cautelares', 'embargo preventivo', 'secuestro', 'cautelares'],
          respuesta:
            'Medidas cautelares disponibles:\n' +
            '• Embargo preventivo de cuentas bancarias\n' +
            '• Embargo y secuestro de bienes\n' +
            '• Inscripción en/oficio a registraduría\n' +
            '• Retención de sumas a terceros\n' +
            'Requisitos: demanda admitida + caución (10-20% del valor)\n' +
            'Suelen recuperar el 60% de la deuda.',
        },
        {
          pregunta: 'Embargo de cuenta bancaria',
          sinonimos: ['embargo cuenta', 'cuenta bancaria', 'retencion', 'banco embargo'],
          respuesta:
            'Embargo de cuenta bancaria:\n' +
            '1. Solicitamos al juez oficio a Superfinanciera\n' +
            '2. Superfinanciera reporta cuentas del deudor\n' +
            '3. Juez ordena embargo a bancos\n' +
            '4. Bancos retienen saldos\n' +
            '5. Si saldo < deuda: seguimos buscando\n' +
            'Tiempo: 4-8 semanas desde solicitud.',
        },
        {
          pregunta: 'Embargo de inmueble',
          sinonimos: ['embargo inmueble', 'casa', 'apartamento', 'bien inmueble', 'secuestro'],
          respuesta:
            'Embargo y secuestro de inmueble:\n' +
            '1. Verificamos titularidad en ORIP\n' +
            '2. Solicitamos al juez medida cautelar\n' +
            '3. Inscripción en ORIP (publicidad)\n' +
            '4. Secuestro del bien (no puede vender)\n' +
            '5. Avalúo comercial\n' +
            '6. Subasta pública (10 meses aprox.)\n' +
            'Cuidado: inmueble con hipoteca queda último.',
        },
        {
          pregunta: 'Demandas que se van a perder',
          sinonimos: ['demandas perdidas', 'procesos sin exito', 'improcedente', 'sin viabilidad'],
          respuesta:
            'Demandas en riesgo de pérdida:\n' +
            '• 2 casos por prescripción (3 años cobro)\n' +
            '• 1 caso con contrato defectuoso\n' +
            '• 1 caso con deudor fallecido sin herederos\n' +
            'Acción recomendada: desistimiento estratégico en los 4 casos para no perder más costos.\n' +
            '¿Genero los desistimientos?',
        },
      ],
    },
    {
      nombre: 'Contratos',
      preguntas: [
        {
          pregunta: 'Generar contrato de préstamo',
          sinonimos: ['contrato prestamo', 'generar contrato', 'nuevo contrato', 'pagare'],
          respuesta:
            'Para generar contrato de préstamo necesito:\n' +
            '• Datos del deudor (cédula, dirección, teléfono)\n' +
            '• Datos del codeudor (si aplica)\n' +
            '• Monto, plazo, tasa, frecuencia\n' +
            '• Cláusulas especiales\n' +
            'Te genero pagaré + contrato + autorizaciones. ¿Procedo?',
        },
        {
          pregunta: 'Revisar cláusulas de un contrato',
          sinonimos: ['revisar contrato', 'clausulas', 'analizar contrato', 'validar contrato'],
          respuesta:
            'Para revisar cláusulas necesito el contrato. Verifico:\n' +
            '• Tasas e intereses (legalidad)\n' +
            '• Plazos y condiciones\n' +
            '• Cláusulas de mora\n' +
            '• Jurisdicción y competencia\n' +
            '• Cláusulas abusivas (Ley 1480)\n' +
            'Pega el texto o adjunta el archivo.',
        },
        {
          pregunta: '¿Qué cláusulas son obligatorias?',
          sinonimos: ['clausulas obligatorias', 'requisitos legales', 'minimo legal', 'que debe tener'],
          respuesta:
            'Cláusulas obligatorias en contrato de préstamo:\n' +
            '• Partes identificadas (deudor, codeudor, acreedor)\n' +
            '• Monto en moneda legal\n' +
            '• Tasa de interés (no exceder máximo legal)\n' +
            '• Plazo y frecuencia\n' +
            '• Lugar de pago\n' +
            '• Causales de mora y sus efectos\n' +
            '• Jurisdicción (cláusula compromisoria opcional)\n' +
            '• Firmas y huellas',
        },
        {
          pregunta: 'Adicionar codeudor a contrato',
          sinonimos: ['adicionar codeudor', 'agregar fiador', 'nuevo aval', 'modificar contrato'],
          respuesta:
            'Para adicionar codeudor:\n' +
            '1. Otrosí al contrato original\n' +
            '2. Datos completos del codeudor\n' +
            '3. Verificación de identidad y firma\n' +
            '4. Aceptación de obligación solidaria\n' +
            '5. Notificación al deudor principal\n' +
            'Te genero el otrosí. ¿Procedo?',
        },
        {
          pregunta: 'Contrato con garantía real',
          sinonimos: ['garantia real', 'hipoteca', 'prenda', 'respaldo', 'bien en garantia'],
          respuesta:
            'Contrato con garantía real:\n' +
            '• Prenda (vehículo, maquinaria): registro ante CRO\n' +
            '• Hipoteca (inmueble): escritura pública + ORIP\n' +
            '• Valor garantía: 1.3x valor préstamo\n' +
            '• Póliza de seguro obligatoria\n' +
            '• Costos: notaría + registro = ~3% valor\n' +
            'Reduce tasa 0.3-0.5%. ¿Tienes el bien?',
        },
        {
          pregunta: 'Vencer un contrato por incumplimiento',
          sinonimos: ['vencer contrato', 'resolucion', 'incumplimiento', 'terminacion anticipada'],
          respuesta:
            'Resolución por incumplimiento:\n' +
            '1. Requerimiento escrito al deudor (8 días)\n' +
            '2. Si no paga: resolución automática (según cláusula)\n' +
            '3. Saldo total se hace exigible\n' +
            '4. Inicio de cobro jurídico\n' +
            '5. Ejecución de garantías (si las hay)\n' +
            'Verifica la cláusula de aceleración en el contrato.',
        },
        {
          pregunta: 'Contratos por vencer',
          sinonimos: ['contratos por vencer', 'por terminar', 'finalizacion contrato', 'proximos a vencer'],
          respuesta:
            'Contratos próximos a vencer (30 días): 12\n' +
            '• 8 en buen estado de pago (renovable)\n' +
            '• 3 con mora (evaluación)\n' +
            '• 1 con saldo crítico (prejurídico)\n' +
            '¿Genero recordatorios de finalización?',
        },
      ],
    },
    {
      nombre: 'Documentación Legal',
      preguntas: [
        {
          pregunta: 'Generar poder a abogado',
          sinonimos: ['poder abogado', 'mandato', 'poder judicial', 'apoderado'],
          respuesta:
            'Poder judicial listo ✅\n' +
            '• Apoderado: [Nombre abogado]\n' +
            '• TP: [número]\n' +
            '• Facultades: cobrar, demandar, conciliar\n' +
            '• Vigencia: indeterminada\n' +
            '¿Lo envío para firma del representante legal?',
        },
        {
          pregunta: 'Generar derecho de petición',
          sinonimos: ['derecho peticion', 'peticion', 'informacion', 'consulta entidad'],
          respuesta:
            'Para generar derecho de petición necesito:\n' +
            '• Entidad destinataria\n' +
            '• Motivo de la petición\n' +
            '• Información solicitada\n' +
            '• Plazo de respuesta (15 días hábiles)\n' +
            'Te redacto el documento en formato formal. ¿Para qué entidad?',
        },
        {
          pregunta: 'Generar paz y salvo',
          sinonimos: ['paz y salvo', 'libranza', 'cancelacion', 'certificacion pago'],
          respuesta:
            'Paz y salvo generado ✅\n' +
            '• Cliente: [nombre]\n' +
            '• Préstamo: [código]\n' +
            '• Saldo cancelado: $0\n' +
            '• Fecha: hoy\n' +
            '• Firma digital del representante legal\n' +
            'Lo envío al cliente por correo certificado.',
        },
        {
          pregunta: 'Acta de conciliación',
          sinonimos: ['acta conciliacion', 'acuerdo conciliatorio', 'centro conciliacion'],
          respuesta:
            'Acta de conciliación lista ✅\n' +
            '• Partes: Jsadr vs. [cliente]\n' +
            '• Centro de conciliación: [nombre]\n' +
            '• Acuerdo: [plan de pago]\n' +
            '• Cuotas: [número]\n' +
            '• Incumplimiento: ejecución inmediata\n' +
            '¿Firmamos digitalmente?',
        },
        {
          pregunta: 'Notificar demanda',
          sinonimos: ['notificar demanda', 'emplazamiento', 'notificacion judicial', 'citacion'],
          respuesta:
            'Notificación de demanda:\n' +
            '1. Juez envía oficio al demandado\n' +
            '2. Si no se ubica: emplazamiento + edicto\n' +
            '3. Publicación en periódico (1 vez)\n' +
            '4. Pasados 15 días: designa curador ad litem\n' +
            '5. Continúa proceso en rebeldía\n' +
            'Costo emplazamiento: $250.000 aprox.',
        },
        {
          pregunta: 'Documentos para demanda',
          sinonimos: ['documentos demanda', 'requisitos demanda', 'anexos', 'soportes'],
          respuesta:
            'Documentos para demanda ejecutiva:\n' +
            '1. Título ejecutivo (pagaré/contrato original)\n' +
            '2. Estado de cuenta actualizado\n' +
            '3. Agotamiento de vía previa\n' +
            '4. Cédula del demandado\n' +
            '5. Poder a abogado\n' +
            '6. Comprobante pago expensas\n' +
            '7. Copias para archivo y contraproductor',
        },
        {
          pregunta: 'Generar tutela',
          sinonimos: ['tutela', 'derecho fundamental', 'accion tutela', 'amparo'],
          respuesta:
            'Tutela se usa para proteger derechos fundamentales, no es vía para cobros. Para casos Jsadr solo aplica cuando:\n' +
            '• Entidad pública vulnera derecho (ej. retención ilegal)\n' +
            '• Negación de información\n' +
            '• Vulneración a consumidor (Ley 1480)\n' +
            'Para cobros usa proceso ejecutivo. ¿Cuál es el caso?',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'Deuda prescribió',
          sinonimos: ['prescripcion', 'prescribio', 'deuda vieja', 'caducidad'],
          respuesta:
            'Prescripción de deuda:\n' +
            '• Acción ejecutiva prescribe en 3 años\n' +
            '• Cobro ordinario en 5 años\n' +
            '• Interrumpe: gestión de cobro debidamente notificada\n' +
            '• Si prescribió: no se puede demandar\n' +
            '• Castigo contable obligatorio\n' +
            'Indícame la antigüedad de la deuda.',
        },
        {
          pregunta: 'Cliente fallecido sin herederos',
          sinonimos: ['sin herederos', 'fallecido solo', 'sucesion vacia', 'sin sucesores'],
          respuesta:
            'Cliente fallecido sin herederos:\n' +
            '1. Verificar códigoudor (cobrar a él)\n' +
            '2. Si no: declarar vacancia herencial\n' +
            '3. Proceso sucesoral en juzgado (12 meses)\n' +
            '4. Si imposible: castigo contable\n' +
            '5. Reporte a Datacrédito como fallecido\n' +
            'Recuperación esperada: 0-30% según caso.',
        },
        {
          pregunta: 'Demanda rechazada',
          sinonimos: ['rechazada demanda', 'inadmisible', 'no admitida', 'subsana'],
          respuesta:
            'Si demanda es rechazada:\n' +
            '1. Verificar motivo (defecto forma, falta documentos)\n' +
            '2. Subsanar en 5 días\n' +
            '3. Re-presentar\n' +
            '4. Si vuelve a rechazar: apelación\n' +
            'Causales comunes: título defectuoso, incompetencia, falta de agotamiento de vía previa',
        },
        {
          pregunta: 'Sentencia adversa',
          sinonimos: ['sentencia adversa', 'perdimos', 'falla en contra', 'rechazada'],
          respuesta:
            'Ante sentencia adversa:\n' +
            '1. Recurso de reposición (3 días)\n' +
            '2. Recurso de apelación (5 días)\n' +
            '3. Si confirmada: casación (Suprema Corte)\n' +
            '4. Costas asumidas por Jsadr\n' +
            '5. Castigo contable de la deuda\n' +
            'Tiempo total apelación: 6-12 meses adicionales.',
        },
        {
          pregunta: 'Cliente se declara insolvente',
          sinonimos: ['insolvencia', 'concordato', 'reestructuracion', 'ley 1116'],
          respuesta:
            'Cliente en insolvencia (Ley 1380/2010):\n' +
            '1. Inscripción en CRC como acreedor\n' +
            '2. Aportar título y saldo\n' +
            '3. Negociación con árbitro\n' +
            '4. Acuerdo de pago (5-10 años)\n' +
            '5. Si no acuerdo: liquidación judicial\n' +
            'Recuperación esperada: 20-50% del saldo.',
        },
        {
          pregunta: 'Demanda con fuero',
          sinonimos: ['fuero', 'juez especial', 'fuero constitucional', 'competencia especial'],
          respuesta:
            'Si demandado tiene fuero:\n' +
            '• Congresista: Corte Suprema\n' +
            '• Magistrado: Consejo Superior\n' +
            '• Otros funcionarios: según caso\n' +
            '• Afecta jurisdicción y tiempo del proceso\n' +
            'Indícame el cargo del demandado.',
        },
        {
          pregunta: 'Apelación de sentencia',
          sinonimos: ['apelacion', 'recurrir', 'segunda instancia', 'impugnar'],
          respuesta:
            'Apelación de sentencia:\n' +
            '1. Interponer en 5 días hábiles\n' +
            '2. Sustentación en 10 días\n' +
            '3. Adhesión si contraproductor también apela\n' +
            '4. Segunda instancia: 6-12 meses\n' +
            '5. Posibilidad de casación (no siempre)\n' +
            'Costo: $1.5-2M adicional al proceso.',
        },
      ],
    },
    {
      nombre: 'Marco Legal Específico',
      preguntas: [
        {
          pregunta: 'Estatuto del Consumidor',
          sinonimos: ['estatuto consumidor', 'ley 1480', 'derechos consumidor', 'proteccion consumidor'],
          respuesta:
            'Ley 1480 de 2011 (Estatuto del Consumidor):\n• Protege a consumidores en relaciones de consumo\n• Cláusulas abusivas: nulas de pleno derecho\n• Derecho a información clara y veraz\n• Garantías mínimas en productos financieros\n• PQR: respuesta en 15 días hábiles\n• Sanciones: hasta 2000 SMMLV\nJsadr cumple y monitorea cambios.',
        },
        {
          pregunta: 'Código de Comercio aplicable',
          sinonimos: ['codigo comercio', 'comercio', 'ley 510', 'comerciante'],
          respuesta:
            'Código de Comercio relevante:\n• Art 871-883: mutuo (préstamo)\n• Art 1169-1234: pagaré\n• Art 1182: prescripción 3 años\n• Art 824-873: contratos comerciales\n• Art 1264-1291: intereses (no usura)\nJsadr opera bajo código comercio por ser sociedad comercial.',
        },
        {
          pregunta: 'Ley 1380 de insolvencia',
          sinonimos: ['ley 1380', 'insolvencia', 'restructuracion deudas', 'persona natural'],
          respuesta:
            'Ley 1380 de 2010 (insolvencia persona natural):\n• Aplica a deudas de consumo\n• Acuerdo de pago con acreedores\n• Vivienda única: protegida\n• Mínimo vital: inembargable\n• Quórum: 50% acreedores\n• Plazo: 5 años máximo\n• Si no acuerdo: liquidación de patrimonio\n¿Tienes cliente en este proceso?',
        },
        {
          pregunta: 'Jurisprudencia Corte Suprema cobros',
          sinonimos: ['jurisprudencia corte', 'corte suprema', 'precedente', 'sentencia cobro'],
          respuesta:
            'Jurisprencia relevante (Corte Suprema):\n• Sentencia SC 4520-2017: intereses moratorios no pueden exceder 1.5x bancario corriente\n• Sentencia SC 28056-2017: cláusula de aceleración válida si fue pactada\n• Sentencia C-855-2017: capitalización de intereses requiere pacto expreso\n• Sentencia SC 12345-2020: contrato electrónico válido si hay consentimiento\n¿Reviso un caso específico?',
        },
        {
          pregunta: 'Títulos valores y pagaré',
          sinonimos: ['titulos valores', 'pagare', 'letra cambio', 'cheque'],
          respuesta:
            'Títulos valores relevantes:\n• Pagaré (Ley 1231 de 2008): requisitos: sumas, fecha, firma\n• Letra de cambio: menos usada en Jsadr\n• Cheque: en cobranza judicial\n• Bonos: solo empresas\nPagaré es nuestro título principal. Requisitos formales estrictos. Pagaré sin firma = no ejecutivo.',
        },
        {
          pregunta: 'Formalidades del pagaré',
          sinonimos: ['formalidades pagare', 'requisitos pagare', 'validez pagare'],
          respuesta:
            'Formalidades del pagaré (Ley 1231):\n1. Mención "pagaré" en el texto\n2. Suma determinada en moneda legal\n3. Fecha de vencimiento\n4. Lugar de pago\n5. Nombre del beneficiario\n6. Firma del suscriptor\n7. Cédula del suscriptor\nFalta de cualquiera = título no ejecutivo.',
        },
        {
          pregunta: 'Pacto de indemnidad',
          sinonimos: ['indemnidad', 'pacto indemnidad', 'acuerdo proteccion', 'hold harmless'],
          respuesta:
            'Pacto de indemnidad:\n• Cláusula contractual\n• Una parte indemniza a otra por daños/claims\n• Usado con codeudores y proveedores\n• Debe ser clara y específica\n• No cubre dolo o culpa grave\n• Validez: admitida en Colombia (Ley 1530/2012 arbitraje)\n¿Quieres incluirlo en un contrato?',
        },
        {
          pregunta: 'Cláusula penal',
          sinonimos: ['clausula penal', 'multa contractual', 'penalizacion', 'penal'],
          respuesta:
            'Cláusula penal:\n• Establece suma por incumplimiento\n• Tope: 25% del valor del contrato (jurisprudencia)\n• Puede sustituir o acumular a indemnización\n• Requisito: pacto expreso\n• Juez puede moderar si excesiva (equidad)\n• No aplica si obligación se cumple parcialmente\nJsadr usa 10% del saldo en mora.',
        },
        {
          pregunta: 'Tutela en cobros',
          sinonimos: ['tutela cobro', 'accion tutela deudas', 'tutela consumidor', 'amparo financiero'],
          respuesta:
            'Tutela en cobros:\n• Procede si: vulnere derechos fundamentales\n• Casos: cobro con hostigamiento, datos sensibles\n• No procede: simple discrepancia comercial\n• Si prospera: orden cesar conducta + indemnización\n• Jsadr: evitar hostigamiento, capacitación gestores\n• Defensa: demostrar legalidad del cobro',
        },
      ],
    },
  ],
}

// =====================================================
// 7. SEGURIDAD — Ciberseguridad (CISO)
// =====================================================
const PREGUNTAS_SEGURIDAD: PreguntasBot = {
  tipoBot: 'SEGURIDAD',
  nombreBot: 'Ciberseguridad',
  descripcion: 'CISO: monitoreo de amenazas, vulnerabilidades, incidentes y cumplimiento normativo.',
  categorias: [
    {
      nombre: 'Estado de Seguridad',
      preguntas: [
        {
          pregunta: '¿Cómo está la seguridad del sistema?',
          sinonimos: ['estado seguridad', 'como esta seguridad', 'panorama seguridad', 'postura seguridad'],
          respuesta:
            'Estado de seguridad actual:\n' +
            '• Nivel de riesgo: MEDIO (7/10)\n' +
            '• Vulnerabilidades abiertas: 12 (3 críticas)\n' +
            '• Amenazas activas: 0\n' +
            '• Usuarios con MFA: 87%\n' +
            '• Último escaneo: hace 2 horas\n' +
            'Recomendación: resolver las 3 vulnerabilidades críticas hoy.',
        },
        {
          pregunta: '¿Hay alguna amenaza activa?',
          sinonimos: ['amenazas activas', 'ataque', 'incidente', 'alarma', 'algo raro'],
          respuesta:
            'Sin amenazas activas detectadas ✅\n' +
            'Últimas 24 horas:\n' +
            '• Intentos de login bloqueados: 234\n' +
            '• IPs bloqueadas: 12\n' +
            '• Anomalías: 0\n' +
            '• Malware detectado: 0\n' +
            'Sistema bajo monitoreo continuo.',
        },
        {
          pregunta: '¿Qué vulnerabilidades tenemos?',
          sinonimos: ['vulnerabilidades', 'vulns', 'debilidades', 'puntos debiles'],
          respuesta:
            'Vulnerabilidades abiertas: 12\n' +
            '• Críticas: 3 (CVE-2024-XXXX, CVE-2024-XXXX, CVE-2024-XXXX)\n' +
            '• Altas: 4\n' +
            '• Medias: 5\n' +
            '• Bajas: 0\n' +
            'Tiempo promedio resolución: 8 días\n' +
            'Meta: 24h críticas, 7d altas',
        },
        {
          pregunta: '¿Cuándo fue el último escaneo?',
          sinonimos: ['ultimo escaneo', 'scan', 'auditoria reciente', 'penetration test'],
          respuesta:
            'Últimos escaneos:\n' +
            '• Escaneo de vulnerabilidades: hace 2 horas (automático)\n' +
            '• Escaneo profundo: hace 3 días\n' +
            '• Penetration test: hace 45 días\n' +
            '• Auditoría externa: hace 4 meses\n' +
            'Próximo pentest programado: en 15 días.',
        },
        {
          pregunta: '¿Está activo el firewall?',
          sinonimos: ['firewall', 'waf', 'activo', 'estado firewall'],
          respuesta:
            'Firewall activo ✅\n' +
            '• WAF Cloudflare: operativo\n' +
            '• Reglas activas: 87\n' +
            '• Bloqueos última hora: 142 intentos\n' +
            '• Países bloqueados: 5 (sospechosos)\n' +
            '• Última actualización de reglas: ayer',
        },
        {
          pregunta: '¿Quién está conectado ahora?',
          sinonimos: ['conectados', 'sesiones activas', 'usuarios online', 'quien esta adentro'],
          respuesta:
            'Sesiones activas: 23\n' +
            '• 15 sesiones de usuarios internos\n' +
            '• 6 sesiones de bots API\n' +
            '• 2 sesiones sospechosas (en revisión)\n' +
            '¿Quieres forzar cierre de sesión sospechosa?',
        },
        {
          pregunta: 'Score de seguridad',
          sinonimos: ['score', 'puntuacion seguridad', 'security score', 'calificacion'],
          respuesta:
            'Score de seguridad: 78/100 (BUENO)\n' +
            'Desglose:\n' +
            '• Patch management: 85/100\n' +
            '• Access control: 72/100\n' +
            '• Data protection: 80/100\n' +
            '• Monitoring: 75/100\n' +
            '• Incident response: 78/100\n' +
            'Meta: 85+ para fines de año.',
        },
      ],
    },
    {
      nombre: 'Amenazas y Vulnerabilidades',
      preguntas: [
        {
          pregunta: 'Detectar intentos de ataque',
          sinonimos: ['intentos ataque', 'intrusion', 'ataques', 'escaneo malicioso'],
          respuesta:
            'Intentos de ataque últimas 24h: 478\n' +
            '• Fuerza bruta login: 234\n' +
            '• SQL injection: 89\n' +
            '• XSS attempts: 67\n' +
            '• Path traversal: 45\n' +
            '• Otros: 43\n' +
            'Todos bloqueados por WAF y fail2ban.',
        },
        {
          pregunta: '¿Hubo brechas de seguridad?',
          sinonimos: ['brechas', 'data breach', 'filtracion', 'compromiso'],
          respuesta:
            'No hay brechas registradas ✅\n' +
            'Última brecha: nunca (sistema operativo desde 2022)\n' +
            '• DLP (Data Loss Prevention): activo\n' +
            '• Monitoreo exfiltración: 24/7\n' +
            '• Logs enviados a SIEM en tiempo real\n' +
            '• Alertas críticas: SMS + email',
        },
        {
          pregunta: 'Reportar vulnerabilidad nueva',
          sinonimos: ['reportar vuln', 'nueva vulnerabilidad', 'cve', 'zero day'],
          respuesta:
            'Para reportar vulnerabilidad necesito:\n' +
            '• CVE o descripción\n' +
            '• Sistema/componente afectado\n' +
            '• Nivel de severidad (CVSS)\n' +
            '• Vector de ataque\n' +
            '• Prueba de concepto (si existe)\n' +
            'Lo registro y disparo proceso de mitigación.',
        },
        {
          pregunta: '¿Hay malware en el sistema?',
          sinonimos: ['malware', 'virus', 'troyano', 'ransomware', 'infeccion'],
          respuesta:
            'Sin malware detectado ✅\n' +
            '• Antivirus: activo, base actualizada hace 1 hora\n' +
            '• EDR (Endpoint Detection): operativo\n' +
            '• Última revisión completa: hace 6 horas\n' +
            '• Archivos sospechosos en cuarentena: 0\n' +
            'Si sospechas de algo específico, dime el archivo.',
        },
        {
          pregunta: '¿Qué IPs están bloqueadas?',
          sinonimos: ['ips bloqueadas', 'blacklist', 'lista negra', 'baneadas'],
          respuesta:
            'IPs bloqueadas: 47\n' +
            '• Por fuerza bruta: 28\n' +
            '• Por ataques SQL: 12\n' +
            '• Por países sospechosos: 7\n' +
            'Última bloqueada: 187.XXX.XXX.XXX hace 18 min\n' +
            '¿Quieres ver el listado completo?',
        },
        {
          pregunta: 'Phishing reportado',
          sinonimos: ['phishing', 'correo fraudulento', 'estafa email', 'suplantacion'],
          respuesta:
            'Reportes de phishing últimos 7 días: 8\n' +
            '• 5 confirmados como phishing (bloqueados)\n' +
            '• 2 falsos positivos\n' +
            '• 1 en investigación\n' +
            'Acción: capacitación al equipo sugerida. ¿Programo campaña de concientización?',
        },
        {
          pregunta: 'Ataque DDoS',
          sinonimos: ['ddos', 'denegacion servicio', 'saturacion', 'trafico anormal'],
          respuesta:
            'Mitigación DDoS:\n' +
            '• Cloudflare activo (capa 7)\n' +
            '• Último intento: hace 3 días, mitigado\n' +
            '• Capacidad: 10 Gbps\n' +
            '• Picos anómalos: 0 en 30 días\n' +
            'Si detecta pico: escalo a Cloudflare Magic Transit',
        },
      ],
    },
    {
      nombre: 'Auditoría y Logs',
      preguntas: [
        {
          pregunta: 'Ver logs del sistema',
          sinonimos: ['logs', 'auditoria', 'historial', 'registro eventos'],
          respuesta:
            'Para ver logs específicos dime:\n' +
            '• Rango de fechas\n' +
            '• Tipo de evento (login, modificación, acceso datos)\n' +
            '• Usuario o IP\n' +
            '• Nivel (info, warning, error, critical)\n' +
            'Te muestro hasta 1000 eventos con filtros aplicados.',
        },
        {
          pregunta: 'Auditoría de accesos',
          sinonimos: ['auditoria accesos', 'quien ingreso', 'logs login', 'control acceso'],
          respuesta:
            'Auditoría de accesos últimas 24h:\n' +
            '• Login exitosos: 234\n' +
            '• Login fallidos: 89\n' +
            '• Bloqueos por fuerza bruta: 12\n' +
            '• Cambios de contraseña: 4\n' +
            '• Reset de MFA: 2\n' +
            '¿Quieres ver por usuario específico?',
        },
        {
          pregunta: 'Logs de una IP sospechosa',
          sinonimos: ['logs ip', 'ip sospechosa', 'rastrear ip', 'que hizo ip'],
          respuesta:
            'Para rastrear una IP necesito la dirección IP. Te muestro:\n' +
            '• Todos los intentos de acceso\n' +
            '• Recursos solicitados\n' +
            '• Patrones de ataque detectados\n' +
            '• Acciones tomadas (bloqueo, captcha, etc.)\n' +
            'Indícame la IP.',
        },
        {
          pregunta: 'Auditoría de cambios',
          sinonimos: ['cambios', 'modificaciones', 'logs cambios', 'auditoria datos'],
          respuesta:
            'Cambios registrados últimas 24h: 67\n' +
            '• Modificaciones de cliente: 23\n' +
            '• Modificaciones de préstamo: 18\n' +
            '• Cambios de configuración: 5\n' +
            '• Cambios de permisos: 2\n' +
            '• Otros: 19\n' +
            'Todos con trazabilidad (quién, qué, cuándo).',
        },
        {
          pregunta: '¿Quién accedió a datos sensibles?',
          sinonimos: ['datos sensibles', 'quien vio datos', 'acceso informacion', 'pii'],
          respuesta:
            'Accesos a datos sensibles (PII) últimas 24h: 142\n' +
            '• Asesores: 89 accesos (legítimos)\n' +
            '• Administradores: 38 accesos\n' +
            '• Sistema (automático): 15 accesos\n' +
            'Todos registrados con justificación.\n' +
            '¿Quieres ver el detalle por usuario?',
        },
        {
          pregunta: 'Retención de logs',
          sinonimos: ['retencion logs', 'cuanto se guardan', 'politica logs', 'historico'],
          respuesta:
            'Política de retención de logs:\n' +
            '• Logs operacionales: 90 días\n' +
            '• Logs de seguridad: 1 año\n' +
            '• Logs de auditoría financiera: 5 años\n' +
            '• Logs de accesos PII: 2 años\n' +
            'Cumple requisitos Ley 1581 (habeas data) y Circular 029 SFC.',
        },
        {
          pregunta: 'Exportar logs',
          sinonimos: ['exportar logs', 'descargar logs', 'backup logs', 'csv logs'],
          respuesta:
            'Puedo exportar logs en formato:\n' +
            '• JSON (raw)\n' +
            '• CSV (filtrado)\n' +
            '• PDF (reporte ejecutivo)\n' +
            'Para exportar, dime:\n' +
            '• Rango de fechas\n' +
            '• Tipo de log\n' +
            '• Filtros específicos',
        },
      ],
    },
    {
      nombre: 'Incidentes de Seguridad',
      preguntas: [
        {
          pregunta: 'Reportar incidente de seguridad',
          sinonimos: ['reportar incidente', 'incidente seguridad', 'alerta', 'problema seguridad'],
          respuesta:
            'Para reportar incidente necesito:\n' +
            '• Descripción breve\n' +
            '• Severidad estimada (baja/media/alta/crítica)\n' +
            '• Sistema afectado\n' +
            '• Hora aproximada\n' +
            '• Persona que reporta\n' +
            'Lo registro y disparo el play book de respuesta inmediata.',
        },
        {
          pregunta: 'Incidentes abiertos',
          sinonimos: ['incidentes abiertos', 'casos activos', 'tickets seguridad', 'en proceso'],
          respuesta:
            'Incidentes abiertos: 3\n' +
            '• INC-0142 (medio): intento phishing, en investigación\n' +
            '• INC-0143 (bajo): alerta de login anómalo, en revisión\n' +
            '• INC-0144 (medio): política DLP disparada, en análisis\n' +
            'SLA cumplimiento: 100%. ¿Quieres el detalle?',
        },
        {
          pregunta: 'Responder a incidente crítico',
          sinonimos: ['incidente critico', 'respuesta incidente', 'playbook', 'contencion'],
          respuesta:
            'Playbook incidente crítico:\n' +
            '1. Confirmación y activación (5 min)\n' +
            '2. Contención (aislar sistema, 30 min)\n' +
            '3. Erradicación (eliminar amenaza)\n' +
            '4. Recuperación (restaurar servicios)\n' +
            '5. Lecciones aprendidas (post-mortem)\n' +
            '¿Qué incidente estás atendiendo?',
        },
        {
          pregunta: 'Cerré incidente',
          sinonimos: ['cerrar incidente', 'finalizar incidente', 'resuelto', 'post mortem'],
          respuesta:
            'Para cerrar incidente necesito:\n' +
            '• ID del incidente\n' +
            '• Descripción de resolución\n' +
            '• Acciones tomadas\n' +
            '• Lecciones aprendidas\n' +
            '• Reporte post-mortem (si crítico)\n' +
            '¿Cuál incidente cierras?',
        },
        {
          pregunta: 'Tiempo medio de respuesta',
          sinonimos: ['mttr', 'tiempo respuesta', 'sla', 'mttd'],
          respuesta:
            'Métricas de respuesta a incidentes:\n' +
            '• MTTD (detección): 12 minutos (meta 15)\n' +
            '• MTTR (resolución): 4.2 horas (meta 6h)\n' +
            '• Críticos resueltos <24h: 92%\n' +
            '• Tiempo medio contención: 35 min\n' +
            'Cumplimiento SLA: 96% (meta 95%).',
        },
        {
          pregunta: 'Plan de continuidad',
          sinonimos: ['continuidad', 'bcdr', 'disaster recovery', 'plan contingencia'],
          respuesta:
            'Plan de continuidad (BCDR):\n' +
            '• RPO (pérdida máx. datos): 1 hora\n' +
            '• RTO (recuperación): 4 horas\n' +
            '• Backups: cada 1 hora, retención 30 días\n' +
            '• DR site: AWS us-east-1\n' +
            '• Último test DR: hace 60 días\n' +
            'Próximo test: en 30 días.',
        },
        {
          pregunta: 'Tabletop exercise',
          sinonimos: ['tabletop', 'simulacro', 'ejercicio seguridad', 'prueba respuesta'],
          respuesta:
            'Tabletop exercises realizados:\n' +
            '• Último: hace 30 días (escenario ransomware)\n' +
            '• Participantes: 8 (equipo seguridad + gerencia)\n' +
            '• Tiempo respuesta medido: 4h\n' +
            '• Hallazgos: 3 mejoras aplicadas\n' +
            '• Próximo simulacro: en 60 días (phishing)',
        },
      ],
    },
    {
      nombre: 'Cumplimiento y Normativas',
      preguntas: [
        {
          pregunta: '¿Cumplimos con la Ley 1581?',
          sinonimos: ['ley 1581', 'habeas data', 'proteccion datos', 'privacidad'],
          respuesta:
            'Cumplimiento Ley 1581 (habeas data):\n' +
            '✅ Política de privacidad publicada\n' +
            '✅ Autorización de datos (consentimiento)\n' +
            '✅ Registro en SIC como responsable\n' +
            '✅ Encargado de datos designado\n' +
            '✅ Procedimiento de consultas/reclamos\n' +
            '⚠️ Pendiente: auditoría bienal (programada Q4)',
        },
        {
          pregunta: 'Auditoría SOX',
          sinonimos: ['sox', 'auditoria financiera', 'controles internos'],
          respuesta:
            'SOX aplica a empresas públicas en USA. Para Jsadr (privada colombiana):\n' +
            '• No obligatoria\n' +
            '• Pero aplicamos mejores prácticas\n' +
            '• Segregación de funciones: ✅\n' +
            '• Auditoría de cambios: ✅\n' +
            '• Logs financieros: retención 5 años ✅\n' +
            'Si van a salir a bolsa, sería obligatoria.',
        },
        {
          pregunta: 'ISO 27001',
          sinonimos: ['iso 27001', 'certificacion seguridad', 'estandar internacional'],
          respuesta:
            'Estado ISO 27001:\n' +
            '• Implementado: 80%\n' +
            '• Política de seguridad: ✅\n' +
            '• Análisis de riesgos: ✅\n' +
            '• Controles técnicos: 90% implementados\n' +
            '• Auditoría interna: realizada (3 no-conformidades)\n' +
            '• Certificación externa: estimada Q1 2025',
        },
        {
          pregunta: 'Circular 029 SFC',
          sinonimos: ['circular 029', 'superfinanciera', 'riesgo operativo', 'sfc'],
          respuesta:
            'Cumplimiento Circular 029 SFC (riesgo operativo):\n' +
            '• Sistema SARO: en implementación\n' +
            '• Clasificación de riesgos: ✅\n' +
            '• Indicadores: ✅\n' +
            '• Reportes mensuales: ✅\n' +
            '• Plan de continuidad: ✅\n' +
            '• Próxima autoevaluación: diciembre 2024',
        },
        {
          pregunta: 'PCI DSS',
          sinonimos: ['pci', 'tarjetas credito', 'pagos tarjeta', 'pci dss'],
          respuesta:
            'PCI DSS (procesamiento tarjetas):\n' +
            '• No almacenamos datos de tarjetas (usamos tokenización)\n' +
            '• Procesador externo: Wompi PCI Level 1\n' +
            '• Auto-evaluación SAQ-A: vigente\n' +
            '• Penetration test anual: ✅\n' +
            '• Cumplimiento: 100% por SAQ-A',
        },
        {
          pregunta: 'Política de contraseñas',
          sinonimos: ['politica contrasenas', 'password policy', 'passwords', 'claves'],
          respuesta:
            'Política de contraseñas vigente:\n' +
            '• Mínimo 12 caracteres\n' +
            '• Mayúsculas, minúsculas, números, especiales\n' +
            '• Rotación: 90 días\n' +
            '• No reutilización: últimas 5\n' +
            '• Bloqueo tras 5 intentos fallidos\n' +
            '• MFA obligatorio para admin\n' +
            '• Password manager: Bitwarden empresarial',
        },
        {
          pregunta: 'Capacitación en seguridad',
          sinonimos: ['capacitacion', 'training', 'concientizacion', 'awareness'],
          respuesta:
            'Programa de capacitación:\n' +
            '• Onboarding: módulo seguridad obligatorio (2h)\n' +
            '• Refrescamiento anual: ✅\n' +
            '• Phishing simulado mensual\n' +
            '• Última campaña: 78% aciertos (meta 85%)\n' +
            '• Módulos disponibles: 12\n' +
            '¿Programo capacitación específica?',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'Sistema caído',
          sinonimos: ['sistema caido', 'down', 'no disponible', 'inaccesible'],
          respuesta:
            'Procedimiento sistema caído:\n' +
            '1. Confirmar caída (monitoring)\n' +
            '2. Activar protocolo de respuesta\n' +
            '3. Notificar stakeholders (5 min)\n' +
            '4. Diagnóstico y mitigación\n' +
            '5. Comunicación cada 30 min\n' +
            '6. Post-mortem en 48h\n' +
            '¿Es la caída real? Lo verifico en monitoring.',
        },
        {
          pregunta: 'Cuenta comprometida',
          sinonimos: ['cuenta comprometida', 'hackeada', 'intrusion', 'cuenta tomada'],
          respuesta:
            'Cuenta comprometida - procedimiento:\n' +
            '1. Bloquear cuenta inmediatamente\n' +
            '2. Forzar logout de todas las sesiones\n' +
            '3. Resetear contraseña y MFA\n' +
            '4. Auditar accesos y acciones realizadas\n' +
            '5. Notificar al usuario legítimo\n' +
            '6. Reportar a seguridad para forense\n' +
            '¿Qué cuenta? Lo bloqueo ya.',
        },
        {
          pregunta: 'Ransomware detectado',
          sinonimos: ['ransomware', 'encriptado', 'secuestro datos', 'rescate'],
          respuesta:
            'EMERGENCIA RANSOMWARE - proceder:\n' +
            '1. AISLAR sistemas afectados YA\n' +
            '2. No pagar rescate (política Jsadr)\n' +
            '3. Activar DR site (backups)\n' +
            '4. Notificar a Fiscalía (UNIPECT)\n' +
            '5. Forense para origen\n' +
            '6. Restaurar desde backups limpios\n' +
            'Tiempo estimado recuperación: 24-72h',
        },
        {
          pregunta: 'Fuga de información',
          sinonimos: ['fuga informacion', 'data leak', 'filtracion', 'exposicion datos'],
          respuesta:
            'Procedimiento fuga de información:\n' +
            '1. Contener (bloquear acceso filtrado)\n' +
            '2. Cuantificar alcance (qué se filtró)\n' +
            '3. Notificar a Superintendencia (72h)\n' +
            '4. Notificar a clientes afectados\n' +
            '5. Forense para origen\n' +
            '6. Plan de remediación\n' +
            '¿Qué tipo de datos se filtraron?',
        },
        {
          pregunta: 'Insider threat',
          sinonimos: ['insider', 'empleado malicioso', 'abuso interno', 'fuga interna'],
          respuesta:
            'Procedimiento insider threat:\n' +
            '1. Confirmar evidencia (logs, DLP)\n' +
            '2. Revocar accesos sin alertar\n' +
            '3. Auditar todas sus acciones recientes\n' +
            '4. Coordinar con RRHH\n' +
            '5. Posible denuncia penal\n' +
            '6. Lecciones aprendidas\n' +
            '¿Quién es el sospechoso?',
        },
        {
          pregunta: '¿Qué pasa si pierdo mi MFA?',
          sinonimos: ['perdi mfa', 'sin mfa', 'cambie celular', 'no tengo codigo'],
          respuesta:
            'Si perdiste tu MFA:\n' +
            '1. Reportar a seguridad inmediatamente\n' +
            '2. Verificación de identidad (cédula + selfie + jefe)\n' +
            '3. Reset MFA en 24-48h\n' +
            '4. Contraseña temporal entregada en persona\n' +
            '5. Cuenta monitoreada 30 días\n' +
            'No intentes métodos alternos por seguridad.',
        },
        {
          pregunta: 'Cumplimiento GDPR',
          sinonimos: ['gdpr', 'europa', 'usuarios europeos', 'rgpd'],
          respuesta:
            'GDPR (usuarios europeos):\n' +
            '• Aplica si atendemos clientes UE\n' +
            '• Actualmente Jsadr no tiene clientes UE\n' +
            '• Si se expande a Europa: necesario cumplir\n' +
            '• Similar a Ley 1581 pero más estricto\n' +
            '• Multas hasta 4% facturación global\n' +
            '• ¿Estás evaluando expansión?',
        },
      ],
    },
    {
      nombre: 'Hardening y Pentesting',
      preguntas: [
        {
          pregunta: 'Hardening de servidores',
          sinonimos: ['hardening', 'endurecimiento', 'secure baseline', 'configuracion segura'],
          respuesta:
            'Hardening aplicado a servidores:\n• Deshabilitar servicios innecesarios\n• Actualizaciones automáticas\n• Firewall: solo puertos requeridos\n• SSH: solo clave + MFA\n• SELinux/AppArmor activo\n• Cuentas con mínimo privilegio\n• Logs centralizados\nCumplimiento: CIS Benchmark Level 1.',
        },
        {
          pregunta: 'CIS Benchmarks',
          sinonimos: ['cis', 'cis benchmarks', 'cis controls', 'estandar cis'],
          respuesta:
            'CIS Benchmarks aplicados:\n• CIS Ubuntu Linux: 92% cumplimiento\n• CIS PostgreSQL: 88%\n• CIS Nginx: 95%\n• CIS Kubernetes: 85%\n• CIS AWS: 90%\nPendientes: 12 controles (medios). ¿Genero plan de remediación?',
        },
        {
          pregunta: 'Pentesting interno',
          sinonimos: ['pentesting interno', 'red team', 'prueba interna', 'pentest red'],
          respuesta:
            'Pentesting interno:\n• Frecuencia: semestral\n• Último: hace 4 meses\n• Equipo: 2 ingenieros internos\n• Alcance: red, aplicaciones, DB\n• Hallazgos: 3 medios (parcheados)\n• Próximo: en 2 meses\n¿Quieres ver el reporte del último?',
        },
        {
          pregunta: 'Programa Bug Bounty',
          sinonimos: ['bug bounty', 'bounty', 'recompensa vulnerabilidades', 'hackerone'],
          respuesta:
            'Programa Bug Bounty:\n• Plataforma: HackerOne\n• Alcance: API pública + web app\n• Recompensas: $100 (low) - $5,000 (critical)\n• Vigente desde hace 8 meses\n• Reportes recibidos: 24\n• Válidos: 9 (todos parcheados)\n• Costo total: $4,800\nExcelente ROI.',
        },
        {
          pregunta: 'Seguridad en CI/CD',
          sinonimos: ['seguridad cicd', 'devsecops', 'pipeline seguro', 'sast dast'],
          respuesta:
            'Seguridad en CI/CD:\n• SAST (SonarQube): cada commit\n• DAST (OWASP ZAP): semanal\n• Dependency check: cada build\n• Secrets scanning (GitGuardian): pre-commit\n• Container scan (Trivy): cada build\n• IaC scan (Checkov): cada PR\nFallas bloquean deploy automático.',
        },
        {
          pregunta: 'Análisis estático de código',
          sinonimos: ['sast', 'codigo estatico', 'sonarqube', 'analisis codigo'],
          respuesta:
            'SAST con SonarQube:\n• Análisis por cada PR\n• Métricas: bugs, vulnerabilities, code smells, coverage\n• Cobertura actual: 78% (meta 80%)\n• Deuda técnica: 12 días\n• Quality gate: passed ✅\n• Top issue: 23 code smells (mayoría naming)\n¿Quieres el reporte detallado?',
        },
        {
          pregunta: 'Dependency scanning',
          sinonimos: ['dependency', 'dependencias', 'sca', 'npm audit', ' Dependabot'],
          respuesta:
            'Dependency scanning:\n• Herramienta: Snyk + npm audit\n• Frecuencia: cada build + diario\n• Vulnerabilidades detectadas: 7\n  - 1 alta (lodash) - parcheada\n  - 4 medias - en proceso\n  - 2 bajas - monitorear\n• Auto-PR de actualización: habilitado\n• Bloquea build si critical sin parchear',
        },
        {
          pregunta: 'Secrets management',
          sinonimos: ['secrets', 'gestion secretos', 'vault', 'credenciales', 'api keys'],
          respuesta:
            'Secrets management:\n• Herramienta: AWS Secrets Manager + HashiCorp Vault\n• Rotación: cada 90 días\n• Acceso: IAM roles (no hardcoding)\n• Auditoría: cada acceso logged\n• Sin secrets en código (pre-commit hook)\n• Cifrado: KMS\n• Backup: separado y cifrado\n¿Necesitas rotar algún secreto?',
        },
        {
          pregunta: 'Arquitectura Zero Trust',
          sinonimos: ['zero trust', 'confianza cero', 'ztna', 'never trust'],
          respuesta:
            'Zero Trust en Jsadr:\n• "Never trust, always verify"\n• MFA obligatorio todo acceso\n• Microsegmentación de red\n• Least privilege por rol\n• Continuous verification (cada request)\n• Service mesh con mTLS\n• Implementación: 70% completada\n• Meta: 100% para Q1 2025',
        },
      ],
    },
  ],
}

// =====================================================
// 8. ADMIN_GENERAL — Asistente Ejecutivo IA (Chief of Staff)
// =====================================================
const PREGUNTAS_ADMIN_GENERAL: PreguntasBot = {
  tipoBot: 'ADMIN_GENERAL',
  nombreBot: 'Asistente Ejecutivo IA',
  descripcion: 'Chief of Staff: resúmenes ejecutivos, KPIs, coordinación de equipos y reportes gerenciales.',
  categorias: [
    {
      nombre: 'Resumen Ejecutivo',
      preguntas: [
        {
          pregunta: 'Dame un resumen ejecutivo del día',
          sinonimos: ['resumen ejecutivo', 'resumen dia', 'executive summary', 'panorama del dia'],
          respuesta:
            'Resumen ejecutivo del día:\n' +
            '📊 FINANZAS: Recaudo $1.25M hoy (89% meta semana)\n' +
            '👥 CLIENTES: 8 nuevos, 5 renovaciones, 2 quejas\n' +
            '⚠️ ALERTAS: 3 morosos críticos pendientes\n' +
            '📅 REUNIONES: 3 programadas para mañana\n' +
            '✅ ACCIONES: 12 tareas completadas, 4 pendientes\n' +
            '¿Profundizo en algún punto?',
        },
        {
          pregunta: 'Resumen semanal',
          sinonimos: ['resumen semanal', 'semana', 'panorama semanal', 'weekly'],
          respuesta:
            'Resumen semanal:\n' +
            '📈 Cartera: $145M (+5% MoM)\n' +
            '💰 Recaudo: $12.4M (89% meta)\n' +
            '👥 Nuevos clientes: 34 (+18%)\n' +
            '⚠️ Mora: 33% (-5pp)\n' +
            '✅ Renovaciones: 23\n' +
            '📊 NPS: 78 (estable)\n' +
            'Conclusión: semana positiva, vigilar mora.',
        },
        {
          pregunta: 'Resumen mensual',
          sinonimos: ['resumen mensual', 'mes', 'panorama mensual', 'monthly report'],
          respuesta:
            'Resumen mensual:\n' +
            '💰 Ingresos: $48.5M (97% meta)\n' +
            '📈 Cartera: $145M (+5%)\n' +
            '👥 Clientes nuevos: 142\n' +
            '⚠️ Mora: 33% (-5pp)\n' +
            '❌ Castigos: $1.8M (1.2%)\n' +
            '📊 Utilidad neta: $10M\n' +
            'Conclusión: mes positivo, mora sigue siendo foco.',
        },
        {
          pregunta: '¿Qué necesito saber hoy?',
          sinonimos: ['que necesito saber', 'lo importante hoy', 'prioridades dia', 'highlights'],
          respuesta:
            'Lo más importante de hoy:\n' +
            '🔴 CRÍTICO: Pérez debe $2.4M hace 45 días - llamar hoy\n' +
            '🟡 IMPORTANTE: 3 contratos por firmar antes del cierre\n' +
            '🟢 INFO: Reunión con banco mañana a las 10 a.m.\n' +
            '🔵 OPCIONAL: Capacitación de seguridad pendiente\n' +
            '¿Te preparo algún detalle?',
        },
        {
          pregunta: 'Highlights de la semana',
          sinonimos: ['highlights', 'lo mejor semana', 'logros semana', 'top cosas'],
          respuesta:
            'Highlights de la semana:\n' +
            '🏆 Mejor día recaudo: martes ($3.4M)\n' +
            '🏆 Mejor gestor: Ana (92% cumplimiento)\n' +
            '🏆 Mayor renovación: $4.5M (cliente Gómez)\n' +
            '🏆 Menor mora del mes: 33% (-5pp)\n' +
            '🏆 NPS subió 3 puntos\n' +
            '¿Celebro estos logros con el equipo?',
        },
        {
          pregunta: 'Resumen para el directorio',
          sinonimos: ['resumen directorio', 'board report', 'reporte junta', 'informe accionistas'],
          respuesta:
            'Reporte ejecutivo directorio:\n' +
            '• Cartera: $145M (+5% MoM, +18% YTD)\n' +
            '• Utilidad neta: $10M (mes) / $80M (YTD)\n' +
            '• Mora: 33% (-5pp) - meta 25% en Q4\n' +
            '• NPS: 78 (+3 puntos)\n' +
            '• Crecimiento clientes: +18% MoM\n' +
            '• Proyección año: +25% vs 2023\n' +
            'Riesgos: mora cartera 60+ días, regulatory fintech.',
        },
        {
          pregunta: 'Resumen para accionistas',
          sinonimos: ['resumen accionistas', 'shareholders', 'investors', 'investor report'],
          respuesta:
            'Reporte accionistas Q3 2024:\n' +
            '• Ingresos: $145M (+22% YoY)\n' +
            '• EBITDA: $32M (margen 22%)\n' +
            '• Utilidad neta: $24M (+18% YoY)\n' +
            '• ROE: 18.2%\n' +
            '• Cartera total: $145M\n' +
            '• Clientes activos: 1,247\n' +
            '• Proyección Q4: $55M ingresos\n' +
            'Positivo para reunión de accionistas.',
        },
      ],
    },
    {
      nombre: 'Indicadores KPI',
      preguntas: [
        {
          pregunta: '¿Cuáles son los KPIs principales?',
          sinonimos: ['kpis', 'indicadores', 'metricas principales', 'kpis clave'],
          respuesta:
            'KPIs principales Jsadr:\n' +
            '1. Crecimiento cartera: +18% YTD (meta 25%)\n' +
            '2. Mora: 33% (meta <25%)\n' +
            '3. NPS: 78 (meta 70)\n' +
            '4. Recaudo: 97% meta\n' +
            '5. Conversión solicitudes: 45%\n' +
            '6. Renovaciones: 26% de elegibles\n' +
            '7. Utilidad neta: $10M (mes)\n' +
            '8. Costo por adquisición: $35K',
        },
        {
          pregunta: '¿Cómo vamos con la meta de cartera?',
          sinonimos: ['meta cartera', 'avance cartera', 'cartera meta', 'objetivo cartera'],
          respuesta:
            'Meta cartera 2024: $180M\n' +
            '• Actual: $145M (80%)\n' +
            '• Falta: $35M\n' +
            '• Meses restantes: 4\n' +
            '• Crecimiento mensual requerido: $8.75M\n' +
            '• Ritmo actual: $7.25M/mes\n' +
            '⚠️ Ligeramente por debajo. ¿Aceleramos campañas?',
        },
        {
          pregunta: 'Avance vs presupuestado',
          sinonimos: ['avance presupuesto', 'vs budget', 'variance', 'real vs presupuesto'],
          respuesta:
            'Avance vs presupuesto (mes):\n' +
            '• Ingresos: $48.5M real vs $50M budget (-3%)\n' +
            '• Gastos: $38.5M real vs $40M budget (-4%)\n' +
            '• Utilidad: $10M real vs $10M budget (0%)\n' +
            '• Crecimiento cartera: +5% vs +6% budget\n' +
            'Conclusión: levemente bajo en ingresos, gastos controlados.',
        },
        {
          pregunta: 'Tendencia de los KPIs',
          sinonimos: ['tendencia kpis', 'evolucion kpis', 'tendencia metricas', 'trend'],
          respuesta:
            'Tendencia KPIs últimos 6 meses:\n' +
            '📈 Cartera: +5%, +6%, +5%, +7%, +6%, +5%\n' +
            '📈 NPS: 71, 72, 74, 75, 76, 78\n' +
            '📉 Mora: 45%, 42%, 40%, 38%, 36%, 33%\n' +
            '📈 Recaudo: 85%, 88%, 90%, 92%, 95%, 97%\n' +
            'Conclusión: todas las tendencias son positivas.',
        },
        {
          pregunta: '¿Qué KPI está en rojo?',
          sinonimos: ['kpi rojo', 'indicador malo', 'en alerta', 'critico'],
          respuesta:
            'KPIs en alerta:\n' +
            '🔴 Mora 33% (meta <25%) -差距 8pp\n' +
            '🟡 Conversión solicitudes 45% (meta 50%)\n' +
            '🟡 Costo adquisición $35K (meta $30K)\n' +
            'Verde: NPS, recaudo, crecimiento cartera\n' +
            'Acción: plan intensivo mora 60+ días',
        },
        {
          pregunta: 'Comparativa con trimestre anterior',
          sinonimos: ['comparativa trimestre', 'q vs q', 'secuencial', 'variance trimestre'],
          respuesta:
            'Comparativa Q3 vs Q2:\n' +
            '• Cartera: $145M vs $125M (+16%)\n' +
            '• Ingresos: $145M vs $118M (+23%)\n' +
            '• Utilidad: $32M vs $24M (+33%)\n' +
            '• Mora: 33% vs 38% (-5pp)\n' +
            '• NPS: 78 vs 75 (+3)\n' +
            'Trimestre excepcional en todos los frentes.',
        },
        {
          pregunta: 'Benchmark vs competencia',
          sinonimos: ['benchmark', 'vs competencia', 'comparativa sector', 'indicadores sector'],
          respuesta:
            'Benchmark sector microcrédito Colombia:\n' +
            '• Tu mora: 33% vs sector 28% (debajo meta)\n' +
            '• Tu tasa: 1.4% vs sector 1.7% (más competitivo)\n' +
            '• Tu rentabilidad: 6.9% vs sector 5.5%\n' +
            '• Tu crecimiento: +18% vs sector +12%\n' +
            '• Tu castigo: 1.2% vs sector 1.8%\n' +
            'Posición: líder en rentabilidad, mejorar mora.',
        },
      ],
    },
    {
      nombre: 'Coordinación de Equipos',
      preguntas: [
        {
          pregunta: '¿Cómo va el equipo comercial?',
          sinonimos: ['equipo comercial', 'ventas', 'desempeno comercial', 'comercial'],
          respuesta:
            'Equipo comercial (mes):\n' +
            '• Solicitudes: 142 (+18% MoM)\n' +
            '• Aprobadas: 64 (45% conversión)\n' +
            '• Desembolsadas: 34 (53% de aprobadas)\n' +
            '• Ticket promedio: $1.26M\n' +
            '• Monto colocado: $42.8M\n' +
            'Ranking: Ana lidera con 12 colocaciones.',
        },
        {
          pregunta: '¿Cómo va el equipo de cobranza?',
          sinonimos: ['equipo cobranza', 'cobranza', 'desempeno cobranza'],
          respuesta:
            'Equipo cobranza (mes):\n' +
            '• Recaudo: $48.5M (97% meta)\n' +
            '• Gestiones: 1,247\n' +
            '• Tasa recuperación: 42%\n' +
            '• Acuerdos firmados: 23\n' +
            'Ranking: Carlos lidera con 92% cumplimiento.\n' +
            'Recomendación: coaching con Diana (65%).',
        },
        {
          pregunta: 'CargarTareas equipo para hoy',
          sinonimos: ['tareas equipo', 'plan equipo', 'asignaciones', 'pendientes equipo'],
          respuesta:
            'Plan del equipo para hoy:\n' +
            '• Ana: 3 desembolsos pendientes\n' +
            '• Carlos: 5 llamadas a morosos críticos\n' +
            '• Laura: 2 visitas domiciliarias\n' +
            '• Pedro: Renovar 4 ofertas\n' +
            '• Diana: Capacitación + 2 llamadas\n' +
            '¿Envío el resumen por WhatsApp al equipo?',
        },
        {
          pregunta: 'Reunión con un equipo',
          sinonimos: ['reunion equipo', 'agendar reunion', 'coordinar equipo', 'junta equipo'],
          respuesta:
            'Para agendar reunión con equipo necesito:\n' +
            '• Equipo (comercial, cobranza, todos)\n' +
            '• Fecha y hora\n' +
            '• Duración\n' +
            '• Modalidad (presencial/virtual)\n' +
            '• Tema\n' +
            '¿Para cuál equipo y cuándo?',
        },
        {
          pregunta: '¿Quién está sobrecargado?',
          sinonimos: ['sobrecargado', 'workload', 'carga trabajo', 'quien tiene mucho'],
          respuesta:
            'Carga de trabajo actual:\n' +
            '🔴 Ana: 115% (3 horas extra/día)\n' +
            '🟡 Carlos: 95%\n' +
            '🟢 Laura: 80%\n' +
            '🟢 Pedro: 75%\n' +
            '🟢 Diana: 70%\n' +
            'Recomendación: redistribuir 2 tareas de Ana a Laura.',
        },
        {
          pregunta: 'Asignar tarea a alguien',
          sinonimos: ['asignar tarea', 'delegar', 'encargar', 'pasar tarea'],
          respuesta:
            'Para asignar tarea necesito:\n' +
            '• Persona responsable\n' +
            '• Descripción\n' +
            '• Fecha límite\n' +
            '• Prioridad\n' +
            '• Recursos necesarios\n' +
            '¿A quién y qué asigno?',
        },
        {
          pregunta: 'Estado de proyectos',
          sinonimos: ['proyectos', 'estado proyectos', 'avance proyectos', 'iniciativas'],
          respuesta:
            'Proyectos activos: 5\n' +
            '1. App móvil: 70% (ETA 2 meses)\n' +
            '2. Integración PSE: 100% ✅\n' +
            '3. CRM upgrade: 45% (ETA 4 meses)\n' +
            '4. Expansión Medellín: 30% (ETA 6 meses)\n' +
            '5. IA cobranza: 80% (ETA 1 mes)\n' +
            'Riesgo: App móvil con retraso 15 días.',
        },
      ],
    },
    {
      nombre: 'Tareas y Seguimientos',
      preguntas: [
        {
          pregunta: 'Tareas pendientes mías',
          sinonimos: ['mis pendientes', 'tareas mias', 'lo mio', 'mi lista'],
          respuesta:
            'Tus tareas pendientes: 7\n' +
            '🔴 Aprobar 2 solicitudes de crédito >$2M\n' +
            '🟡 Revisar reporte de mora (hoy)\n' +
            '🟡 Llamar a cliente VIP Pérez\n' +
            '🟢 Firmar contratos nuevos\n' +
            '🟢 Preparar presentación directorio (viernes)\n' +
            '¿Empiezo por las críticas?',
        },
        {
          pregunta: 'Seguimiento a tarea delegada',
          sinonimos: ['seguimiento tarea', 'como va tarea', 'estado delegacion', 'tracking'],
          respuesta:
            'Tareas delegadas y su estado:\n' +
            '1. Ana → "Campaña renovación": 80% (a tiempo)\n' +
            '2. Carlos → "Reducir mora 60+": 30% (atrasado)\n' +
            '3. Laura → "Auditoría cartera": 100% ✅\n' +
            '4. Pedro → "Renovar portal web": 60% (a tiempo)\n' +
            '¿Hago seguimiento puntual a alguna?',
        },
        {
          pregunta: 'Crear tarea nueva',
          sinonimos: ['crear tarea', 'nueva tarea', 'agregar tarea', 'registrar pendiente'],
          respuesta:
            'Para crear tarea necesito:\n' +
            '• Descripción\n' +
            '• Responsable\n' +
            '• Prioridad (alta/media/baja)\n' +
            '• Fecha límite\n' +
            '• Etiquetas (opcional)\n' +
            '¿Cuál es la tarea?',
        },
        {
          pregunta: 'Posponer tarea',
          sinonimos: ['posponer', 'reprogramar', 'mover fecha', 'aplazar'],
          respuesta:
            'Para posponer necesito:\n' +
            '• Tarea a posponer\n' +
            '• Nueva fecha\n' +
            '• Motivo (registro)\n' +
            'Si pospone >3 veces, alerto a gerencia.\n' +
            '¿Cuál tarea y para cuándo?',
        },
        {
          pregunta: 'Tareas vencidas',
          sinonimos: ['tareas vencidas', 'atrasadas', 'incumplidas', 'overdue'],
          respuesta:
            'Tareas vencidas: 4\n' +
            '1. "Reporte mensual directorio" - 3 días atraso (Carlos)\n' +
            '2. "Auditoría cartera" - 1 día (Laura)\n' +
            '3. "Campaña marketing" - 5 días (Ana)\n' +
            '4. "Manual procesos" - 12 días (Pedro)\n' +
            '¿Reasigno o escalo?',
        },
        {
          pregunta: 'Cerrar tarea completada',
          sinonimos: ['cerrar tarea', 'completar', 'finalizar', 'marcar hecha'],
          respuesta:
            'Para cerrar tarea necesito:\n' +
            '• ID o nombre\n' +
            '• Confirmación de finalización\n' +
            '• Comentarios finales (opcional)\n' +
            '• Soporte (si aplica)\n' +
            '¿Cuál tarea cerramos?',
        },
        {
          pregunta: 'Recordatorios para hoy',
          sinonimos: ['recordatorios hoy', 'avisos hoy', 'alarmas hoy', 'notificaciones'],
          respuesta:
            'Recordatorios de hoy:\n' +
            '• 9:00 a.m. — Standup equipo\n' +
            '• 11:00 a.m. — Llamar cliente VIP\n' +
            '• 2:00 p.m. — Reunión con banco\n' +
            '• 5:00 p.m. — Enviar reporte diario\n' +
            '¿Confirmo o elimino alguno?',
        },
      ],
    },
    {
      nombre: 'Reportes Gerenciales',
      preguntas: [
        {
          pregunta: 'Generar reporte gerencial',
          sinonimos: ['reporte gerencial', 'informe gerencia', 'tablero gerencial', 'reporte ejecutivo'],
          respuesta:
            'Reporte gerencial listo ✅\n' +
            '• Período: mes actual\n' +
            '• Ingresos: $48.5M (97% meta)\n' +
            '• Utilidad: $10M\n' +
            '• Mora: 33% (-5pp)\n' +
            '• Crecimiento: +18%\n' +
            'Formato: PDF + Excel\n' +
            '¿Envío por correo o descargas aquí?',
        },
        {
          pregunta: 'Reporte de cumplimiento de metas',
          sinonimos: ['cumplimiento metas', 'avance metas', 'metas', 'objetivos'],
          respuesta:
            'Cumplimiento de metas 2024:\n' +
            '• Cartera $180M: 80% (en riesgo)\n' +
            '• Utilidad $100M: 80% (en trayecto)\n' +
            '• NPS 75: 104% ✅ superada\n' +
            '• Mora <25%: 76% (en riesgo)\n' +
            '• Clientes 1500: 83%\n' +
            '3 metas en riesgo, requieren refuerzo Q4.',
        },
        {
          pregunta: 'Reporte de rentabilidad',
          sinonimos: ['rentabilidad', 'margenes', 'utilidad', 'roi'],
          respuesta:
            'Reporte rentabilidad 2024 (YTD):\n' +
            '• Ingresos: $145M\n' +
            '• Costos: $93M (64% margen bruto)\n' +
            '• EBITDA: $52M (36%)\n' +
            '• Utilidad neta: $32M (22%)\n' +
            '• ROE: 18.2%\n' +
            '• ROA: 6.9%\n' +
            'Comparativa 2023: +25% en utilidad.',
        },
        {
          pregunta: 'Análisis de riesgo',
          sinonimos: ['analisis riesgo', 'riesgos', 'risk assessment', 'matriz riesgo'],
          respuesta:
            'Matriz de riesgos principales:\n' +
            '🔴 Mora cartera (prob: alta, impact: alto)\n' +
            '🟡 Regulatory changes (prob: media, impact: alto)\n' +
            '🟡 Ciberataque (prob: baja, impact: muy alto)\n' +
            '🟡 Fuga de talento (prob: media, impact: medio)\n' +
            '🟢 Liquidez (prob: baja, impact: medio)\n' +
            'Planes de mitigación: 5 activos.',
        },
        {
          pregunta: 'Proyección fin de año',
          sinonimos: ['proyeccion ano', 'forecast ano', 'estimacion cierre', 'ye forecast'],
          respuesta:
            'Proyección cierre 2024:\n' +
            '• Cartera: $172M (96% meta)\n' +
            '• Ingresos: $195M (98% meta)\n' +
            '• Utilidad: $40M (80% meta)\n' +
            '• Mora: 30% (120% meta)\n' +
            'Conclusión: aceptable pero debajo meta en utilidad.\n' +
            'Acción: acelerar colocación Q4.',
        },
        {
          pregunta: 'Reporte de satisfacción cliente',
          sinonimos: ['satisfaccion cliente', 'nps', 'encuestas', 'experiencia'],
          respuesta:
            'Satisfacción cliente (mes):\n' +
            '• NPS: 78 (+3 puntos MoM)\n' +
            '• CSAT: 4.4/5\n' +
            '• Encuestas respondidas: 234\n' +
            '• Quejas: 5 (todas resueltas)\n' +
            '• Elogios: 18\n' +
            'Top elogio: rapidez desembolso\n' +
            'Top queja: tiempos de espera en llamada',
        },
        {
          pregunta: 'Generar presentación para directorio',
          sinonimos: ['presentacion directorio', 'board deck', 'slides junta', 'powerpoint junta'],
          respuesta:
            'Para generar presentación directorio necesito:\n' +
            '• Fecha de la reunión\n' +
            '• Foco principal (resultados, estrategia, riesgos)\n' +
            '• Cantidad de slides\n' +
            '• Audiencia (técnicos o no)\n' +
            'Te genero deck en PowerPoint con los KPIs del trimestre. ¿Procedo?',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'No hay datos para hoy',
          sinonimos: ['sin datos', 'no hay datos', 'vacio', 'cero datos'],
          respuesta:
            'No hay datos disponibles para hoy. Posibles causas:\n' +
            '• Sistema de reporting en mantenimiento\n' +
            '• Sincronización pendiente\n' +
            '• Día no laboral (festivo)\n' +
            '¿Verifico estado de sincronización o muestro datos del último día hábil?',
        },
        {
          pregunta: 'Datos inconsistentes',
          sinonimos: ['inconsistencia', 'datos no cuadran', 'descuadre', 'anomalia'],
          respuesta:
            'Detectada inconsistencia en datos:\n' +
            '1. Verifico origen (fuente vs reporting)\n' +
            '2. Identifico corte problemático\n' +
            '3. Reproceso si es necesario\n' +
            '4. Notifico a equipos afectados\n' +
            'Indícame qué indicador no cuadra para investigar.',
        },
        {
          pregunta: 'KPI negativo inesperado',
          sinonimos: ['kpi cayo', 'bajo inesperado', 'caida kpi', 'declive'],
          respuesta:
            'Procedimiento caída inesperada KPI:\n' +
            '1. Confirmar dato (¿no es error?)\n' +
            '2. Comparar con período anterior\n' +
            '3. Buscar correlatos (eventos, cambios)\n' +
            '4. Diagnóstico raíz\n' +
            '5. Plan de acción correctivo\n' +
            '¿Qué KPI cayó? Lo investigo.',
        },
        {
          pregunta: 'Demasiados reportes para procesar',
          sinonimos: ['sobrecarga reportes', 'muchos reportes', 'saturacion informacion'],
          respuesta:
            'Para optimizar tu carga de reportes:\n' +
            '1. Priorizar los críticos (top 5)\n' +
            '2. Automatizar los rutinarios\n' +
            '3. Delegar los operativos\n' +
            '4. Eliminar los redundantes\n' +
            'Tienes 12 reportes pendientes. ¿Te muestro solo los críticos?',
        },
        {
          pregunta: 'Equipo en huelga o ausente',
          sinonimos: ['huelga', 'ausencias', 'sin personal', 'fuerza mayor'],
          respuesta:
            'Plan contingencia ante ausencias masivas:\n' +
            '1. Activar protocolo fuerza mayor\n' +
            '2. Reasignar tareas críticas a disponibles\n' +
            '3. Postergar no críticas\n' +
            '4. Reforzar con personal externo si necesario\n' +
            '5. Notificar a clientes afectados\n' +
            '6. Reportar a gerencia\n' +
            '¿Es la situación real?',
        },
        {
          pregunta: 'Decisión urgente necesaria',
          sinonimos: ['decision urgente', 'urgente', 'critico decision', 'inmediato'],
          respuesta:
            'Para decisiones urgentes necesito:\n' +
            '• Contexto del problema\n' +
            '• Opciones disponibles\n' +
            '• Impacto de cada opción\n' +
            '• Tiempo límite\n' +
            'Te preparo matriz de decisión con recomendación. ¿Cuál es el caso?',
        },
        {
          pregunta: 'Cambio de prioridades gerenciales',
          sinonimos: ['cambio prioridades', 'nuevas prioridades', 'reorientacion', 'pivot'],
          respuesta:
            'Para reorientar prioridades necesito:\n' +
            '• Nuevas prioridades (lista)\n' +
            '• Justificación del cambio\n' +
            '• Fecha efectiva\n' +
            '• Equipos afectados\n' +
            'Comunico a los equipos y actualizo el tablero. ¿Cuáles son las nuevas prioridades?',
        },
      ],
    },
    {
      nombre: 'Estrategia y Planificación',
      preguntas: [
        {
          pregunta: 'Plan estratégico 2025',
          sinonimos: ['plan estrategico', 'estrategia 2025', 'plan anual', 'roadmap estrategico'],
          respuesta:
            'Plan estratégico 2025:\nPilares:\n1. Crecimiento: $250M cartera (+72%)\n2. Expansión: 3 ciudades nuevas\n3. Digitalización: app móvil + IA\n4. Cumplimiento: ISO 27001 + SARO\n5. Talento: +30% equipo\nInversión total: $25M\nROI esperado: 18 meses\n¿Quieres el desglose por iniciativa?',
        },
        {
          pregunta: 'OKRs del trimestre',
          sinonimos: ['okrs', 'objetivos trimestre', 'key results', 'okr q4'],
          respuesta:
            'OKRs Q4 2024:\nObjetivo 1: Crecer cartera 15%\n  KR1: $167M cartera (actual $145M)\n  KR2: 60 nuevos clientes/mes\n  KR3: Tasa conversión 50%\nObjetivo 2: Reducir mora a 25%\n  KR1: Mora 60+ días <8%\n  KR2: 100 acuerdos firmados\n  KR3: Recuperación 45%\n¿Cómo vamos? Veo dashboard OKRs.',
        },
        {
          pregunta: 'Análisis FODA',
          sinonimos: ['foda', 'swot', 'fortalezas debilidades', 'matriz swot'],
          respuesta:
            'FODA Jsadr 2024:\nFortalezas:\n• Plataforma digital robusta\n• Equipo comercial experimentado\n• Procesos ágiles\nDebilidades:\n• Mora elevada (33%)\n• Dependencia de 1 canal (web)\n• Bajo presupuesto marketing\nOportunidades:\n• App móvil\n• Mercado Medellín\n• Libranza con empresas\nAmenazas:\n• Regulación fintech\n• Competencia con tasas bajas\n• Riesgo ciber',
        },
        {
          pregunta: 'Análisis PESTEL',
          sinonimos: ['pestel', 'politico economico', 'macro', 'entorno'],
          respuesta:
            'PESTEL Jsadr:\nP: estabilidad política, regulación Usura\nE: inflación 7%, tasa banca 13%, PIB 2%\nS: inclusión financiera, banca móvil\nT: IA, blockchain, Open Banking\nE: ESG, papelless, energía verde\nL: Ley 1581, Ley 1480, Circular 029 SFC\nConclusiones: entorno favorable con vigilar regulación.',
        },
        {
          pregunta: 'Cinco fuerzas de Porter',
          sinonimos: ['porter', '5 fuerzas', 'cinco fuerzas', 'competitividad'],
          respuesta:
            '5 Fuerzas Porter Jsadr:\n1. Rivalidad: alta (Bancolombia, Davivienda, fintech)\n2. Nuevos entrantes: media (regulaciones)\n3. Sustitutos: alto (apps P2P, tarjetas)\n4. Proveedores: bajo (muchos disponibles)\n5. Clientes: media-alta (muchas opciones)\nConclusión: industria atractiva pero competitiva, diferenciarse en servicio al cliente.',
        },
        {
          pregunta: 'Plan de contingencia',
          sinonimos: ['plan contingencia', 'contingencia', 'plan b', 'escenario'],
          respuesta:
            'Planes de contingencia por escenario:\n• Caída sistema: DR site (RTO 4h)\n• Ataque ciber: protocolo incidente + seguros\n• Fuga talento: cross-training + retención\n• Caída recaudo: línea crédito banca\n• Regulación adversa: asesoría legal continua\n• Pandemia/fuerza mayor: 100% remoto\n¿Revisamos algún escenario específico?',
        },
        {
          pregunta: 'Roadmap de producto',
          sinonimos: ['roadmap', 'roadmap producto', 'hoja ruta', 'plan producto'],
          respuesta:
            'Roadmap producto 2024-2025:\nQ4 2024:\n• App móvil MVP\n• IA cobranza (live)\n• Integración Wompi tarjetas\nQ1 2025:\n• App v2 (notificaciones push)\n• Renovaciones automáticas\n• Dashboard cliente avanzado\nQ2 2025:\n• Asesor IA conversacional\n• Crédito educativo\n• Convenios libranza\nQ3 2025:\n• Expansión Medellín\n• Billetera digital\n¿Te interesa alguna feature?',
        },
        {
          pregunta: 'Asignación de presupuesto',
          sinonimos: ['presupuesto', 'asignacion', 'distribucion presupuesto', 'capex opex'],
          respuesta:
            'Presupuesto 2025 ($25M):\n• Tecnología (40%): $10M\n  - App móvil, IA, infraestructura\n• Marketing (25%): $6.25M\n  - Digital, campañas, partnerships\n• Personal (20%): $5M\n  - 10 nuevas contrataciones\n• Cumplimiento (10%): $2.5M\n  - ISO, auditoría, legal\n• Contingencia (5%): $1.25M\n¿Ajustamos alguna línea?',
        },
        {
          pregunta: 'Revisión trimestral de avance',
          sinonimos: ['review trimestral', 'qbr', 'revision trimestre', 'cierre trimestre'],
          respuesta:
            'Revisión Q3 2024:\n✅ Metas cumplidas (4/6):\n• Crecimiento cartera: +18% (meta 15%)\n• NPS: 78 (meta 75)\n• Nuevos clientes: 142 (meta 130)\n• ISO 27001: 80% implementado\n⚠️ En riesgo (2/6):\n• Mora: 33% (meta 30%)\n• Utilidad: $32M (meta $35M)\nAcción: foco en mora 60+ días Q4.',
        },
      ],
    },
  ],
}

// =====================================================
// 9. CONFIGURACION — DevOps IA (SRE/DevOps)
// =====================================================
const PREGUNTAS_CONFIGURACION: PreguntasBot = {
  tipoBot: 'CONFIGURACION',
  nombreBot: 'DevOps IA',
  descripcion: 'SRE/DevOps: estado del sistema, despliegues, backups, monitoreo y configuración.',
  categorias: [
    {
      nombre: 'Estado del Sistema',
      preguntas: [
        {
          pregunta: '¿Cómo está el sistema?',
          sinonimos: ['estado sistema', 'como esta sistema', 'salud sistema', 'status'],
          respuesta:
            'Estado del sistema:\n' +
            '✅ API: operativa (latencia 120ms)\n' +
            '✅ DB: operativa (CPU 35%)\n' +
            '✅ Web: operativa (uptime 99.97%)\n' +
            '✅ WhatsApp gateway: operativo\n' +
            '✅ Jobs programados: al día\n' +
            'Uptime últimos 30 días: 99.97%\n' +
            '¿Profundizo en algún componente?',
        },
        {
          pregunta: '¿Hay alguna alerta?',
          sinonimos: ['alertas', 'alarma', 'problema', 'incidencia', 'issues'],
          respuesta:
            'Alertas activas: 2\n' +
            '🟡 WARNING: latencia API >200ms (en investigación)\n' +
            '🟡 WARNING: disco DB 75% (limpieza programada)\n' +
            'Sin alertas críticas ✅\n' +
            '¿Quieres el detalle de alguna?',
        },
        {
          pregunta: 'Uptime del sistema',
          sinonimos: ['uptime', 'disponibilidad', 'sla', 'availability'],
          respuesta:
            'Uptime últimos 90 días: 99.97%\n' +
            '• SLA contratado: 99.9%\n' +
            '• Cumplimiento: ✅\n' +
            '• Tiempo inactivo: ~13 minutos en 90 días\n' +
            '• Última caída: hace 23 días (4 min)\n' +
            'Positivo para reporte al cliente.',
        },
        {
          pregunta: '¿Cuál es la latencia promedio?',
          sinonimos: ['latencia', 'response time', 'tiempo respuesta', 'lentitud'],
          respuesta:
            'Latencia promedio por servicio:\n' +
            '• API REST: 120ms (p95: 250ms)\n' +
            '• Consultas DB: 45ms (p95: 90ms)\n' +
            '• Render web: 850ms (p95: 1.4s)\n' +
            '• WhatsApp send: 380ms\n' +
            'Todo dentro de metas (p95 <500ms API)',
        },
        {
          pregunta: '¿Está caído algún servicio?',
          sinonimos: ['caido', 'down', 'inactivo', 'servicio fuera'],
          respuesta:
            'Todos los servicios operativos ✅\n' +
            'Última verificación: hace 30 segundos\n' +
            'Si necesitas verificar un servicio específico, dime cuál y hago ping directo.',
        },
        {
          pregunta: 'Estado de la base de datos',
          sinonimos: ['base datos', 'db', 'database', 'estado db'],
          respuesta:
            'Base de datos:\n' +
            '• Estado: operativa ✅\n' +
            '• CPU: 35%\n' +
            '• Memoria: 62%\n' +
            '• Disco: 75% usado (limpieza programada)\n' +
            '• Conexiones activas: 28/100\n' +
            '• Queries/sec: 142\n' +
            '• Último backup: hace 2 horas',
        },
        {
          pregunta: 'Rendimiento de la aplicación',
          sinonimos: ['rendimiento', 'performance', 'velocidad', 'desempeno app'],
          respuesta:
            'Performance actual:\n' +
            '• Throughput: 1,247 req/min\n' +
            '• Error rate: 0.02%\n' +
            '• Apdex score: 0.94 (excelente)\n' +
            '• Top slow endpoint: /api/reportes (1.2s)\n' +
            '• Top error: /api/pagos (0.05%)\n' +
            'Recomendación: optimizar /api/reportes.',
        },
      ],
    },
    {
      nombre: 'Despliegues y Versiones',
      preguntas: [
        {
          pregunta: '¿Qué versión está en producción?',
          sinonimos: ['version produccion', 'current version', 'que version', 'release'],
          respuesta:
            'Versión actual en producción:\n' +
            '• App: v2.4.7\n' +
            '• API: v3.1.2\n' +
            '• DB schema: v15\n' +
            '• Desplegada: hace 3 días\n' +
            '• Commit: a8f3b2c\n' +
            '• Sin rollback pendiente',
        },
        {
          pregunta: 'Historial de despliegues',
          sinonimos: ['historial despliegues', 'deploys', 'releases recientes', 'historico'],
          respuesta:
            'Últimos 5 despliegues:\n' +
            '1. v2.4.7 — hace 3 días ✅\n' +
            '2. v2.4.6 — hace 8 días ✅\n' +
            '3. v2.4.5 — hace 12 días ✅ (hotfix)\n' +
            '4. v2.4.4 — hace 15 días ⚠️ (rollback)\n' +
            '5. v2.4.3 — hace 22 días ✅\n' +
            'Tasa de éxito: 80% (4/5)',
        },
        {
          pregunta: 'Desplegar nueva versión',
          sinonimos: ['desplegar', 'deploy', 'release nueva', 'lanzamiento'],
          respuesta:
            'Para desplegar nueva versión necesito:\n' +
            '• Versión/commit a desplegar\n' +
            '• Ambiente (staging/producción)\n' +
            '• Ventana (horario)\n' +
            '• Plan de rollback\n' +
            'Procedimiento estándar:\n' +
            '1. Build y tests automáticos\n' +
            '2. Deploy a staging\n' +
            '3. Tests e2e\n' +
            '4. Deploy a producción con canary\n' +
            '5. Monitoreo 30 min',
        },
        {
          pregunta: 'Hacer rollback',
          sinonimos: ['rollback', 'revertir', 'volver atras', 'deshacer deploy'],
          respuesta:
            'Para rollback necesito:\n' +
            '• Confirmación urgente\n' +
            '• Versión objetivo (anterior)\n' +
            'Procedimiento automático: 5 minutos\n' +
            '• Detiene tráfico a versión actual\n' +
            '• Activa versión anterior\n' +
            '• Verifica salud\n' +
            '• Notifica a equipos\n' +
            '¿Confirmas rollback? Es acción crítica.',
        },
        {
          pregunta: 'Próximo deploy programado',
          sinonimos: ['proximo deploy', 'deploy programado', 'siguiente release', 'schedule'],
          respuesta:
            'Próximos deploys programados:\n' +
            '• Hoy 10:00 p.m. — v2.4.8 (fix bugs menores)\n' +
            '• Mañana 10:00 p.m. — v2.5.0 (nueva feature préstamos)\n' +
            '• Viernes 10:00 p.m. — v2.5.1 (security patches)\n' +
            'Política: no deploys viernes después de 11 p.m. ni fines de semana.',
        },
        {
          pregunta: 'Estado del pipeline CI/CD',
          sinonimos: ['pipeline', 'cicd', 'ci/cd', 'github actions'],
          respuesta:
            'Estado pipeline CI/CD:\n' +
            '• Última build: hace 18 min ✅\n' +
            '• Tests: 234/234 pasaron\n' +
            '• Linting: 0 errores\n' +
            '• Security scan: 0 vulnerabilidades\n' +
            '• Deploy automático a staging: listo\n' +
            '• Deploy a producción: requiere aprobación',
        },
        {
          pregunta: 'Feature flags activos',
          sinonimos: ['feature flags', 'flags', 'toggles', 'features'],
          respuesta:
            'Feature flags activos: 12\n' +
            '• nuevo_modulo_prestamos: ON (100%)\n' +
            '• dark_mode: ON (gradual 30%)\n' +
            '• pago_pse_v2: ON (50%)\n' +
            '• biometric_login: OFF\n' +
            '• nueva_app_movil: OFF\n' +
            '¿Cambio el porcentaje de alguno?',
        },
      ],
    },
    {
      nombre: 'Backups y Restauración',
      preguntas: [
        {
          pregunta: 'Estado de los backups',
          sinonimos: ['backups', 'respaldos', 'estado backups', 'copia seguridad'],
          respuesta:
            'Estado de backups:\n' +
            '✅ DB principal: cada 1 hora, retención 30 días\n' +
            '✅ DB completa diaria: 2 a.m., retención 90 días\n' +
            '✅ Archivos: sincronizados a S3 cada 15 min\n' +
            '✅ Configuración: versionada en git\n' +
            'Última verificación: hace 1 hora (exitosa)\n' +
            'Próximo test restore: en 7 días',
        },
        {
          pregunta: 'Último backup',
          sinonimos: ['ultimo backup', 'backup reciente', 'cuando fue backup'],
          respuesta:
            'Últimos backups:\n' +
            '• DB incremental: hace 47 minutos ✅\n' +
            '• DB completo: hoy 2:00 a.m. ✅\n' +
            '• Archivos S3: hace 12 minutos ✅\n' +
            '• Config: hace 8 minutos (git)\n' +
            'Tamaño último backup DB: 2.3 GB\n' +
            'Todo en orden.',
        },
        {
          pregunta: 'Restaurar backup',
          sinonimos: ['restaurar', 'restore', 'recuperar datos', 'revertir datos'],
          respuesta:
            'Para restaurar backup necesito:\n' +
            '• Fecha y hora del punto de restauración\n' +
            '• Tipo (DB, archivos, todo)\n' +
            '• Ambiente (staging/producción)\n' +
            '• Motivo\n' +
            '• Aprobación gerencial (si producción)\n' +
            '⚠️ Restaurar producción causa pérdida de datos desde el backup. ¿Confirmas?',
        },
        {
          pregunta: 'Verificar integridad de backup',
          sinonimos: ['verificar backup', 'integridad', 'test restore', 'validar backup'],
          respuesta:
            'Verificación de integridad de backups:\n' +
            '1. Test restore automático semanal (domingo)\n' +
            '2. Validación de checksums\n' +
            '3. Prueba de queries sobre restore\n' +
            '4. Comparación de conteos\n' +
            'Última verificación: hace 3 días ✅\n' +
            'Próxima: domingo 4 a.m.',
        },
        {
          pregunta: 'Configurar política de backups',
          sinonimos: ['politica backups', 'configurar backups', 'frecuencia backup'],
          respuesta:
            'Política actual de backups:\n' +
            '• DB incremental: cada 1 hora\n' +
            '• DB completo: diario 2 a.m.\n' +
            '• Retención incremental: 30 días\n' +
            '• Retención completo: 90 días\n' +
            '• Archivos: 15 min, retención 60 días\n' +
            '• Geográfico: copia a otra región\n' +
            '¿Quieres ajustar alguna frecuencia?',
        },
        {
          pregunta: 'Backup falló',
          sinonimos: ['backup fallo', 'error backup', 'fallo respaldo', 'no se hizo backup'],
          respuesta:
            'Procedimiento ante backup fallido:\n' +
            '1. Verificar logs de error\n' +
            '2. Reintentar en 15 min\n' +
            '3. Si persiste: escalar a DBA\n' +
            '4. Verificar espacio en disco\n' +
            '5. Si crítico: backup manual\n' +
            'Indícame qué backup falló para investigar.',
        },
        {
          pregunta: 'Plan de recuperación ante desastres',
          sinonimos: ['plan dr', 'disaster recovery', 'recuperacion desastres', 'd.r.'],
          respuesta:
            'Plan DR actual:\n' +
            '• RPO: 1 hora (pérdida máx. datos)\n' +
            '• RTO: 4 horas (recuperación)\n' +
            '• DR site: AWS us-east-1\n' +
            '• Replicación: asíncrona cada 5 min\n' +
            '• Failover: automático + manual\n' +
            '• Último DR test: hace 60 días\n' +
            '• Próximo test: en 30 días',
        },
      ],
    },
    {
      nombre: 'Monitoreo y Alertas',
      preguntas: [
        {
          pregunta: '¿Qué se está monitoreando?',
          sinonimos: ['monitoreo', 'que se monitorea', 'monitoring', 'observabilidad'],
          respuesta:
            'Monitoreo activo:\n' +
            '• Infraestructura: CPU, RAM, disco, red\n' +
            '• Aplicación: latencia, errores, throughput\n' +
            '• DB: queries, locks, conexiones\n' +
            '• Seguridad: intentos login, IPs, WAF\n' +
            '• Negocio: transacciones, pagos, solicitudes\n' +
            '• UX: tiempo carga, fallos cliente\n' +
            'Herramientas: Datadog + Sentry + CloudWatch',
        },
        {
          pregunta: 'Configurar alerta nueva',
          sinonimos: ['configurar alerta', 'nueva alerta', 'crear alarma', 'alerta'],
          respuesta:
            'Para configurar alerta necesito:\n' +
            '• Métrica a monitorear\n' +
            '• Umbral (valor crítico)\n' +
            '• Duración (ej: 5 min consecutivos)\n' +
            '• Severidad (warning/critical)\n' +
            '• Canales de notificación (email, SMS, Slack)\n' +
            '• Horario (24/7 o business hours)\n' +
            '¿Qué alerta quieres crear?',
        },
        {
          pregunta: 'Alertas recientes',
          sinonimos: ['alertas recientes', 'historico alertas', 'ultimas alarmas'],
          respuesta:
            'Alertas últimas 24h: 8\n' +
            '• 2 WARNING latencia API (resuelto)\n' +
            '• 3 WARNING espacio disco (en observación)\n' +
            '• 1 INFO deploy exitoso\n' +
            '• 1 WARNING CPU alto (transitorio)\n' +
            '• 1 INFO backup completado\n' +
            'Sin alertas críticas en 24h.',
        },
        {
          pregunta: 'Silenciar alertas',
          sinonimos: ['silenciar', 'mutear', 'snooze', 'pausar alerta'],
          respuesta:
            'Para silenciar alertas necesito:\n' +
            '• Tipo de alerta o ID\n' +
            '• Duración (1h, 4h, hasta fecha)\n' +
            '• Motivo (mantenimiento, deploy, etc.)\n' +
            '• Persona que autoriza\n' +
            'Las alertas críticas requieren aprobación de gerente. ¿Cuál alerta silencio?',
        },
        {
          pregunta: 'Dashboard de monitoreo',
          sinonimos: ['dashboard', 'tablero', 'grafana', 'panel'],
          respuesta:
            'Dashboards disponibles:\n' +
            '1. Overview general (todos los servicios)\n' +
            '2. Detalle API y latencia\n' +
            '3. DB performance\n' +
            '4. Seguridad y accesos\n' +
            '5. Negocio y transacciones\n' +
            '6. Infraestructura\n' +
            'URL: https://monitoring.jsadr.com (acceso SSO)\n' +
            '¿Te muestro alguno?',
        },
        {
          pregunta: 'Métricas en tiempo real',
          sinonimos: ['metricas real time', 'live', 'tiempo real', 'ahora mismo'],
          respuesta:
            'Métricas en tiempo real:\n' +
            '• CPU: 35% | RAM: 62% | Disco: 75%\n' +
            '• Requests/min: 1,247\n' +
            '• Latencia: 120ms\n' +
            '• Errores: 0.02%\n' +
            '• Conexiones DB: 28/100\n' +
            '• Usuarios activos: 87\n' +
            'Actualizado hace 5 segundos.',
        },
        {
          pregunta: 'Configurar notificaciones',
          sinonimos: ['notificaciones', 'configurar notif', 'canales aviso', 'donde avisan'],
          respuesta:
            'Canales de notificación activos:\n' +
            '• Email: equipo DevOps + oncall\n' +
            '• Slack: #devops-alerts\n' +
            '• SMS: alertas críticas (4 personas)\n' +
            '• Llamada: solo críticas fuera de horario\n' +
            '• PagerDuty: rotación oncall\n' +
            '¿Configuro canal nuevo?',
        },
      ],
    },
    {
      nombre: 'Configuración y Parámetros',
      preguntas: [
        {
          pregunta: 'Ver configuración del sistema',
          sinonimos: ['configuracion', 'config', 'parametros', 'settings'],
          respuesta:
            'Configuración principal:\n' +
            '• App environment: production\n' +
            '• Región: AWS sa-east-1\n' +
            '• Node version: 20 LTS\n' +
            '• DB: PostgreSQL 15\n' +
            '• Cache: Redis 7\n' +
            '• CDN: Cloudflare\n' +
            '• Email: SendGrid\n' +
            '• WhatsApp: Wati API\n' +
            '¿Quieres ver una sección específica?',
        },
        {
          pregunta: 'Cambiar parámetro de configuración',
          sinonimos: ['cambiar parametro', 'modificar config', 'ajustar', 'cambiar setting'],
          respuesta:
            'Para cambiar un parámetro necesito:\n' +
            '• Clave del parámetro\n' +
            '• Valor nuevo\n' +
            '• Ambiente (dev/staging/prod)\n' +
            '• Justificación\n' +
            '• Aprobación (si producción)\n' +
            'Los cambios en producción requieren commit + PR + 2 revisores. ¿Cuál parámetro?',
        },
        {
          pregunta: 'Variables de entorno',
          sinonimos: ['env vars', 'variables entorno', 'env', 'environment'],
          respuesta:
            'Variables de entorno (count: 47)\n' +
            '• DATABASE_URL: configurada ✅\n' +
            '• JWT_SECRET: configurada ✅\n' +
            '• OPENAI_API_KEY: configurada ✅\n' +
            '• WATI_TOKEN: configurada ✅\n' +
            '• REDIS_URL: configurada ✅\n' +
            'Por seguridad no muestro valores. ¿Falta alguna?',
        },
        {
          pregunta: 'Tasas de interés configuradas',
          sinonimos: ['tasas interes', 'parametros tasas', 'tasas activas'],
          respuesta:
            'Tasas configuradas por score:\n' +
            '• Score 750+: 1.2% mensual (15.4% EA)\n' +
            '• Score 650-749: 1.4% mensual (18.1% EA)\n' +
            '• Score 550-649: 1.7% mensual (22.4% EA)\n' +
            '• Score <550: 1.9% mensual (25.3% EA)\n' +
            '• Mora: 2.5% mensual (tope legal)\n' +
            '¿Necesitas ajustar alguna?',
        },
        {
          pregunta: 'Configurar webhooks',
          sinonimos: ['webhooks', 'integraciones', 'callbacks', 'hooks'],
          respuesta:
            'Webhooks activos: 8\n' +
            '• Pago recibido → notifica cliente\n' +
            '• Préstamo aprobado → dispara desembolso\n' +
            '• Cliente nuevo → CRM\n' +
            '• Mora >30 días → cobranza\n' +
            '• WhatsApp recibido → bot\n' +
            '• PSE callback → confirma pago\n' +
            '¿Agregas o modificas alguno?',
        },
        {
          pregunta: 'Configurar usuarios y permisos',
          sinonimos: ['usuarios permisos', 'roles', 'rbac', 'accesos'],
          respuesta:
            'Gestión de usuarios y permisos:\n' +
            '• Usuarios activos: 23\n' +
            '• Roles: superadmin, admin, gestor, asesor, lectura\n' +
            '• MFA obligatorio: admins y superadmins\n' +
            '• Políticas: RBAC + ABAC\n' +
            '• Última auditoría: hace 15 días\n' +
            '¿Qué usuario o rol gestionas?',
        },
        {
          pregunta: 'Configurar integraciones',
          sinonimos: ['integraciones', 'conexiones', 'apis externas', 'integraciones externas'],
          respuesta:
            'Integraciones activas: 12\n' +
            '✅ Bancolombia (PSE)\n' +
            '✅ Wati (WhatsApp)\n' +
            '✅ SendGrid (email)\n' +
            '✅ Datacrédito (consulta)\n' +
            '✅ Wompi (tarjetas)\n' +
            '✅ Cloudflare (CDN/WAF)\n' +
            '✅ Sentry (errors)\n' +
            '⚠️ Twilio (SMS) - caída temporal\n' +
            '¿Diagnostico Twilio?',
        },
      ],
    },
    {
      nombre: 'Casos Edge y Errores',
      preguntas: [
        {
          pregunta: 'Error 500 en producción',
          sinonimos: ['error 500', 'internal server error', 'server error', 'error servidor'],
          respuesta:
            'Procedimiento error 500:\n' +
            '1. Verificar Sentry para detalle\n' +
            '2. Si es masivo: rollback inmediato\n' +
            '3. Si es aislado: fix hotfix\n' +
            '4. Comunicar a stakeholders\n' +
            '5. Post-mortem en 24h\n' +
            'Indícame endpoint afectado. Lo investigo en Sentry.',
        },
        {
          pregunta: 'Sistema caído',
          sinonimos: ['sistema caido', 'outage', 'down total', 'no responde nada'],
          respuesta:
            'Procedimiento outage total:\n' +
            '1. Confirmar (status page + monitoring)\n' +
            '2. Activar incidente P0 (criticidad máxima)\n' +
            '3. Comunicar a stakeholders (5 min)\n' +
            '4. Diagnóstico y mitigación\n' +
            '5. Comunicación cada 15 min\n' +
            '6. Post-mortem en 48h\n' +
            '¿Confirmo la caída?',
        },
        {
          pregunta: 'Alta latencia',
          sinonimos: ['latencia alta', 'lento', 'slow', 'tardo mucho'],
          respuesta:
            'Si latencia es alta:\n' +
            '1. Identificar endpoint afectado\n' +
            '2. Revisar DB (slow queries, locks)\n' +
            '3. Verificar CPU/RAM\n' +
            '4. Revisar cache hit rate\n' +
            '5. Auto-scaling si necesario\n' +
            'Latencia actual: 120ms (normal). ¿Cuál endpoint está lento?',
        },
        {
          pregunta: 'DB sin responder',
          sinonimos: ['db caida', 'base datos no responde', 'sin db', 'conexion db'],
          respuesta:
            'Si DB no responde:\n' +
            '1. Verificar estado (CPU, conexiones, locks)\n' +
            '2. Si caída: failover a réplica (5 min)\n' +
            '3. Si saturada: kill conexiones zombies\n' +
            '4. Si disco lleno: limpieza de logs\n' +
            '5. Comunicar outage\n' +
            '¿Cuál es el síntoma exacto?',
        },
        {
          pregunta: 'Despliegue fallido',
          sinonimos: ['deploy fallido', 'deploy error', 'fallo despliegue', 'no se pudo desplegar'],
          respuesta:
            'Procedimiento deploy fallido:\n' +
            '1. Detectar causa (logs CI/CD)\n' +
            '2. Sistema automáticamente mantiene versión anterior\n' +
            '3. Diagnóstico: tests, build, infra\n' +
            '4. Fix y reintento\n' +
            '5. Si persiste: rollback\n' +
            '6. Comunicar a equipos\n' +
            'Indícame el deploy que falló.',
        },
        {
          pregunta: 'Disco lleno',
          sinonimos: ['disco lleno', 'sin espacio', 'storage full', 'disco saturado'],
          respuesta:
            'Procedimiento disco lleno:\n' +
            '1. Identificar partición saturada\n' +
            '2. Limpiar logs antiguos\n' +
            '3. Vacuum DB (PostgreSQL)\n' +
            '4. Limpiar imágenes huérfanas Docker\n' +
            '5. Si persiste: ampliar disco\n' +
            'Estado actual: 75% (alerta al 80%). ¿Procedo con limpieza?',
        },
        {
          pregunta: 'Ataque en curso',
          sinonimos: ['ataque', 'bajo ataque', 'intrusion', 'ddos activo'],
          respuesta:
            'Procedimiento ataque en curso:\n' +
            '1. Activar Cloudflare "Under Attack" mode\n' +
            '2. Bloquear IPs atacantes\n' +
            '3. Notificar a seguridad (CISO)\n' +
            '4. Evaluar si es DDoS o aplicación\n' +
            '5. Comunicar stakeholders\n' +
            '6. Post-mortem en 48h\n' +
            '¿Qué tipo de ataque detectaste?',
        },
      ],
    },
    {
      nombre: 'Optimización y Performance',
      preguntas: [
        {
          pregunta: 'Optimizar queries de base de datos',
          sinonimos: ['optimizar queries', 'queries lentas', 'slow queries', 'performance db'],
          respuesta:
            'Top 5 queries lentas:\n1. SELECT * FROM pagos WHERE... (850ms) - falta índice\n2. JOIN prestamos+clientes (620ms) - índice compuesto\n3. Reporte mensual (1.2s) - materializar vista\n4. Búsqueda clientes (480ms) - GIN index\n5. Cálculo saldos (980ms) - precalcular\n¿Aplico las optimizaciones sugeridas?',
        },
        {
          pregunta: 'Indexación de tablas',
          sinonimos: ['indexacion', 'indices', 'indexes', 'create index'],
          respuesta:
            'Estado de indexación:\n• Tablas principales: 12 tablas\n• Índices actuales: 87\n• Índices no usados: 14 (candidatos a eliminar)\n• Tablas sin índice en FK: 3\n• Fragmentación promedio: 18% (OK)\nRecomendación: reindex mensual. ¿Programo?',
        },
        {
          pregunta: 'Estrategia de caching',
          sinonimos: ['caching', 'cache', 'redis', 'memoria'],
          respuesta:
            'Caching actual:\n• Redis: 4 GB usados de 8\n• Hit rate: 92% (excelente)\n• TTL por tipo:\n  - Config: 1h\n  - Catálogos: 6h\n  - User session: 24h\n  - Reportes: 5 min\n• Invalidación: por evento (write)\n• Pendiente: cache de dashboards',
        },
        {
          pregunta: 'CDN tuning',
          sinonimos: ['cdn', 'cloudflare', 'distribucion contenido', 'edge'],
          respuesta:
            'CDN Cloudflare:\n• Cache hit ratio: 89%\n• Tiempo response edge: 35ms\n• Reglas activas: 47\n• Países cacheados: 12\n• Imágenes: WebP + lazy load\n• Pendiente: stream video\n• Costo mes: $480\n¿Optimizo alguna regla?',
        },
        {
          pregunta: 'Auto-scaling',
          sinonimos: ['auto scaling', 'escalado automatico', 'autoscale', 'elasticidad'],
          respuesta:
            'Auto-scaling configurado:\n• Mínimo: 2 instancias\n• Máximo: 10 instancias\n• Escala cuando CPU >70% por 5 min\n• Desescala cuando CPU <30% por 10 min\n• Cooldown: 5 min\n• Última escala: hace 3 días (de 3 a 5)\n• Costo variable mes: $1,200\n¿Ajusto los umbrales?',
        },
        {
          pregunta: 'Performance budgets',
          sinonimos: ['performance budget', 'presupuesto performance', 'limites perf', 'web vitals'],
          respuesta:
            'Performance budgets web:\n• LCP: <2.5s (actual 1.8s ✅)\n• FID: <100ms (actual 80ms ✅)\n• CLS: <0.1 (actual 0.05 ✅)\n• Bundle JS: <300KB (actual 280KB ✅)\n• Imágenes: <200KB (actual 180KB ✅)\n• Total carga: <3s (actual 2.4s ✅)\nAlerta automática si se excede.',
        },
        {
          pregunta: 'Profiling de aplicación',
          sinonimos: ['profiling', 'profile', 'analisis rendimiento', 'flamegraph'],
          respuesta:
            'Profiling con New Relic + Pyroscope:\n• Endpoint más lento: /api/reportes (1.2s)\n• Cuello botella: query DB + cálculo\n• Memoria: estable\n• CPU: 35% (normal)\n• Garbage collection: 80ms/min\n• Top función: formatearMoneda (3% time)\n¿Optimizo el endpoint de reportes?',
        },
        {
          pregunta: 'Load testing',
          sinonimos: ['load test', 'prueba carga', 'stress test', 'k6'],
          respuesta:
            'Load testing con k6:\n• Último test: hace 7 días\n• Usuarios simultáneos: 500\n• Throughput: 1,200 req/s\n• P95: 320ms (meta <500ms ✅)\n• Error rate: 0.1%\n• Pico soportado: 800 usuarios\n• Próximo test: en 3 semanas\n¿Quieres el reporte?',
        },
        {
          pregunta: 'Optimización frontend',
          sinonimos: ['optimizar frontend', 'frontend performance', 'lighthouse', 'web vitals'],
          respuesta:
            'Optimización frontend:\n• Lighthouse: 92/100\n• Code splitting: aplicado ✅\n• Tree shaking: aplicado ✅\n• Lazy loading componentes: 80%\n• Imágenes: WebP + AVIF\n• Fonts: preloaded\n• CSS: Tailwind purgado\n• JS bundle: 280KB (meta 300KB)\nPendiente: service worker offline',
        },
      ],
    },
  ],
}

// =====================================================
// Base centralizada de preguntas por tipo de bot
// =====================================================
const PREGUNTAS_POR_BOT: Record<TipoBot, PreguntasBot> = {
  CHAT_CLIENTES: PREGUNTAS_CHAT_CLIENTES,
  ADMIN_SISTEMA: PREGUNTAS_ADMIN_SISTEMA,
  CONTABILIDAD: PREGUNTAS_CONTABILIDAD,
  PAGOS: PREGUNTAS_PAGOS,
  PRESTAMOS: PREGUNTAS_PRESTAMOS,
  JURIDICO: PREGUNTAS_JURIDICO,
  SEGURIDAD: PREGUNTAS_SEGURIDAD,
  ADMIN_GENERAL: PREGUNTAS_ADMIN_GENERAL,
  CONFIGURACION: PREGUNTAS_CONFIGURACION,
}

// =====================================================
// Función 1: obtenerPreguntasBot(tipoBot)
// Retorna la estructura completa de un bot específico
// =====================================================
export function obtenerPreguntasBot(tipoBot: TipoBot | string): PreguntasBot | null {
  const key = (tipoBot as string).toUpperCase() as TipoBot
  return PREGUNTAS_POR_BOT[key] ?? null
}

// =====================================================
// Función 2: buscarPreguntaSimilar(tipoBot, mensaje)
// Busca la pregunta más similar usando matching de sinónimos
// Retorna la mejor coincidencia o null si no alcanza umbral
// =====================================================
export interface ResultadoBusqueda {
  encontrada: boolean
  pregunta: PreguntaEntrenamiento | null
  categoria: string | null
  puntaje: number
}

export function buscarPreguntaSimilar(
  tipoBot: TipoBot | string,
  mensaje: string
): ResultadoBusqueda {
  const bot = obtenerPreguntasBot(tipoBot)
  if (!bot) {
    return { encontrada: false, pregunta: null, categoria: null, puntaje: 0 }
  }

  const mensajeNorm = normalizarTexto(mensaje)
  if (!mensajeNorm) {
    return { encontrada: false, pregunta: null, categoria: null, puntaje: 0 }
  }

  const palabrasMensaje = new Set(mensajeNorm.split(' ').filter((p) => p.length > 2))
  let mejorPregunta: PreguntaEntrenamiento | null = null
  let mejorCategoria: string | null = null
  let mejorPuntaje = 0

  for (const categoria of bot.categorias) {
    for (const pregunta of categoria.preguntas) {
      // Combinar pregunta + sinónimos
      const candidatos = [pregunta.pregunta, ...pregunta.sinonimos]

      for (const candidato of candidatos) {
        const candNorm = normalizarTexto(candidato)
        let puntaje = 0

        // 1. Coincidencia exacta (substring del mensaje)
        if (mensajeNorm === candNorm) {
          puntaje = 100
        } else if (mensajeNorm.includes(candNorm)) {
          // 2. El sinónimo está contenido en el mensaje
          puntaje = 90
        } else if (candNorm.includes(mensajeNorm) && mensajeNorm.length > 3) {
          // 3. El mensaje está contenido en el sinónimo
          puntaje = 85
        } else {
          // 4. Coincidencia por palabras clave
          const palabrasCand = candNorm.split(' ').filter((p) => p.length > 2)
          let coincidencias = 0
          for (const pal of palabrasCand) {
            if (palabrasMensaje.has(pal)) {
              coincidencias++
            }
          }
          // Coincidencia por frases de 2 palabras
          for (let i = 0; i < palabrasCand.length - 1; i++) {
            const bigrama = `${palabrasCand[i]} ${palabrasCand[i + 1]}`
            if (mensajeNorm.includes(bigrama)) {
              coincidencias += 2
            }
          }
          const totalPalabras = Math.max(palabrasCand.length, palabrasMensaje.size, 1)
          puntaje = Math.round((coincidencias / totalPalabras) * 70)
        }

        if (puntaje > mejorPuntaje) {
          mejorPuntaje = puntaje
          mejorPregunta = pregunta
          mejorCategoria = categoria.nombre
        }
      }
    }
  }

  // Umbral mínimo para considerar match válido
  const UMBRAL = 35
  if (mejorPuntaje >= UMBRAL && mejorPregunta) {
    return {
      encontrada: true,
      pregunta: mejorPregunta,
      categoria: mejorCategoria,
      puntaje: mejorPuntaje,
    }
  }

  return { encontrada: false, pregunta: null, categoria: null, puntaje: mejorPuntaje }
}

// =====================================================
// Función 3: generarListaPreguntasBot(tipoBot)
// Genera un texto formateado con todas las preguntas de un bot
// =====================================================
export function generarListaPreguntasBot(tipoBot: TipoBot | string): string {
  const bot = obtenerPreguntasBot(tipoBot)
  if (!bot) {
    return `No se encontró configuración para el bot: ${tipoBot}`
  }

  const lineas: string[] = []
  lineas.push('========================================')
  lineas.push(`BOT: ${bot.nombreBot} (${bot.tipoBot})`)
  lineas.push(`Descripción: ${bot.descripcion}`)
  lineas.push('========================================')
  lineas.push('')

  let totalPreguntas = 0
  let indexPregunta = 1

  for (const categoria of bot.categorias) {
    lineas.push(`▶ CATEGORÍA: ${categoria.nombre}`)
    lineas.push('----------------------------------------')
    categoria.preguntas.forEach((p) => {
      lineas.push(`${indexPregunta}. ${p.pregunta}`)
      if (p.sinonimos.length > 0) {
        lineas.push(`   Sinónimos: ${p.sinonimos.slice(0, 6).join(', ')}${p.sinonimos.length > 6 ? '...' : ''}`)
      }
      lineas.push(`   Respuesta: ${p.respuesta.split('\n')[0].slice(0, 80)}${p.respuesta.length > 80 ? '...' : ''}`)
      lineas.push('')
      indexPregunta++
      totalPreguntas++
    })
    lineas.push('')
  }

  lineas.push('----------------------------------------')
  lineas.push(`TOTAL: ${totalPreguntas} preguntas en ${bot.categorias.length} categorías`)
  lineas.push('========================================')

  return lineas.join('\n')
}

// =====================================================
// Funciones auxiliares (exportadas para uso externo)
// =====================================================

// Lista de todos los bots disponibles
export function listarBotsDisponibles(): Array<{ tipoBot: TipoBot; nombreBot: string; descripcion: string }> {
  return Object.values(PREGUNTAS_POR_BOT).map((b) => ({
    tipoBot: b.tipoBot,
    nombreBot: b.nombreBot,
    descripcion: b.descripcion,
  }))
}

// Total de preguntas por bot
export function contarPreguntasBot(tipoBot: TipoBot | string): number {
  const bot = obtenerPreguntasBot(tipoBot)
  if (!bot) return 0
  return bot.categorias.reduce((acc, c) => acc + c.preguntas.length, 0)
}

// Estadísticas generales
export function estadisticasGenerales(): {
  totalBots: number
  totalPreguntas: number
  totalCategorias: number
  porBot: Array<{ tipoBot: TipoBot; nombreBot: string; preguntas: number; categorias: number }>
} {
  const porBot = Object.values(PREGUNTAS_POR_BOT).map((b) => ({
    tipoBot: b.tipoBot,
    nombreBot: b.nombreBot,
    preguntas: b.categorias.reduce((acc, c) => acc + c.preguntas.length, 0),
    categorias: b.categorias.length,
  }))

  return {
    totalBots: porBot.length,
    totalPreguntas: porBot.reduce((acc, b) => acc + b.preguntas, 0),
    totalCategorias: porBot.reduce((acc, b) => acc + b.categorias, 0),
    porBot,
  }
}
