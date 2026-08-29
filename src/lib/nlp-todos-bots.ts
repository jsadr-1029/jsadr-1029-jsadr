// =====================================================
// nlp-todos-bots.ts — Sistema NLP unificado para TODOS los bots
// Matching semántico con intents, sinónimos y normalización
// =====================================================

// =====================================================
// INTENTS POR TIPO DE BOT
// =====================================================
interface IntentBot {
  id: string
  sinonimos: string[]
  patrones?: RegExp[]
}

const INTENTS_POR_BOT: Record<string, IntentBot[]> = {
  // === CHAT_CLIENTES (Clientes) ===
  CHAT_CLIENTES: [
    {
      id: 'SALDO',
      sinonimos: ['saldo', 'deuda', 'cuánto debo', 'cuanto debo', 'cuánto pago', 'cuanto pago', 'mi solicitud', 'mi prestamo', 'cuánto me queda', 'cuanto me queda', 'lo que debo', 'mi obligación', 'mi obligacion'],
    },
    {
      id: 'FECHA_PAGO',
      sinonimos: ['fecha de pago', 'cuándo pago', 'cuando pago', 'próximo pago', 'proximo pago', 'vencimiento', 'cuándo vence', 'cuando vence', 'cuándo es mi pago', 'cuando es mi pago', 'fecha límite', 'fecha limite'],
    },
    {
      id: 'CUOTAS_PAGADAS',
      sinonimos: ['cuotas pagadas', 'cuántas cuotas', 'cuantas cuotas', 'progreso', 'avance', 'cuánto he pagado', 'cuanto he pagado', 'historial de pagos', 'qué he pagado', 'que he pagado'],
    },
    {
      id: 'RENOVACION',
      sinonimos: ['renovación', 'renovacion', 'renovar', 'renuevo', 'refinanciar', 'ampliar crédito', 'ampliar credito', 'nuevo solicitud', 'nuevo prestamo'],
    },
    {
      id: 'REQUISITOS',
      sinonimos: ['requisitos', 'qué necesito', 'que necesito', 'documentos', 'qué piden', 'que piden', 'cómo solicito', 'como solicito', 'trámite', 'tramite'],
    },
    {
      id: 'ASESOR',
      sinonimos: ['asesor', 'humano', 'persona', 'hablar con alguien', 'llamenme', 'llámenme', 'contacto', 'whatsapp', 'teléfono', 'telefono', 'ayuda humana', 'no entiendo', 'no me sirve'],
    },
    {
      id: 'HORARIOS',
      sinonimos: ['horario', 'horarios', 'atención', 'atencion', 'a qué hora', 'a que hora', 'cuándo atienden', 'cuando atienden', 'días hábiles', 'dias habiles', 'fin de semana'],
    },
    {
      id: 'PIN',
      sinonimos: ['pin', 'contraseña', 'contrasena', 'clave', 'cambiar pin', 'olvidé mi pin', 'olvide mi pin', 'olvidé mi clave', 'olvide mi clave', 'no me acuerdo', 'recuperar acceso'],
    },
    {
      id: 'ESTADO_CUENTA',
      sinonimos: ['estado de cuenta', 'extracto', 'resumen', 'detalle de mi solicitud', 'detalle de mi prestamo', 'movimientos', 'historial completo'],
    },
  ],

  // === CONTABILIDAD (Experto Financiero) ===
  CONTABILIDAD: [
    {
      id: 'REGISTRAR_GASTO',
      sinonimos: ['gasto', 'gasté', 'gaste', 'pagué', 'pague', 'compré', 'compre', 'me costó', 'me costo', 'me salió', 'me salio', 'egreso', 'salida de dinero'],
      patrones: [/(?:gasto|gasté|gaste|pagué|pague|compré|compre|me\s+costó|me\s+costo|me\s+salió|me\s+salio)\s+(?:de\s+)?\$?\s*([\d.]+)/i],
    },
    {
      id: 'REGISTRAR_INGRESO',
      sinonimos: ['ingreso', 'recibí', 'recibi', 'gané', 'gane', 'cobré', 'cobre', 'me pagaron', 'me depositaron', 'venta', 'vendí', 'vendi', 'sueldo', 'salario', 'comisión', 'comision'],
      patrones: [/(?:ingreso|recibí|recibi|gané|gane|cobré|cobre|vendí|vendi)\s+(?:de\s+)?\$?\s*([\d.]+)/i],
    },
    {
      id: 'DASHBOARD',
      sinonimos: ['balance', 'dashboard', 'resumen', 'cómo van mis finanzas', 'como van mis finanzas', 'cuánto tengo', 'cuanto tengo', 'mi plata', 'mi dinero', 'mi saldo', 'salud financiera', 'cómo estoy', 'como estoy', 'panorama', 'situación financiera', 'situacion financiera'],
    },
    {
      id: 'CONSEJO_AHORRO',
      sinonimos: ['cómo ahorrar', 'como ahorrar', 'ahorrar más', 'ahorrar mas', 'reducir gastos', 'gastar menos', 'economizar', 'tips de ahorro', 'consejos de ahorro', 'estrategias de ahorro', 'cómo gastar menos', 'como gastar menos'],
    },
    {
      id: 'PREDICCION',
      sinonimos: ['predicción', 'prediccion', 'predecir', 'pronóstico', 'pronostico', 'proyección', 'proyeccion', 'futuro', 'qué pasará', 'que pasara', 'cómo estaré', 'como estare', 'escenario', 'simulación', 'simulacion', 'forecast', 'prever'],
    },
    {
      id: 'COMPARATIVO',
      sinonimos: ['comparativo', 'compara', 'comparar', 'mes anterior', 'vs mes', 'evolución', 'evolucion', 'cambio', 'antes vs ahora', 'cómo iba', 'como iba', 'diferencia'],
    },
    {
      id: 'PRESUPUESTO',
      sinonimos: ['presupuesto', 'presupuestar', 'límite', 'limite', 'tope de gasto', 'control de gasto'],
    },
    {
      id: 'META',
      sinonimos: ['meta de', 'crear meta', 'objetivo de', 'ahorrar para', 'fondo de', 'quiero comprar', 'planeo comprar', 'meta financiera'],
    },
    {
      id: 'ALERTAS',
      sinonimos: ['alerta', 'alertas', 'problema', 'problemas', 'qué está mal', 'que esta mal', 'riesgo', 'peligro', 'aviso', 'notificación', 'notificacion', 'algo malo'],
    },
    {
      id: 'RECOMENDACION',
      sinonimos: ['recomendación', 'recomendacion', 'recomendaciones', 'qué hago', 'que hago', 'consejo', 'consejos', 'sugerencia', 'sugerencias', 'qué me sugieres', 'que me sugieres', 'qué me recomiendas', 'que me recomiendas', 'mejoras', 'optimizar'],
    },
  ],

  // === PAGOS (Asistente de Cobros) ===
  PAGOS: [
    {
      id: 'ESTADO_CARTERA',
      sinonimos: ['cartera', 'estado', 'resumen', 'cómo está la cartera', 'como esta la cartera', 'novedades', 'qué pasó hoy', 'que paso hoy', 'panorama', 'overview', 'cómo vamos', 'como vamos'],
    },
    {
      id: 'MORA',
      sinonimos: ['mora', 'moroso', 'morosos', 'atraso', 'atrasados', 'incumplimiento', 'incumplidos', 'deudores', 'quiénes no pagan', 'quienes no pagan', 'clientes en mora', 'mora actual'],
    },
    {
      id: 'VENCEN_HOY',
      sinonimos: ['vencen hoy', 'vencimiento hoy', 'pagan hoy', 'cuotas de hoy', 'hoy vencen', 'qué vence hoy', 'que vence hoy'],
    },
    {
      id: 'PROXIMOS_VENCIMIENTOS',
      sinonimos: ['próximos vencimientos', 'proximos vencimientos', 'vencimientos', 'vencen esta semana', 'vencen en 7 días', 'vencen en 7 dias', 'próximos pagos', 'proximos pagos', 'agenda de cobros'],
    },
    {
      id: 'RECAUDO',
      sinonimos: ['recaudo', 'recuperación', 'recuperacion', 'cuánto recaudamos', 'cuanto recaudamos', 'cuánto cobramos', 'cuanto cobramos', 'entradas de dinero', 'ingresos por cobros', 'lo que entró', 'lo que entro'],
    },
    {
      id: 'INDICADORES',
      sinonimos: ['indicadores', 'tasa de recuperación', 'tasa de recuperacion', 'tasa de mora', 'kpi', 'métricas', 'metricas', 'estadísticas', 'estadisticas', 'porcentaje de mora', 'recuperación de cartera', 'recuperacion de cartera'],
    },
    {
      id: 'RIESGO',
      sinonimos: ['riesgo', 'peligro', 'alto riesgo', 'clientes peligrosos', 'más riesgo', 'mas riesgo', 'prioridad', 'urgente', 'crítico', 'critico', 'atender ya', 'emergencia'],
    },
    {
      id: 'ALERTAS_COBROS',
      sinonimos: ['alerta', 'alertas', 'problema', 'problemas', 'novedad', 'novedades', 'anomalía', 'anomalia', 'situación crítica', 'situacion critica', 'qué está pasando', 'que esta pasando'],
    },
    {
      id: 'RECORDATORIO_WA',
      sinonimos: ['recordatorio', 'whatsapp', 'enviar mensaje', 'contactar', 'llamar', 'cobrar por whatsapp', 'notificar', 'recordar pago', 'avisar'],
    },
    {
      id: 'ESCALAR_JURIDICO',
      sinonimos: ['jurídico', 'juridico', 'escalar', 'demanda', 'abogado', 'cobro judicial', 'proceso legal', 'enviar a jurídico', 'enviar a juridico', '60 días', '60 dias'],
    },
    {
      id: 'ANALISIS_ESTRATEGICO',
      sinonimos: ['análisis', 'analisis', 'estrategia', 'estratégico', 'estrategico', 'plan', 'recomendación', 'recomendacion', 'qué hacer', 'que hacer', 'cómo mejorar', 'como mejorar', 'diagnóstico', 'diagnostico'],
    },
  ],

  // === PRESTAMOS (Asistente Solicitudes) ===
  PRESTAMOS: [
    {
      id: 'DASHBOARD_PRESTAMOS',
      sinonimos: ['dashboard', 'estado', 'resumen', 'panorama', 'cómo van los solicitudes', 'como van los prestamos', 'overview', 'kpi', 'indicadores del módulo'],
    },
    {
      id: 'SOLICITUDES_PENDIENTES',
      sinonimos: ['solicitudes', 'pendientes', 'nuevas solicitudes', 'solicitudes pendientes', 'por aprobar', 'pendientes de aprobación', 'pendientes de aprobacion', 'cola de solicitudes'],
    },
    {
      id: 'PRESTAMOS_ACTIVOS',
      sinonimos: ['activos', 'solicitudes activos', 'prestamos activos', 'vigentes', 'en curso', 'cuántos solicitudes activos', 'cuantos prestamos activos', 'solicitudes vigentes', 'prestamos vigentes'],
    },
    {
      id: 'MORA_PRESTAMOS',
      sinonimos: ['mora', 'morosos', 'en mora', 'atrasados', 'incumplidos', 'deudores', 'solicitudes en mora', 'prestamos en mora'],
    },
    {
      id: 'VENCIMIENTOS_PRESTAMOS',
      sinonimos: ['vencimientos', 'vencen', 'próximos vencimientos', 'proximos vencimientos', 'vencen esta semana', 'cuándo vencen', 'cuando vencen', 'agenda de vencimientos'],
    },
    {
      id: 'RENOVACION',
      sinonimos: ['renovación', 'renovacion', 'renovar', 'renuevo', 'aptos para renovar', 'candidatos a renovación', 'candidatos a renovacion', 'quiénes pueden renovar', 'quienes pueden renovar', 'oportunidades de renovación', 'oportunidades de renovacion'],
    },
    {
      id: 'RENTABILIDAD',
      sinonimos: ['rentabilidad', 'utilidad', 'ganancia', 'cuánto hemos ganado', 'cuanto hemos ganado', 'cuánta utilidad', 'cuanta utilidad', 'intereses cobrados', 'rentable', 'roi', 'retorno'],
    },
    {
      id: 'MAS_RENTABLES',
      sinonimos: ['más rentables', 'mas rentables', 'solicitudes más rentables', 'prestamos mas rentables', 'mejores solicitudes', 'mejores prestamos', 'top rentables', 'más ganancia', 'mas ganancia'],
    },
    {
      id: 'MAYOR_RIESGO',
      sinonimos: ['mayor riesgo', 'más riesgo', 'mas riesgo', 'peligrosos', 'solicitudes de riesgo', 'prestamos de riesgo', 'alto riesgo', 'críticos', 'criticos', 'atención urgente', 'atencion urgente'],
    },
    {
      id: 'SIMULAR',
      sinonimos: ['simular', 'simulación', 'simulacion', 'calcular cuota', 'cuánto sería la cuota', 'cuanto seria la cuota', 'cuánto pago', 'cuanto pago', 'tasa', 'plazo', 'capital', 'cuota mensual'],
      patrones: [/simul(?:ar|ación|acion)\s+(?:de\s+)?\$?\s*([\d.]+)/i, /(?:cuánto|cuanto)\s+(?:sería|seria|es|será|sera)\s+(?:la\s+)?cuota/i],
    },
    {
      id: 'DOCUMENTOS',
      sinonimos: ['documentos', 'pagaré', 'pagare', 'carta', 'certificado', 'paz y salvo', 'estado de cuenta', 'tabla de amortización', 'tabla de amortizacion', 'liquidación', 'liquidacion', 'contrato'],
    },
    {
      id: 'CREADOS_HOY',
      sinonimos: ['creados hoy', 'nuevos hoy', 'desembolsados hoy', 'solicitudes de hoy', 'prestamos de hoy', 'qué se desembolsó hoy', 'que se desembolso hoy', 'actividad de hoy'],
    },
  ],

  // === JURIDICO (Asesor Jurídico) ===
  JURIDICO: [
    {
      id: 'CASOS_ACTIVOS',
      sinonimos: ['casos', 'casos activos', 'estado', 'resumen', 'panorama', 'cómo van los casos', 'como van los casos', 'procesos activos', 'juicios activos', 'demandas activas'],
    },
    {
      id: 'CANDIDATOS_JURIDICO',
      sinonimos: ['candidatos', 'escalar', 'enviar a jurídico', 'enviar a juridico', '60 días', '60 dias', 'mora alta', 'para demandar', 'nuevos casos', 'prejurídico', 'prejuridico', 'pre-jurídico', 'pre-juridico'],
    },
    {
      id: 'ALERTAS_LEGALES',
      sinonimos: ['alerta', 'alertas', 'vencimientos legales', 'audiencias', 'plazos', 'términos', 'terminos', 'notificaciones judiciales', 'urgente legal', 'atención legal', 'atencion legal'],
    },
    {
      id: 'CRONOLOGIA',
      sinonimos: ['cronología', 'cronologia', 'historial del caso', 'línea de tiempo', 'linea de tiempo', 'eventos del caso', 'detalle del caso', 'paso a paso', 'seguimiento', 'avance del caso'],
    },
    {
      id: 'DOCUMENTOS_LEGAL',
      sinonimos: ['documentos', 'demanda', 'memorial', 'requerimiento', 'notificación', 'notificacion', 'poder', 'acta', 'escrito', 'auto', 'sentencia', 'recurso'],
    },
    {
      id: 'PORTAL_ABOGADO',
      sinonimos: ['abogado', 'portal del abogado', 'acceso abogado', 'login abogado', 'asignar abogado', 'quién lleva el caso', 'quien lleva el caso', 'despacho', 'bufete'],
    },
    {
      id: 'ASESORIA_PAGARE',
      sinonimos: ['pagaré', 'pagare', 'título valor', 'titulo valor', 'código de comercio', 'codigo de comercio', 'cómo cobro un pagaré', 'como cobro un pagare', 'prescripción pagaré', 'prescripcion pagare', 'acción ejecutiva', 'accion ejecutiva', 'título ejecutivo', 'titulo ejecutivo'],
    },
    {
      id: 'ASESORIA_COBRANZA',
      sinonimos: ['cobranza', 'cobro', 'proceso ejecutivo', 'embargo', 'medidas cautelares', 'secuestro', 'audiencia', 'conciliación', 'conciliacion', 'acuerdo de pago', 'refinanciación', 'refinanciacion', 'reestructuración', 'reestructuracion'],
    },
    {
      id: 'ASESORIA_CONTRATOS',
      sinonimos: ['contrato', 'contratos', 'cláusulas', 'clausulas', 'incumplimiento', 'responsabilidad civil', 'indemnización', 'indemnizacion', 'garantías', 'garantias', 'prescripción', 'prescripcion', 'caducidad'],
    },
    {
      id: 'HABEAS_DATA',
      sinonimos: ['habeas data', 'datos personales', 'ley 1266', 'ley 1581', 'protección de datos', 'proteccion de datos', 'autorización de datos', 'autorizacion de datos', 'privacidad', 'confidencialidad'],
    },
    {
      id: 'REDACCION_JURIDICA',
      sinonimos: ['redactar', 'redacción', 'redaccion', 'elaborar', 'escribir', 'modelo de', 'formato de', 'plantilla de', 'derecho de petición', 'derecho de peticion', 'memorial', 'poder', 'contrato', 'acuerdo de pago', 'requerimiento'],
    },
    {
      id: 'LAVADO_ACTIVOS',
      sinonimos: ['lavado de activos', 'sarlaft', 'sagrilaft', 'conocimiento del cliente', 'kyc', 'operaciones sospechosas', 'ros', 'prevención', 'prevencion', 'cumplimiento', 'regulatorio'],
    },
  ],

  // === SEGURIDAD (Ciberseguridad) ===
  SEGURIDAD: [
    {
      id: 'ESTADO_SEGURIDAD',
      sinonimos: ['estado', 'general', 'cómo está la seguridad', 'como esta la seguridad', 'panorama de seguridad', 'estatus', 'situación de seguridad', 'situacion de seguridad', 'todo bien', 'funcionando', 'está todo bien', 'esta todo bien'],
    },
    {
      id: 'NIVEL_RIESGO',
      sinonimos: ['nivel de riesgo', 'riesgo', 'cómo de riesgo', 'qué tan riesgoso', 'que tan riesgoso', 'semáforo', 'semaforo', 'alerta de riesgo', 'peligro', 'amenaza', 'vulnerabilidad', 'vulnerabilidades'],
    },
    {
      id: 'HALLAZGOS',
      sinonimos: ['hallazgos', 'vulnerabilidades', 'problemas', 'qué encontraste', 'que encontraste', 'qué fallas', 'que fallas', 'incidencias', 'issues', 'bugs de seguridad', 'agujeros'],
    },
    {
      id: 'USUARIOS_RIESGO',
      sinonimos: ['usuarios de riesgo', 'usuarios peligrosos', 'usuarios sospechosos', 'qué usuarios', 'que usuarios', 'cuentas comprometidas', 'accesos sospechosos', 'ips sospechosas', 'fuerza bruta', 'intentos fallidos'],
    },
    {
      id: 'PERMISOS',
      sinonimos: ['permisos', 'accesos', 'privilegios', 'roles', 'quién tiene acceso', 'quien tiene acceso', 'control de acceso', 'rbac', 'autorización', 'autorizacion'],
    },
    {
      id: 'AUDITORIA_LOGS',
      sinonimos: ['auditoría', 'auditoria', 'logs', 'registro de actividad', 'qué pasó', 'que paso', 'eventos', 'historial de acciones', 'trazabilidad', ' quién hizo qué', 'quien hizo que'],
    },
    {
      id: 'ACCESOS_SOSPECHOSOS',
      sinonimos: ['accesos sospechosos', 'ips sospechosas', 'intentos fallidos', 'ataque', 'hackeo', 'intrusión', 'intrusion', 'fuerza bruta', 'login fallido', 'acceso no autorizado'],
    },
    {
      id: 'INFORME_SEGURIDAD',
      sinonimos: ['informe', 'reporte', 'reporte de seguridad', 'auditoría completa', 'auditoria completa', 'documentación de seguridad', 'documentacion de seguridad', 'resumen ejecutivo de seguridad'],
    },
    {
      id: 'PLAN_ACCION_SEG',
      sinonimos: ['plan de acción', 'plan de accion', 'qué hacer', 'que hacer', 'cómo mejorar', 'como mejorar', 'recomendaciones de seguridad', 'prioridades', 'roadmap de seguridad'],
    },
    {
      id: 'MFA',
      sinonimos: ['mfa', 'autenticación multifactor', 'autenticacion multifactor', 'doble factor', '2fa', 'google authenticator', 'authy', 'verificación en dos pasos', 'verificacion en dos pasos'],
    },
    {
      id: 'BACKUPS_SEG',
      sinonimos: ['backups', 'respaldos', 'copias de seguridad', 'cómo están los backups', 'como estan los backups', 'último backup', 'ultimo backup', 'restaurar', 'recuperación', 'recuperacion'],
    },
  ],

  // === ADMIN_GENERAL (Asistente Ejecutivo IA) ===
  ADMIN_GENERAL: [
    {
      id: 'DASHBOARD_CONSOLIDADO',
      sinonimos: ['dashboard', 'estado', 'cómo va el negocio', 'como va el negocio', 'panorama general', 'resumen ejecutivo', 'overview', 'cómo estamos', 'como estamos', 'situación actual', 'situacion actual', 'panorama', 'foto del negocio'],
    },
    {
      id: 'KPI_FINANCIERO',
      sinonimos: ['kpi financieros', 'financiero', 'utilidad', 'cuánto ganamos', 'cuanto ganamos', 'ingresos', 'gastos', 'balance', 'rentabilidad', 'roi', 'margen', 'flujo de caja'],
    },
    {
      id: 'KPI_COMERCIAL',
      sinonimos: ['kpi comerciales', 'comercial', 'clientes', 'ventas', 'nuevos clientes', 'conversión', 'conversion', 'crecimiento', 'recaudo', 'cartera', 'cómo van las ventas', 'como van las ventas'],
    },
    {
      id: 'KPI_OPERATIVO',
      sinonimos: ['kpi operativos', 'operativo', 'operación', 'operacion', 'productividad', 'eficiencia', 'procesos', 'automatización', 'automatizacion', 'cómo operamos', 'como operamos'],
    },
    {
      id: 'ANOMALIAS',
      sinonimos: ['anomalías', 'anomalias', 'problemas', 'qué está mal', 'que esta mal', 'alertas', 'caídas', 'caidas', 'picos', 'comportamiento atípico', 'comportamiento atipico', 'algo raro', 'situaciones críticas', 'situaciones criticas'],
    },
    {
      id: 'TENDENCIAS',
      sinonimos: ['tendencias', 'evolución', 'evolucion', 'hacia dónde vamos', 'hacia donde vamos', 'trayectoria', 'dirección', 'direccion', 'creciendo', 'decreciendo', 'mejorando', 'empeorando'],
    },
    {
      id: 'ANALISIS_ESTRATEGICO',
      sinonimos: ['análisis estratégico', 'analisis estrategico', 'estrategia', 'recomendaciones estratégicas', 'recomendaciones estrategicas', 'qué hacer', 'que hacer', 'decisiones', 'plan estratégico', 'plan estrategico', 'diagnóstico', 'diagnostico'],
    },
    {
      id: 'COMPARATIVOS',
      sinonimos: ['comparativo', 'comparar', 'mes anterior', 'vs mes', 'año anterior', 'ano anterior', 'evolución', 'evolucion', 'diferencia', 'antes vs ahora'],
    },
    {
      id: 'OPORTUNIDADES',
      sinonimos: ['oportunidades', 'qué puedo mejorar', 'que puedo mejorar', 'dónde hay oportunidad', 'donde hay oportunidad', 'crecimiento', 'expandir', 'nuevas oportunidades', 'hallazgos positivos'],
    },
    {
      id: 'PLAN_ACCION',
      sinonimos: ['plan de acción', 'plan de accion', 'prioridades', 'qué hacer primero', 'que hacer primero', 'roadmap', 'hoja de ruta', 'pasos a seguir', 'acciones inmediatas'],
    },
    {
      id: 'AUDITORIA_INTERNA',
      sinonimos: ['auditoría', 'auditoria', 'auditoría interna', 'auditoria interna', 'revisión', 'revision', 'control', 'verificación', 'verificacion', 'qué está mal', 'que esta mal'],
    },
    {
      id: 'CONSULTOR',
      sinonimos: ['comparar opciones', 'consultor', 'qué conviene', 'que conviene', 'análisis de opciones', 'analisis de opciones', 'ventajas y desventajas', 'pros y contras', 'recomendación', 'recomendacion'],
    },
  ],

  // === CONFIGURACION (DevOps IA) ===
  CONFIGURACION: [
    {
      id: 'ESTADO_SISTEMA',
      sinonimos: ['estado', 'general', 'cómo está el sistema', 'como esta el sistema', 'funcionando', 'todo bien', 'está todo bien', 'esta todo bien', 'salud del sistema', 'health check', 'uptime', 'disponibilidad'],
    },
    {
      id: 'BASE_DATOS',
      sinonimos: ['base de datos', 'bd', 'database', 'db', 'qué tamaño tiene la bd', 'que tamaño tiene la bd', 'registros', 'cuántos registros', 'cuantos registros', 'consultas', 'performance de la bd'],
    },
    {
      id: 'DISCO_MEMORIA',
      sinonimos: ['disco', 'memoria', 'recursos', 'almacenamiento', 'cuánto espacio', 'cuanto espacio', 'uso de recursos', 'ram', 'cpu', 'carga', 'rendimiento'],
    },
    {
      id: 'SERVICIOS',
      sinonimos: ['servicios', 'servidor', 'next.js', 'prisma', 'caddy', 'proxy', 'puerto', 'qué servicios están activos', 'que servicios estan activos', 'estado de servicios'],
    },
    {
      id: 'VARIABLES_ENTORNO',
      sinonimos: ['variables de entorno', 'variables', 'env', 'configuración', 'configuracion', 'jwt', 'database_url', 'api_key', 'secretos', 'credenciales', 'qué variables', 'que variables'],
    },
    {
      id: 'SMTP',
      sinonimos: ['smtp', 'correo', 'email', 'notificaciones por correo', 'servidor de correo', 'configuración de correo', 'configuracion de correo'],
    },
    {
      id: 'SSL',
      sinonimos: ['ssl', 'certificado', 'certificados', 'https', 'tls', 'vencimiento ssl', 'renovar certificado', 'lets encrypt', 'seguridad de conexión', 'seguridad de conexion'],
    },
    {
      id: 'INTEGRACIONES',
      sinonimos: ['integraciones', 'apis externas', 'conexiones', 'webhooks', 'whatsapp api', 'bancolombia', 'pse', 'davivienda', 'qué integraciones', 'que integraciones', 'sistemas conectados'],
    },
    {
      id: 'AMBIENTES',
      sinonimos: ['ambientes', 'desarrollo', 'producción', 'produccion', 'staging', 'dev', 'prod', 'qa', 'qué ambiente', 'que ambiente', 'configuración de ambiente', 'configuracion de ambiente'],
    },
    {
      id: 'BACKUPS_DEVOPS',
      sinonimos: ['backups', 'respaldos', 'copias de seguridad', 'último backup', 'ultimo backup', 'frecuencia de backups', 'restaurar backup', 'recuperación', 'recuperacion'],
    },
    {
      id: 'MANTENIMIENTO',
      sinonimos: ['mantenimiento', 'modo mantenimiento', 'down', 'offline', 'pausa', 'actualización', 'actualizacion', 'deploy', 'despliegue'],
    },
    {
      id: 'OPTIMIZACION',
      sinonimos: ['optimización', 'optimizacion', 'mejorar', 'rendimiento', 'performance', 'acelerar', 'cómo mejorar', 'como mejorar', 'recomendaciones', 'plan de mejora', 'sugerencias'],
    },
    {
      id: 'PROBLEMAS_DEVOPS',
      sinonimos: ['problemas', 'errores', 'fallas', 'qué está mal', 'que esta mal', 'issues', 'bugs', 'alertas', 'crítico', 'critico', 'urgente'],
    },
    {
      id: 'SNAPSHOTS',
      sinonimos: ['snapshots', 'snapshot', 'versión del código', 'version del codigo', 'punto de restauración', 'punto de restauracion', 'código fuente', 'codigo fuente', 'exportar código', 'exportar codigo'],
    },
    {
      id: 'VERSIONES',
      sinonimos: ['versiones', 'versión actual', 'version actual', 'qué versión', 'que version', 'changelog', 'cambios de versión', 'cambios de version', 'historial de versiones'],
    },
  ],
}

// =====================================================
// DETECCIÓN DE INTENT POR BOT
// =====================================================
export function detectarIntentBot(botTipo: string, mensaje: string): { intent: string | null; confianza: number; matchData?: any } {
  const mensajeNormalizado = normalizar(mensaje)
  const intents = INTENTS_POR_BOT[botTipo]

  if (!intents) {
    return { intent: null, confianza: 0 }
  }

  let mejorMatch: { intent: string; confianza: number; matchData?: any } | null = null

  for (const intent of intents) {
    // Matching por sinónimos
    for (const sinonimo of intent.sinonimos) {
      const sinonimoNorm = normalizar(sinonimo)
      if (mensajeNormalizado === sinonimoNorm) {
        if (!mejorMatch || 1.0 > mejorMatch.confianza) {
          mejorMatch = { intent: intent.id, confianza: 1.0 }
        }
        continue
      }
      if (mensajeNormalizado.includes(sinonimoNorm)) {
        const confianza = sinonimoNorm.length / mensajeNormalizado.length
        if (!mejorMatch || confianza > mejorMatch.confianza) {
          mejorMatch = { intent: intent.id, confianza }
        }
      }
    }

    // Matching por patrones
    if (intent.patrones) {
      for (const patron of intent.patrones) {
        const match = mensajeNormalizado.match(patron)
        if (match) {
          if (!mejorMatch || 0.9 > mejorMatch.confianza) {
            mejorMatch = { intent: intent.id, confianza: 0.9, matchData: match }
          }
        }
      }
    }
  }

  return {
    intent: mejorMatch?.intent || null,
    confianza: mejorMatch?.confianza || 0,
    matchData: mejorMatch?.matchData,
  }
}

// =====================================================
// NORMALIZACIÓN (sin acentos, signos, minúsculas)
// =====================================================
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[¿?¡!]/g, '')
    .trim()
}

// =====================================================
// DETECCIÓN DE SALUDO/MENÚ
// =====================================================
export function esSaludoOMenu(mensaje: string): boolean {
  const m = normalizar(mensaje)
  const saludos = ['menu', 'menú', 'hola', 'ayuda', 'help', 'hola', 'buenos dias', 'buenas', 'que tal', 'que puedes hacer', 'qué puedes hacer', 'opciones', 'comandos']
  return saludos.some((s) => m === s || m.includes(s))
}

// =====================================================
// EXTRACCIÓN DE MONTO (compartido)
// =====================================================
export function extraerMontoBot(mensaje: string): number | null {
  const m = normalizar(mensaje)

  // "50 mil" → 50000
  const milMatch = m.match(/(\d+)\s*(?:mil|miles)/i)
  if (milMatch) return parseInt(milMatch[1]) * 1000

  // "2 millones" → 2000000
  const millonesMatch = m.match(/(\d+(?:\.\d+)?)\s*(?:millones?|mm|millon)/i)
  if (millonesMatch) return Math.round(parseFloat(millonesMatch[1]) * 1000000)

  // Número con separadores
  const numMatch = m.match(/\$?\s*([\d][\d.,]*)/)
  if (numMatch) {
    const raw = numMatch[1]
    if (raw.includes('.') && raw.includes(',')) {
      const limpio = raw.replace(/\./g, '').replace(',', '.')
      const num = parseFloat(limpio)
      return isNaN(num) ? null : num
    }
    if (raw.includes('.')) {
      const partes = raw.split('.')
      if (partes.length === 2 && partes[1].length === 3) {
        return parseInt(raw.replace(/\./g, ''))
      }
      return parseFloat(raw)
    }
    if (raw.includes(',')) {
      const partes = raw.split(',')
      if (partes.length === 2 && partes[1].length === 3) {
        return parseInt(raw.replace(/,/g, ''))
      }
      return parseFloat(raw.replace(',', '.'))
    }
    return parseInt(raw)
  }

  return null
}

// =====================================================
// VALIDACIÓN DE MONTO
// =====================================================
export function validarMontoBot(monto: number): { valido: boolean; error?: string } {
  if (isNaN(monto)) return { valido: false, error: 'El monto no es un número válido' }
  if (monto <= 0) return { valido: false, error: 'El monto debe ser mayor a 0' }
  if (monto > 1000000000) return { valido: false, error: 'El monto excede el límite máximo (1000 millones)' }
  return { valido: true }
}
