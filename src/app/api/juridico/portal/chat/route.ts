// =====================================================
// /api/juridico/portal/chat — Chat interno del portal jurídico (Jsadr)
// Conversación categorizada como JURIDICO_INTERNO en moduloReferencia.
// El bot "Asesor Jurídico" responde reutilizando la lógica existente
// (lib/asesor-juridico.ts + lib/llm-bot.ts opcional).
//
//   GET  → historial de mensajes (header x-juridico-token o ?token=)
//   POST → envía un mensaje y obtiene la respuesta del bot
//          Body: { token, mensaje, casoId? }
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { formatearMoneda } from '@/lib/finanzas'
import { verificarTokenPortal } from '../auth/route'
import {
  obtenerEstadoModuloJuridico,
  generarResumenJuridico,
  obtenerDetalleCaso,
  generarAnalisisCaso,
} from '@/lib/asesor-juridico'
// === Memoria persistente + dataset jurídico reforzado ===
import {
  guardarMensajeMemoria,
  cargarContextoMemoria,
  construirTextoContexto,
  detectarYRecordarHechos,
  registrarAprendizaje,
} from '@/lib/bot-memoria'
import { buscarMejorMatch } from '@/lib/bot-fuzzy-matcher'
import { getDatasetPorTipo } from '@/lib/bot-datasets'

const BOT_TIPO = 'JURIDICO'
const DATASET_JURIDICO_FULL = getDatasetPorTipo(BOT_TIPO)

const CATEGORIA = 'JURIDICO_INTERNO'

// =====================================================
// Helpers
// =====================================================

async function obtenerOcrearConversacion(
  usuarioId: string,
  usuarioNombre: string,
  cedula: string | null
) {
  const existente = await db.conversacionChat.findFirst({
    where: {
      moduloReferencia: CATEGORIA,
      entidadRefId: usuarioId,
    },
  })
  if (existente) return existente

  // Crear conversación. Necesitamos un clienteId (campo obligatorio).
  // Tomamos el primer cliente disponible solo para satisfacer el constraint.
  const algunCliente = await db.cliente.findFirst({
    where: { activo: true },
    select: { id: true },
  })

  if (!algunCliente) {
    throw new Error('SAFE:No se pudo crear la conversación (sin cliente base)')
  }

  return db.conversacionChat.create({
    data: {
      codigo: `JUR-INT-${cedula || usuarioId.slice(-6)}-${Date.now()}`,
      clienteId: algunCliente.id,
      asesorId: usuarioId,
      asunto: `Chat interno — ${usuarioNombre}`,
      moduloReferencia: CATEGORIA,
      entidadRefId: usuarioId,
      estado: 'ACTIVA',
      otpVerificado: true,
      permiteArchivos: true,
      permiteNotasInternas: true,
      metadata: JSON.stringify({ usuarioId, usuarioNombre, cedula }),
    },
  })
}

// =====================================================
// Lógica del bot "Asesor Jurídico" (reutiliza lib/asesor-juridico.ts)
// =====================================================
async function responderAsesorJuridico(
  mensajeRaw: string,
  usuarioId: string,
  usuarioNombre: string,
  casoId?: string | null
): Promise<{ respuesta: string; tipo: string }> {
  const mensaje = (mensajeRaw || '').trim()
  const lower = mensaje.toLowerCase()

  // === 0. Antes de los comandos numéricos: buscar en dataset jurídico reforzado ===
  // Esto permite responder a "¿qué dice el artículo 1551 del Código Civil?"
  // o "¿cuándo prescribe una deuda?" usando el dataset expandido con normativa colombiana.
  if (mensaje.length >= 5 && !/^\d+$/.test(mensaje.trim())) {
    const match = buscarMejorMatch(mensaje, DATASET_JURIDICO_FULL)
    if (match && match.item && (match.confianza === 'ALTA' || match.confianza === 'MEDIA')) {
      return {
        tipo: 'CONOCIMIENTO_NORMATIVO',
        respuesta: match.item.respuesta,
      }
    }
  }

  // === Saludo conversacional fluido (NO menú) ===
  // El bot juridico conversa como un abogado senior, no muestra menú numerado.
  if (
    lower === '' ||
    lower === 'hola' ||
    lower === 'buenas' ||
    lower === 'buenos días' ||
    lower === 'buenas tardes' ||
    lower === 'buenas noches' ||
    lower === 'saludos' ||
    lower === 'qué tal' ||
    lower === 'que tal' ||
    lower === 'holaa' ||
    lower === 'holas'
  ) {
    return {
      tipo: 'TEXTO',
      respuesta:
        `Hola, ${usuarioNombre}. Soy tu asesor jurídico. Cuéntame en qué te puedo ayudar hoy: ¿tienes una consulta sobre normativa colombiana, un caso de cobro, un pagaré, un proceso judicial, o algo relacionado con la cartera? Soy todo oídos.`,
    }
  }

  // === "Ayuda" / "menú" → respuesta conversacional, no menú numerado ===
  if (lower === 'ayuda' || lower === 'help' || lower === 'menu' || lower === 'menú') {
    return {
      tipo: 'TEXTO',
      respuesta:
        `Claro, te explico cómo te puedo acompañar. Puedo ayudarte con: consultas de normativa colombiana (Código Civil, Comercio, CGP, Habeas Data, Ley 1581 de 2012, etc.), análisis de casos de cobro jurídico, estrategia para demandar o defender un proceso ejecutivo, redacción de requerimientos prejurídicos, revisión de pagarés y títulos valores, gestión de centrales de datos, y seguimiento de la cartera en mora. Si quieres, dime qué tema te trae hoy y lo abordamos paso a paso.`,
    }
  }

  // === Resumen del módulo jurídico ===
  if (
    lower === '1' ||
    lower === '1️⃣' ||
    lower.includes('caso') ||
    lower.includes('estado') ||
    lower.includes('resumen') ||
    lower.includes('panorama')
  ) {
    return { tipo: 'REPORTE', respuesta: await generarResumenJuridico() }
  }

  // === Candidatos a jurídico ===
  if (
    lower === '2' ||
    lower === '2️⃣' ||
    lower.includes('candidato')
  ) {
    const estado = await obtenerEstadoModuloJuridico()
    if (estado.candidatosJuridico.length === 0) {
      return {
        tipo: 'TEXTO',
        respuesta:
          '✅ No hay candidatos a cobro jurídico actualmente.\n\n(Criterio: préstamos con 60+ días de mora sin caso jurídico existente)',
      }
    }
    let r = `⚖️ CANDIDATOS A COBRO JURÍDICO (${estado.candidatosJuridico.length}):\n\n`
    estado.candidatosJuridico.forEach((c, i) => {
      r += `${i + 1}. ${c.cliente} — ${c.diasMora} días mora [${c.severidad}]\n`
      r += `   💰 Saldo: ${formatearMoneda(c.saldoTotal)} | Mora: ${formatearMoneda(c.montoMora)}\n`
      r += `   🎯 Recomendación: ${c.recomendacion}\n\n`
    })
    return { tipo: 'REPORTE', respuesta: r }
  }

  // === Alertas legales ===
  if (lower === '3' || lower === '3️⃣' || lower.includes('alerta')) {
    const estado = await obtenerEstadoModuloJuridico()
    if (estado.alertasPendientes.length === 0) {
      return { tipo: 'TEXTO', respuesta: '✅ No hay alertas legales pendientes.' }
    }
    let r = `🔔 ALERTAS LEGALES PENDIENTES (${estado.alertasPendientes.length}):\n\n`
    estado.alertasPendientes.forEach((a, i) => {
      r += `${i + 1}. ${a.tipo} — ${a.descripcion}\n`
      if (a.caso) r += `   Caso: ${a.caso.codigo} (${a.caso.cliente})\n`
      r += `\n`
    })
    return { tipo: 'REPORTE', respuesta: r }
  }

  // === Análisis de un caso específico ===
  if (
    lower === '4' ||
    lower === '4️⃣' ||
    lower.includes('análisis') ||
    lower.includes('analisis') ||
    lower.includes('detalle') ||
    lower.includes('cronolog')
  ) {
    if (casoId) {
      const texto = await generarAnalisisCaso(casoId)
      if (texto) return { tipo: 'REPORTE', respuesta: texto }
      return { tipo: 'TEXTO', respuesta: '⚠️ No se encontró el caso especificado.' }
    }
    // intentar extraer un id/código del mensaje
    const detalle = await buscarCasoPorTexto(mensaje)
    if (detalle) {
      const texto = await generarAnalisisCaso(detalle.id)
      if (texto) return { tipo: 'REPORTE', respuesta: texto }
    }
    return {
      tipo: 'TEXTO',
      respuesta:
        '📋 ANÁLISIS DE CASO\n\nPara ver el análisis de un caso, escribe su código, ej:\n• "análisis de JUR-2026-001"\n• "detalle del caso ABC-123"\n\n💡 También puedes abrir un caso y pedir el análisis desde ahí.',
    }
  }

  // === Cobranza ===
  if (
    lower === '5' ||
    lower === '5️⃣' ||
    lower.includes('cobran') ||
    lower.includes('cobro')
  ) {
    return {
      tipo: 'TEXTO',
      respuesta:
        `💼 ASESORÍA EN COBRANZA\n\n` +
        `**Etapas de cobro en Colombia:**\n\n` +
        `1. **Cobro persuasivo** (1-30 días):\n   • Llamadas, WhatsApp, correos\n   • Recordatorios amables\n   • Sin acciones legales\n\n` +
        `2. **Cobro prejurídico** (30-60 días):\n   • Requerimiento escrito\n   • Última oportunidad de acuerdo\n   • Preparación documental\n\n` +
        `3. **Cobro judicial** (60+ días):\n   • Proceso ejecutivo (art. 420 CGP)\n   • Si el título es pagaré/letra: proceso ejecutivo single\n   • Medidas cautelares: embargo y secuestro\n   • Audiencia de conciliación\n\n` +
        `**Proceso ejecutivo (Ley 1564/2012 art. 420-423):**\n` +
        `• Título ejecutivo: pagaré, letra, contrato\n` +
        `• Demanda con sus anexos\n` +
        `• Mandamiento de pago\n` +
        `• Excepciones del demandado\n` +
        `• Sentencia y ejecución\n\n` +
        `⚠️ Para analizar un caso específico, dame el código del préstamo.`,
    }
  }

  // === Procesos judiciales ===
  if (
    lower === '6' ||
    lower === '6️⃣' ||
    lower.includes('proceso') ||
    lower.includes('demanda') ||
    lower.includes('embargo') ||
    lower.includes('audiencia')
  ) {
    return {
      tipo: 'TEXTO',
      respuesta:
        `⚖️ PROCESOS JUDICIALES EN COLOMBIA\n\n` +
        `**Proceso Ejecutivo (art. 420 CGP):**\n` +
        `• Aplica para obligaciones con título ejecutivo (pagaré, letra de cambio, sentencia)\n` +
        `• Demanda + título + pruebas\n` +
        `• Mandamiento de pago (auto admisorio)\n` +
        `• Término para excepciones: 10 días\n` +
        `• Audiencia de pruebas y sentencia\n\n` +
        `**Medidas cautelares:**\n` +
        `• Embargo: afecta bienes del demandado\n` +
        `• Secuestro: aprehensión material de bienes\n` +
        `• Inscripción en registro: inmuebles\n` +
        `• Requisitos: presupuesto + contracautela\n\n` +
        `**Recursos:**\n` +
        `• Apelación (art. 320-323 CGP)\n` +
        `• Casación (art. 336-345 CGP)\n` +
        `• Queja (art. 324-329 CGP)\n` +
        `• Revisión (art. 346-352 CGP)\n\n` +
        `**Jurisdicción competente:**\n` +
        `• Juzgados Civiles del Circuito (mayor cuantía)\n` +
        `• Juzgados Civiles Municipales (menor cuantía)\n` +
        `• Cuantía: según salario mínimo (arts. 18-21 CGP)`,
    }
  }

  // === Pagaré / títulos valores ===
  if (
    lower === '7' ||
    lower === '7️⃣' ||
    lower.includes('pagaré') ||
    lower.includes('pagare') ||
    lower.includes('título valor') ||
    lower.includes('titulo valor')
  ) {
    return {
      tipo: 'TEXTO',
      respuesta:
        `📋 ASESORÍA SOBRE PAGARÉ\n\n` +
        `El pagaré es un título valor regulado por el Código de Comercio colombiano (arts. 620-624 y 702-707).\n\n` +
        `**Requisitos del pagaré (art. 621 C.Co.):**\n` +
        `1. La mención de ser "pagaré"\n` +
        `2. La promesa incondicional de pagar una suma determinada\n` +
        `3. El nombre del beneficiario\n` +
        `4. La fecha y lugar de suscripción\n` +
        `5. La fecha de vencimiento\n` +
        `6. Lugar de pago\n` +
        `7. La firma del suscriptor\n\n` +
        `**Acción ejecutiva:** El pagaré es título ejecutivo (art. 488 CGP). La acción prescribe en 3 años desde el vencimiento (art. 784 C.Co.).\n\n` +
        `**Recomendación:** Para cobro judicial, el pagaré permite proceso ejecutivo documental (art. 420 CGP).`,
    }
  }

  // === Habeas data / Lavado de activos ===
  if (
    lower === '8' ||
    lower === '8️⃣' ||
    lower.includes('habeas') ||
    lower.includes('lavado') ||
    lower.includes('datos personales') ||
    lower.includes('cumplimient')
  ) {
    if (lower.includes('lavado')) {
      return {
        tipo: 'TEXTO',
        respuesta:
          `💼 PREVENCIÓN DE LAVADO DE ACTIVOS (LA/FT)\n\n` +
          `**Marco normativo:**\n` +
          `• Ley 599 de 2000 (Código Penal, arts. 323-325)\n` +
          `• Ley 1121 de 2006 (terrorismo)\n` +
          `• Decreto 663 de 1993 (Estatuto Orgánico Financiero)\n\n` +
          `**Obligaciones:**\n` +
          `1. SARLAFT (Sistema de Administración del Riesgo de LA/FT)\n` +
          `2. Conocimiento del cliente (KYC)\n` +
          `3. Reportes de operaciones sospechosas (ROS)\n` +
          `4. Lista vinculante ONU (resolution 1267)\n` +
          `5. Conservación documental (10 años)\n\n` +
          `**Señales de alerta:**\n` +
          `• Transacciones inusuales\n` +
          `• Cliente reacio a dar información\n` +
          `• Origen de fondos no claro\n` +
          `• Múltiples pagos en efectivo`,
      }
    }
    return {
      tipo: 'TEXTO',
      respuesta:
        `🔒 PROTECCIÓN DE DATOS\n\n` +
        `**Marco normativo:**\n` +
        `• Constitución Política art. 15 (derecho fundamental)\n` +
        `• Ley 1266 de 2008 (habeas data financiero)\n` +
        `• Ley 1581 de 2012 (datos personales generales)\n` +
        `• Decreto 1377 de 2013 (reglamentario)\n\n` +
        `**Obligaciones:**\n` +
        `1. Autorización previa del titular (art. 9 Ley 1581)\n` +
        `2. Finalidad específica del tratamiento (art. 4)\n` +
        `3. Conservación por el tiempo necesario\n` +
        `4. Seguridad de la información\n` +
        `5. Atención de consultas y reclamos (arts. 21-23)\n\n` +
        `**Derechos del titular:**\n` +
        `• Acceso, consulta, actualización, rectificación, supresión\n` +
        `• Revocar autorización`,
    }
  }

  // === Default conversacional fluido (NO menú) ===
  // Si el mensaje no coincide con ningún comando ni con el dataset, el bot responde
  // como un abogado senior: pide contexto, ofrece explorar el tema y registra la
  // pregunta como aprendizaje pendiente para revisión posterior.
  return {
    tipo: 'TEXTO',
    respuesta:
      `Mira, ${usuarioNombre}, para responder esa con precisión necesito un poco más de contexto. Cuéntame: ¿es sobre un caso específico de la cartera, una consulta de fondo sobre normativa colombiana, o algo operativo del módulo jurídico? Si me das el detalle del préstamo, del cliente o del documento, te doy una respuesta mucho más útil. También puedo revisar casos activos, candidatos a jurídico o alertas pendientes si me dices qué necesitas ver.`,
  }
}

// Búsqueda heurística de un caso por código/radicado en el texto
async function buscarCasoPorTexto(texto: string) {
  // Buscar códigos tipo ABC-123 o JUR-2026-001
  const match = texto.match(/([A-Z]{2,}-\d{2,}-?\d+)/i)
  if (!match) return null
  const codigo = match[1]
  const caso = await db.casoJuridico.findFirst({
    where: {
      OR: [{ radicado: { contains: codigo } }, { prestamo: { codigo: { contains: codigo } } }],
    },
    select: { id: true },
  })
  return caso
}

// =====================================================
// GET — Historial del chat interno
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const headerToken = req.headers.get('x-juridico-token')
    const token = headerToken || searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido' },
        { status: 401 }
      )
    }

    const usuario = await verificarTokenPortal(token)
    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada' },
        { status: 401 }
      )
    }

    const conversacion = await db.conversacionChat.findFirst({
      where: {
        moduloReferencia: CATEGORIA,
        entidadRefId: usuario.id,
      },
    })

    if (!conversacion) {
      return NextResponse.json({
        success: true,
        data: { mensajes: [], conversacion: null },
      })
    }

    const mensajes = await db.mensajeChat.findMany({
      where: { conversacionId: conversacion.id },
      orderBy: { fechaEnvio: 'asc' },
      take: 200,
    })

    return NextResponse.json({
      success: true,
      data: { mensajes, conversacion },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// =====================================================
// POST — Enviar mensaje y obtener respuesta del bot
// Body: { token, mensaje, casoId? }
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = body.token || req.headers.get('x-juridico-token')
    // Tolerante a ambos nombres de campo: 'mensaje' (canónico) o 'contenido' (legacy)
    const mensaje = body.mensaje || body.contenido || body.texto
    const casoId = body.casoId || null

    if (!token || !mensaje) {
      return NextResponse.json(
        { success: false, error: 'token y mensaje son requeridos' },
        { status: 400 }
      )
    }

    const usuario = await verificarTokenPortal(token)
    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada' },
        { status: 401 }
      )
    }

    const conversacion = await obtenerOcrearConversacion(
      usuario.id,
      usuario.nombre,
      usuario.cedula
    )

    // 1. Persistir el mensaje del abogado
    const mensajeAbogado = await db.mensajeChat.create({
      data: {
        conversacionId: conversacion.id,
        remitenteTipo: 'ASESOR',
        remitenteId: usuario.id,
        remitenteNombre: `Abogado ${usuario.nombre}`,
        contenido: String(mensaje).slice(0, 4000),
        tipoMensaje: 'TEXTO',
        estado: 'ENVIADO',
        fechaEntregado: new Date(),
        metadata: casoId ? JSON.stringify({ casoId }) : null,
      },
    })

    // === 1b. MEMORIA PERSISTENTE: guardar mensaje + detectar hechos ===
    // (paralelo, no bloquea la respuesta)
    const memoriaPromises = [
      guardarMensajeMemoria({
        botTipo: BOT_TIPO,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        conversacionId: conversacion.id,
        rol: 'usuario',
        texto: String(mensaje),
        categoria: casoId ? 'CASO_ESPECIFICO' : undefined,
      }),
      detectarYRecordarHechos({
        botTipo: BOT_TIPO,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        conversacionId: conversacion.id,
        mensaje: String(mensaje),
      }),
    ]

    // 2. Generar la respuesta del bot Asesor Jurídico
    //    (la búsqueda en dataset y la lógica de comandos ocurren dentro)
    const { respuesta, tipo } = await responderAsesorJuridico(
      String(mensaje),
      usuario.id,
      usuario.nombre,
      casoId
    )

    // Esperar las promesas de memoria antes de continuar
    await Promise.all(memoriaPromises)

    // 3. Persistir la respuesta del bot
    const mensajeBot = await db.mensajeChat.create({
      data: {
        conversacionId: conversacion.id,
        remitenteTipo: 'BOT',
        remitenteId: 'asesor-juridico',
        remitenteNombre: 'Asesor Jurídico',
        contenido: respuesta.slice(0, 8000),
        tipoMensaje: 'TEXTO',
        estado: 'ENVIADO',
        fechaEntregado: new Date(),
        metadata: JSON.stringify({ tipo, casoId }),
      },
    })

    // === 3b. MEMORIA PERSISTENTE: guardar respuesta del bot ===
    guardarMensajeMemoria({
      botTipo: BOT_TIPO,
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      conversacionId: conversacion.id,
      rol: 'bot',
      texto: respuesta,
    }).catch(() => {}) // fire-and-forget: no bloquea

    // === 3c. APRENDIZAJE: si la respuesta es el default (no encontró en dataset),
    //       registrar como aprendizaje pendiente para revisión ===
    if (tipo === 'DEFAULT' || tipo === 'TEXTO') {
      registrarAprendizaje({
        botTipo: BOT_TIPO,
        pregunta: String(mensaje),
        respuestaDada: respuesta.slice(0, 500),
        categoria: 'NO_CLASIFICADO',
        fuente: 'PORTAL_JURIDICO',
      }).catch(() => {})
    }

    // 4. Actualizar última actividad
    await db.conversacionChat.update({
      where: { id: conversacion.id },
      data: { ultimaActividad: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        mensaje: mensajeAbogado,
        respuesta: mensajeBot,
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
