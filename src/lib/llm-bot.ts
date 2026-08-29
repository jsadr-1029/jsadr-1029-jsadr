// =====================================================
// llm-bot.ts — Servicio de LLM para los bots del sistema
// Usa z-ai-web-dev-sdk (GLM) para generar respuestas con IA
// Solo usable en backend (server-side)
// =====================================================

import ZAI, { ChatMessage } from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// Tipos
// =====================================================
export interface ContextoBot {
  botNombre: string
  botTipo: string
  instrucciones: string
  clienteId?: string
  clienteNombre?: string
  conversacionId?: string
  // Historial de mensajes recientes para mantener contexto
  historial?: Array<{ remitenteTipo: string; contenido: string; fechaEnvio: string }>
}

export interface RespuestaLLM {
  respuesta: string
  escalar: boolean // true si el LLM dice que no puede responder
  fuente: 'LLM' | 'FALLBACK'
}

// Cache de instancia ZAI para no recrear en cada llamada
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// =====================================================
// Construye el system prompt con todo el contexto del bot
// =====================================================
async function construirSystemPrompt(ctx: ContextoBot): Promise<string> {
  const partes: string[] = []

  // 1. Instrucciones del bot (prompt principal)
  if (ctx.instrucciones) {
    partes.push(ctx.instrucciones)
  }

  // 2. Contexto del cliente (si está autenticado)
  if (ctx.clienteId) {
    try {
      const cliente = await db.cliente.findUnique({
        where: { id: ctx.clienteId },
        select: {
          id: true, nombre: true, cedula: true, telefono: true, email: true,
        }
      })

      if (cliente) {
        partes.push('\n\n## CONTEXTO DEL CLIENTE ACTUAL\n')
        partes.push(`- Nombre: ${cliente.nombre}`)
        partes.push(`- Cédula: ${cliente.cedula}`)
        partes.push(`- Teléfono: ${cliente.telefono}`)
        if (cliente.email) partes.push(`- Email: ${cliente.email}`)

        // Solicitudes activos del cliente
        const prestamos = await db.prestamo.findMany({
          where: { clienteId: cliente.id, estado: { in: ['ACTIVO', 'EN_MORA'] } },
          select: {
            id: true, codigo: true, montoPrincipal: true, saldoTotal: true,
            montoCuota: true, numeroCuotas: true, cuotasPagadas: true,
            fechaVencimiento: true, diasMora: true, estado: true, frecuencia: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })

        if (prestamos.length > 0) {
          partes.push('\n### SOLICITUDES ACTIVOS DEL CLIENTE\n')
          prestamos.forEach((p, i) => {
            partes.push(
              `${i + 1}. Crédito ${p.codigo}:\n` +
              `   - Estado: ${p.estado}${p.estado === 'EN_MORA' ? ` (${p.diasMora} días de mora)` : ''}\n` +
              `   - Saldo pendiente: ${formatearMoneda(p.saldoTotal)}\n` +
              `   - Cuota: ${formatearMoneda(p.montoCuota)} (${p.frecuencia})\n` +
              `   - Cuotas pagadas: ${p.cuotasPagadas} de ${p.numeroCuotas}\n` +
              `   - Vencimiento: ${p.fechaVencimiento ? new Date(p.fechaVencimiento).toLocaleDateString('es-CO') : 'N/A'}`
            )
          })
        } else {
          partes.push('\n### SOLICITUDES ACTIVOS: el cliente no tiene solicitudes activos actualmente.')
        }

        // Últimos pagos del cliente (para contexto)
        const ultimosPagos = await db.pago.findMany({
          where: {
            prestamo: { clienteId: cliente.id },
            estado: 'APLICADO',
          },
          orderBy: { fechaPago: 'desc' },
          take: 5,
          select: {
            montoTotal: true, fechaPago: true, prestamo: { select: { codigo: true } },
          },
        })

        if (ultimosPagos.length > 0) {
          partes.push('\n### ÚLTIMOS PAGOS REGISTRADOS\n')
          ultimosPagos.forEach((p) => {
            partes.push(
              `- ${new Date(p.fechaPago || new Date()).toLocaleDateString('es-CO')}: ${formatearMoneda(p.montoTotal)} (crédito ${p.prestamo.codigo})`
            )
          })
        }
      }
    } catch (e) {
      // Si falla, continuamos sin contexto del cliente
    }
  }

  // 3. FAQs activas (para que el LLM sepa qué responder en temas comunes)
  try {
    const faqs = await db.faqBot.findMany({
      where: { activa: true },
      select: { pregunta: true, respuesta: true, categoria: true },
      take: 20,
    })

    if (faqs.length > 0) {
      partes.push('\n\n## PREGUNTAS FRECUENTES (FAQs) AUTORIZADAS\n')
      partes.push('Usa estas respuestas como referencia. Si la consulta del cliente coincide con una FAQ, responde con esa información:\n')
      faqs.forEach((f, i) => {
        partes.push(`\n${i + 1}. P: ${f.pregunta}`)
        partes.push(`   R: ${f.respuesta}`)
      })
    }
  } catch (e) {
    // Si falla, continuamos sin FAQs
  }

  // 4. Reglas de escalamiento (CRÍTICO)
  partes.push('\n\n## REGLAS DE ESCALAMIENTO\n')
  partes.push('Si la consulta del cliente es sobre:')
  partes.push('- Quejas, reclamos o disputas')
  partes.push('- Modificación de saldos, pagos o estados de solicitud (NUNCA lo hagas)')
  partes.push('- Aprobación de solicitudes (NUNCA apruebes)')
  partes.push('- Datos personales sensibles que no seas del cliente actual')
  partes.push('- Temas fuera del alcance de Jsadr (compras externas, otros bancos, etc.)')
  partes.push('- Información que no tengas en el contexto anterior')
  partes.push('')
  partes.push('ENTONCES debes responder EXACTAMENTE con esta frase (sin agregar nada más):')
  partes.push('"ESCALAR: Esta consulta requiere atención de un asesor humano."')
  partes.push('')
  partes.push('En cualquier otro caso, responde directamente al cliente de forma útil y cordial.')

  // 5. Formato de respuesta
  partes.push('\n\n## FORMATO DE RESPUESTA\n')
  partes.push('- Responde en español (Colombia).')
  partes.push('- Sé conciso: máximo 3 párrafos o 200 palabras.')
  partes.push('- Usa formato de texto plano (no markdown).')
  partes.push('- Puedes usar emojis con moderación (1-2 por mensaje).')
  partes.push('- NO inventes información. Si no la tienes, escala.')
  partes.push('- NO uses comillas dobles en la respuesta.')
  partes.push('- Trata al cliente de "tú".')

  return partes.join('\n')
}

// =====================================================
// Construye el historial de mensajes en formato ChatMessage[]
// =====================================================
function construirMensajes(
  systemPrompt: string,
  historial: Array<{ remitenteTipo: string; contenido: string; fechaEnvio: string }> | undefined,
  mensajeActual: string
): ChatMessage[] {
  const mensajes: ChatMessage[] = [
    { role: 'assistant', content: systemPrompt }
  ]

  // Agregar historial (últimos 10 mensajes para no exceder tokens)
  if (historial && historial.length > 0) {
    const ultimos = historial.slice(-10)
    for (const m of ultimos) {
      // Mapear remitenteTipo a roles del chat
      if (m.remitenteTipo === 'CLIENTE') {
        mensajes.push({ role: 'user', content: m.contenido })
      } else if (m.remitenteTipo === 'ASESOR' || m.remitenteTipo === 'SISTEMA') {
        // Asesor/Sistema → assistant
        mensajes.push({ role: 'assistant', content: m.contenido })
      }
    }
  }

  // Mensaje actual del cliente
  mensajes.push({ role: 'user', content: mensajeActual })

  return mensajes
}

// =====================================================
// Función principal: generar respuesta con LLM
// =====================================================
export async function generarRespuestaLLM(
  ctx: ContextoBot,
  mensajeCliente: string
): Promise<RespuestaLLM> {
  try {
    const systemPrompt = await construirSystemPrompt(ctx)
    const mensajes = construirMensajes(systemPrompt, ctx.historial, mensajeCliente)

    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: mensajes,
      stream: false,
      thinking: { type: 'disabled' },
    })

    const respuesta = completion.choices?.[0]?.message?.content?.trim()

    if (!respuesta) {
      return {
        respuesta: 'Lo siento, no pude procesar tu consulta en este momento. Por favor, escribe "asesor" para hablar con un humano.',
        escalar: true,
        fuente: 'FALLBACK',
      }
    }

    // Detectar si el LLM quiere escalar
    const quiereEscalar = respuesta.toUpperCase().includes('ESCALAR:') ||
                          respuesta.includes('asesor humano') ||
                          respuesta.includes('no tengo información suficiente')

    // Limpiar la respuesta si incluye el marcador ESCALAR:
    let respuestaLimpia = respuesta
    if (quiereEscalar) {
      respuestaLimpia = 'Gracias por tu consulta. No tengo información suficiente para responder esto con seguridad. Voy a escalar tu caso a un asesor humano, quien te responderá a la brevedad. Tu conversación queda marcada como pendiente.'
    }

    return {
      respuesta: respuestaLimpia,
      escalar: quiereEscalar,
      fuente: 'LLM',
    }
  } catch (error: any) {
    console.error('[LLM] Error generando respuesta:', error?.message || error)
    return {
      respuesta: 'Lo siento, tengo un problema técnico en este momento. Por favor, escribe "asesor" para hablar con un humano.',
      escalar: true,
      fuente: 'FALLBACK',
    }
  }
}

// =====================================================
// Verifica si el LLM está disponible
// =====================================================
export async function verificarLLM(): Promise<boolean> {
  try {
    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'Responde solo "OK".' },
        { role: 'user', content: 'test' },
      ],
      stream: false,
      thinking: { type: 'disabled' },
    })
    return !!completion.choices?.[0]?.message?.content
  } catch (e) {
    return false
  }
}
