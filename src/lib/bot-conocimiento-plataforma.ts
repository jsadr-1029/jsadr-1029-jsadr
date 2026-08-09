// =====================================================
// bot-conocimiento-plataforma.ts — Conocimiento actualizado del bot
// -------------------------------------------------------------------
// Base de conocimiento Q&A que describe TODO lo que la plataforma
// Jsadr hace actualmente, incluyendo las últimas actualizaciones:
//   - Portales directos (/admin, /juridico, /?portal=cliente, /?view=portal-admin)
//   - Seguridad (bcrypt, JWT, MFA TOTP+WhatsApp, rate limiting, audit log, CSRF)
//   - Cajas (4 cajas nuevas: Flexibilidad financiera, Ingresos causados, Pagare+carta, Uso plataforma)
//   - Tarifa de uso de plataforma ($4,900 en creación de préstamo)
//   - Firma manuscrita en flujo de firma electrónica
//   - Portal Admin Companion (P_jsadr — chat admin↔bot)
//   - Restablecimiento de claves (reset global)
//   - Módulos: clientes, préstamos, pagos, juridico, cajas, usuarios, seguridad, auditoría
//   - Confirmación obligatoria de ámbito (negocio/personal) al registrar gasto/ingreso
//
// Este dataset se usa para:
//   1. Que el bot sepa responder preguntas sobre la plataforma
//   2. Que el bot reconozca términos relacionados con cada módulo
//   3. Que el bot sugiera acciones basadas en el contexto
// =====================================================

import type { ItemEntrenamiento } from './bot-fuzzy-matcher'

export const DATASET_CONOCIMIENTO_PLATAFORMA: ItemEntrenamiento[] = [
  // =====================================================
  // PORTALES DIRECTOS (acceso rápido)
  // =====================================================
  {
    id: 'PL-PORTAL-ADMIN',
    categoria: 'PORTALES',
    pregunta: 'como entro al portal admin',
    respuesta:
      'Puedes entrar al portal administrativo directamente desde:\n\n🌐 https://jsadr.com.co/admin\n\nEste enlace te lleva al formulario de login para usuarios ADMIN, GESTOR, CONSULTOR y el companion P_jsadr. Una vez autenticado, el sistema te redirige automáticamente según tu rol:\n\n• ADMIN / GESTOR / CONSULTOR → Dashboard principal\n• P_jsadr → Portal Admin Companion (chat con el bot)\n• ABOGADO → Portal jurídico (/juridico)\n• CLIENTE → Portal de cliente',
    sinonimos: [
      'portal admin', 'como entro al admin', 'acceso admin', 'url admin',
      'enlace admin', 'donde entro admin', 'login admin', 'ruta admin',
      'portal administrativo', 'ingresar admin', 'admin portal',
      '/admin', 'jsadr.com.co/admin', 'directo admin',
    ],
  },
  {
    id: 'PL-PORTAL-JURIDICO',
    categoria: 'PORTALES',
    pregunta: 'como entro al portal juridico',
    respuesta:
      'El portal jurídico (para abogados) está disponible en:\n\n⚖️ https://jsadr.com.co/juridico\n\nEste enlace lleva directo al login específico para usuarios con rol ABOGADO. Una vez autenticado, el abogado ve su panel de casos, cronologías, candidatos a cobro jurídico y herramientas de análisis legal.',
    sinonimos: [
      'portal juridico', 'juridico', 'acceso juridico', 'url juridico',
      'enlace juridico', 'donde entro juridico', 'login juridico',
      'login abogado', 'portal abogados', '/juridico', 'abogado portal',
      'acceso abogado', 'ruta abogado',
    ],
  },
  {
    id: 'PL-PORTAL-CLIENTE',
    categoria: 'PORTALES',
    pregunta: 'como entra un cliente al portal',
    respuesta:
      'Los clientes entran a su portal desde:\n\n👤 https://jsadr.com.co/?portal=cliente\n\nAllí pueden consultar su saldo, ver cuotas, descargar pagares y comunicarse con el sistema. El acceso requiere cédula + clave o token temporal enviado por WhatsApp.',
    sinonimos: [
      'portal cliente', 'portal clientes', 'como entra un cliente',
      'acceso cliente', 'url cliente', 'enlace cliente', 'login cliente',
      'clientes portal', '/?portal=cliente', 'donde entran clientes',
    ],
  },
  {
    id: 'PL-PORTAL-COMPANION',
    categoria: 'PORTALES',
    pregunta: 'que es el portal admin companion',
    respuesta:
      'El Portal Admin Companion es un chat directo entre el administrador y el bot del sistema. Se accede con el usuario P_jsadr desde https://jsadr.com.co/admin.\n\nUna vez autenticado, redirige a la vista /?view=portal-admin donde el admin puede dar instrucciones en lenguaje natural (ej: "registra un gasto de $50.000 por transporte") y el sistema las ejecuta. Soporta comandos numerados (escribe "menu" para verlos).',
    sinonimos: [
      'portal companion', 'admin companion', 'companion admin',
      'chat admin', 'chat bot admin', 'p_jsadr', 'p jsadr',
      'portal admin companion', 'chat directo admin', 'bot admin',
      'asistente admin', 'bot del sistema', 'chat con el bot',
    ],
  },

  // =====================================================
  // SEGURIDAD
  // =====================================================
  {
    id: 'PL-SEGURIDAD-RESUMEN',
    categoria: 'SEGURIDAD',
    pregunta: 'que seguridad tiene la plataforma',
    respuesta:
      'La plataforma Jsadr cuenta con múltiples capas de seguridad:\n\n🔐 Autenticación:\n  • bcrypt (rounds=12) para hash de contraseñas\n  • JWT: access token (15 min) + refresh token (7 días)\n  • MFA / 2FA: TOTP (Google Authenticator) + OTP por WhatsApp\n  • Campos passwordHash + claveHash sincronizados\n\n🛡️ Protección:\n  • Rate limiting: 10 intentos de login/min por IP\n  • Bloqueo de cuenta: 5 intentos fallidos → 30 min\n  • CSRF protection (Origin check → 403 CSRF_DENIED)\n  • Anti-enumeración: mensajes uniformes "Usuario o contraseña incorrectos"\n  • Modo mantenimiento (HTTP 503 si está activo)\n\n📋 Trazabilidad:\n  • Audit log de todos los eventos de seguridad (LOGIN, LOGOUT, MFA, etc.)\n  • Registro de IP, user-agent, timestamp en cada acción',
    sinonimos: [
      'seguridad', 'que seguridad tiene', 'medidas de seguridad',
      'como se protege', 'seguridad plataforma', 'criptografia',
      'encriptacion', 'cifrado', 'bcrypt', 'jwt', 'mfa', '2fa',
      'autenticacion', 'two factor', 'doble factor', 'totp',
      'google authenticator', 'whatsapp otp',
    ],
  },
  {
    id: 'PL-SEGURIDAD-RATELIMIT',
    categoria: 'SEGURIDAD',
    pregunta: 'que pasa si alguien intenta hackear una cuenta',
    respuesta:
      'Si alguien intenta acceder a una cuenta por fuerza bruta:\n\n1. Rate limiting: máximo 10 intentos de login por minuto por IP. Si se excede, se bloquean los intentos por un tiempo.\n\n2. Bloqueo de cuenta: tras 5 intentos fallidos con credenciales inválidas, la cuenta se bloquea durante 30 minutos automáticamente.\n\n3. Anti-enumeración: el sistema siempre responde "Usuario o contraseña incorrectos" (igual para usuario existente o no), para no revelar qué usuarios están registrados.\n\n4. Audit log: cada intento (exitoso o fallido) se registra en AuditLog con IP, user-agent y timestamp. Puedes revisarlos en el panel de Seguridad.',
    sinonimos: [
      'hackear', 'fuerza bruta', 'brute force', 'intentos fallidos',
      'bloqueo de cuenta', 'rate limit', 'limite de intentos',
      'ataque', 'denegacion', 'intentos login', 'cuenta bloqueada',
    ],
  },

  // =====================================================
  // CONFIRMACIÓN OBLIGATORIA DE ÁMBITO (negocio/personal)
  // =====================================================
  {
    id: 'PL-AMBITO-OBLIGATORIO',
    categoria: 'FINANZAS',
    pregunta: 'por que el bot pregunta negocio o personal',
    respuesta:
      'Cada vez que registras un gasto o un ingreso, el bot OBLIGATORIAMENTE te pregunta si es para NEGOCIO o PERSONAL. Esto es ineludible: no se puede registrar el movimiento hasta que confirmes el ámbito.\n\n¿Por qué? Para separar correctamente las finanzas del negocio de las finanzas personales del administrador. Es crítico para:\n  • Contabilidad precisa\n  • Reportes fiscales\n  • clcular la rentabilidad real del negocio\n  • Evitar mezclar gastos personales con gastos empresariales\n\nCómo responder:\n  • "negocio" o "1" → lo asigna al negocio\n  • "personal" o "2" → lo asigna a tu contabilidad personal\n  • "cancelar" → abandona el registro (no se guarda nada)\n\nSi escribes cualquier otra cosa, el bot volverá a preguntar. No puedes saltarte este paso.',
    sinonimos: [
      'por que pregunta negocio o personal', 'ambito obligatorio',
      'confirmar ambito', 'negocio o personal', 'para que sirve el ambito',
      'por que tengo que confirmar', 'no me deja registrar',
      'siempre pregunta', 'para que negocio personal',
      'separar finanzas', 'finanzas personales vs negocio',
    ],
  },

  // =====================================================
  // CAJAS (4 nuevas)
  // =====================================================
  {
    id: 'PL-CAJAS-RESUMEN',
    categoria: 'CAJAS',
    pregunta: 'que cajas tiene el sistema',
    respuesta:
      'El sistema tiene 4 cajas principales:\n\n1. 💸 **Flexibilidad financiera** — Caja para movimientos relacionados con flexibilidad de pagos, refinanciaciones, prórrogas y ajustes de cuotas.\n\n2. 💰 **Ingresos causados** — Registra los ingresos ya causados pero pendientes de cobro efectivo (intereses devengados, comisiones generadas).\n\n3. 📄 **Pagaré + carta** — Caja para gastos asociados a la emisión de pagarés formales y cartas de cobro pre-jurídicas.\n\n4. 🌐 **Tarifa de Uso de Plataforma** — $4.900 COP por cada préstamo creado. Se cobra automáticamente al desembolsar. Es la tarifa que cobra Jsadr por usar la plataforma.',
    sinonimos: [
      'cajas', 'que cajas hay', 'tipos de caja', 'cajas del sistema',
      'cajas disponibles', 'flexibilidad financiera', 'ingresos causados',
      'pagare carta', 'tarifa plataforma', 'tarifa uso plataforma',
      '4900', '4.900', 'caja de flexibilidad', 'caja de ingresos',
    ],
  },
  {
    id: 'PL-CAJA-TARIFA-PLATAFORMA',
    categoria: 'CAJAS',
    pregunta: 'cuanto cuesta usar la plataforma',
    respuesta:
      'Cada vez que se crea un préstamo en la plataforma, se cobra una **Tarifa de Uso de Plataforma de $4.900 COP**. Este monto se descuenta automáticamente al desembolsar el préstamo y se registra en la caja "Tarifa de Uso de Plataforma".\n\nEsta tarifa cubre:\n  • Uso del sistema de firma electrónica\n  • Generación de pagaré digital\n  • Almacenamiento seguro del expediente\n  • Trazabilidad del AuditLog\n  • Soporte del Portal Admin Companion',
    sinonimos: [
      'cuanto cuesta', 'tarifa', 'comision plataforma', 'costo plataforma',
      'precio por prestamo', 'cargo por prestamo', '4900', '4.900',
      'tarifa de uso', 'fee plataforma', 'costo usar jsadr',
    ],
  },

  // =====================================================
  // FIRMA ELECTRÓNICA Y MANUSCRITA
  // =====================================================
  {
    id: 'PL-FIRMA-ELECTRONICA',
    categoria: 'FIRMA',
    pregunta: 'como funciona la firma electronica',
    respuesta:
      'El flujo de firma electrónica de préstamos tiene estos pasos:\n\n1. **Generación del pagaré digital** — Al crear el préstamo, se genera un PDF con el pagaré y la tabla de amortización.\n\n2. **Confirmación por email** — Se envían códigos de 6 caracteres al deudor (y codeudor si aplica) por email. El cliente debe compartir el código con el gestor para verificar.\n\n3. **Firma manuscrita digital** — Como paso final, el cliente dibuja su firma en pantalla (touch o mouse). Esta firma se incrusta en el PDF.\n\n4. **Activación** — Una vez verificadas las firmas del deudor (y codeudor si aplica), el préstamo se activa y se desembolsa.\n\nTodo el proceso queda registrado en AuditLog con timestamp, IP y dispositivo.',
    sinonimos: [
      'firma electronica', 'firma digital', 'firma de prestamo',
      'como se firma', 'firmar prestamo', 'pagare firma',
      'firma manuscrita', 'firma a mano', 'dibujar firma',
      'firma en pantalla', 'firma touch', 'firma mouse',
    ],
  },

  // =====================================================
  // RESTABLECIMIENTO DE CONTRASEÑAS
  // =====================================================
  {
    id: 'PL-RESET-CLAVES',
    categoria: 'USUARIOS',
    pregunta: 'como se resetean las contrasenas',
    respuesta:
      'Hay 2 formas de restablecer contraseñas:\n\n1. **Reset individual** — El admin puede resetear la contraseña de un usuario específico desde el panel de Usuarios. El usuario recibirá una clave temporal que debe cambiar en su próximo login (mustChangePassword=true).\n\n2. **Reset global** — Solo lo hace el super-admin mediante un script seguro (scripts/_reset-todas-claves.cjs). Cambia la contraseña de TODOS los usuarios a un valor estándar, fuerza mustChangePassword=true, invalida sesiones activas y registra el evento en AuditLog con acción CLAVE_RESTABLECIDA_GLOBAL.\n\nEn ambos casos:\n  • Se usa bcrypt con rounds=12 (irreversible)\n  • Se actualizan passwordHash y claveHash\n  • Se resetea intentosFallidos=0\n  • Se limpia bloqueadoHasta=null\n  • Se invalidan tokens de sesión activos\n  • Se crea entrada en AuditLog',
    sinonimos: [
      'resetear claves', 'cambiar contrasenas', 'restablecer password',
      'olvide mi clave', 'recuperar clave', 'reset password',
      'cambio global', 'reset global', 'reset todas las claves',
      'must change password', 'forzar cambio clave',
    ],
  },

  // =====================================================
  // USUARIOS Y ROLES
  // =====================================================
  {
    id: 'PL-USUARIOS-ROLES',
    categoria: 'USUARIOS',
    pregunta: 'que roles hay en el sistema',
    respuesta:
      'El sistema maneja estos roles de usuario:\n\n👤 **ADMIN** — Acceso total. Puede gestionar usuarios, configurar el sistema, ver todos los módulos.\n\n👥 **GESTOR** — Crea préstamos, registra pagos, gestiona clientes. No puede gestionar usuarios.\n\n👁️ **CONSULTOR** — Solo lectura. Ve reportes y dashboards pero no puede modificar.\n\n⚖️ **ABOGADO** — Acceso al portal jurídico (/juridico). Ve casos, cronologías, candidatos a cobro jurídico.\n\n🤖 **P_jsadr (Companion)** — Usuario especial (rol GESTOR) que da acceso al Portal Admin Companion. Es el chat directo entre el admin y el bot del sistema.\n\n👤 **CLIENTE** — Acceso al portal de cliente (/?portal=cliente). Solo ve sus propios préstamos y pagos.',
    sinonimos: [
      'roles', 'que roles hay', 'tipos de usuario', 'jerarquia usuarios',
      'permisos', 'admin', 'gestor', 'consultor', 'abogado', 'cliente',
      'p_jsadr', 'companion', 'roles del sistema', 'niveles de acceso',
    ],
  },

  // =====================================================
  // MÓDULOS DE LA PLATAFORMA
  // =====================================================
  {
    id: 'PL-MODULOS-RESUMEN',
    categoria: 'PLATAFORMA',
    pregunta: 'que modulos tiene la plataforma',
    respuesta:
      'La plataforma Jsadr tiene estos módulos principales:\n\n📊 **Dashboard** — KPIs, resumen ejecutivo, alertas\n👥 **Clientes** — CRUD de clientes, historial crediticio\n💵 **Préstamos** — Creación, firma electrónica, desembolso, seguimiento\n💳 **Pagos** — Registro de pagos, amortización, comprobantes\n⚖️ **Jurídico** — Casos, cronologías, candidatos a cobro judicial\n💰 **Cajas** — 4 cajas: Flexibilidad, Ingresos causados, Pagare+carta, Tarifa plataforma\n📈 **Cobros** — Gestión de cartera, morosos, recordatorios WhatsApp\n📊 **Reportes** — Reportes ejecutivos, rentabilidad, anomalías\n🔐 **Seguridad** — Auditoría, hallazgos, MFA, rate limiting\n⚙️ **Usuarios** — CRUD de usuarios, roles, permisos\n🤖 **Bot Admin** — Chat admin↔sistema (Portal Companion)\n\nCada módulo tiene su bot especializado (Asistente Cobros, Asesor Jurídico, Ciberseguridad, etc.)',
    sinonimos: [
      'modulos', 'que modulos hay', 'secciones', 'areas del sistema',
      'funcionalidades', 'que hace la plataforma', 'capacidades',
      'menu principal', 'opciones del sistema', 'modulos jsadr',
    ],
  },

  // =====================================================
  // PRÉSTAMOS — FLUJO COMPLETO
  // =====================================================
  {
    id: 'PL-PRESTAMO-FLUJO',
    categoria: 'PRESTAMOS',
    pregunta: 'como se crea un prestamo',
    respuesta:
      'El flujo completo de creación de préstamo:\n\n1. **Datos del cliente** — Seleccionas el cliente (o creas uno nuevo con cédula, nombre, teléfono, email).\n\n2. **Condiciones del préstamo** — Monto, frecuencia (quincenal/mensual), número de cuotas, tasa de interés. El sistema valida que no supere la Ley de Usura (1.5x tasa corriente).\n\n3. **Codeudor (opcional)** — Si el préstamo requiere codeudor, se ingresan sus datos.\n\n4. **Tarifa de plataforma** — Se cobra $4.900 COP automáticamente. Se registra en la caja "Tarifa de Uso de Plataforma".\n\n5. **Generación del pagaré** — Se crea el PDF con pagaré + tabla de amortización.\n\n6. **Confirmación por email** — Se envían códigos de 6 caracteres al deudor (y codeudor). Deben ser verificados por el gestor.\n\n7. **Firma manuscrita** — El cliente dibuja su firma en pantalla. Se incrusta en el PDF.\n\n8. **Activación** — Una vez verificadas todas las firmas, el préstamo pasa a estado ACTIVO y se desembolsa.\n\nTodo queda registrado en AuditLog con timestamps.',
    sinonimos: [
      'crear prestamo', 'nuevo prestamo', 'como se crea',
      'flujo de prestamo', 'desembolso', 'proceso de prestamo',
      'generar prestamo', 'registrar prestamo', 'solicitud prestamo',
    ],
  },

  // =====================================================
  // AUDIT LOG
  // =====================================================
  {
    id: 'PL-AUDIT-LOG',
    categoria: 'AUDITORIA',
    pregunta: 'que es el audit log',
    respuesta:
      'El Audit Log es el registro inmutable de TODAS las acciones importantes del sistema. Cada entrada incluye:\n\n• usuarioId + usuarioNombre (quién hizo la acción)\n• accion (LOGIN, CREATE, UPDATE, DELETE, REVERSAR, APROBAR, etc.)\n• modulo (clientes, prestamos, pagos, juridico, cajas, usuarios, etc.)\n• entidadId + entidadNombre (qué entidad afectó)\n• detalles (JSON con campos modificados)\n• ipOrigen + userAgent (desde dónde)\n• exito (true/false)\n• errorMessage (si falló)\n• fecha (timestamp)\n\nPuedes consultarlo en Seguridad → Auditoría. Sirve para trazabilidad, cumplimiento normativo y detección de anomalías.',
    sinonimos: [
      'audit log', 'auditoria', 'bitacora', 'logs', 'historial',
      'rastro', 'eventos', 'trazabilidad', 'log de auditoria',
      'quien hizo que', 'registro de acciones',
    ],
  },

  // =====================================================
  // COMANDOS DEL BOT (ayuda)
  // =====================================================
  {
    id: 'PL-BOT-COMANDOS',
    categoria: 'AYUDA',
    pregunta: 'que puedo hacer con el bot',
    respuesta:
      'Puedes pedirme en lenguaje natural o con comandos numerados:\n\n💰 **FINANZAS**\n  1. Registrar gasto (te preguntaré NEGOCIO/PERSONAL obligatoriamente)\n  2. Registrar ingreso (te preguntaré NEGOCIO/PERSONAL obligatoriamente)\n  3. Balance del mes\n  4. Gastos por categoría\n  5. Crear presupuesto\n  6. Crear meta de ahorro\n  7. Reporte mensual\n\n📊 **SISTEMA**\n  8. Estado de préstamos\n  9. Préstamos en mora\n  10. Estado de cartera\n  11. Auditoría reciente\n  12. Alertas activas\n  13. Crear evento/recordatorio\n  14. Resumen jurídico\n\n📈 **ANÁLISIS**\n  15. Recomendaciones financieras\n  16. Análisis predictivo 90 días\n  17. Comparativo mes anterior\n  18. Dashboard ejecutivo consolidado\n\n🔐 **SEGURIDAD**\n  19. Informe de seguridad\n  20. Estado del sistema (DevOps)\n\n⚙️ **CONFIG**\n  21. Configurar ámbito preferido\n\n❓ **AYUDA**\n  22. Repetir último comando\n  23. Aprender nueva frase\n  0/menu — Ver menú completo\n\nEscribe solo el número (ej: 3) o lenguaje natural (ej: "balance del mes").',
    sinonimos: [
      'que puedo hacer', 'comandos', 'menu', 'ayuda', 'help',
      'opciones', 'funciones del bot', 'para que sirves',
      'que haces', 'capacidades', 'que sabes hacer',
    ],
  },
]

// =====================================================
// Helper: buscar respuesta de conocimiento
// =====================================================
export function buscarConocimientoPlataforma(mensaje: string): string | null {
  const mensajeLower = mensaje.toLowerCase()
  for (const item of DATASET_CONOCIMIENTO_PLATAFORMA) {
    const sinonimos = item.sinonimos ?? []
    for (const sinonimo of sinonimos) {
      if (mensajeLower.includes(sinonimo.toLowerCase())) {
        return item.respuesta
      }
    }
  }
  return null
}
