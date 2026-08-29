import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { formatearMoneda } from '@/lib/finanzas'
import { generarRespuestaLLM } from '@/lib/llm-bot'
import { registrarMovimiento, obtenerDashboard, detectarAlertas, crearPresupuesto, crearMeta, generarReporte } from '@/lib/asistente-personal'
import { clasificarConIA, guardarMemoria, obtenerMemoria, generarAnalisisPredictivo, generarComparativoMes, generarConsejosAhorro, generarListaPreguntas } from '@/lib/asistente-personal-mejorado'
import { detectarIntent, extraerMonto, extraerAmbito, extraerConcepto, detectarPeriodo, buscarRespuestaQA, normalizarMensaje, validarMonto } from '@/lib/nlp-asistente'
import { detectarIntentBot, normalizar, esSaludoOMenu, extraerMontoBot, validarMontoBot } from '@/lib/nlp-todos-bots'
import { obtenerEstadoCartera, generarResumenEjecutivo, generarAnalisisEstrategico } from '@/lib/asistente-cobros'
import { obtenerEstadoModuloPrestamos, generarDashboardEjecutivo, generarAnalisisRentabilidad, simularPrestamo } from '@/lib/asistente-prestamos'
import { obtenerEstadoModuloJuridico, generarResumenJuridico, obtenerDetalleCaso, generarAnalisisCaso } from '@/lib/asesor-juridico'
import { auditarSistema as auditarSeguridad, generarInformeSeguridad, generarPlanAccion } from '@/lib/ciberseguridad'
import { obtenerDashboardConsolidado, generarDashboardEjecutivoConsolidado, generarAnalisisEstrategicoConsolidado } from '@/lib/asistente-ejecutivo'
import { auditarSistema as auditarDevOps, generarEstadoSistema, generarPlanOptimizacion } from '@/lib/devops-ia'

// =====================================================
// POST /api/admin/portal/chat
// Recibe una instrucción del administrador, la interpreta,
// ejecuta la acción si la reconoce, y responde con un mensaje.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mensaje, token, botTipo, botNombre, clienteId } = body

    if (!mensaje || typeof mensaje !== 'string') {
      return NextResponse.json(
        { success: false, error: 'mensaje es requerido' },
        { status: 400 }
      )
    }

    // Verificar token del admin
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    // === RESPUESTA A CONFIRMACIÓN DE ÁMBITO (Negocio/Personal) — OBLIGATORIA ===
    // FIX-CRÍTICO: este handler debe ejecutarse ANTES del branch `if (botTipo)`
    // para que las respuestas "negocio"/"personal" funcionen incluso cuando
    // el chat se envía con un botTipo específico (p.ej. ADMIN_SISTEMA).
    //
    // COMPORTAMIENTO (nuevo):
    //   a) Admin responde "negocio"/"personal"/"1"/"2"/"n"/"p" → REGISTRA
    //   b) Admin pide "menu"/"ayuda"/"hola"/"cancelar"/"salir" → CANCELA y continúa
    //   c) Admin escribe cualquier otra cosa → RE-PREGUNTA (NO cancela, NO registra)
    //      La confirmación es OBLIGATORIA para poder registrar el movimiento.
    const sessionIdPre = token || 'admin-session'
    const memoriaPre = obtenerMemoria(sessionIdPre)
    if (memoriaPre?.pendienteConfirmarAmbito) {
      const pendiente = memoriaPre.pendienteConfirmarAmbito
      // Expiración: 10 minutos (tiempo amplio para que el admin responda)
      if (Date.now() - pendiente.timestamp > 10 * 60 * 1000) {
        guardarMemoria(sessionIdPre, { pendienteConfirmarAmbito: undefined } as any)
      } else {
        const mensajeLowerPre = mensaje.toLowerCase().trim()
        const esNegocio = mensajeLowerPre === 'negocio' || mensajeLowerPre === '1' || mensajeLowerPre.includes('negocio') || mensajeLowerPre.includes('empresa') || mensajeLowerPre === 'n'
        const esPersonal = mensajeLowerPre === 'personal' || mensajeLowerPre === '2' || (mensajeLowerPre.includes('personal') && !mensajeLowerPre.includes('personalizar')) || mensajeLowerPre === 'p'

        // Comandos que permiten SALIR del flujo de confirmación sin registrar
        const esComandoNavegacion =
          mensajeLowerPre === 'menu' ||
          mensajeLowerPre === 'menú' ||
          mensajeLowerPre === 'ayuda' ||
          mensajeLowerPre === 'hola' ||
          mensajeLowerPre === 'cancelar' ||
          mensajeLowerPre === 'salir' ||
          mensajeLowerPre === 'cancel'

        if (esNegocio || esPersonal) {
          const ambito = esNegocio ? 'NEGOCIO' : 'PERSONAL'
          try {
            const resultado = await registrarMovimiento({
              tipo: pendiente.tipo === 'GASTO' ? 'EGRESO' : 'INGRESO',
              monto: pendiente.monto,
              concepto: pendiente.concepto,
              ambito: ambito as 'NEGOCIO' | 'PERSONAL',
              usuarioNombre: 'Admin',
            })
            const detalleAccionP = `${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} ${ambito}: ${formatearMoneda(pendiente.monto)} | Motivo: ${pendiente.concepto} | Categoría: ${resultado.categoriaNombre}`
            const respuestaP = resultado.success
              ? `✅ ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} registrado (${ambito})\n\n💰 Monto: ${formatearMoneda(pendiente.monto)}\n📝 Motivo: ${pendiente.concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n📅 ${new Date().toLocaleString('es-CO')}`
              : `❌ ${resultado.mensaje}`
            guardarMemoria(sessionIdPre, {
              pendienteConfirmarAmbito: undefined,
              ultimoMovimientoId: resultado.movimientoId,
              ultimoMovimientoTipo: pendiente.tipo,
              ultimoMovimientoMonto: pendiente.monto,
              ultimoMovimientoConcepto: pendiente.concepto,
              ultimoMovimientoAmbito: ambito as any,
              ultimoMovimientoCategoria: resultado.categoriaNombre,
            } as any)
            return NextResponse.json({
              success: true,
              data: {
                respuesta: respuestaP,
                tipo: 'ACCION' as const,
                accionEjecutada: resultado.success,
                detalleAccion: detalleAccionP,
              },
            })
          } catch (e) {
            guardarMemoria(sessionIdPre, { pendienteConfirmarAmbito: undefined } as any)
            return NextResponse.json({
              success: true,
              data: {
                respuesta: `❌ No pude registrar el movimiento. Error: ${e instanceof Error ? e.message : 'desconocido'}`,
                tipo: 'TEXTO' as const,
                accionEjecutada: false,
                detalleAccion: '',
              },
            })
          }
        }

        if (esComandoNavegacion) {
          // El admin quiere salir del flujo de confirmación sin registrar
          guardarMemoria(sessionIdPre, { pendienteConfirmarAmbito: undefined } as any)
          // Caer al flujo normal (no retornar aquí)
        } else {
          // === RE-PREGUNTAR: la confirmación es OBLIGATORIA ===
          // No cancelamos el pendiente. El admin debe responder explícitamente.
          return NextResponse.json({
            success: true,
            data: {
              respuesta: `🔒 **Tienes un ${pendiente.tipo === 'GASTO' ? 'gasto' : 'ingreso'} pendiente de confirmar.**\n\n💰 Monto: ${formatearMoneda(pendiente.monto)}\n📝 ${pendiente.tipo === 'GASTO' ? 'Motivo' : 'Concepto'}: ${pendiente.concepto}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ **DEBES confirmar el ámbito para continuar**\n━━━━━━━━━━━━━━━━━━\n\nResponde:\n  • **negocio** o **1** → ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} del negocio\n  • **personal** o **2** → ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} personal\n  • **cancelar** → abandona el registro (no se guarda nada)`,
              tipo: 'CONFIRMACION' as const,
              accionEjecutada: false,
              detalleAccion: '',
            },
          })
        }
      }
    }

    // === Si viene de un bot específico (BotIcons), responder según su especialidad ===
    // Todos los bots con tipo definido pasan por responderSegunBot, incluyendo Admin Guardian.
    // Excepción: si NO hay botTipo, es el chat admin genérico del menú principal.
    if (botTipo) {
      return responderSegunBot(botTipo, botNombre || 'Bot', mensaje, clienteId, token || 'admin-session')
    }

    // === NUEVO MOTOR BOT-ADMIN v2.0 ===
    // Si el mensaje empieza con un número (comando), "menu", o es lenguaje natural,
    // pasar al nuevo motor con NLU + aprendizaje + comandos numerados.
    try {
      const { procesarMensajeAdmin } = await import('@/lib/bot-admin-v2')
      const sessionId = token || 'admin-session'
      const resp = await procesarMensajeAdmin(mensaje, sessionId)
      // Devolver en el formato que espera el frontend (objeto con "respuesta")
      return NextResponse.json({
        success: true,
        data: {
          respuesta: resp.texto,
          tipo: resp.tipo,
          accionEjecutada: resp.accionEjecutada || false,
          detalleAccion: resp.detalleAccion || '',
          // Y también como array para compatibilidad
          mensajes: [{
            id: `resp-${Date.now()}`,
            rol: 'BOT',
            contenido: resp.texto,
            timestamp: new Date().toISOString(),
            tipo: resp.tipo,
          }],
        },
      })
    } catch (err: any) {
      console.error('[BotAdmin v2] Error:', err)
      // Si falla el nuevo motor, cae al flujo regex legacy más abajo
    }

    // === FLUJO LEGACY (fallback si el nuevo motor falla) ===
    // === INTERPRETAR LA INSTRUCCIÓN DEL ADMIN ===
    const mensajeLower = mensaje.toLowerCase().trim()
    let respuesta = ''
    let tipo: 'TEXTO' | 'ACCION' | 'REPORTE' | 'CONFIRMACION' = 'TEXTO'
    let accionEjecutada = false
    let detalleAccion = ''

    // Pre-calcular match de gasto para usar en el else if
    const gastoMatch = mensajeLower.match(/(?:registra|registrar|anota|anotar|crea|crear|aplica|aplicar|gaste|gasté|gaste)?\s*(?:un\s+)?gasto\s+de\s+\$?([\d.]+)/i)

    // === RESPUESTA A CONFIRMACIÓN DE ÁMBITO (Negocio/Personal) ===
    // Si hay un movimiento pendiente de confirmar ámbito, procesarlo
    const sessionId = token || 'admin-session'
    const memoriaActual = obtenerMemoria(sessionId)
    if (memoriaActual?.pendienteConfirmarAmbito) {
      const pendiente = memoriaActual.pendienteConfirmarAmbito
      // Verificar que no haya expirado (5 minutos)
      if (Date.now() - pendiente.timestamp > 5 * 60 * 1000) {
        // Expiró, limpiar y continuar con flujo normal
        guardarMemoria(sessionId, { pendienteConfirmarAmbito: undefined } as any)
      } else {
        // Detectar si el usuario respondió "negocio" o "personal"
        const esNegocio = mensajeLower === 'negocio' || mensajeLower === '1' || mensajeLower.includes('negocio') || mensajeLower.includes('empresa') || mensajeLower === 'n'
        const esPersonal = mensajeLower === 'personal' || mensajeLower === '2' || mensajeLower.includes('personal') || mensajeLower === 'p'

        if (esNegocio || esPersonal) {
          const ambito = esNegocio ? 'NEGOCIO' : 'PERSONAL'
          try {
            const resultado = await registrarMovimiento({
              tipo: pendiente.tipo === 'GASTO' ? 'EGRESO' : 'INGRESO',
              monto: pendiente.monto,
              concepto: pendiente.concepto,
              ambito: ambito as 'NEGOCIO' | 'PERSONAL',
              usuarioNombre: 'Admin',
            })
            accionEjecutada = resultado.success
            tipo = 'ACCION'
            detalleAccion = `${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} ${ambito}: ${formatearMoneda(pendiente.monto)} | Motivo: ${pendiente.concepto} | Categoría: ${resultado.categoriaNombre}`
            respuesta = resultado.success
              ? `✅ ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} registrado (${ambito})\n\n💰 Monto: ${formatearMoneda(pendiente.monto)}\n📝 Motivo: ${pendiente.concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n📅 ${new Date().toLocaleString('es-CO')}`
              : `❌ ${resultado.mensaje}`
            // Limpiar pendiente
            guardarMemoria(sessionId, {
              pendienteConfirmarAmbito: undefined,
              ultimoMovimientoId: resultado.movimientoId,
              ultimoMovimientoTipo: pendiente.tipo,
              ultimoMovimientoMonto: pendiente.monto,
              ultimoMovimientoConcepto: pendiente.concepto,
              ultimoMovimientoAmbito: ambito as any,
              ultimoMovimientoCategoria: resultado.categoriaNombre,
            } as any)
          } catch (e) {
            respuesta = `❌ No pude registrar el movimiento. Error: ${e instanceof Error ? e.message : 'desconocido'}`
          }
          // Limpiar pendiente después de procesar (éxito o error)
          guardarMemoria(sessionId, { pendienteConfirmarAmbito: undefined } as any)
          // Retornar respuesta sin continuar con el resto del flujo
          return NextResponse.json({
            success: true,
            data: { respuesta, tipo, accionEjecutada, detalleAccion },
          })
        }
        // Si el usuario escribe algo distinto a "negocio"/"personal", cancelar el pendiente y continuar con flujo normal
        if (mensajeLower !== 'menu' && mensajeLower !== 'menú' && mensajeLower !== 'hola' && mensajeLower !== 'ayuda') {
          guardarMemoria(sessionId, { pendienteConfirmarAmbito: undefined } as any)
        }
      }
    }

    // === MENÚ POR NÚMEROS ===
    // 1 = Registrar gasto
    if (mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'TEXTO'
      respuesta = `💰 Registrar gasto\n\nEscribe el gasto que quieres registrar, ej:\n\n• "Registra un gasto de 50000 en hamburguesas"\n• "Me gasté 30000 en gasolina"\n• "Anota 100000 de renta"\n\n💡 El sistema extraerá automáticamente el monto, motivo y categoría.`
    }
    // 2 = Registrar ingreso
    else if (mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'TEXTO'
      respuesta = `📈 Registrar ingreso\n\nEscribe el ingreso que quieres registrar, ej:\n\n• "Registra un ingreso de 200000 por pago de cuota"\n• "Recibí 500000 por venta de producto"\n• "Ingreso de 100000 por comisión"\n\n💡 El sistema extraerá automáticamente el monto y motivo.`
    }
    // 3 = Ver balance del mes
    else if (mensajeLower === '3' || mensajeLower === '3️⃣' || mensajeLower.includes('balance') || mensajeLower.includes('como va') || mensajeLower.includes('cómo va') || (mensajeLower.includes('resumen') && mensajeLower.includes('mes'))) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movimientos = await db.movimientoCaja.findMany({
          where: { fechaMovimiento: { gte: inicioMes } },
        })
        const ingresos = movimientos.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastos = movimientos.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
        const balance = ingresos - gastos
        const movsNegocio = movimientos.filter((m) => m.ambito === 'NEGOCIO')
        const movsPersonal = movimientos.filter((m) => m.ambito === 'PERSONAL')
        const ingresosNeg = movsNegocio.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastosNeg = movsNegocio.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
        const ingresosPer = movsPersonal.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastosPer = movsPersonal.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)

        tipo = 'REPORTE'
        respuesta = `📊 Balance del mes (${ahora.toLocaleString('es-CO', { month: 'long' })})\n\n`
        respuesta += `═══ RESUMEN GENERAL ═══\n`
        respuesta += `✅ Ingresos totales: ${formatearMoneda(ingresos)}\n`
        respuesta += `❌ Gastos totales: ${formatearMoneda(gastos)}\n`
        respuesta += `💰 Balance: ${formatearMoneda(balance)} ${balance >= 0 ? '✅' : '⚠️'}\n\n`
        respuesta += `═══ NEGOCIO ═══\n`
        respuesta += `Ingresos: ${formatearMoneda(ingresosNeg)} | Gastos: ${formatearMoneda(gastosNeg)} | Balance: ${formatearMoneda(ingresosNeg - gastosNeg)}\n\n`
        respuesta += `═══ PERSONAL ═══\n`
        respuesta += `Ingresos: ${formatearMoneda(ingresosPer)} | Gastos: ${formatearMoneda(gastosPer)} | Balance: ${formatearMoneda(ingresosPer - gastosPer)}\n\n`
        respuesta += `📋 Total movimientos: ${movimientos.length}\n`
        respuesta += balance >= 0 ? `\n💡 ¡Vas en positivo! Sigue así.` : `\n⚠️ Estás en negativo. Revisa tus gastos.`
      } catch (e) {
        respuesta = `❌ No pude obtener el balance. Error: ${e instanceof Error ? e.message : 'desconocido'}`
      }
    }
    // 4 = Ver gastos por categoría
    else if (mensajeLower === '4' || mensajeLower === '4️⃣' || (mensajeLower.includes('gastos') && mensajeLower.includes('categor'))) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({
          where: { tipo: 'EGRESO', fechaMovimiento: { gte: inicioMes } },
          include: { movimientoCajaExtendido: { include: { categoria: true } } },
        })
        const porCat: Record<string, number> = {}
        movs.forEach((m) => {
          const cat = m.movimientoCajaExtendido?.categoria?.nombre || 'Sin categoría'
          porCat[cat] = (porCat[cat] || 0) + m.monto
        })
        const total = Object.values(porCat).reduce((s, v) => s + v, 0)
        tipo = 'REPORTE'
        if (Object.keys(porCat).length === 0) {
          respuesta = `📊 No hay gastos registrados este mes.`
        } else {
          respuesta = `📊 Gastos por categoría — ${ahora.toLocaleString('es-CO', { month: 'long' })}\n\n`
          Object.entries(porCat).sort(([,a],[,b]) => b-a).forEach(([cat, monto]) => {
            const pct = total > 0 ? (monto/total*100).toFixed(1) : '0'
            const barra = '█'.repeat(Math.round(parseFloat(pct)/5))
            respuesta += `${cat}: ${formatearMoneda(monto)} (${pct}%)\n${barra}\n\n`
          })
          respuesta += `Total gastos: ${formatearMoneda(total)}`
        }
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // 5 = Ver ingresos por categoría
    else if (mensajeLower === '5' || mensajeLower === '5️⃣' || (mensajeLower.includes('ingresos') && mensajeLower.includes('categor'))) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({
          where: { tipo: 'INGRESO', fechaMovimiento: { gte: inicioMes } },
          include: { movimientoCajaExtendido: { include: { categoria: true } } },
        })
        const porCat: Record<string, number> = {}
        movs.forEach((m) => {
          const cat = m.movimientoCajaExtendido?.categoria?.nombre || 'Sin categoría'
          porCat[cat] = (porCat[cat] || 0) + m.monto
        })
        const total = Object.values(porCat).reduce((s, v) => s + v, 0)
        tipo = 'REPORTE'
        if (Object.keys(porCat).length === 0) {
          respuesta = `📊 No hay ingresos registrados este mes.`
        } else {
          respuesta = `📊 Ingresos por categoría — ${ahora.toLocaleString('es-CO', { month: 'long' })}\n\n`
          Object.entries(porCat).sort(([,a],[,b]) => b-a).forEach(([cat, monto]) => {
            const pct = total > 0 ? (monto/total*100).toFixed(1) : '0'
            respuesta += `${cat}: ${formatearMoneda(monto)} (${pct}%)\n`
          })
          respuesta += `\nTotal ingresos: ${formatearMoneda(total)}`
        }
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // 6 = Crear presupuesto
    else if (mensajeLower === '6' || mensajeLower === '6️⃣' || mensajeLower.includes('presupuesto')) {
      tipo = 'TEXTO'
      respuesta = `🎯 Crear presupuesto\n\nPara crear un presupuesto, escribe:\n\n• "Crea un presupuesto de 500000 para alimentación"\n• "Presupuesto de 1000000 para transporte"\n\n💡 El presupuesto se creará y el sistema monitoreará su cumplimiento.`
    }
    // 7 = Crear meta financiera
    else if (mensajeLower === '7' || mensajeLower === '7️⃣' || mensajeLower.includes('meta')) {
      tipo = 'TEXTO'
      respuesta = `🏆 Crear meta financiera\n\nPara crear una meta, escribe:\n\n• "Crea una meta de ahorrar 5000000"\n• "Meta: pagar deuda de 2000000"\n• "Crear meta de comprar vehículo de 30000000"\n\n💡 El sistema hará seguimiento automático del progreso.`
    }
    // 8 = Ver reporte
    else if (mensajeLower === '8' || mensajeLower === '8️⃣' || mensajeLower.includes('reporte')) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({
          where: { fechaMovimiento: { gte: inicioMes } },
          orderBy: { fechaMovimiento: 'desc' },
        })
        const ingresos = movs.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastos = movs.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
        tipo = 'REPORTE'
        respuesta = `📋 Reporte financiero — ${ahora.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}\n\n`
        respuesta += `═══ RESUMEN ═══\n`
        respuesta += `Ingresos: ${formatearMoneda(ingresos)}\n`
        respuesta += `Gastos: ${formatearMoneda(gastos)}\n`
        respuesta += `Balance: ${formatearMoneda(ingresos - gastos)}\n`
        respuesta += `Movimientos: ${movs.length}\n\n`
        respuesta += `═══ ÚLTIMOS 10 MOVIMIENTOS ═══\n`
        movs.slice(0, 10).forEach((m, i) => {
          respuesta += `${i+1}. ${m.tipo === 'INGRESO' ? '✅' : '❌'} ${formatearMoneda(m.monto)} - ${m.concepto}\n`
        })
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // 9 = Proyección fin de mes
    else if (mensajeLower === '9' || mensajeLower === '9️⃣' || mensajeLower.includes('proyeccion') || mensajeLower.includes('proyección')) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({
          where: { fechaMovimiento: { gte: inicioMes } },
        })
        const ingresos = movs.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastos = movs.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
        const diasTranscurridos = ahora.getDate()
        const diasEnMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()
        const promedioIng = diasTranscurridos > 0 ? ingresos / diasTranscurridos : 0
        const promedioGas = diasTranscurridos > 0 ? gastos / diasTranscurridos : 0
        const proyIng = promedioIng * diasEnMes
        const proyGas = promedioGas * diasEnMes
        const proyBal = proyIng - proyGas
        tipo = 'REPORTE'
        respuesta = `🔮 Proyección fin de mes\n\n`
        respuesta += `Días transcurridos: ${diasTranscurridos} / ${diasEnMes}\n`
        respuesta += `Promedio ingreso/día: ${formatearMoneda(promedioIng)}\n`
        respuesta += `Promedio gasto/día: ${formatearMoneda(promedioGas)}\n\n`
        respuesta += `═══ PROYECCIÓN ═══\n`
        respuesta += `Ingresos proyectados: ${formatearMoneda(proyIng)}\n`
        respuesta += `Gastos proyectados: ${formatearMoneda(proyGas)}\n`
        respuesta += `Balance proyectado: ${formatearMoneda(proyBal)} ${proyBal >= 0 ? '✅' : '⚠️'}\n\n`
        respuesta += proyBal >= 0 ? `💡 Si mantienes este ritmo, terminarás el mes en positivo.` : `⚠️ Si mantienes este ritmo, terminarás en negativo. Considera reducir gastos.`
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // A = Estado del sistema
    else if (mensajeLower === 'a' || mensajeLower === 'a️⃣' || (mensajeLower.includes('estado') && mensajeLower.includes('sistema')) || mensajeLower.includes('cuantos prestamos') || mensajeLower.includes('cuántos solicitudes')) {
      try {
        const activos = await db.prestamo.count({ where: { estado: 'ACTIVO' } })
        const enMora = await db.prestamo.count({ where: { estado: 'EN_MORA' } })
        const juridico = await db.prestamo.count({ where: { estado: 'JURIDICO' } })
        const solicitudes = await db.prestamo.count({ where: { estado: 'SOLICITUD' } })
        const pendientes = await db.prestamo.count({ where: { estado: 'PENDIENTE_ACEPTACION' } })
        const saldoTotal = await db.prestamo.aggregate({
          where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
          _sum: { saldoTotal: true },
        })
        const clientes = await db.cliente.count()
        tipo = 'REPORTE'
        respuesta = `🛡️ Estado del sistema Jsadr\n\n`
        respuesta += `═══ SOLICITUDES ═══\n`
        respuesta += `✅ Activos: ${activos}\n`
        respuesta += `⚠️ En mora: ${enMora}\n`
        respuesta += `⚖️ Jurídico: ${juridico}\n`
        respuesta += `📝 Solicitudes nuevas: ${solicitudes}\n`
        respuesta += `⏳ Pendientes T&C: ${pendientes}\n`
        respuesta += `💰 Saldo cartera: ${formatearMoneda(saldoTotal._sum.saldoTotal || 0)}\n\n`
        respuesta += `═══ CLIENTES ═══\n`
        respuesta += `Total clientes: ${clientes}\n`
        respuesta += `\n📅 Reporte generado: ${new Date().toLocaleString('es-CO')}`
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // B = Solicitudes en mora
    else if (mensajeLower === 'b' || mensajeLower === 'b️⃣' || mensajeLower.includes('mora') || (mensajeLower.includes('prestamos') && mensajeLower.includes('moroso'))) {
      try {
        const morosos = await db.prestamo.findMany({
          where: { estado: 'EN_MORA' },
          include: { cliente: true },
        })
        tipo = 'REPORTE'
        if (morosos.length === 0) {
          respuesta = `✅ No hay solicitudes en mora. ¡Todo al día!`
        } else {
          respuesta = `⚠️ Solicitudes en mora (${morosos.length})\n\n`
          morosos.forEach((p, i) => {
            respuesta += `${i+1}. ${p.cliente.nombre} (${p.cliente.cedula})\n`
            respuesta += `   Código: ${p.codigo}\n`
            respuesta += `   Saldo: ${formatearMoneda(p.saldoTotal)}\n`
            respuesta += `   Días mora: ${p.diasMora}\n\n`
          })
          respuesta += `💡 Revisa el módulo de Pagos para gestionar el cobro.`
        }
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // C = Ver auditoría reciente
    else if (mensajeLower === 'c' || mensajeLower === 'c️⃣' || mensajeLower.includes('auditor')) {
      try {
        const logs = await db.auditLog.findMany({
          orderBy: { fecha: 'desc' },
          take: 10,
        })
        tipo = 'REPORTE'
        respuesta = `📋 Auditoría reciente (últimos 10 eventos)\n\n`
        logs.forEach((l, i) => {
          respuesta += `${i+1}. [${l.accion}] ${l.entidadNombre || 'N/A'}\n`
          respuesta += `   Usuario: ${l.usuarioNombre} | IP: ${l.ipOrigen || 'N/A'}\n`
          respuesta += `   Fecha: ${l.fecha.toLocaleString('es-CO')}\n\n`
        })
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // D = Alertas inteligentes
    else if (mensajeLower === 'd' || mensajeLower === 'd️⃣' || mensajeLower.includes('alerta')) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({ where: { fechaMovimiento: { gte: inicioMes } } })
        const ingresos = movs.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastos = movs.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
        const balance = ingresos - gastos
        const morosos = await db.prestamo.count({ where: { estado: 'EN_MORA' } })
        tipo = 'REPORTE'
        respuesta = `🔔 Alertas inteligentes\n\n`
        if (balance < 0) respuesta += `🔴 Balance negativo este mes: ${formatearMoneda(balance)}\n`
        if (gastos > ingresos * 0.8 && ingresos > 0) respuesta += `🟡 Gastos > 80% de ingresos. Reduce gastos.\n`
        if (morosos > 0) respuesta += `🔴 ${morosos} solicitud(s) en mora. Gestiona el cobro.\n`
        if (balance >= 0 && morosos === 0 && gastos <= ingresos * 0.8) respuesta += `✅ No hay alertas críticas. Todo bajo control.\n`
        respuesta += `\n💡 Revisa estas alertas y toma acción si es necesario.`
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // E = Crear evento en calendario
    else if (mensajeLower === 'e' || mensajeLower === 'e️⃣' || mensajeLower.includes('evento') || mensajeLower.includes('programar') || mensajeLower.includes('agenda') || mensajeLower.includes('recordar')) {
      const montoMatch = mensajeLower.match(/\$?([\d.]+)/)
      const monto = montoMatch ? parseFloat(montoMatch[1].replace(/\./g, '')) : null
      try {
        await db.eventoFinanciero.create({
          data: {
            titulo: mensaje.substring(0, 100),
            descripcion: mensaje,
            fecha: new Date(Date.now() + 24 * 60 * 60 * 1000),
            tipo: 'RECORDATORIO',
            completado: false,
            monto: monto,
            categoria: 'INSTRUCCION_ADMIN',
            origen: 'PORTAL_ADMIN_CHAT',
          },
        })
        accionEjecutada = true
        tipo = 'ACCION'
        detalleAccion = `Evento creado en el calendario financiero`
        respuesta = `✅ Evento creado en el calendario.\n\n📅 Evento: "${mensaje.substring(0, 80)}"\n💰 Monto: ${monto ? formatearMoneda(monto) : 'No especificado'}\n📆 Programado para: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('es-CO')}\n\nPuedes verlo en Administración → Contabilidad → Calendario.`
      } catch (e) { respuesta = `❌ No pude crear el evento. Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // F = Recomendaciones
    else if (mensajeLower === 'f' || mensajeLower === 'f️⃣' || mensajeLower.includes('recomend')) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({ where: { fechaMovimiento: { gte: inicioMes } }, include: { movimientoCajaExtendido: { include: { categoria: true } } } })
        const ingresos = movs.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
        const gastos = movs.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
        const balance = ingresos - gastos
        const morosos = await db.prestamo.count({ where: { estado: 'EN_MORA' } })

        // Gastos por categoría
        const porCat: Record<string, number> = {}
        movs.filter((m) => m.tipo === 'EGRESO').forEach((m) => {
          const cat = m.movimientoCajaExtendido?.categoria?.nombre || 'Sin categoría'
          porCat[cat] = (porCat[cat] || 0) + m.monto
        })
        const catTop = Object.entries(porCat).sort(([,a],[,b]) => b-a)[0]

        tipo = 'REPORTE'
        respuesta = `💡 Recomendaciones financieras\n\n`
        if (balance < 0) {
          respuesta += `🔴 Tu balance del mes es negativo (${formatearMoneda(balance)}).\n   → Reduce gastos innecesarios inmediatamente.\n   → Prioriza gastos esenciales únicamente.\n\n`
        }
        if (catTop) {
          respuesta += `📊 Tu mayor categoría de gasto es "${catTop[0]}" con ${formatearMoneda(catTop[1])}.\n   → Evalúa si puedes optimizar este rubro.\n\n`
        }
        if (gastos > ingresos * 0.8 && ingresos > 0) {
          respuesta += `🟡 Tus gastos representan más del 80% de tus ingresos.\n   → Busca fuentes adicionales de ingreso.\n   → Renegocia tarifas de servicios.\n\n`
        }
        if (morosos > 0) {
          respuesta += `🔴 Tienes ${morosos} solicitud(s) en mora.\n   → Gestiona el cobro urgentemente.\n   → Considera renovación o acuerdo de pago.\n\n`
        }
        if (balance >= 0 && morosos === 0) {
          respuesta += `✅ Tu situación financiera es saludable.\n   → Considera aumentar tu ahorro.\n   → Evalúa oportunidades de inversión.\n\n`
        }
        respuesta += `💡 Recuerda: monitorea tus finanzas diariamente para mantener el control.`
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // G = Separación Negocio vs Personal
    else if (mensajeLower === 'g' || mensajeLower === 'g️⃣' || (mensajeLower.includes('negocio') && mensajeLower.includes('personal'))) {
      try {
        const ahora = new Date()
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        const movs = await db.movimientoCaja.findMany({ where: { fechaMovimiento: { gte: inicioMes } } })
        const ingNeg = movs.filter((m) => m.tipo === 'INGRESO' && m.ambito === 'NEGOCIO').reduce((s, m) => s + m.monto, 0)
        const gasNeg = movs.filter((m) => m.tipo === 'EGRESO' && m.ambito === 'NEGOCIO').reduce((s, m) => s + m.monto, 0)
        const ingPer = movs.filter((m) => m.tipo === 'INGRESO' && m.ambito === 'PERSONAL').reduce((s, m) => s + m.monto, 0)
        const gasPer = movs.filter((m) => m.tipo === 'EGRESO' && m.ambito === 'PERSONAL').reduce((s, m) => s + m.monto, 0)
        tipo = 'REPORTE'
        respuesta = `📊 Separación Negocio vs Personal\n\n`
        respuesta += `═══ 🏢 NEGOCIO ═══\n`
        respuesta += `Ingresos: ${formatearMoneda(ingNeg)}\n`
        respuesta += `Gastos: ${formatearMoneda(gasNeg)}\n`
        respuesta += `Balance: ${formatearMoneda(ingNeg - gasNeg)}\n\n`
        respuesta += `═══ 👤 PERSONAL ═══\n`
        respuesta += `Ingresos: ${formatearMoneda(ingPer)}\n`
        respuesta += `Gastos: ${formatearMoneda(gasPer)}\n`
        respuesta += `Balance: ${formatearMoneda(ingPer - gasPer)}\n\n`
        respuesta += `💡 ${ingNeg - gasNeg > ingPer - gasPer ? 'Tu negocio genera más balance que tus finanzas personales.' : 'Tus finanzas personales generan más balance que el negocio.'}`
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // H = Deudas y activos
    else if (mensajeLower === 'h' || mensajeLower === 'h️⃣' || mensajeLower.includes('deuda') || mensajeLower.includes('activo')) {
      try {
        const prestamosBancarios = await db.prestamoBancario.findMany({ where: { estado: 'ACTIVO' } })
        const totalDeudas = prestamosBancarios.reduce((s, p) => s + (p.saldoUtilizado || 0), 0)
        const cuentas = await db.cuentaRecaudo.findMany({ where: { activa: true } })
        tipo = 'REPORTE'
        respuesta = `💳 Deudas y activos\n\n`
        respuesta += `═══ DEUDAS ═══\n`
        respuesta += `Solicitudes bancarios activos: ${prestamosBancarios.length}\n`
        respuesta += `Saldo total deudas: ${formatearMoneda(totalDeudas)}\n\n`
        if (prestamosBancarios.length > 0) {
          prestamosBancarios.forEach((p, i) => {
            respuesta += `${i+1}. ${p.nombre} - ${p.banco}\n   Saldo: ${formatearMoneda(p.saldoUtilizado || 0)}\n\n`
          })
        }
        respuesta += `══️ ACTIVOS ═══\n`
        respuesta += `Cuentas de recaudo activas: ${cuentas.length}\n\n`
        respuesta += `💡 Gestiona tus deudas prioritizando las de mayor tasa de interés.`
      } catch (e) { respuesta = `❌ Error: ${e instanceof Error ? e.message : 'desconocido'}` }
    }
    // Ayuda / hola
    else if (mensajeLower.includes('hola') || mensajeLower.includes('ayuda') || mensajeLower.includes('menu') || mensajeLower.includes('menú') || mensajeLower.includes('que puedes hacer') || mensajeLower.includes('qué puedes hacer')) {
      tipo = 'TEXTO'
      respuesta = `🤖 ASISTENTE PERSONAL\n`
      respuesta += `━━━━━━━━━━━━━━━━━━\n\n`
      respuesta += `💰 FINANZAS\n`
      respuesta += `  1  Registrar gasto\n`
      respuesta += `  2  Registrar ingreso\n`
      respuesta += `  3  Ver balance del mes\n`
      respuesta += `  4  Gastos por categoría\n`
      respuesta += `  5  Ingresos por categoría\n`
      respuesta += `  6  Crear presupuesto\n`
      respuesta += `  7  Crear meta financiera\n`
      respuesta += `  8  Ver reporte\n`
      respuesta += `  9  Ver proyección fin de mes\n\n`
      respuesta += `🛡️ SISTEMA\n`
      respuesta += `  A  Estado del sistema\n`
      respuesta += `  B  Solicitudes en mora\n`
      respuesta += `  C  Ver auditoría reciente\n`
      respuesta += `  D  Ver alertas inteligentes\n`
      respuesta += `  E  Crear evento en calendario\n\n`
      respuesta += `📊 ANÁLISIS\n`
      respuesta += `  F  Recomendaciones financieras\n`
      respuesta += `  G  Separación Negocio vs Personal\n`
      respuesta += `  H  Ver deudas y activos\n\n`
      respuesta += `━━━━━━━━━━━━━━━━━━\n`
      respuesta += `💡 También puedes escribir directamente:\n`
      respuesta += `   "Registra un gasto de $50.000 en comida"\n`
      respuesta += `   "¿Cómo va el balance del mes?"\n`
      respuesta += `   "Muéstrame los solicitudes en mora"`
    }

    // === 1. REGISTRAR GASTO ===
    // Ej: "registra un gasto de 50000 en transporte"
    // Ej: "registra un gasto de 50000 en hamburguesas"
    // Ej: "me gasté 50000 en hamburguesas"
    // Ej: "anota 30000 de gasolina"
    else if (gastoMatch || (mensajeLower.includes('gasto') && mensajeLower.match(/\$?([\d.]+)/)) || (mensajeLower.match(/(?:gaste|gasté|anota|aplica)\s+\$?([\d.]+)/i))) {
      const montoStr = (gastoMatch?.[1] || mensajeLower.match(/\$?([\d.]+)/)?.[1] || '0').replace(/\./g, '')
      const monto = parseFloat(montoStr)

      // === Extraer MOTIVO de la instrucción ===
      // El motivo es todo lo que viene DESPUÉS del monto y la palabra "en" o "para"
      // Ej: "registra un gasto de 50000 en hamburguesas" → motivo = "hamburguesas"
      // Ej: "me gaste 30000 en gasolina para el carro" → motivo = "gasolina para el carro"
      let motivo = ''
      // Buscar el número del monto en el mensaje original
      const montoEnMensaje = mensaje.match(/\$?\s*([\d.]+)/)
      if (montoEnMensaje) {
        // Tomar todo lo que viene después del monto
        const despuesMonto = mensaje.substring(montoEnMensaje.index! + montoEnMensaje[0].length).trim()
        // Quitar "en", "de", "para" del inicio si existe
        const limpio = despuesMonto.replace(/^(?:en|de|para)\s+/i, '').trim()
        if (limpio) {
          motivo = limpio
        }
      }
      if (!motivo) motivo = 'Gasto general'

      // Extraer categoría basada en palabras clave
      let categoria = 'GENERAL'
      if (mensajeLower.includes('transporte') || mensajeLower.includes('gasolina') || mensajeLower.includes('taxi') || mensajeLower.includes('uber') || mensajeLower.includes('bus')) categoria = 'TRANSPORTE'
      else if (mensajeLower.includes('comida') || mensajeLower.includes('almuerzo') || mensajeLower.includes('restaurante') || mensajeLower.includes('hamburguesa') || mensajeLower.includes('cafeteria') || mensajeLower.includes('café') || mensajeLower.includes('mercado') || mensajeLower.includes('supermercado')) categoria = 'ALIMENTACION'
      else if (mensajeLower.includes('servicio') || mensajeLower.includes('luz') || mensajeLower.includes('agua') || mensajeLower.includes('internet') || mensajeLower.includes('telefono') || mensajeLower.includes('gas')) categoria = 'SERVICIOS'
      else if (mensajeLower.includes('oficina') || mensajeLower.includes('papeleria') || mensajeLower.includes('utiles')) categoria = 'OFICINA'
      else if (mensajeLower.includes('personal') || mensajeLower.includes('ropa') || mensajeLower.includes('cine') || mensajeLower.includes('entretenimiento')) categoria = 'PERSONAL'
      else if (mensajeLower.includes('inversion') || mensajeLower.includes('inversión')) categoria = 'INVERSION'
      else if (mensajeLower.includes('salud') || mensajeLower.includes('farmacia') || mensajeLower.includes('medico') || mensajeLower.includes('médico')) categoria = 'SALUD'

      if (monto > 0) {
        try {
          // === CONFIRMACIÓN OBLIGATORIA DE ÁMBITO ===
          // Aunque el mensaje contenga "personal" o "negocio", SIEMPRE pedimos
          // confirmación explícita antes de registrar. Es ineludible.
          const esPersonalDetectado = mensajeLower.includes('personal') && !mensajeLower.includes('personalizar')
          const esNegocioDetectado = mensajeLower.includes('negocio') || mensajeLower.includes('empresa')
          const sugerenciaDetectada = esPersonalDetectado
            ? 'Detecté "personal" en tu mensaje → responde **personal** para confirmar'
            : esNegocioDetectado
            ? 'Detecté "negocio" en tu mensaje → responde **negocio** para confirmar'
            : ''

          guardarMemoria(sessionId, {
            pendienteConfirmarAmbito: {
              tipo: 'GASTO',
              monto,
              concepto: motivo,
              categoria,
              timestamp: Date.now(),
            },
          } as any)
          tipo = 'CONFIRMACION'
          respuesta = `💰 **Gasto detectado**\n\n💰 Monto: ${formatearMoneda(monto)}\n📝 Motivo: ${motivo}\n🏷️ Categoría sugerida: ${categoria}${sugerenciaDetectada ? `\n\n💡 ${sugerenciaDetectada}` : ''}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ **CONFIRMACIÓN OBLIGATORIA**\n━━━━━━━━━━━━━━━━━━\n\n¿Este gasto es para NEGOCIO o PERSONAL?\n\nResponde:\n  • "negocio" o "1" → Gasto del negocio\n  • "personal" o "2" → Gasto personal\n\n🔒 No puedo registrarlo hasta que confirmes el ámbito.`
        } catch (e) {
          respuesta = `❌ No pude registrar el gasto. Error: ${e instanceof Error ? e.message : 'desconocido'}`
        }
      }
    }

    // === 2. REGISTRAR INGRESO ===
    // Ej: "registra un ingreso de 100000 por venta de productos"
    else if ((mensajeLower.includes('ingreso') || mensajeLower.includes('entrada')) && mensajeLower.match(/\$?([\d.]+)/)) {
      const montoStr = (mensajeLower.match(/\$?([\d.]+)/)?.[1] || '0').replace(/\./g, '')
      const monto = parseFloat(montoStr)

      // === Extraer MOTIVO del ingreso ===
      // Ej: "registra un ingreso de 200000 por pago de cuota" → motivo = "pago de cuota"
      let motivo = ''
      const montoEnMensajeIng = mensaje.match(/\$?\s*([\d.]+)/)
      if (montoEnMensajeIng) {
        const despuesMonto = mensaje.substring(montoEnMensajeIng.index! + montoEnMensajeIng[0].length).trim()
        // Quitar "por", "de", "concepto" del inicio
        const limpio = despuesMonto.replace(/^(?:por|de|concepto)\s+/i, '').trim()
        if (limpio) {
          motivo = limpio
        }
      }
      if (!motivo) motivo = 'Ingreso registrado por el administrador'

      if (monto > 0) {
        try {
          // === CONFIRMACIÓN OBLIGATORIA DE ÁMBITO ===
          const esPersonalDetectado = mensajeLower.includes('personal') && !mensajeLower.includes('personalizar')
          const esNegocioDetectado = mensajeLower.includes('negocio') || mensajeLower.includes('empresa')
          const sugerenciaDetectada = esPersonalDetectado
            ? 'Detecté "personal" en tu mensaje → responde **personal** para confirmar'
            : esNegocioDetectado
            ? 'Detecté "negocio" en tu mensaje → responde **negocio** para confirmar'
            : ''

          guardarMemoria(sessionId, {
            pendienteConfirmarAmbito: {
              tipo: 'INGRESO',
              monto,
              concepto: motivo,
              timestamp: Date.now(),
            },
          } as any)
          tipo = 'CONFIRMACION'
          respuesta = `📈 **Ingreso detectado**\n\n💵 Monto: ${formatearMoneda(monto)}\n📝 Motivo: ${motivo}${sugerenciaDetectada ? `\n\n💡 ${sugerenciaDetectada}` : ''}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ **CONFIRMACIÓN OBLIGATORIA**\n━━━━━━━━━━━━━━━━━━\n\n¿Este ingreso es para NEGOCIO o PERSONAL?\n\nResponde:\n  • "negocio" o "1" → Ingreso del negocio\n  • "personal" o "2" → Ingreso personal\n\n🔒 No puedo registrarlo hasta que confirmes el ámbito.`
        } catch (e) {
          respuesta = `❌ No pude registrar el ingreso. Error: ${e instanceof Error ? e.message : 'desconocido'}`
        }
      }
    }

    // === 3. CONSULTAR BALANCE DEL MES ===
    else if (mensajeLower.includes('balance') || mensajeLower.includes('como va') || mensajeLower.includes('cómo va') || (mensajeLower.includes('resumen') && mensajeLower.includes('mes'))) {
      try {
        const dashboard = await obtenerDashboard('NEGOCIO', 30)
        const k = dashboard.kpis
        tipo = 'REPORTE'
        respuesta = `📊 Resumen financiero del mes (NEGOCIO):\n\n✅ Ingresos: ${formatearMoneda(k.ingresos)}\n❌ Gastos: ${formatearMoneda(k.gastos)}\n💰 Balance: ${formatearMoneda(k.balance)}\n📈 Capacidad ahorro: ${k.capacidadAhorro}%\n📊 Movimientos: ${k.totalMovimientos}\n\n${k.balance >= 0 ? '¡Vas en positivo!' : '⚠️ Estás en negativo este mes.'}`
      } catch (e) {
        respuesta = `❌ No pude obtener el balance. Error: ${e instanceof Error ? e.message : 'desconocido'}`
      }
    }

    // === 4. CONSULTAR SOLICITUDES EN MORA ===
    else if (mensajeLower.includes('mora') || (mensajeLower.includes('prestamos') && mensajeLower.includes('moroso'))) {
      try {
        const morosos = await db.prestamo.findMany({
          where: { estado: 'EN_MORA' },
          include: { cliente: true },
        })
        tipo = 'REPORTE'
        if (morosos.length === 0) {
          respuesta = `✅ No hay solicitudes en mora. ¡Todo al día!`
        } else {
          respuesta = `⚠️ Tienes ${morosos.length} solicitud(s) en mora:\n\n`
          morosos.forEach((p, i) => {
            respuesta += `${i + 1}. ${p.cliente.nombre} (${p.cliente.cedula})\n   Código: ${p.codigo}\n   Saldo: ${formatearMoneda(p.saldoTotal)}\n   Días mora: ${p.diasMora}\n\n`
          })
          respuesta += `💡 Te sugiero revisar el módulo de Pagos para gestionar el cobro.`
        }
      } catch (e) {
        respuesta = `❌ No pude consultar los morosos. Error: ${e instanceof Error ? e.message : 'desconocido'}`
      }
    }

    // === 5. CREAR EVENTO EN EL CALENDARIO ===
    else if (mensajeLower.includes('evento') || mensajeLower.includes('programar') || mensajeLower.includes('agenda') || mensajeLower.includes('recordar')) {
      const montoMatch = mensajeLower.match(/\$?([\d.]+)/)
      const monto = montoMatch ? parseFloat(montoMatch[1].replace(/\./g, '')) : null

      try {
        await db.eventoFinanciero.create({
          data: {
            titulo: mensaje.substring(0, 100),
            descripcion: mensaje,
            fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), // mañana por defecto
            tipo: 'RECORDATORIO',
            completado: false,
            monto: monto,
            categoria: 'INSTRUCCION_ADMIN',
            origen: 'PORTAL_ADMIN_CHAT',
          },
        })
        accionEjecutada = true
        tipo = 'ACCION'
        detalleAccion = `Evento creado en el calendario financiero`
        respuesta = `✅ Evento creado en el calendario.\n\n📅 Evento: "${mensaje.substring(0, 80)}..."\n💰 Monto: ${monto ? formatearMoneda(monto) : 'No especificado'}\n📆 Programado para: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('es-CO')}\n\nPuedes verlo en Administración → Contabilidad → Calendario.`
      } catch (e) {
        respuesta = `❌ No pude crear el evento. Error: ${e instanceof Error ? e.message : 'desconocido'}`
      }
    }

    // === 6. CONSULTAR SOLICITUDES ACTIVOS ===
    else if (mensajeLower.includes('prestamos activos') || mensajeLower.includes('solicitudes activos') || mensajeLower.includes('cuantos prestamos') || mensajeLower.includes('cuántos solicitudes')) {
      try {
        const activos = await db.prestamo.count({ where: { estado: 'ACTIVO' } })
        const enMora = await db.prestamo.count({ where: { estado: 'EN_MORA' } })
        const saldoTotal = await db.prestamo.aggregate({
          where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
          _sum: { saldoTotal: true },
        })
        tipo = 'REPORTE'
        respuesta = `📊 Estado de la cartera:\n\n✅ Solicitudes activos: ${activos}\n⚠️ En mora: ${enMora}\n💰 Saldo total: ${formatearMoneda(saldoTotal._sum.saldoTotal || 0)}`
      } catch (e) {
        respuesta = `❌ No pude consultar los solicitudes. Error: ${e instanceof Error ? e.message : 'desconocido'}`
      }
    }

    // === 7. SALUDO / AYUDA ===
    else if (mensajeLower.includes('hola') || mensajeLower.includes('ayuda') || mensajeLower.includes('que puedes hacer') || mensajeLower.includes('qué puedes hacer')) {
      tipo = 'TEXTO'
      respuesta = `👋 ¡Hola! Soy el sistema Jsadr. Puedo ayudarte con:\n\n💰 **Registrar gastos:** "Registra un gasto de $50.000 en transporte"\n📈 **Registrar ingresos:** "Registra un ingreso de $100.000"\n📊 **Ver balance del mes:** "¿Cómo va el balance del mes?"\n⚠️ **Ver morosos:** "Muéstrame los solicitudes en mora"\n📅 **Crear eventos:** "Crea un evento para pagar la tarjeta el 30"\n📋 **Ver solicitudes activos:** "¿Cuántos solicitudes activos hay?"\n\nEscribe tu instrucción y la ejecutaré en tiempo real.`
    }

    // === RESPUESTA POR DEFECTO ===
    else {
      tipo = 'TEXTO'
      respuesta = `🤔 No reconocí esa instrucción. Prueba con:\n\n• "Registra un gasto de $50.000 en transporte"\n• "¿Cómo va el balance del mes?"\n• "Muéstrame los solicitudes en mora"\n• "Crea un evento para pagar la tarjeta el 30"\n• "¿Cuántos solicitudes activos hay?"\n• "Registra un ingreso de $100.000"\n\nO escribe "ayuda" para ver todas las opciones.`
    }

    return NextResponse.json({
      success: true,
      data: {
        respuesta,
        tipo,
        accionEjecutada,
        detalleAccion,
      },
    })
  } catch (error: any) {
    console.error('[admin portal chat] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// Función: responderSegunBot
// Responde según la especialidad del bot que está hablando
// =====================================================
async function responderSegunBot(botTipo: string, botNombre: string, mensaje: string, clienteId?: string, sessionId: string = 'admin-session'): Promise<NextResponse> {
  let mensajeLower = mensaje.toLowerCase().trim()
  let respuesta = ''
  let tipo: 'TEXTO' | 'ACCION' | 'REPORTE' | 'CONFIRMACION' = 'TEXTO'
  let accionEjecutada = false
  let detalleAccion = ''

  // === AYUDA / MENÚ para TODOS los bots ===
  if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
    return NextResponse.json({
      success: true,
      data: { respuesta: obtenerMenuBot(botTipo, botNombre), tipo: 'TEXTO', accionEjecutada: false, detalleAccion: '' },
    })
  }

  // === PRESTAMOS (Asistente Solicitudes) — Director Inteligente del Módulo ===
  else if (botTipo === 'PRESTAMOS') {
    // 1. Verificar si LLM está activado
    const configLLM = await db.configBot.findUnique({ where: { clave: 'asistente_prestamos_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto completo del módulo
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'PRESTAMOS', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        const estado = await obtenerEstadoModuloPrestamos()
        const r = estado.resumen

        const contextoPrestamos = `CONTEXTO MÓDULO SOLICITUDES (tiempo real — ${new Date().toLocaleString('es-CO')}):

═══ PANORAMA GENERAL ═══
Total solicitudes: ${r.totalPrestamos}
Solicitudes pendientes: ${r.totalSolicitudes}
Activos: ${r.totalActivos}
Finalizados: ${r.totalFinalizados}
Cancelados: ${r.totalCancelados}
En mora: ${r.totalMora} (${r.tasaMora}%)
En jurídico: ${r.totalJuridico}
Creados hoy: ${r.creadosHoy}

═══ INDICADORES FINANCIEROS ═══
Capital prestado: ${formatearMoneda(r.capitalPrestado)}
Capital recuperado: ${formatearMoneda(r.capitalRecuperado)} (${r.tasaRecuperacion}%)
Capital pendiente: ${formatearMoneda(r.capitalPendiente)}
Intereses cobrados: ${formatearMoneda(r.interesesCobrados)}
Intereses pendientes: ${formatearMoneda(r.interesesPendientes)}
Mora acumulada: ${formatearMoneda(r.moraAcumulada)}
Rentabilidad promedio: ${r.rentabilidadPromedio}%

═══ UTILIDAD ═══
Utilidad del mes: ${formatearMoneda(r.utilidadMes)}
Utilidad del año: ${formatearMoneda(r.utilidadAnio)}
Recaudo del mes: ${formatearMoneda(r.recaudoMes)}

═══ VENCIMIENTOS ═══
Vencen hoy: ${r.vencenHoy}
Próximos a vencer (7 días): ${r.proximosVencer}
Aptos para renovación: ${r.aptosRenovacion}

${estado.aptosRenovacion.length > 0 ? `═══ OPORTUNIDADES DE RENOVACIÓN ═══\n${estado.aptosRenovacion.slice(0, 10).map((a, i) => `${i + 1}. ${a.cliente} (${a.progreso}% pagado, ${a.cuotasRestantes} cuotas restantes)`).join('\n')}` : ''}

${estado.masRentables.length > 0 ? `═══ TOP 5 MÁS RENTABLES ═══\n${estado.masRentables.map((p, i) => `${i + 1}. ${p.codigo} — ${p.cliente}: interés ${formatearMoneda(p.interesGenerado)} (${p.rentabilidadPct}%)`).join('\n')}` : ''}

${estado.mayorRiesgo.length > 0 ? `══️ MAYOR RIESGO ═══\n${estado.mayorRiesgo.map((p, i) => `${i + 1}. ${p.codigo} — ${p.cliente} (${p.diasMora} días mora) [${p.severidad}]`).join('\n')}` : ''}

${estado.alertas.length > 0 ? `═══ ALERTAS (${estado.alertas.length}) ═══\n${estado.alertas.map((a, i) => `${i + 1}. [${a.severidad}] ${a.titulo}: ${a.descripcion}`).join('\n')}` : 'Sin alertas'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'PRESTAMOS',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoPrestamos,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Asistente Solicitudes falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones (fallback)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_PRESTAMOS = detectarIntentBot('PRESTAMOS', mensaje)
    if (intentNLP_PRESTAMOS.intent && intentNLP_PRESTAMOS.confianza > 0.15) {
      const keywordsNLP_PRESTAMOS: Record<string, string> = { 'DASHBOARD_PRESTAMOS': 'dashboard', 'SOLICITUDES_PENDIENTES': 'solicitud', 'PRESTAMOS_ACTIVOS': 'activo', 'MORA_PRESTAMOS': 'mora', 'VENCIMIENTOS_PRESTAMOS': 'venc', 'RENOVACION': 'renov', 'RENTABILIDAD': 'rentab', 'MAS_RENTABLES': 'mas rentable', 'MAYOR_RIESGO': 'riesgo', 'SIMULAR': 'simul', 'DOCUMENTOS': 'document', 'CREADOS_HOY': 'creados' }
      const kw = keywordsNLP_PRESTAMOS[intentNLP_PRESTAMOS.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // Dashboard ejecutivo
    if (mensajeLower.includes('dashboard') || mensajeLower.includes('estado') || mensajeLower.includes('resumen') || mensajeLower.includes('panorama') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarDashboardEjecutivo()
    }
    // Solicitudes pendientes
    else if (mensajeLower.includes('solicitud') || mensajeLower.includes('pendiente') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'REPORTE'
      const solicitudes = await db.prestamo.findMany({
        where: { estado: { in: ['SOLICITUD', 'PENDIENTE_ACEPTACION'] } },
        include: { cliente: { select: { nombre: true, cedula: true, telefono: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      if (solicitudes.length === 0) {
        respuesta = `✅ No hay solicitudes pendientes.`
      } else {
        respuesta = `📋 SOLICITUDES PENDIENTES (${solicitudes.length}):

`
        solicitudes.forEach((s, i) => {
          respuesta += `${i + 1}. ${s.codigo} — ${s.cliente.nombre}
`
          respuesta += `   💰 ${formatearMoneda(s.montoPrincipal)} | ${s.numeroCuotas} cuotas | ${s.frecuencia}
`
          respuesta += `   📊 Estado: ${s.estado}

`
        })
      }
    }
    // Solicitudes activos
    else if (mensajeLower.includes('activo') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloPrestamos()
      respuesta = `📋 SOLICITUDES ACTIVOS: ${estado.resumen.totalActivos}

`
      // Listar los 10 más recientes
      const activos = await db.prestamo.findMany({
        where: { estado: 'ACTIVO' },
        include: { cliente: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      activos.forEach((p, i) => {
        const progreso = p.numeroCuotas > 0 ? Math.round((p.cuotasPagadas / p.numeroCuotas) * 100) : 0
        respuesta += `${i + 1}. ${p.codigo} — ${p.cliente.nombre}
`
        respuesta += `   💰 Saldo: ${formatearMoneda(p.saldoTotal)} | Progreso: ${progreso}%
`
      })
    }
    // Mora
    else if (mensajeLower.includes('mora') || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'REPORTE'
      const morosos = await db.prestamo.findMany({
        where: { estado: 'EN_MORA' },
        include: { cliente: { select: { nombre: true, telefono: true } } },
        orderBy: { diasMora: 'desc' },
      })
      if (morosos.length === 0) {
        respuesta = `✅ No hay solicitudes en mora.`
      } else {
        respuesta = `⚠️ SOLICITUDES EN MORA (${morosos.length}):

`
        morosos.forEach((p, i) => {
          respuesta += `${i + 1}. ${p.codigo} — ${p.cliente.nombre}
`
          respuesta += `   📅 ${p.diasMora} días | 💰 ${formatearMoneda(p.saldoTotal)} | 📞 ${p.cliente.telefono}

`
        })
      }
    }
    // Próximos vencimientos
    else if (mensajeLower.includes('venc') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloPrestamos()
      if (estado.proximosVencer.length === 0) {
        respuesta = `✅ No hay vencimientos en los próximos 7 días.`
      } else {
        respuesta = `📅 PRÓXIMOS VENCIMIENTOS (7 días — ${estado.proximosVencer.length}):

`
        estado.proximosVencer.forEach((v, i) => {
          respuesta += `${i + 1}. ${v.codigo} — ${v.cliente}
`
          respuesta += `   💰 Cuota: ${formatearMoneda(v.montoCuota)} | Vence: ${new Date(v.fechaVencimiento!).toLocaleDateString('es-CO')}
`
        })
      }
    }
    // Aptos para renovación
    else if (mensajeLower.includes('renov') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloPrestamos()
      if (estado.aptosRenovacion.length === 0) {
        respuesta = `ℹ️ No hay clientes aptos para renovación actualmente.

(Criterio: al día + 70%+ del solicitud pagado)`
      } else {
        respuesta = `🔄 CLIENTES APTOS PARA RENOVACIÓN (${estado.aptosRenovacion.length}):

`
        estado.aptosRenovacion.forEach((a, i) => {
          respuesta += `${i + 1}. ${a.cliente} (${a.cedula})
`
          respuesta += `   📊 ${a.progreso}% pagado | ${a.cuotasRestantes} cuotas restantes
`
          respuesta += `   💰 Saldo pendiente: ${formatearMoneda(a.saldoPendiente)}

`
        })
      }
    }
    // Análisis de rentabilidad
    else if (mensajeLower.includes('rentab') || mensajeLower.includes('utilidad') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarAnalisisRentabilidad()
    }
    // Solicitudes más rentables
    else if (mensajeLower.includes('mas rentable') || mensajeLower.includes('más rentable') || mensajeLower === '8' || mensajeLower === '8️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloPrestamos()
      if (estado.masRentables.length === 0) {
        respuesta = `ℹ️ No hay solicitudes activos para analizar rentabilidad.`
      } else {
        respuesta = `📈 SOLICITUDES MÁS RENTABLES:

`
        estado.masRentables.forEach((p, i) => {
          respuesta += `${i + 1}. ${p.codigo} — ${p.cliente}
`
          respuesta += `   💰 Capital: ${formatearMoneda(p.capital)}
`
          respuesta += `   📈 Interés generado: ${formatearMoneda(p.interesGenerado)} (${p.rentabilidadPct}%)

`
        })
      }
    }
    // Mayor riesgo
    else if (mensajeLower.includes('riesgo') || mensajeLower === '9' || mensajeLower === '9️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloPrestamos()
      if (estado.mayorRiesgo.length === 0) {
        respuesta = `✅ No hay solicitudes en mora. Sin riesgo detectado.`
      } else {
        respuesta = `🔴 SOLICITUDES DE MAYOR RIESGO:

`
        estado.mayorRiesgo.forEach((p, i) => {
          respuesta += `${i + 1}. ${p.codigo} — ${p.cliente}
`
          respuesta += `   📅 ${p.diasMora} días mora [${p.severidad}]
`
          respuesta += `   💰 Saldo: ${formatearMoneda(p.saldoTotal)} | Mora: ${formatearMoneda(p.montoMora)}

`
        })
      }
    }
    // Simular crédito
    else if (mensajeLower.includes('simul') || mensajeLower === '10' || mensajeLower === '🔟') {
      tipo = 'TEXTO'
      // Intentar extraer parámetros del mensaje
      const capitalMatch = mensajeLower.match(/\$?\s*([\d.]+(?:\s*millones?)?)/)
      const tasaMatch = mensajeLower.match(/(\d+[.,]?\d*)\s*%/)
      const plazoMatch = mensajeLower.match(/(\d+)\s*(?:cuotas|meses|mes)/)

      if (capitalMatch && tasaMatch && plazoMatch) {
        let capital = parseFloat(capitalMatch[1].replace(/\./g, ''))
        if (mensajeLower.includes('millon')) capital *= 1000000
        const tasa = parseFloat(tasaMatch[1].replace(',', '.')) / 100
        const plazo = parseInt(plazoMatch[1])

        const modalidad = mensajeLower.includes('frances') ? 'FRANCES' :
                          mensajeLower.includes('personalizada') ? 'CUOTA_PERSONALIZADA' : 'FIJO_MENSUAL'

        const simulacion = simularPrestamo({ capital, tasaMensual: tasa, plazo, modalidad })
        if ('error' in simulacion) {
          respuesta = `❌ ${simulacion.error}`
        } else {
          respuesta = `🧮 SIMULACIÓN DE CRÉDITO

`
          respuesta += `💰 Capital: ${formatearMoneda(simulacion.capital)}
`
          respuesta += `📊 Tasa mensual: ${simulacion.tasaMensual}
`
          respuesta += `📅 Plazo: ${simulacion.plazo} cuotas
`
          respuesta += `📋 Modalidad: ${simulacion.modalidad}

`
          respuesta += `═══ RESULTADO ═══
`
          respuesta += `💵 Cuota: ${formatearMoneda(simulacion.cuota)}
`
          respuesta += `📈 Interés total: ${formatearMoneda(simulacion.interesTotal)}
`
          respuesta += `💰 Total a pagar: ${formatearMoneda(simulacion.totalPagar)}
`
          respuesta += `📊 Rentabilidad: ${simulacion.rentabilidadPct}%

`
          respuesta += `💡 Ve a Solicitudes → Simulador para más opciones.`
        }
      } else {
        respuesta = `🧮 SIMULAR CRÉDITO

Escribe los parámetros, ej:
`
        respuesta += `• "simula 2.000.000 al 2.5% por 12 cuotas" (Jsadr fijo mensual)
`
        respuesta += `• "simula 5 millones frances 2% 24 cuotas"
`
        respuesta += `• "simula 1.000.000 personalizada 3% 10 cuotas"

`
        respuesta += `Modalidades: frances, fijo mensual (Jsadr), personalizada.`
      }
    }
    // Documentos
    else if (mensajeLower.includes('document') || mensajeLower.includes('pagare') || mensajeLower.includes('pagaré') || mensajeLower.includes('carta') || mensajeLower === '0' || mensajeLower === '0️⃣') {
      tipo = 'TEXTO'
      respuesta = `📄 GENERAR DOCUMENTOS

`
      respuesta += `Puedes generar:
`
      respuesta += `• Pagaré diligenciado (con datos completos + firmas + QR)
`
      respuesta += `• Pagaré en blanco (para diligenciar a mano)
`
      respuesta += `• Carta de instrucciones (10 cláusulas legales)
`
      respuesta += `• Estado de cuenta (PDF)
`
      respuesta += `• Paz y salvo (solicitudes cancelados)

`
      respuesta += `💡 Ve a Solicitudes → Documentos para generarlos.`
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `📋 MENÚ ASISTENTE SOLICITUDES
` +
        `═══ ESTADO DEL MÓDULO ═══
` +
        `1️⃣ Dashboard ejecutivo (KPIs)
` +
        `2️⃣ Solicitudes pendientes
` +
        `3️⃣ Solicitudes activos
` +
        `4️⃣ Solicitudes en mora
` +
        `═══ CONSULTAS INTELIGENTES ═══
` +
        `5️⃣ Próximos vencimientos
` +
        `6️⃣ Clientes aptos para renovación
` +
        `7️⃣ Análisis de rentabilidad
` +
        `8️⃣ Solicitudes más rentables
` +
        `9️⃣ Solicitudes de mayor riesgo
` +
        `══️ ACCIONES ═══
` +
        `🔟 Simular crédito
` +
        `0️⃣ Generar documentos

` +
        `💡 Pregúntame: "¿cuántos solicitudes activos hay?", "¿qué clientes pueden renovar?", "¿cuál es la utilidad del mes?"`
    }
        // Default
// Default
    else {
      tipo = 'TEXTO'
      respuesta = `📋 Soy Asistente Solicitudes, Director Inteligente del Módulo de Solicitudes.

` +
        `Escribe "menú" para ver opciones o pregúntame:
` +
        `• "¿cuántos solicitudes activos hay?"
` +
        `• "¿qué clientes pueden renovar?"
` +
        `• "¿cuál es la utilidad del mes?"
` +
        `• "próximos vencimientos"
` +
        `• "análisis de rentabilidad"
` +
        `• "simula 2.000.000 al 2.5% por 12 cuotas"`
    }
  }


  // === JURIDICO (Asesor Jurídico) — Asesor Jurídico Inteligente ===
  else if (botTipo === 'JURIDICO') {
    // 1. Verificar si LLM está activado
    const configLLM = await db.configBot.findUnique({ where: { clave: 'asesor_juridico_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto jurídico completo
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'JURIDICO', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        const estado = await obtenerEstadoModuloJuridico()
        const r = estado.resumen

        const contextoJuridico = `CONTEXTO MÓDULO JURÍDICO (tiempo real — ${new Date().toLocaleString('es-CO')}):

═══ PANORAMA GENERAL ═══
Total casos: ${r.totalCasos}
Casos activos: ${r.casosActivos}
• Pre-judicial: ${r.casosPreJudicial}
• Demanda: ${r.casosDemanda}
• Ejecución: ${r.casosEjecucion}
• Cobro judicial: ${r.casosCobroJudicial}
• Conciliación: ${r.casosConciliacion}
• Sentencia: ${r.casosSentencia}
• Cerrados: ${r.casosCerrados}

═══ INDICADORES ═══
Monto total en cobro jurídico: ${formatearMoneda(r.montoTotalJuridico)}
Alertas pendientes: ${r.alertasPendientes}
Candidatos a jurídico (60+ días mora): ${r.candidatosJuridico}

${estado.casosActivos.length > 0 ? `═══ CASOS ACTIVOS (top 10) ═══\n${estado.casosActivos.slice(0, 10).map((c, i) => `${i + 1}. ${c.codigo} — ${c.cliente} [${c.estado}] | Monto: ${formatearMoneda(c.montoDemandado)} | Abogado: ${c.abogado}`).join('\n')}` : 'Sin casos activos'}

${estado.candidatosJuridico.length > 0 ? `═══ CANDIDATOS A COBRO JURÍDICO (${estado.candidatosJuridico.length}) ═══\n${estado.candidatosJuridico.slice(0, 10).map((c, i) => `${i + 1}. ${c.cliente} — ${c.diasMora} días mora [${c.severidad}] | Saldo: ${formatearMoneda(c.saldoTotal)} | Recomendación: ${c.recomendacion}`).join('\n')}` : 'Sin candidatos a jurídico'}

${estado.alertasPendientes.length > 0 ? `═══ ALERTAS PENDIENTES (${estado.alertasPendientes.length}) ═══\n${estado.alertasPendientes.slice(0, 10).map((a, i) => `${i + 1}. ${a.tipo} — ${a.descripcion}${a.caso ? ` (Caso: ${a.caso.codigo})` : ''}`).join('\n')}` : 'Sin alertas pendientes'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'JURIDICO',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoJuridico,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Asesor Jurídico falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones (fallback)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_JURIDICO = detectarIntentBot('JURIDICO', mensaje)
    if (intentNLP_JURIDICO.intent && intentNLP_JURIDICO.confianza > 0.15) {
      const keywordsNLP_JURIDICO: Record<string, string> = { 'CASOS_ACTIVOS': 'caso', 'CANDIDATOS_JURIDICO': 'candidato', 'ALERTAS_LEGALES': 'alerta', 'CRONOLOGIA': 'cronolog', 'DOCUMENTOS_LEGAL': 'document', 'PORTAL_ABOGADO': 'abogado', 'ASESORIA_PAGARE': 'pagare', 'ASESORIA_COBRANZA': 'cobran', 'ASESORIA_CONTRATOS': 'contrato', 'HABEAS_DATA': 'habeas', 'REDACCION_JURIDICA': 'redact', 'LAVADO_ACTIVOS': 'lavado' }
      const kw = keywordsNLP_JURIDICO[intentNLP_JURIDICO.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // Casos activos / resumen del módulo
    if (mensajeLower.includes('caso') || mensajeLower.includes('estado') || mensajeLower.includes('resumen') || mensajeLower.includes('panorama') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarResumenJuridico()
    }
    // Candidatos a jurídico
    else if (mensajeLower.includes('candidato') || mensajeLower.includes('juridico') || mensajeLower.includes('jurídico') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloJuridico()
      if (estado.candidatosJuridico.length === 0) {
        respuesta = `✅ No hay candidatos a cobro jurídico actualmente.\n\n(Criterio: solicitudes con 60+ días de mora sin caso jurídico existente)`
      } else {
        respuesta = `⚖️ CANDIDATOS A COBRO JURÍDICO (${estado.candidatosJuridico.length}):\n\n`
        estado.candidatosJuridico.forEach((c, i) => {
          respuesta += `${i + 1}. ${c.cliente} — ${c.diasMora} días mora [${c.severidad}]\n`
          respuesta += `   💰 Saldo: ${formatearMoneda(c.saldoTotal)} | Mora: ${formatearMoneda(c.montoMora)}\n`
          respuesta += `   📞 ${c.telefono}\n`
          respuesta += `   🎯 Recomendación: ${c.recomendacion}\n\n`
        })
        respuesta += `💡 Para crear un caso: ve a Jurídico → Nuevo Caso y selecciona el solicitud.`
      }
    }
    // Alertas legales
    else if (mensajeLower.includes('alerta') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoModuloJuridico()
      if (estado.alertasPendientes.length === 0) {
        respuesta = `✅ No hay alertas legales pendientes.`
      } else {
        respuesta = `🔔 ALERTAS LEGALES PENDIENTES (${estado.alertasPendientes.length}):\n\n`
        estado.alertasPendientes.forEach((a, i) => {
          respuesta += `${i + 1}. ${a.tipo} — ${a.descripcion}\n`
          if (a.caso) respuesta += `   Caso: ${a.caso.codigo} (${a.caso.cliente})\n`
          respuesta += `\n`
        })
      }
    }
    // Cronología / detalle de caso
    else if (mensajeLower.includes('cronolog') || mensajeLower.includes('detalle') || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'TEXTO'
      respuesta = `📋 CRONOLOGÍA DE CASO\n\nPara ver la cronología de un caso específico, escribe su código, ej:\n• "cronología de JUR-2026-001"\n• "detalle del caso JUR-2026-001"\n\n💡 También ve a Jurídico → Casos → Abrir caso → Cronología.`
    }
    // Documentos
    else if (mensajeLower.includes('document') || mensajeLower.includes('demanda') || mensajeLower.includes('memorial') || mensajeLower.includes('requerimiento') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'TEXTO'
      respuesta = `📄 DOCUMENTOS LEGALES\n\nPuedes generar:\n• Demanda ejecutiva\n• Requerimiento de pago\n• Memorial\n• Notificación judicial\n• Acta de audiencia\n• Poder\n• Acuerdo de pago\n\n💡 Ve a Jurídico → Documentos para generarlos.`
    }
    // Portal del abogado
    else if (mensajeLower.includes('abogado') || mensajeLower.includes('portal') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'TEXTO'
      respuesta = `⚖️ PORTAL DEL ABOGADO\n\nEl portal del abogado está en Jurídico → Portal Abogado.\n• Login con cédula + clave\n• Acceso a casos asignados\n• Chat interno → comunicaciones (categoría JURIDICO_INTERNO)\n• Activar/desactivar cuenta desde el panel principal`
    }
    // Asesoría jurídica civil/comercial
    else if (mensajeLower.includes('civil') || mensajeLower.includes('comercial') || mensajeLower.includes('contrato') || mensajeLower.includes('pagare') || mensajeLower.includes('pagaré') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'TEXTO'
      if (mensajeLower.includes('pagar') || mensajeLower.includes('pagaré')) {
        respuesta = `📋 ASESORÍA SOBRE PAGARÉ\n\n**Información jurídica general:**\nEl pagaré es un título valor regulado por el Código de Comercio colombiano (arts. 620-624 y 702-707).\n\n**Requisitos del pagaré (art. 621 C.Co.):**\n1. La mención de ser "pagaré"\n2. La promesa incondicional de pagar una suma determinada\n3. El nombre del beneficiario\n4. La fecha y lugar de suscripción\n5. La fecha de vencimiento\n6. Lugar de pago\n7. La firma del suscriptor\n\n**Acción ejecutiva:** El pagaré es título ejecutivo (art. 488 CGP). La acción prescribe en 3 años desde el vencimiento (art. 784 C.Co.).\n\n**Recomendación:** Para cobro judicial, el pagaré permite proceso ejecutivo单documental (art. 420 CGP).\n\n⚠️ Para análisis de un caso específico, comparte el código del solicitud.`
      } else if (mensajeLower.includes('contrato')) {
        respuesta = `📋 ASESORÍA SOBRE CONTRATOS\n\n**Información jurídica general:**\nLos contratos en Colombia se rigen por el Código Civil (arts. 1495-1501).\n\n**Elementos esenciales (art. 1501 C.C.):**\n1. Consentimiento\n2. Objeto físico y jurídicamente posible\n3. Causa lícita\n\n**Clases de contratos:**\n• Consensuales: se perfeccionan con el solo consentimiento\n• Reales: requieren entrega de la cosa\n• Solemnes: requieren formalidades específicas\n\n**Incumplimiento:** Da lugar a indemnización de perjuicios (arts. 1546-1556 C.C.) y resolución del contrato.\n\n⚠️ Para asesoría sobre un contrato específico, compártelo.`
      } else {
        respuesta = `⚖️ ASESORÍA JURÍDICA\n\nPuedo asesorarte sobre:\n\n**Derecho Civil:**\n• Contratos, obligaciones, incumplimientos\n• Responsabilidad civil, garantías, indemnizaciones\n• Prescripción y caducidad\n\n**Derecho Comercial:**\n• Títulos valores (pagarés, letras, cheques)\n• Contratos mercantiles, sociedades\n• Representación legal\n\nPregúntame cosas como:\n• "¿qué dice la ley sobre pagarés?"\n• "¿cómo cobrar un pagaré vencido?"\n• "¿qué elementos debe tener un contrato?"\n• "¿cuándo prescribe una obligación?"`
      }
    }
    // Cobranza
    else if (mensajeLower.includes('cobran') || mensajeLower.includes('cobro') || mensajeLower.includes('ejecut') || mensajeLower === '8' || mensajeLower === '8️⃣') {
      tipo = 'TEXTO'
      respuesta = `💼 ASESORÍA EN COBRANZA\n\n**Etapas de cobro en Colombia:**\n\n1. **Cobro persuasivo** (1-30 días):\n   • Llamadas, WhatsApp, correos\n   • Recordatorios amables\n   • Sin acciones legales\n\n2. **Cobro prejurídico** (30-60 días):\n   • Requerimiento escrito\n   • Última oportunidad de acuerdo\n   • Preparación documental\n\n3. **Cobro judicial** (60+ días):\n   • Proceso ejecutivo (art. 420 CGP)\n   • Si el título es pagaré/letra: proceso ejecutivo single\n   • Medidas cautelares: embargo y secuestro\n   • Audiencia de conciliación\n\n**Proceso ejecutivo (Ley 1564/2012 art. 420-423):**\n• Título ejecutivo: pagaré, letra, contrato\n• Demanda con sus anexos\n• Mandamiento de pago\n• Excepciones del demandado\n• Sentencia y ejecución\n\n⚠️ Para analizar un caso específico, dame el código del solicitud.`
    }
    // Procesos judiciales
    else if (mensajeLower.includes('proceso') || mensajeLower.includes('demanda') || mensajeLower.includes('embargo') || mensajeLower.includes('audiencia') || mensajeLower === '9' || mensajeLower === '9️⃣') {
      tipo = 'TEXTO'
      respuesta = `⚖️ PROCESOS JUDICIALES EN COLOMBIA\n\n**Proceso Ejecutivo (art. 420 CGP):**\n• Aplica para obligaciones con título ejecutivo (pagaré, letra de cambio, sentencia)\n• Demanda + título + pruebas\n• Mandamiento de pago (auto admisorio)\n• Término para excepciones: 10 días\n• Audiencia de pruebas y sentencia\n\n**Medidas cautelares:**\n• Embargo: afecta bienes del demandado\n• Secuestro: aprehensión material de bienes\n• Inscripción en registro: inmuebles\n• Requisitos: presupuesto + contracautela\n\n**Recursos:**\n• Apelación (art. 320-323 CGP)\n• Casación (art. 336-345 CGP)\n• Queja (art. 324-329 CGP)\n• Revisión (art. 346-352 CGP)\n\n**Jurisdicción competente:**\n• Juzgados Civiles del Circuito (mayor cuantía)\n• Juzgados Civiles Municipales (menor cuantía)\n• Cuantía: según salario mínimo (arts. 18-21 CGP)`
    }
    // Redacción jurídica
    else if (mensajeLower.includes('redact') || mensajeLower.includes('escrib') || mensajeLower.includes('elabor') || mensajeLower === '10' || mensajeLower === '🔟') {
      tipo = 'TEXTO'
      respuesta = `✍️ REDACCIÓN JURÍDICA\n\nPuedo ayudarte a redactar o revisar:\n• Derechos de petición\n• Contratos y otrosíes\n• Acuerdos de pago\n• Cartas y comunicaciones\n• Requerimientos\n• Memoriales\n• Demandas y contestaciones\n• Poderes\n• Actas\n• Conceptos jurídicos\n\n💡 Para redactar un documento específico, escribe:\n• "redacta un requerimiento de pago para el cliente X"\n• "elabora un acuerdo de pago por $5.000.000 a 6 cuotas"\n• "redacta un derecho de petición al ICPC"`
    }
    // Cumplimiento normativo
    else if (mensajeLower.includes('cumplimient') || mensajeLower.includes('habeas') || mensajeLower.includes('lavado') || mensajeLower.includes('datos') || mensajeLower === '0' || mensajeLower === '0️⃣') {
      tipo = 'TEXTO'
      if (mensajeLower.includes('habeas') || mensajeLower.includes('datos')) {
        respuesta = `🔒 PROTECCIÓN DE DATOS\n\n**Marco normativo:**\n• Constitución Política art. 15 (derecho fundamental)\n• Ley 1266 de 2008 (habeas data financiero)\n• Ley 1581 de 2012 (datos personales generales)\n• Decreto 1377 de 2013 (reglamentario)\n\n**Obligaciones de Jsadr:**\n1. Autorización previa del titular (art. 9 Ley 1581)\n2. Finalidad específica del tratamiento (art. 4)\n3. Conservación por el tiempo necesario\n4. Seguridad de la información\n5. Atención de consultas y reclamos (arts. 21-23)\n\n**Derechos del titular:**\n• Acceso, consulta, actualización, rectificación, supresión\n• Revocar autorización\n\n**Recomendación:** Mantener política de tratamiento de datos actualizada y autorizaciones firmadas.`
      } else if (mensajeLower.includes('lavado')) {
        respuesta = `💼 PREVENCIÓN DE LAVADO DE ACTIVOS (LA/FT)\n\n**Marco normativo:**\n• Ley 599 de 2000 (Código Penal, arts. 323-325)\n• Ley 1121 de 2006 (terrorismo)\n• Decreto 663 de 1993 (Estatuto Orgánico Financiero)\n• Circular básico jurídico SIC\n\n**Obligaciones de Jsadr:**\n1. SARLAFT (Sistema de Administración del Riesgo de LA/FT)\n2. Conocimiento del cliente (KYC)\n3. Reportes de operaciones sospechosas (ROS)\n4. Lista vinculante ONU (resolution 1267)\n5. Conservación documental (10 años)\n\n**Señales de alerta:**\n• Transacciones inusuales\n• Cliente reacio a dar información\n• Origen de fondos no claro\n• Múltiples pagos en efectivo\n\n⚠️ Jsadr debe implementar matriz de riesgo y manual SARLAFT.`
      } else {
        respuesta = `📋 CUMPLIMIENTO NORMATIVO\n\nPuedo asesorarte sobre:\n\n• **Prevención de Lavado de Activos (LA/FT):** SARLAFT, KYC, reportes SOS\n• **Habeas Data:** Ley 1266/2008 y Ley 1581/2012\n• **Gestión del riesgo:** matriz, evaluación, mitigación\n• **Conservación documental:** plazos legales\n• **Auditoría:** interna y externa\n• **Cumplimiento regulatorio:** SIC, Superfinanciera\n\n💡 Pregúntame: "¿qué es el habeas data?", "¿qué obligaciones tengo sobre lavado de activos?", "¿cuánto tiempo debo conservar documentos?"`
      }
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `⚖️ MENÚ ASESOR JURÍDICO\n` +
        `═══ MÓDULO JURÍDICO ═══\n` +
        `1️⃣ Casos activos\n` +
        `2️⃣ Candidatos a jurídico (60+ días mora)\n` +
        `3️⃣ Alertas legales pendientes\n` +
        `4️⃣ Cronología de un caso\n` +
        `5️⃣ Documentos legales\n` +
        `6️⃣ Portal del abogado\n` +
        `══️ ASESORÍA JURÍDICA ═══\n` +
        `7️⃣ Consulta de derecho civil/comercial\n` +
        `8️⃣ Cobranza (persuasiva/prejurídica/judicial)\n` +
        `9️⃣ Procesos judiciales\n` +
        `🔟 Redacción jurídica\n` +
        `0️⃣ Cumplimiento normativo (LA/FT, Habeas Data)\n\n` +
        `💡 Pregúntame: "¿qué casos requieren atención?", "¿cómo cobrar un pagaré?", "redacta un requerimiento"`
    }
        // Default
// Default
    else {
      tipo = 'TEXTO'
      respuesta = `⚖️ Soy Asesor Jurídico, tu asesor jurídico inteligente.\n\n` +
        `Escribe "menú" para ver opciones o pregúntame:\n` +
        `• "casos activos"\n` +
        `• "candidatos a jurídico"\n` +
        `• "¿cómo cobrar un pagaré vencido?"\n` +
        `• "redacta un requerimiento de pago"\n` +
        `• "¿qué dice la ley sobre habeas data?"\n` +
        `• "proceso ejecutivo en Colombia"`
    }
  }


  // === SEGURIDAD (Ciberseguridad) — CISO Inteligente (SOC AI) ===
  else if (botTipo === 'SEGURIDAD') {
    // 1. Verificar si LLM está activado
    const configLLM = await db.configBot.findUnique({ where: { clave: 'ciberseguridad_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto de seguridad completo
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'SEGURIDAD', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        const audit = await auditarSeguridad()
        const r = audit.resumen

        const contextoSeguridad = `CONTEXTO DE SEGURIDAD (tiempo real — ${new Date().toLocaleString('es-CO')}):

═══ NIVEL DE RIESGO GENERAL ═══
${r.colorRiesgo} ${r.nivelRiesgoGeneral}
Hallazgos: ${r.totalHallazgos} (${r.hallazgosCriticos} críticos, ${r.hallazgosAltos} altos, ${r.hallazgosMedios} medios)

═══ USUARIOS Y PERMISOS ═══
Usuarios internos: ${r.totalUsuarios} (${r.admins} ADMIN)
Clientes: ${r.totalClientes}
• Sin PIN: ${r.clientesSinPin}
• Sin clave: ${r.clientesSinClave}
Usuarios bloqueados: ${r.usuariosBloqueados}
Usuarios inactivos (90+ días): ${r.usuariosInactivos}

═══ ACCESOS (24h) ═══
Total: ${r.accesos24h}
Exitosos: ${r.accesosExitosos}
Fallidos: ${r.accesosFallidos}
IPs únicas: ${r.ipsUnicas}
IPs sospechosas (5+ intentos): ${r.ipsSospechosas}

══️ AUDITORÍA (24h) ═══
Eventos: ${r.auditReciente}
Fallidos: ${r.auditFallida}

═══ BACKUPS ═══
Total: ${r.totalBackups}
Últimos 30 días: ${r.backups30dias}

═══ CONEXIONES API ═══
Activas: ${r.conexionesActivas}
Inactivas: ${r.conexionesInactivas}

═══ MÓDULOS PROTEGIDOS ═══
${r.modulosProtegidos} módulo(s) con protección activa

${audit.hallazgos.length > 0 ? `═══ HALLAZGOS (${audit.hallazgos.length}) ═══\n${audit.hallazgos.map((h, i) => `${i + 1}. [${h.nivel}] ${h.descripcion}\n   Impacto: ${h.impacto}\n   Recomendación: ${h.recomendacion}`).join('\n')}` : 'Sin hallazgos'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'SEGURIDAD',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoSeguridad,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Ciberseguridad falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones (fallback)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_SEGURIDAD = detectarIntentBot('SEGURIDAD', mensaje)
    if (intentNLP_SEGURIDAD.intent && intentNLP_SEGURIDAD.confianza > 0.15) {
      const keywordsNLP_SEGURIDAD: Record<string, string> = { 'ESTADO_SEGURIDAD': 'estado', 'NIVEL_RIESGO': 'riesgo', 'HALLAZGOS': 'hallazgo', 'USUARIOS_RIESGO': 'usuario', 'PERMISOS': 'permiso', 'AUDITORIA_LOGS': 'audit', 'ACCESOS_SOSPECHOSOS': 'sospech', 'INFORME_SEGURIDAD': 'informe', 'PLAN_ACCION_SEG': 'plan', 'MFA': 'mfa', 'BACKUPS_SEG': 'backup' }
      const kw = keywordsNLP_SEGURIDAD[intentNLP_SEGURIDAD.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // Estado general
    if (mensajeLower.includes('estado') || mensajeLower.includes('general') || mensajeLower.includes('sistema') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `🛡️ ESTADO DE SEGURIDAD\n\n`
      respuesta += `═══ NIVEL GENERAL ═══\n`
      respuesta += `${r.colorRiesgo} ${r.nivelRiesgoGeneral}\n`
      respuesta += `Hallazgos: ${r.totalHallazgos} (${r.hallazgosCriticos} críticos, ${r.hallazgosAltos} altos, ${r.hallazgosMedios} medios)\n\n`
      respuesta += `═══ USUARIOS ═══\n`
      respuesta += `Internos: ${r.totalUsuarios} (${r.admins} ADMIN)\n`
      respuesta += `Clientes: ${r.totalClientes} (sin PIN: ${r.clientesSinPin}, sin clave: ${r.clientesSinClave})\n`
      respuesta += `Bloqueados: ${r.usuariosBloqueados}\n`
      respuesta += `Inactivos (90+ días): ${r.usuariosInactivos}\n\n`
      respuesta += `═══ ACCESOS 24h ═══\n`
      respuesta += `Exitosos: ${r.accesosExitosos} | Fallidos: ${r.accesosFallidos}\n`
      respuesta += `IPs únicas: ${r.ipsUnicas} | Sospechosas: ${r.ipsSospechosas}\n\n`
      respuesta += `═══ BACKUPS ═══\n`
      respuesta += `Total: ${r.totalBackups} | Últimos 30 días: ${r.backups30dias}\n\n`
      respuesta += `💡 Escribe "informe" para ver el informe completo o "plan" para ver acciones priorizadas.`
    }
    // Nivel de riesgo
    else if (mensajeLower.includes('nivel') || mensajeLower.includes('riesgo') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `📊 NIVEL DE RIESGO ACTUAL\n\n`
      respuesta += `${r.colorRiesgo} ${r.nivelRiesgoGeneral}\n\n`
      respuesta += `Hallazgos por severidad:\n`
      respuesta += `🔴 Críticos: ${r.hallazgosCriticos}\n`
      respuesta += `🟠 Altos: ${r.hallazgosAltos}\n`
      respuesta += `🟡 Medios: ${r.hallazgosMedios}\n\n`
      if (r.hallazgosCriticos > 0) {
        respuesta += `⚠️ ACCIÓN INMEDIATA REQUERIDA\n`
        respuesta += `Hay ${r.hallazgosCriticos} hallazgo(s) crítico(s) que deben atenderse AHORA.\n\n`
        respuesta += `💡 Escribe "hallazgos" para ver el detalle.`
      } else if (r.hallazgosAltos > 0) {
        respuesta += `⚠️ Atender en 24-48h los hallazgos altos.`
      } else {
        respuesta += `✅ Sistema en buen estado. Sin riesgos críticos.`
      }
    }
    // Hallazgos críticos
    else if (mensajeLower.includes('hallazgo') || mensajeLower.includes('vulnerab') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      if (audit.hallazgos.length === 0) {
        respuesta = `✅ No hay hallazgos de seguridad. Sistema en buen estado.`
      } else {
        respuesta = `🔍 HALLAZGOS DE SEGURIDAD (${audit.hallazgos.length}):\n\n`
        audit.hallazgos.forEach((h, i) => {
          const emoji = h.nivel === 'CRITICA' ? '🔴' : h.nivel === 'ALTA' ? '🟠' : h.nivel === 'MEDIA' ? '🟡' : '🟢'
          respuesta += `${i + 1}. ${emoji} [${h.nivel}] ${h.descripcion}\n`
          respuesta += `   Impacto: ${h.impacto}\n`
          respuesta += `   Probabilidad: ${h.probabilidad}\n`
          respuesta += `   Recomendación: ${h.recomendacion}\n`
          respuesta += `   Estado: ${h.estado}\n\n`
        })
      }
    }
    // Usuarios de riesgo
    else if (mensajeLower.includes('usuario') && (mensajeLower.includes('riesgo') || mensajeLower.includes('peligro')) || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `👤 USUARIOS DE RIESGO\n\n`
      respuesta += `Usuarios bloqueados: ${r.usuariosBloqueados}\n`
      respuesta += `Usuarios inactivos (90+ días): ${r.usuariosInactivos}\n`
      respuesta += `IPs con intentos sospechosos: ${r.ipsSospechosas}\n\n`
      if (audit.ipsSospechosas.length > 0) {
        respuesta += `IPs sospechosas:\n`
        audit.ipsSospechosas.forEach((ip) => {
          respuesta += `• ${ip.ip}: ${ip.intentos} intentos fallidos\n`
        })
      }
    }
    // Permisos a corregir
    else if (mensajeLower.includes('permiso') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `🔑 PERMISOS A CORREGIR\n\n`
      respuesta += `• Clientes sin PIN: ${r.clientesSinPin}\n`
      respuesta += `• Clientes sin clave: ${r.clientesSinClave}\n`
      respuesta += `• Usuarios inactivos con cuenta activa: ${r.usuariosInactivos}\n`
      respuesta += `• ADMIN sin MFA verificado: revisar manualmente\n\n`
      respuesta += `💡 Recomendación: implementar RBAC estricto y rotación de credenciales.`
    }
    // Auditoría reciente
    else if (mensajeLower.includes('audit') || mensajeLower.includes('auditor') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      if (audit.auditReciente.length === 0) {
        respuesta = `📋 No hay eventos de auditoría en las últimas 24h.`
      } else {
        respuesta = `📋 AUDITORÍA RECIENTE (últimas 24h — ${audit.auditReciente.length} eventos):\n\n`
        audit.auditReciente.forEach((a, i) => {
          respuesta += `${i + 1}. [${new Date(a.fecha).toLocaleString('es-CO')}] ${a.exito ? '✅' : '❌'} ${a.accion}\n`
          respuesta += `   Usuario: ${a.usuario || 'sistema'} | Módulo: ${a.modulo}\n`
        })
      }
    }
    // Accesos sospechosos
    else if (mensajeLower.includes('sospech') || mensajeLower.includes('acceso') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      respuesta = `🔍 ACCESOS SOSPECHOSOS\n\n`
      if (audit.ipsSospechosas.length === 0) {
        respuesta += `✅ No hay IPs sospechosas detectadas en las últimas 24h.`
      } else {
        respuesta += `⚠️ IPs con 5+ intentos fallidos:\n\n`
        audit.ipsSospechosas.forEach((ip) => {
          respuesta += `• ${ip.ip}: ${ip.intentos} intentos fallidos\n`
        })
        respuesta += `\n💡 Recomendación: bloquear estas IPs en el firewall.`
      }
    }
    // Conexiones API
    else if (mensajeLower.includes('api') || mensajeLower.includes('conexion') || mensajeLower.includes('conexión') || mensajeLower === '8' || mensajeLower === '8️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `🔌 CONEXIONES API\n\n`
      respuesta += `Activas: ${r.conexionesActivas}\n`
      respuesta += `Inactivas: ${r.conexionesInactivas}\n\n`
      respuesta += `💡 Ve a Configuración → Integraciones para gestionar.`
    }
    // Módulos protegidos
    else if (mensajeLower.includes('modulo') || mensajeLower.includes('módulo') || mensajeLower.includes('protegido') || mensajeLower === '9' || mensajeLower === '9️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      respuesta = `🔐 MÓDULOS PROTEGIDOS\n\n`
      respuesta += `Módulos con protección activa: ${audit.resumen.modulosProtegidos}\n\n`
      respuesta += `💡 Ve a Seguridad → Módulos Protegidos para gestionar.`
    }
    // Variables de entorno
    else if (mensajeLower.includes('variable') || mensajeLower.includes('entorno') || mensajeLower.includes('env') || mensajeLower === '10' || mensajeLower === '🔟') {
      tipo = 'TEXTO'
      respuesta = `🔧 VARIABLES DE ENTORNO\n\nVariables críticas a verificar:\n• DATABASE_URL (BD)\n• JWT_SECRET (autenticación)\n• API_ENCRYPTION_KEY (cifrado)\n• WHATSAPP_TOKEN (notificaciones)\n• SMTP_* (correo)\n\n⚠️ Por seguridad, no revelo los valores. Ve a .env para revisar.\n\n💡 Recomendación: rotar JWT_SECRET cada 90 días.`
    }
    // Backups
    else if (mensajeLower.includes('backup') || mensajeLower.includes('respaldo') || mensajeLower === '0' || mensajeLower === '0️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `💾 COPIAS DE SEGURIDAD\n\n`
      respuesta += `Total: ${r.totalBackups}\n`
      respuesta += `Últimos 30 días: ${r.backups30dias}\n\n`
      if (r.backups30dias === 0) {
        respuesta += `🔴 ALERTA: No hay backups recientes. Configura backups automáticos.`
      } else if (r.backups30dias < 4) {
        respuesta += `🟡 Recomendación: hacer backups más frecuentes (ideal: diario).`
      } else {
        respuesta += `✅ Frecuencia de backups adecuada.`
      }
    }
    // Informe de seguridad
    else if (mensajeLower.includes('informe') || mensajeLower === 'a' || mensajeLower === 'a️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarInformeSeguridad()
    }
    // Plan de acción
    else if (mensajeLower.includes('plan') || mensajeLower.includes('accion') || mensajeLower.includes('acción') || mensajeLower === 'b' || mensajeLower === 'b️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarPlanAccion()
    }
    // Recomendaciones de hoy
    else if (mensajeLower.includes('recomend') || mensajeLower === 'c' || mensajeLower === 'c️⃣') {
      tipo = 'TEXTO'
      const audit = await auditarSeguridad()
      const r = audit.resumen
      respuesta = `💡 RECOMENDACIONES DE HOY\n\n`
      if (r.hallazgosCriticos > 0) {
        respuesta += `🔴 URGENTE: ${r.hallazgosCriticos} hallazgo(s) crítico(s)\n`
        respuesta += `   → Atender inmediatamente (escribe "hallazgos")\n\n`
      }
      if (r.clientesSinPin > 0) {
        respuesta += `🟠 ${r.clientesSinPin} cliente(s) sin PIN\n`
        respuesta += `   → Forzar creación de PIN en próximo acceso\n\n`
      }
      if (r.usuariosInactivos > 0) {
        respuesta += `🟡 ${r.usuariosInactivos} usuario(s) inactivo(s)\n`
        respuesta += `   → Desactivar cuentas o requerir reactivación\n\n`
      }
      if (r.backups30dias === 0) {
        respuesta += `🔴 Sin backups en 30 días\n`
        respuesta += `   → Configurar backups automáticos\n\n`
      }
      respuesta += `📋 Recomendaciones generales:\n`
      respuesta += `• Activar MFA en cuentas ADMIN\n`
      respuesta += `• Rotar JWT_SECRET (cada 90 días)\n`
      respuesta += `• Revisar logs de auditoría semanalmente\n`
      respuesta += `• Actualizar dependencias npm\n`
      respuesta += `• Verificar certificados SSL\n`
    }
    // Activar MFA
    else if (mensajeLower.includes('mfa') || mensajeLower.includes(' multifactor') || mensajeLower === 'd' || mensajeLower === 'd️⃣') {
      tipo = 'TEXTO'
      respuesta = `🔐 ACTIVAR MFA\n\nPara activar MFA en una cuenta:\n1. Ve a Seguridad → Usuarios\n2. Selecciona el usuario\n3. Activa el switch "MFA"\n4. El usuario deberá escanear código QR con app autenticadora (Google Authenticator, Authy)\n5. Verificar con código de 6 dígitos\n\n💡 Recomendación: activar MFA en TODAS las cuentas ADMIN.`
    }
    // Bloquear usuario
    else if (mensajeLower.includes('bloquear') || mensajeLower === 'e' || mensajeLower === 'e️⃣') {
      tipo = 'TEXTO'
      respuesta = `🔒 BLOQUEAR USUARIO\n\nPara bloquear un usuario sospechoso:\n1. Ve a Seguridad → Usuarios\n2. Busca por cédula o nombre\n3. Click en "Bloquear"\n4. Define duración del bloqueo\n5. Registra motivo en auditoría\n\n⚠️ El bloqueo es reversible. Siempre justificar el motivo.`
    }
    // Desbloquear usuario
    else if (mensajeLower.includes('desbloquear') || mensajeLower === 'f' || mensajeLower === 'f️⃣') {
      tipo = 'TEXTO'
      respuesta = `🔓 DESBLOQUEAR USUARIO\n\nPara desbloquear un usuario:\n1. Ve a Seguridad → Usuarios\n2. Filtra por "Bloqueados"\n3. Click en "Desbloquear"\n4. Verifica identidad del usuario antes\n5. Registra motivo en auditoría\n\n⚠️ Antes de desbloquear, verifica que no sea un ataque.`
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `🛡️ MENÚ CIBERSEGURIDAD\n` +
        `═══ ESTADO DE SEGURIDAD ═══\n` +
        `1️⃣ Estado general del sistema\n` +
        `2️⃣ Nivel de riesgo actual\n` +
        `3️⃣ Hallazgos críticos\n` +
        `4️⃣ Usuarios de riesgo\n` +
        `5️⃣ Permisos a corregir\n` +
        `═══ AUDITORÍA ═══\n` +
        `6️⃣ Auditoría reciente (logs)\n` +
        `7️⃣ Accesos sospechosos\n` +
        `8️⃣ Conexiones API\n` +
        `9️⃣ Módulos protegidos\n` +
        `🔟 Variables de entorno\n` +
        `0️⃣ Copias de seguridad\n` +
        `══️ ACCIONES ═══\n` +
        `A️⃣ Generar informe de seguridad\n` +
        `B️⃣ Plan de acción priorizado\n` +
        `C️⃣ Recomendaciones de hoy\n` +
        `D️⃣ Activar MFA\n` +
        `E️⃣ Bloquear usuario sospechoso\n` +
        `F️⃣ Desbloquear usuario\n\n` +
        `💡 Pregúntame: "¿cuál es el estado de seguridad?", "¿qué vulnerabilidades encontraste?", "¿qué recomendaciones tienes hoy?"`
    }
        // Default
// Default
    else {
      tipo = 'TEXTO'
      respuesta = `🛡️ Soy Ciberseguridad, tu CISO Inteligente (SOC AI).\n\n` +
        `Escribe "menú" para ver opciones o pregúntame:\n` +
        `• "estado de seguridad"\n` +
        `• "nivel de riesgo"\n` +
        `• "hallazgos críticos"\n` +
        `• "usuarios sospechosos"\n` +
        `• "informe de seguridad"\n` +
        `• "plan de acción"\n` +
        `• "recomendaciones de hoy"`
    }
  }


  // === ADMIN_GENERAL (Asistente Ejecutivo IA) — Chief of Staff Digital ===
  else if (botTipo === 'ADMIN_GENERAL') {
    // 1. Verificar si LLM está activado
    const configLLM = await db.configBot.findUnique({ where: { clave: 'asistente_ejecutivo_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto consolidado de TODOS los módulos
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'ADMIN_GENERAL', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        const consolidado = await obtenerDashboardConsolidado()
        const r = consolidado.resumen

        const contextoConsolidado = `CONTEXTO EJECUTIVO CONSOLIDADO (tiempo real — ${new Date().toLocaleString('es-CO')}):

═══ RESUMEN EJECUTIVO ═══
Período: mes actual

FINANCIERO:
• Capital prestado: ${formatearMoneda(r.capitalPrestado)}
• Capital recuperado: ${formatearMoneda(r.capitalRecuperado)}
• Capital pendiente: ${formatearMoneda(r.capitalPendiente)}
• Utilidad del mes: ${formatearMoneda(r.utilidadMes)}
• Utilidad del año: ${formatearMoneda(r.utilidadAnio)}
• Recaudo del mes: ${formatearMoneda(r.recaudoMes)} (${r.crecimientoRecaudo >= 0 ? '+' : ''}${r.crecimientoRecaudo}% vs mes anterior)
• Recaudo del año: ${formatearMoneda(r.recaudoAnio)}
• Rentabilidad promedio: ${r.rentabilidadPromedio}%

COMERCIAL:
• Total clientes: ${r.totalClientes}
• Nuevos este mes: ${r.clientesNuevosMes} (${r.crecimientoClientes >= 0 ? '+' : ''}${r.crecimientoClientes}%)
• Total solicitudes: ${r.totalPrestamos} (${r.prestamosActivos} activos, ${r.prestamosMora} en mora)
• Tasa de mora: ${r.tasaMora}%

OPERATIVO:
• Casos jurídicos activos: ${r.casosJuridicos}
• Candidatos a jurídico: ${r.candidatosJuridico}
• Hallazgos de seguridad: ${r.hallazgosSeguridad} (${r.hallazgosCriticos} críticos)

PERSONAL:
• Balance personal: ${formatearMoneda(r.balancePersonal)}
• Capacidad ahorro personal: ${r.capacidadAhorroPersonal}%

${consolidado.anomalias.length > 0 ? `═══ ANOMALÍAS DETECTADAS (${consolidado.anomalias.length}) ═══\n${consolidado.anomalias.map((a, i) => `${i + 1}. [${a.severidad}] ${a.titulo}: ${a.descripcion}`).join('\n')}` : 'Sin anomalías detectadas'}

${consolidado.oportunidades.length > 0 ? `═══ OPORTUNIDADES (${consolidado.oportunidades.length}) ═══\n${consolidado.oportunidades.map((o, i) => `${i + 1}. ${o.titulo}: ${o.descripcion} (Impacto: ${o.impactoEstimado})`).join('\n')}` : 'Sin oportunidades detectadas'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'ADMIN_GENERAL',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoConsolidado,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Asistente Ejecutivo falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones (fallback)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_ADMIN_GENERAL = detectarIntentBot('ADMIN_GENERAL', mensaje)
    if (intentNLP_ADMIN_GENERAL.intent && intentNLP_ADMIN_GENERAL.confianza > 0.15) {
      const keywordsNLP_ADMIN_GENERAL: Record<string, string> = { 'DASHBOARD_CONSOLIDADO': 'dashboard', 'KPI_FINANCIERO': 'financiero', 'KPI_COMERCIAL': 'comercial', 'KPI_OPERATIVO': 'operativo', 'ANOMALIAS': 'anomalia', 'TENDENCIAS': 'tendencia', 'ANALISIS_ESTRATEGICO': 'estrateg', 'COMPARATIVOS': 'compar', 'OPORTUNIDADES': 'oportunidad', 'PLAN_ACCION': 'plan', 'AUDITORIA_INTERNA': 'audit', 'CONSULTOR': 'consultor' }
      const kw = keywordsNLP_ADMIN_GENERAL[intentNLP_ADMIN_GENERAL.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // Dashboard consolidado
    if (mensajeLower.includes('dashboard') || mensajeLower.includes('estado') || mensajeLower.includes('negocio') || mensajeLower.includes('cómo va') || mensajeLower.includes('como va') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarDashboardEjecutivoConsolidado()
    }
    // KPIs financieros
    else if (mensajeLower.includes('financiero') || mensajeLower.includes('utilidad') || mensajeLower.includes('kpi') && mensajeLower.includes('financ') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      const r = data.resumen
      respuesta = `💰 KPIs FINANCIEROS CONSOLIDADOS\n\n`
      respuesta += `═══ CAPITAL ═══\n`
      respuesta += `Prestado: ${formatearMoneda(r.capitalPrestado)}\n`
      respuesta += `Recuperado: ${formatearMoneda(r.capitalRecuperado)} (${data.modulos.prestamos.tasaRecuperacion}%)\n`
      respuesta += `Pendiente: ${formatearMoneda(r.capitalPendiente)}\n\n`
      respuesta += `═══ UTILIDAD ═══\n`
      respuesta += `Mes: ${formatearMoneda(r.utilidadMes)}\n`
      respuesta += `Año: ${formatearMoneda(r.utilidadAnio)}\n\n`
      respuesta += `═══ RECAUDO ═══\n`
      respuesta += `Mes: ${formatearMoneda(r.recaudoMes)} (${r.crecimientoRecaudo >= 0 ? '📈' : '📉'} ${r.crecimientoRecaudo}%)\n`
      respuesta += `Año: ${formatearMoneda(r.recaudoAnio)}\n\n`
      respuesta += `Rentabilidad promedio: ${r.rentabilidadPromedio}%`
    }
    // KPIs comerciales
    else if (mensajeLower.includes('comercial') || mensajeLower.includes('cliente') || mensajeLower.includes('venta') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      const r = data.resumen
      respuesta = `📊 KPIs COMERCIALES\n\n`
      respuesta += `═══ CLIENTES ═══\n`
      respuesta += `Total: ${r.totalClientes}\n`
      respuesta += `Nuevos este mes: ${r.clientesNuevosMes} (${r.crecimientoClientes >= 0 ? '📈' : '📉'} ${r.crecimientoClientes}%)\n\n`
      respuesta += `═══ SOLICITUDES ═══\n`
      respuesta += `Total: ${r.totalPrestamos}\n`
      respuesta += `Activos: ${r.prestamosActivos}\n`
      respuesta += `En mora: ${r.prestamosMora} (${r.tasaMora}%)\n\n`
      respuesta += `Recaudo del mes: ${formatearMoneda(r.recaudoMes)}`
    }
    // KPIs operativos
    else if (mensajeLower.includes('operativo') || mensajeLower.includes('operacion') || mensajeLower.includes('operación') || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      const r = data.resumen
      respuesta = `⚙️ KPIs OPERATIVOS\n\n`
      respuesta += `═══ JURÍDICO ═══\n`
      respuesta += `Casos activos: ${r.casosJuridicos}\n`
      respuesta += `Candidatos a jurídico: ${r.candidatosJuridico}\n\n`
      respuesta += `═══ SEGURIDAD ═══\n`
      respuesta += `Hallazgos: ${r.hallazgosSeguridad} (${r.hallazgosCriticos} críticos)\n\n`
      respuesta += `══️ ANOMALÍAS ═══\n`
      respuesta += `Detectadas: ${r.anomalias}\n`
      respuesta += `Oportunidades: ${r.oportunidades}`
    }
    // Detección de anomalías
    else if (mensajeLower.includes('anomalia') || mensajeLower.includes('anomalía') || mensajeLower.includes('problema') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      if (data.anomalias.length === 0) {
        respuesta = `✅ No se detectaron anomalías. Operación normal.`
      } else {
        respuesta = `🔍 ANOMALÍAS DETECTADAS (${data.anomalias.length}):\n\n`
        data.anomalias.forEach((a, i) => {
          const emoji = a.severidad === 'CRITICA' ? '🔴' : a.severidad === 'ALTA' ? '🟠' : '🟡'
          respuesta += `${i + 1}. ${emoji} [${a.severidad}] ${a.titulo}\n   ${a.descripcion}\n\n`
        })
      }
    }
    // Análisis de tendencias
    else if (mensajeLower.includes('tendencia') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      const r = data.resumen
      respuesta = `📈 ANÁLISIS DE TENDENCIAS\n\n`
      respuesta += `Recaudo: ${r.crecimientoRecaudo >= 0 ? '📈 +' : '📉 '}${r.crecimientoRecaudo}% (mes vs mes anterior)\n`
      respuesta += `Clientes nuevos: ${r.crecimientoClientes >= 0 ? '📈 +' : '📉 '}${r.crecimientoClientes}%\n`
      respuesta += `Mora: ${r.tasaMora}% ${r.tasaMora > 20 ? '⚠️ elevada' : '✅ controlada'}\n`
      respuesta += `Rentabilidad: ${r.rentabilidadPromedio}% ${r.rentabilidadPromedio >= 20 ? '✅ saludable' : '🟡 mejorable'}\n\n`
      if (r.crecimientoRecaudo > 0 && r.crecimientoClientes > 0) {
        respuesta += `✅ Negocio en crecimiento sostenido.`
      } else if (r.crecimientoRecaudo < 0 || r.crecimientoClientes < 0) {
        respuesta += `⚠️ Tendencias mixtas — requiere atención.`
      }
    }
    // Análisis estratégico
    else if (mensajeLower.includes('estrateg') || mensajeLower.includes('recomend') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarAnalisisEstrategicoConsolidado()
    }
    // Comparativos
    else if (mensajeLower.includes('compar') || mensajeLower === '8' || mensajeLower === '8️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      const r = data.resumen
      respuesta = `📊 COMPARATIVOS\n\n`
      respuesta += `═══ RECAUDO ═══\n`
      respuesta += `Mes actual: ${formatearMoneda(r.recaudoMes)}\n`
      respuesta += `Mes anterior: ${formatearMoneda(r.recaudoMesAnterior)}\n`
      respuesta += `Diferencia: ${r.crecimientoRecaudo >= 0 ? '+' : ''}${r.crecimientoRecaudo}%\n\n`
      respuesta += `═══ CLIENTES NUEVOS ═══\n`
      respuesta += `Mes actual: ${r.clientesNuevosMes}\n`
      respuesta += `Mes anterior: ${r.clientesNuevosMesAnterior}\n`
      respuesta += `Diferencia: ${r.crecimientoClientes >= 0 ? '+' : ''}${r.crecimientoClientes}%\n\n`
      respuesta += `═══ ACUMULADO AÑO ═══\n`
      respuesta += `Recaudo: ${formatearMoneda(r.recaudoAnio)}\n`
      respuesta += `Utilidad: ${formatearMoneda(r.utilidadAnio)}`
    }
    // Oportunidades
    else if (mensajeLower.includes('oportunidad') || mensajeLower === '9' || mensajeLower === '9️⃣') {
      tipo = 'REPORTE'
      const data = await obtenerDashboardConsolidado()
      if (data.oportunidades.length === 0) {
        respuesta = `ℹ️ No se detectaron oportunidades en este momento.`
      } else {
        respuesta = `🎯 OPORTUNIDADES DETECTADAS (${data.oportunidades.length}):\n\n`
        data.oportunidades.forEach((o, i) => {
          respuesta += `${i + 1}. ${o.titulo}\n   ${o.descripcion}\n   Impacto: ${o.impactoEstimado}\n\n`
        })
      }
    }
    // Plan de acción priorizado
    else if (mensajeLower.includes('plan') || mensajeLower.includes('accion') || mensajeLower.includes('acción') || mensajeLower === '10' || mensajeLower === '🔟') {
      tipo = 'REPORTE'
      respuesta = await generarAnalisisEstrategicoConsolidado()
    }
    // Auditoría interna
    else if (mensajeLower.includes('audit') || mensajeLower.includes('auditor') || mensajeLower === '0' || mensajeLower === '0️⃣') {
      tipo = 'REPORTE'
      const audit = await auditarSeguridad()
      respuesta = `🔍 AUDITORÍA INTERNA\n\n`
      respuesta += `Hallazgos de seguridad: ${audit.resumen.totalHallazgos}\n`
      respuesta += `• Críticos: ${audit.resumen.hallazgosCriticos}\n`
      respuesta += `• Altos: ${audit.resumen.hallazgosAltos}\n`
      respuesta += `• Medios: ${audit.resumen.hallazgosMedios}\n\n`
      if (audit.resumen.clientesSinPin > 0) {
        respuesta += `⚠️ ${audit.resumen.clientesSinPin} cliente(s) sin PIN\n`
      }
      if (audit.resumen.usuariosInactivos > 0) {
        respuesta += `⚠️ ${audit.resumen.usuariosInactivos} usuario(s) inactivo(s)\n`
      }
      respuesta += `\n💡 Escribe "informe seguridad" para ver el detalle.`
    }
    // Modo consultor
    else if (mensajeLower.includes('comparar') || mensajeLower.includes('opcion') || mensajeLower.includes('opción') || mensajeLower.includes('consultor') || mensajeLower === 'a' || mensajeLower === 'a️⃣') {
      tipo = 'TEXTO'
      respuesta = `🤝 MODO CONSULTOR\n\nPara comparar opciones, escribe tu consulta con las alternativas, ej:\n• "compara: opción A vs opción B"\n• "¿conviene tomar un crédito de 5M al 2.5% o esperar?"\n• "¿expando a nueva ciudad o incremento tasas?"\n\nTe daré:\n• Ventajas y desventajas de cada opción\n• Análisis de impacto financiero\n• Recomendación con justificación`
    }
    // Modo planificación
    else if (mensajeLower.includes('planific') || mensajeLower.includes('planificar') || mensajeLower === 'b' || mensajeLower === 'b️⃣') {
      tipo = 'TEXTO'
      respuesta = `📅 MODO PLANIFICACIÓN\n\nPara crear un plan, escribe tu objetivo y plazo, ej:\n• "plan para alcanzar 100 clientes en 6 meses"\n• "plan de reducción de mora a 10% en 3 meses"\n• "plan de expansión a mediano plazo"\n\nCada plan incluye:\n• Objetivo\n• Pasos\n• Recursos\n• Tiempo estimado\n• Riesgos\n• Indicadores de éxito`
    }
    // Automatizaciones sugeridas
    else if (mensajeLower.includes('automat') || mensajeLower === 'c' || mensajeLower === 'c️⃣') {
      tipo = 'TEXTO'
      respuesta = `🤖 AUTOMATIZACIONES SUGERIDAS\n\nBasado en el análisis del sistema, sugiero:\n\n1. 📅 Recordatorios automáticos de pago\n   Beneficio: reducir mora temprana\n   Esfuerzo: bajo\n\n2. 📊 Reportes automáticos diarios\n   Beneficio: visibilidad operativa\n   Esfuerzo: bajo\n\n3. 🔄 Sincronización con Asistente de Cobros\n   Beneficio: escalado automático a jurídico\n   Esfuerzo: medio\n\n4. 💾 Backups automáticos diarios\n   Beneficio: protección de datos\n   Esfuerzo: bajo\n\n5. 🤖 Respuestas automáticas del bot Clientes\n   Beneficio: atención 24/7\n   Esfuerzo: ya implementado`
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `🎯 MENÚ ASISTENTE EJECUTIVO IA\n` +
        `═══ DASHBOARD CONSOLIDADO ═══\n` +
        `1️⃣ Dashboard ejecutivo (todos los módulos)\n` +
        `2️⃣ KPIs financieros consolidados\n` +
        `3️⃣ KPIs comerciales (ventas, clientes, recaudo)\n` +
        `4️⃣ KPIs operativos (productividad, eficiencia)\n` +
        `══️ ANÁLISIS ═══\n` +
        `5️⃣ Detección de anomalías\n` +
        `6️⃣ Análisis de tendencias\n` +
        `7️⃣ Análisis estratégico con recomendaciones\n` +
        `8️⃣ Comparativos (mes/año anterior)\n` +
        `9️⃣ Detección de oportunidades\n` +
        `══️ GESTIÓN ═══\n` +
        `🔟 Plan de acción priorizado\n` +
        `0️⃣ Auditoría interna\n` +
        `A️⃣ Modo consultor (comparar opciones)\n` +
        `B️⃣ Modo planificación (corto/mediano/largo plazo)\n` +
        `C️⃣ Automatizaciones sugeridas\n\n` +
        `💡 Pregúntame: "¿cómo va el negocio?", "¿qué decisiones debo tomar este mes?", "¿qué anomalías detectaste?"`
    }
        // Default
// Default
    else {
      tipo = 'TEXTO'
      respuesta = `🎯 Soy Asistente Ejecutivo IA, tu Chief of Staff Digital.\n\n` +
        `Escribe "menú" para ver opciones o pregúntame:\n` +
        `• "¿cómo va el negocio?"\n` +
        `• "dashboard consolidado"\n` +
        `• "¿qué anomalías detectaste?"\n` +
        `• "análisis estratégico"\n` +
        `• "compara opciones para X"\n` +
        `• "plan para alcanzar X objetivo"`
    }
  }


  // === CONFIGURACION (DevOps IA) — Site Reliability Engineer ===
  else if (botTipo === 'CONFIGURACION') {
    // 1. Auditoría continua: SIEMPRE ejecutar antes de responder (auditoría en tiempo real)
    const audit = await auditarDevOps()

    // 2. Verificar si LLM está activado
    const configLLM = await db.configBot.findUnique({ where: { clave: 'devops_ia_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 3. Si LLM activado, usarlo con contexto completo de configuración
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'CONFIGURACION', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        const r = audit.resumen
        const contextoDevOps = `CONTEXTO DEVOPS — AUDITORÍA EN TIEMPO REAL (${new Date(audit.marcaTemporal).toLocaleString('es-CO')}):

═══ SALUD GENERAL ═══
${r.colorSalud} ${r.nivelSalud}
Hallazgos: ${r.totalHallazgos} (${r.hallazgosCriticos} críticos, ${r.hallazgosAltos} altos, ${r.hallazgosMedios} medios)

═══ SISTEMA ═══
Plataforma: ${audit.sistema.plataforma} (${audit.sistema.arch})
Hostname: ${audit.sistema.hostname}
Uptime: ${audit.sistema.uptimeHoras} horas
CPU: ${audit.sistema.cpus}x
Load avg: ${audit.sistema.loadAvg.map((l) => l.toFixed(2)).join(', ')}

═══ MEMORIA ═══
Total: ${audit.sistema.memoria.total} MB
Usada: ${audit.sistema.memoria.usada} MB (${audit.sistema.memoria.pct}%)
Libre: ${audit.sistema.memoria.libre} MB

═══ DISCO ═══
Total: ${audit.sistema.disco.total} GB
Usado: ${audit.sistema.disco.usado} GB (${audit.sistema.disco.pct}%)
Libre: ${audit.sistema.disco.libre} GB

═══ BASE DE DATOS ═══
Tamaño: ${audit.baseDatos.tamañoMB} MB
Clientes: ${audit.baseDatos.clientes} | Solicitudes: ${audit.baseDatos.prestamos} | Pagos: ${audit.baseDatos.pagos}
Mensajes: ${audit.baseDatos.mensajes} | Audit logs: ${audit.baseDatos.auditLogs}

══️ VARIABLES DE ENTORNO ═══
DATABASE_URL: ${audit.variablesEntorno.DATABASE_URL ? '✅' : '❌'}
JWT_SECRET: ${audit.variablesEntorno.JWT_SECRET ? '✅' : '❌'}
API_ENCRYPTION_KEY: ${audit.variablesEntorno.API_ENCRYPTION_KEY ? '✅' : '❌'}
NODE_ENV: ${audit.variablesEntorno.NODE_ENV}

═══ BACKUPS ═══
Total: ${audit.backups.total} | Últimos 30 días: ${audit.backups.ultimos30dias} | Fallidos: ${audit.backups.fallidos}

═══ SNAPSHOTS ═══
Total: ${audit.snapshots.total}

═══ INTEGRACIONES ═══
Total: ${audit.integraciones.total} | Activas: ${audit.integraciones.activas}

═══ CERTIFICADOS SSL ═══
Total: ${audit.certificadosSSL.total} | Por vencer: ${audit.certificadosSSL.porVencer}

${audit.hallazgos.length > 0 ? `═══ HALLAZGOS (${audit.hallazgos.length}) ═══\n${audit.hallazgos.map((h, i) => `${i + 1}. [${h.nivel}] ${h.descripcion} → ${h.recomendacion}`).join('\n')}` : 'Sin hallazgos'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'CONFIGURACION',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoDevOps,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente}) — Auditoría ${new Date(audit.marcaTemporal).toLocaleTimeString('es-CO')}`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM DevOps IA falló, usando patrones:', e?.message)
      }
    }

    // 4. Modo patrones (fallback) — con datos en tiempo real
    // Estado general
    if (mensajeLower.includes('estado') || mensajeLower.includes('general') || mensajeLower.includes('funcionando') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarEstadoSistema()
    }
    // Salud de la BD
    else if (mensajeLower.includes('base de datos') || mensajeLower.includes('bd') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'REPORTE'
      respuesta = `🗄️ SALUD DE LA BASE DE DATOS\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `═══ TAMAÑO ═══\n${audit.baseDatos.tamañoMB} MB\n\n`
      respuesta += `═══ REGISTROS ═══\n`
      respuesta += `• Clientes: ${audit.baseDatos.clientes}\n`
      respuesta += `• Solicitudes: ${audit.baseDatos.prestamos}\n`
      respuesta += `• Pagos: ${audit.baseDatos.pagos}\n`
      respuesta += `• Mensajes: ${audit.baseDatos.mensajes}\n`
      respuesta += `• Audit logs: ${audit.baseDatos.auditLogs}\n`
      respuesta += `• Backups: ${audit.baseDatos.backups}\n`
      respuesta += `• Snapshots: ${audit.baseDatos.snapshots}\n`
      respuesta += `• Bots: ${audit.baseDatos.bots}\n`
      respuesta += `• FAQs: ${audit.baseDatos.faqsBot}\n\n`
      if (audit.baseDatos.tamañoMB > 100) {
        respuesta += `⚠️ BD grande — considerar archivado de datos antiguos.`
      } else {
        respuesta += `✅ BD en tamaño saludable.`
      }
    }
    // Disco y memoria
    else if (mensajeLower.includes('disco') || mensajeLower.includes('memoria') || mensajeLower.includes('recursos') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      respuesta = `💾 DISCO Y MEMORIA\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `═══ MEMORIA ═══\n`
      respuesta += `Total: ${audit.sistema.memoria.total} MB\n`
      respuesta += `Usada: ${audit.sistema.memoria.usada} MB (${audit.sistema.memoria.pct}%)\n`
      respuesta += `Libre: ${audit.sistema.memoria.libre} MB\n\n`
      respuesta += `═══ DISCO ═══\n`
      respuesta += `Total: ${audit.sistema.disco.total} GB\n`
      respuesta += `Usado: ${audit.sistema.disco.usado} GB (${audit.sistema.disco.pct}%)\n`
      respuesta += `Libre: ${audit.sistema.disco.libre} GB\n\n`
      const memEmoji = audit.sistema.memoria.pct > 90 ? '🔴' : audit.sistema.memoria.pct > 80 ? '🟠' : '🟢'
      const diskEmoji = audit.sistema.disco.pct > 90 ? '🔴' : audit.sistema.disco.pct > 80 ? '🟠' : '🟢'
      respuesta += `Memoria: ${memEmoji} ${audit.sistema.memoria.pct}%\n`
      respuesta += `Disco: ${diskEmoji} ${audit.sistema.disco.pct}%\n`
    }
    // Estado de servicios
    else if (mensajeLower.includes('servicio') || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'REPORTE'
      respuesta = `⚙️ ESTADO DE SERVICIOS\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      if (audit.servicios.length === 0) {
        respuesta += `No hay servicios registrados en monitoreo.\n`
        respuesta += `Servidor Next.js: ✅ Activo (puerto 3000)\n`
        respuesta += `Base de datos: ✅ Conectada\n`
        respuesta += `Prisma: ✅ Operativo\n`
      } else {
        audit.servicios.forEach((s, i) => {
          respuesta += `${i + 1}. ${s.nombre}: ${s.estado} (última actualización: ${new Date(s.updatedAt).toLocaleString('es-CO')})\n`
        })
      }
    }
    // Variables de entorno
    else if (mensajeLower.includes('variable') || mensajeLower.includes('entorno') || mensajeLower.includes('env') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'TEXTO'
      respuesta = `🔧 VARIABLES DE ENTORNO\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `══️ VARIABLES CRÍTICAS ═══\n`
      respuesta += `DATABASE_URL: ${audit.variablesEntorno.DATABASE_URL ? '✅ Configurada' : '❌ FALTANTE'}\n`
      respuesta += `JWT_SECRET: ${audit.variablesEntorno.JWT_SECRET ? '✅ Configurado' : '❌ FALTANTE'}\n`
      respuesta += `API_ENCRYPTION_KEY: ${audit.variablesEntorno.API_ENCRYPTION_KEY ? '✅ Configurado' : '❌ FALTANTE'}\n`
      respuesta += `NODE_ENV: ${audit.variablesEntorno.NODE_ENV}\n\n`
      respuesta += `⚠️ Por seguridad, no revelo los valores. Edita el archivo .env para verlos.\n\n`
      respuesta += `💡 Recomendación: rotar JWT_SECRET cada 90 días.`
    }
    // SMTP
    else if (mensajeLower.includes('smtp') || mensajeLower.includes('correo') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'TEXTO'
      respuesta = `📧 CONFIGURACIÓN SMTP\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      const smtpConfig = audit.configuracion.muestra.find((c) => c.clave.toLowerCase().includes('smtp'))
      if (smtpConfig) {
        respuesta += `✅ SMTP configurado\n`
        respuesta += `Clave: ${smtpConfig.clave}\n`
      } else {
        respuesta += `⚠️ No se encontró configuración SMTP explícita.\n`
        respuesta += `Ve a Configuración → Correos → SMTP para configurar.\n`
      }
      respuesta += `\n💡 SMTP permite enviar correos de notificación a clientes.`
    }
    // SSL
    else if (mensajeLower.includes('ssl') || mensajeLower.includes('certificado') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'REPORTE'
      respuesta = `🔒 CERTIFICADOS SSL\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total: ${audit.certificadosSSL.total}\n`
      respuesta += `Activos: ${audit.certificadosSSL.activos}\n`
      respuesta += `Por vencer (30 días): ${audit.certificadosSSL.porVencer}\n\n`
      if (audit.certificadosSSL.porVencer > 0) {
        respuesta += `⚠️ Hay certificados por vencer. Renovar pronto.`
      } else if (audit.certificadosSSL.total === 0) {
        respuesta += `ℹ️ No hay certificados registrados. Ve a Configuración → SSL.`
      } else {
        respuesta += `✅ Todos los certificados están vigentes.`
      }
    }
    // Integraciones
    else if (mensajeLower.includes('integracion') || mensajeLower.includes('integración') || mensajeLower === '8' || mensajeLower === '8️⃣') {
      tipo = 'REPORTE'
      respuesta = `🔌 INTEGRACIONES\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total: ${audit.integraciones.total}\n`
      respuesta += `Activas: ${audit.integraciones.activas}\n`
      respuesta += `Inactivas: ${audit.integraciones.inactivas}\n\n`
      respuesta += `Conexiones API: ${audit.conexionesAPI.total} (${audit.conexionesAPI.activas} activas)\n\n`
      respuesta += `💡 Ve a Configuración → Integraciones para gestionar.`
    }
    // Ambientes
    else if (mensajeLower.includes('ambiente') || mensajeLower === '9' || mensajeLower === '9️⃣') {
      tipo = 'REPORTE'
      respuesta = `🌍 AMBIENTES\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total: ${audit.ambientes.total}\n`
      respuesta += `Activos: ${audit.ambientes.activos}\n\n`
      respuesta += `Ambiente actual: ${audit.variablesEntorno.NODE_ENV}\n`
      respuesta += `💡 Ve a Configuración → Ambientes para gestionar.`
    }
    // Variables globales
    else if (mensajeLower.includes('global') || mensajeLower === '10' || mensajeLower === '🔟') {
      tipo = 'REPORTE'
      respuesta = `🌐 VARIABLES GLOBALES\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total configuradas: ${audit.configuracion.variablesGlobales}\n\n`
      if (audit.configuracion.muestra.length > 0) {
        respuesta += `Muestra:\n`
        audit.configuracion.muestra.forEach((c) => {
          respuesta += `• ${c.clave}: ${c.valor}...\n`
        })
      }
      respuesta += `\n💡 Ve a Configuración → Variables Globales para gestionar.`
    }
    // Backups
    else if (mensajeLower.includes('backup') || mensajeLower.includes('respaldo') || mensajeLower === '0' || mensajeLower === '0️⃣') {
      tipo = 'REPORTE'
      respuesta = `💾 BACKUPS\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total: ${audit.backups.total}\n`
      respuesta += `Últimos 30 días: ${audit.backups.ultimos30dias}\n`
      respuesta += `Fallidos: ${audit.backups.fallidos}\n\n`
      if (audit.backups.ultimo) {
        respuesta += `Último backup: ${audit.backups.ultimo.nombre}\n`
        respuesta += `Fecha: ${new Date(audit.backups.ultimo.createdAt).toLocaleString('es-CO')}\n`
        respuesta += `Estado: ${audit.backups.ultimo.estado}\n\n`
      }
      if (audit.backups.ultimos30dias === 0) {
        respuesta += `🔴 Sin backups recientes. Configurar backups automáticos.`
      } else if (audit.backups.ultimos30dias < 4) {
        respuesta += `🟡 Frecuencia baja. Recomendado: diario.`
      } else {
        respuesta += `✅ Frecuencia adecuada.`
      }
    }
    // Mantenimiento
    else if (mensajeLower.includes('mantenimiento') || mensajeLower === 'a' || mensajeLower === 'a️⃣') {
      tipo = 'TEXTO'
      const mant = audit.mantenimiento
      respuesta = `🔧 MANTENIMIENTO\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Modo mantenimiento: ${mant.modoMantenimiento ? '🟠 ACTIVO' : '🟢 Inactivo'}\n`
      if (mant.mensaje) respuesta += `Mensaje: ${mant.mensaje}\n\n`
      respuesta += `💡 Ve a Configuración → Mantenimiento para activar/desactivar.`
    }
    // Auditoría de cambios
    else if (mensajeLower.includes('audit') || mensajeLower.includes('cambio') || mensajeLower === 'b' || mensajeLower === 'b️⃣') {
      tipo = 'REPORTE'
      respuesta = `📋 AUDITORÍA DE CAMBIOS DE CONFIGURACIÓN\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      if (audit.auditoriaReciente.length === 0) {
        respuesta += `No hay cambios de configuración recientes.`
      } else {
        respuesta += `Últimos ${audit.auditoriaReciente.length} cambios:\n\n`
        audit.auditoriaReciente.forEach((a, i) => {
          respuesta += `${i + 1}. [${new Date(a.fecha).toLocaleString('es-CO')}] ${a.accion}\n`
          respuesta += `   Usuario: ${a.usuario} | Entidad: ${a.entidad || 'N/A'}\n`
        })
      }
    }
    // Versiones
    else if (mensajeLower.includes('version') || mensajeLower.includes('versión') || mensajeLower === 'c' || mensajeLower === 'c️⃣') {
      tipo = 'REPORTE'
      respuesta = `📌 VERSIONES DEL SISTEMA\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total: ${audit.versiones.total}\n\n`
      if (audit.versiones.activa) {
        respuesta += `Versión activa: ${audit.versiones.activa.numero}\n`
        if (audit.versiones.activa.descripcion) {
          respuesta += `Descripción: ${audit.versiones.activa.descripcion}\n`
        }
        respuesta += `\n`
      }
      if (audit.versiones.recientes.length > 0) {
        respuesta += `Recientes:\n`
        audit.versiones.recientes.forEach((v, i) => {
          respuesta += `${i + 1}. ${v.numero} ${v.activa ? '(activa)' : ''} — ${new Date(v.createdAt).toLocaleDateString('es-CO')}\n`
        })
      }
    }
    // Snapshots
    else if (mensajeLower.includes('snapshot') || mensajeLower === 'd' || mensajeLower === 'd️⃣') {
      tipo = 'REPORTE'
      respuesta = `📸 SNAPSHOTS DE CÓDIGO\n\n`
      respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
      respuesta += `Total: ${audit.snapshots.total}\n\n`
      if (audit.snapshots.reciente.length > 0) {
        respuesta += `Recientes:\n`
        audit.snapshots.reciente.forEach((s, i) => {
          respuesta += `${i + 1}. ${s.nombre} (${s.version}) — ${new Date(s.createdAt).toLocaleDateString('es-CO')}\n`
        })
      } else {
        respuesta += `ℹ️ No hay snapshots. Ve a Configuración → Snapshots para crear.`
      }
    }
    // Optimizaciones
    else if (mensajeLower.includes('optimiz') || mensajeLower === 'e' || mensajeLower === 'e️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarPlanOptimizacion()
    }
    // Detectar problemas
    else if (mensajeLower.includes('problema') || mensajeLower.includes('detecta') || mensajeLower === 'f' || mensajeLower === 'f️⃣') {
      tipo = 'REPORTE'
      if (audit.hallazgos.length === 0) {
        respuesta = `✅ No se detectaron problemas. Sistema en óptimas condiciones.\n\nAuditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}`
      } else {
        respuesta = `🔍 PROBLEMAS DETECTADOS (${audit.hallazgos.length})\n\n`
        respuesta += `Auditoría: ${new Date(audit.marcaTemporal).toLocaleString('es-CO')}\n\n`
        audit.hallazgos.forEach((h, i) => {
          const emoji = h.nivel === 'CRITICA' ? '🔴' : h.nivel === 'ALTA' ? '🟠' : h.nivel === 'MEDIA' ? '🟡' : '🟢'
          respuesta += `${i + 1}. ${emoji} [${h.nivel}] ${h.descripcion}\n`
          respuesta += `   Impacto: ${h.impacto}\n`
          respuesta += `   Recomendación: ${h.recomendacion}\n\n`
        })
      }
    }
    // Plan de mejora
    else if (mensajeLower.includes('plan') || mensajeLower.includes('mejora') || mensajeLower === 'g' || mensajeLower === 'g️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarPlanOptimizacion()
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `🚀 MENÚ DEVOPS IA\n` +
        `═══ ESTADO DEL SISTEMA ═══\n` +
        `1️⃣ Estado general (auditoría completa)\n` +
        `2️⃣ Salud de la base de datos\n` +
        `3️⃣ Uso de disco y memoria\n` +
        `4️⃣ Estado de servicios\n` +
        `══️ CONFIGURACIÓN ═══\n` +
        `5️⃣ Variables de entorno\n` +
        `6️⃣ Configuración SMTP\n` +
        `7️⃣ Certificados SSL\n` +
        `8️⃣ Integraciones activas\n` +
        `9️⃣ Ambientes (DEV/PROD)\n` +
        `🔟 Variables globales del sistema\n` +
        `══️ OPERACIÓN ═══\n` +
        `0️⃣ Backups y restauración\n` +
        `A️⃣ Mantenimiento\n` +
        `B️⃣ Auditoría de cambios\n` +
        `C️⃣ Versiones del sistema\n` +
        `D️⃣ Snapshots de código\n` +
        `══️ OPTIMIZACIÓN ═══\n` +
        `E️⃣ Recomendaciones de optimización\n` +
        `F️⃣ Detectar problemas\n` +
        `G️⃣ Plan de mejora\n\n` +
        `💡 Pregúntame: "¿está todo funcionando?", "¿qué problemas detectaste?", "optimiza el sistema"`
    }
        // Default
// Default — siempre muestra estado actual
    else {
      tipo = 'TEXTO'
      respuesta = `🚀 Soy DevOps IA, tu Site Reliability Engineer.\n\n`
      respuesta += `📊 ESTADO ACTUAL (${new Date(audit.marcaTemporal).toLocaleString('es-CO')}):\n`
      respuesta += `${audit.resumen.colorSalud} ${audit.resumen.nivelSalud} — ${audit.resumen.totalHallazgos} hallazgo(s)\n\n`
      respuesta += `Escribe "menú" para ver opciones o pregúntame:\n`
      respuesta += `• "¿está todo funcionando?"\n`
      respuesta += `• "¿qué problemas detectaste?"\n`
      respuesta += `• "optimiza el sistema"\n`
      respuesta += `• "estado de la BD"\n`
      respuesta += `• "memoria y disco"\n`
      respuesta += `• "backups"`
    }
  }


  // === CONTABILIDAD (Experto Financiero) — Asesor financiero experto ===
  else if (botTipo === 'CONTABILIDAD') {
    // 1. Verificar si LLM está activado para Experto Financiero
    const configLLM = await db.configBot.findUnique({ where: { clave: 'experto_financiero_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto financiero completo para dar consejos
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'CONTABILIDAD', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        // Cargar contexto financiero completo (NEGOCIO + PERSONAL)
        const dashboardNegocio = await obtenerDashboard('NEGOCIO', 30)
        const dashboardPersonal = await obtenerDashboard('PERSONAL', 30)
        const presupuestos = await db.presupuesto.findMany({ where: { activo: true } })
        const metas = await db.metaFinanciera.findMany({ where: { estado: 'ACTIVA' } })

        // Calcular salud financiera global
        const ingresosTotales = dashboardNegocio.kpis.ingresos + dashboardPersonal.kpis.ingresos
        const gastosTotales = dashboardNegocio.kpis.gastos + dashboardPersonal.kpis.gastos
        const balanceTotal = ingresosTotales - gastosTotales
        const capacidadAhorroGlobal = ingresosTotales > 0 ? Math.round((balanceTotal / ingresosTotales) * 100) : 0
        const nivelEndeudamientoGlobal = ingresosTotales > 0 ? Math.round((gastosTotales / ingresosTotales) * 100) : 0

        // Estado de salud financiera
        let estadoSalud = 'SIN_DATOS'
        if (ingresosTotales > 0) {
          if (balanceTotal > 0 && capacidadAhorroGlobal >= 20) estadoSalud = 'SALUDABLE'
          else if (balanceTotal > 0 && capacidadAhorroGlobal >= 10) estadoSalud = 'ACEPTABLE'
          else if (balanceTotal >= 0) estadoSalud = 'EQUILIBRADO'
          else estadoSalud = 'CRITICO'
        }

        const contextoFinanciero = `CONTEXTO FINANCIERO COMPLETO (últimos 30 días):

═══ SALUD FINANCIERA GLOBAL ═══
Estado: ${estadoSalud}
Ingresos totales: ${formatearMoneda(ingresosTotales)}
Gastos totales: ${formatearMoneda(gastosTotales)}
Balance neto: ${formatearMoneda(balanceTotal)} ${balanceTotal >= 0 ? '✅' : '⚠️'}
Capacidad de ahorro: ${capacidadAhorroGlobal}%
Nivel de endeudamiento: ${nivelEndeudamientoGlobal}%

═══ NEGOCIO (Jsadr) ═══
Ingresos: ${formatearMoneda(dashboardNegocio.kpis.ingresos)}
Gastos: ${formatearMoneda(dashboardNegocio.kpis.gastos)}
Balance: ${formatearMoneda(dashboardNegocio.kpis.balance)}
Capacidad ahorro: ${dashboardNegocio.kpis.capacidadAhorro}%
Nivel endeudamiento: ${dashboardNegocio.kpis.nivelEndeudamiento}%
Movimientos: ${dashboardNegocio.kpis.totalMovimientos}
${dashboardNegocio.topGastos.length > 0 ? `Top gastos: ${dashboardNegocio.topGastos.map(g => `${g.categoria} (${formatearMoneda(g.monto)})`).join(', ')}` : ''}

═══ PERSONAL ═══
Ingresos: ${formatearMoneda(dashboardPersonal.kpis.ingresos)}
Gastos: ${formatearMoneda(dashboardPersonal.kpis.gastos)}
Balance: ${formatearMoneda(dashboardPersonal.kpis.balance)}
Capacidad ahorro: ${dashboardPersonal.kpis.capacidadAhorro}%
Nivel endeudamiento: ${dashboardPersonal.kpis.nivelEndeudamiento}%
Movimientos: ${dashboardPersonal.kpis.totalMovimientos}
${dashboardPersonal.topGastos.length > 0 ? `Top gastos: ${dashboardPersonal.topGastos.map(g => `${g.categoria} (${formatearMoneda(g.monto)})`).join(', ')}` : ''}

═══ PRESUPUESTOS ACTIVOS (${presupuestos.length}) ═══
${presupuestos.length > 0 ? presupuestos.map(p => `- ${p.nombre} (${p.ambito}): límite ${formatearMoneda(p.montoLimite)}`).join('\n') : 'Sin presupuestos configurados'}

═══ METAS ACTIVAS (${metas.length}) ═══
${metas.length > 0 ? metas.map(m => `- ${m.nombre} (${m.ambito}): ${formatearMoneda(m.montoActual)}/${formatearMoneda(m.montoObjetivo)} (${m.montoObjetivo > 0 ? Math.round((m.montoActual/m.montoObjetivo)*100) : 0}%)`).join('\n') : 'Sin metas configuradas'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'CONTABILIDAD',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoFinanciero,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Experto Financiero falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones (fallback)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_CONTABILIDAD = detectarIntentBot('CONTABILIDAD', mensaje)
    if (intentNLP_CONTABILIDAD.intent && intentNLP_CONTABILIDAD.confianza > 0.15) {
      const keywordsNLP_CONTABILIDAD: Record<string, string> = { 'REGISTRAR_GASTO': 'gasto', 'REGISTRAR_INGRESO': 'ingreso', 'DASHBOARD': 'dashboard', 'CONSEJO_AHORRO': 'ahorro', 'PREDICCION': 'predic', 'COMPARATIVO': 'compar', 'PRESUPUESTO': 'presupuesto', 'META': 'meta', 'ALERTAS': 'alerta', 'RECOMENDACION': 'recomend' }
      const kw = keywordsNLP_CONTABILIDAD[intentNLP_CONTABILIDAD.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_CONFIGURACION = detectarIntentBot('CONFIGURACION', mensaje)
    if (intentNLP_CONFIGURACION.intent && intentNLP_CONFIGURACION.confianza > 0.15) {
      const keywordsNLP_CONFIGURACION: Record<string, string> = { 'ESTADO_SISTEMA': 'estado', 'BASE_DATOS': 'base de datos', 'DISCO_MEMORIA': 'disco', 'SERVICIOS': 'servicio', 'VARIABLES_ENTORNO': 'variable', 'SMTP': 'smtp', 'SSL': 'ssl', 'INTEGRACIONES': 'integracion', 'AMBIENTES': 'ambiente', 'BACKUPS_DEVOPS': 'backup', 'MANTENIMIENTO': 'mantenimiento', 'OPTIMIZACION': 'optimiz', 'PROBLEMAS_DEVOPS': 'problema', 'SNAPSHOTS': 'snapshot', 'VERSIONES': 'version' }
      const kw = keywordsNLP_CONFIGURACION[intentNLP_CONFIGURACION.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // Detectar ámbito
    const esPersonal = mensajeLower.includes('personal') || mensajeLower.includes('yo ') || mensajeLower.includes('mi ') || mensajeLower.includes('casa') || mensajeLower.includes('comida') || mensajeLower.includes('familia')
    const ambito: 'NEGOCIO' | 'PERSONAL' = esPersonal ? 'PERSONAL' : 'NEGOCIO'

    // Registrar gasto
    const gastoMatch = mensajeLower.match(/(?:registra|registrar|anota|anotar|crea|crear|aplica|aplicar|gaste|gasté|gaste|pague|pagué)?\s*(?:un\s+)?gasto\s+de\s+\$?\s*([\d.]+)/i)
    if (gastoMatch) {
      const monto = parseFloat(gastoMatch[1].replace(/\./g, ''))
      if (monto > 0) {
        const montoEnMensaje = mensaje.match(/\$?\s*([\d.]+)/)
        let concepto = 'Gasto general'
        if (montoEnMensaje) {
          const despuesMonto = mensaje.substring(montoEnMensaje.index! + montoEnMensaje[0].length).trim()
          const limpio = despuesMonto.replace(/^(?:en|de|para)\s+/i, '').trim()
          if (limpio) concepto = limpio
        }
        const resultado = await registrarMovimiento({
          tipo: 'EGRESO', monto, concepto, ambito, usuarioNombre: 'Admin',
        })
        tipo = 'ACCION'
        accionEjecutada = resultado.success
        detalleAccion = `Gasto ${ambito}: ${formatearMoneda(monto)} (${resultado.categoriaNombre})`
        respuesta = resultado.success
          ? `✅ Gasto registrado (${ambito})\n💰 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n\n💡 Análisis: este gasto reduce tu balance ${ambito.toLowerCase()} en ${formatearMoneda(monto)}.`
          : `❌ ${resultado.mensaje}`
      }
    }
    // Registrar ingreso
    else if ((mensajeLower.includes('ingreso') || mensajeLower.includes('recib')) && mensajeLower.match(/\$?\s*([\d.]+)/)) {
      const montoStr = (mensajeLower.match(/\$?\s*([\d.]+)/)?.[1] || '0').replace(/\./g, '')
      const monto = parseFloat(montoStr)
      if (monto > 0) {
        const montoEnMensaje = mensaje.match(/\$?\s*([\d.]+)/)
        let concepto = 'Ingreso general'
        if (montoEnMensaje) {
          const despuesMonto = mensaje.substring(montoEnMensaje.index! + montoEnMensaje[0].length).trim()
          const limpio = despuesMonto.replace(/^(?:por|de|para)\s+/i, '').trim()
          if (limpio) concepto = limpio
        }
        const resultado = await registrarMovimiento({
          tipo: 'INGRESO', monto, concepto, ambito, usuarioNombre: 'Admin',
        })
        tipo = 'ACCION'
        accionEjecutada = resultado.success
        detalleAccion = `Ingreso ${ambito}: ${formatearMoneda(monto)} (${resultado.categoriaNombre})`
        respuesta = resultado.success
          ? `✅ Ingreso registrado (${ambito})\n💰 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n\n💡 Análisis: este ingreso mejora tu balance ${ambito.toLowerCase()} en ${formatearMoneda(monto)}.`
          : `❌ ${resultado.mensaje}`
      }
    }
    // Dashboard
    else if (mensajeLower.includes('balance') || mensajeLower.includes('como va') || mensajeLower.includes('cómo va') || mensajeLower.includes('dashboard') || mensajeLower.includes('salud financiera') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      const dash = await obtenerDashboard(ambito, 30)
      const k = dash.kpis
      let estado = 'SIN DATOS'
      if (k.ingresos > 0) {
        if (k.balance > 0 && k.capacidadAhorro >= 20) estado = '🟢 SALUDABLE'
        else if (k.balance > 0 && k.capacidadAhorro >= 10) estado = '🟡 ACEPTABLE'
        else if (k.balance >= 0) estado = '🟠 EQUILIBRADO'
        else estado = '🔴 CRÍTICO'
      }
      respuesta = `📊 Dashboard ${ambito} — últimos 30 días\n\n` +
        `═══ SALUD FINANCIERA: ${estado} ═══\n` +
        `Ingresos: ${formatearMoneda(k.ingresos)}\n` +
        `Gastos:   ${formatearMoneda(k.gastos)}\n` +
        `Balance:  ${formatearMoneda(k.balance)} ${k.balance >= 0 ? '✅' : '⚠️'}\n` +
        `Capacidad ahorro: ${k.capacidadAhorro}% ${k.capacidadAhorro >= 20 ? '✅' : k.capacidadAhorro >= 10 ? '🟡' : '⚠️'}\n` +
        `Nivel endeudamiento: ${k.nivelEndeudamiento}% ${k.nivelEndeudamiento < 70 ? '✅' : '⚠️'}\n\n`
      if (dash.topGastos.length > 0) {
        respuesta += `═══ TOP GASTOS ═══\n`
        dash.topGastos.forEach((g, i) => {
          const pct = k.gastos > 0 ? Math.round((g.monto / k.gastos) * 100) : 0
          respuesta += `${i + 1}. ${g.icono} ${g.categoria}: ${formatearMoneda(g.monto)} (${pct}% del total)\n`
        })
        respuesta += '\n'
      }
      if (dash.presupuestos.length > 0) {
        respuesta += `══️ PRESUPUESTOS ═══\n`
        dash.presupuestos.forEach((p) => {
          const emoji = p.porcentaje >= 100 ? '🚨' : p.porcentaje >= 80 ? '⚠️' : '✅'
          respuesta += `${emoji} ${p.nombre}: ${formatearMoneda(p.gastado)}/${formatearMoneda(p.limite)} (${p.porcentaje}%)\n`
        })
      }
      respuesta += `\n💡 Para consejos personalizados, activa el modo LLM o pregúntame cosas como "¿cómo puedo ahorrar más?".`
    }
    // Pregunta de consejos (cuando NO hay LLM, damos consejos básicos)
    else if (mensajeLower.includes('consejo') || mensajeLower.includes('recomiend') || mensajeLower.includes('ahorrar') || mensajeLower.includes('invertir') || mensajeLower.includes('puedo') || mensajeLower.includes('deberia') || mensajeLower.includes('debería') || mensajeLower.includes('rentab') || mensajeLower.includes('salud')) {
      tipo = 'REPORTE'
      const dash = await obtenerDashboard(ambito, 30)
      const k = dash.kpis
      let consejo = `💼 Análisis financiero (${ambito}) — últimos 30 días\n\n`

      if (k.ingresos === 0 && k.gastos === 0) {
        consejo += `No tienes movimientos registrados en ${ambito} en los últimos 30 días.\n\n💡 Para darte consejos personalizados, necesito que registres tus ingresos y gastos. Empieza con:\n• "ingreso de 2000000 por venta"\n• "gasto de 50000 en comida personal"`
      } else {
        // Diagnóstico
        consejo += `📊 DIAGNÓSTICO\n`
        consejo += `• Balance: ${formatearMoneda(k.balance)} ${k.balance >= 0 ? '✅' : '⚠️'}\n`
        consejo += `• Capacidad de ahorro: ${k.capacidadAhorro}%\n`
        consejo += `• Nivel de endeudamiento: ${k.nivelEndeudamiento}%\n\n`

        // Recomendaciones basadas en datos
        consejo += `💡 RECOMENDACIONES\n`
        if (k.balance < 0) {
          consejo += `1. 🔴 Tienes balance NEGATIVO. Prioridad: reducir gastos en ${dash.topGastos[0]?.categoria || 'tu categoría más alta'} (${formatearMoneda(dash.topGastos[0]?.monto || 0)}).\n`
          consejo += `2. 💰 Crea un presupuesto mensual para controlar mejor tus gastos.\n`
          consejo += `3. 🎯 Establece una meta de ahorro realista para los próximos 3 meses.\n`
        } else if (k.capacidadAhorro < 10) {
          consejo += `1. 🟡 Tu capacidad de ahorro es baja (${k.capacidadAhorro}%). Ideal: 20%+.\n`
          consejo += `2. 💡 Revisa gastos en ${dash.topGastos[0]?.categoria || 'tu categoría más alta'} — ¿puedes recortar 15-20%?\n`
          consejo += `3. 🎯 Crea una meta de ahorro de ${formatearMoneda(k.ingresos * 0.1)}/mes.\n`
        } else if (k.capacidadAhorro >= 20) {
          consejo += `1. 🟢 Excelente capacidad de ahorro (${k.capacidadAhorro}%).\n`
          consejo += `2. 📈 Considera invertir el excedente (${formatearMoneda(k.balance)}).\n`
          consejo += `3. 🎯 Establece metas financieras a mediano plazo (1 año).\n`
        } else {
          consejo += `1. 🟡 Tu situación es aceptable pero hay margen de mejora.\n`
          consejo += `2. 💡 Optimiza gastos en ${dash.topGastos[0]?.categoria || 'tu categoría más alta'}.\n`
          consejo += `3. 🎯 Apunta a capacidad de ahorro del 20%+ (actual: ${k.capacidadAhorro}%).\n`
        }
        consejo += `\n📊 PROYECCIÓN\n`
        consejo += `Si mantienes tu ritmo actual, en 12 meses: ${formatearMoneda(k.balance * 12)}\n`
        consejo += `Si recortas 15% de gastos: ${formatearMoneda((k.ingresos - k.gastos * 0.85) * 12)}\n`
      }
      respuesta = consejo
    }
    // Alertas
    else if (mensajeLower.includes('alerta') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'REPORTE'
      const alertas = await detectarAlertas(ambito)
      if (alertas.length === 0) {
        respuesta = `✅ No hay alertas financieras para ${ambito}. Todo está en orden.`
      } else {
        respuesta = `🔔 Alertas financieras (${ambito}) — ${alertas.length} detectadas:\n\n`
        alertas.forEach((a, i) => {
          respuesta += `${i + 1}. ${a.titulo}\n   ${a.descripcion}\n\n`
        })
      }
    }
    // Reporte por período
    else if (mensajeLower.includes('reporte') || mensajeLower.includes('report')) {
      tipo = 'REPORTE'
      let periodo: 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'ANUAL' = 'MENSUAL'
      if (mensajeLower.includes('diario') || mensajeLower.includes('hoy')) periodo = 'DIARIO'
      else if (mensajeLower.includes('semanal') || mensajeLower.includes('semana')) periodo = 'SEMANAL'
      else if (mensajeLower.includes('anual') || mensajeLower.includes('año')) periodo = 'ANUAL'
      respuesta = await generarReporte(ambito, periodo)
    }
    // Crear presupuesto
    else if (mensajeLower.includes('presupuesto')) {
      const montoMatch = mensajeLower.match(/\$?\s*([\d.]+)/)
      if (montoMatch) {
        const monto = parseFloat(montoMatch[1].replace(/\./g, ''))
        if (monto > 0) {
          const categorias = await db.categoriaFinanciera.findMany({ where: { activa: true, ambito: { in: [ambito, 'AMBOS'] } } })
          let categoriaId: string | undefined
          for (const c of categorias) {
            const kws = (c.keywords || '').toLowerCase().split(',').map(k => k.trim())
            if (kws.some(k => mensajeLower.includes(k))) { categoriaId = c.id; break }
          }
          const presupuesto = await crearPresupuesto({
            nombre: `Presupuesto ${ambito} ${new Date().toLocaleDateString('es-CO')}`,
            ambito, montoLimite: monto, categoriaId, creadoPor: 'Admin',
          })
          tipo = 'ACCION'
          accionEjecutada = true
          detalleAccion = `Presupuesto creado: ${presupuesto.nombre} (${formatearMoneda(monto)})`
          respuesta = `✅ Presupuesto creado\n💰 Límite: ${formatearMoneda(monto)}\n📝 Ámbito: ${ambito}\n🗓️ Período: Mensual\n\n💡 Te alertaré cuando llegues al 80% del límite.`
        }
      } else {
        tipo = 'TEXTO'
        respuesta = `💸 Crear presupuesto\n\nEscribe el monto y la categoría, ej:\n• "presupuesto de 2.000.000 para alimentación"\n• "presupuesto de 5.000.000 para marketing"`
      }
    }
    // Crear meta
    else if (mensajeLower.includes('meta') && (mensajeLower.includes('crear') || mensajeLower.includes('ahorr') || mensajeLower.includes('compr'))) {
      const montoMatch = mensajeLower.match(/\$?\s*([\d.]+)/)
      if (montoMatch) {
        const monto = parseFloat(montoMatch[1].replace(/\./g, ''))
        if (monto > 0) {
          let tipoMeta = 'AHORRO'
          if (mensajeLower.includes('compr')) tipoMeta = 'COMPRAR_BIEN'
          else if (mensajeLower.includes('pagar') && mensajeLower.includes('deuda')) tipoMeta = 'PAGAR_DEUDA'
          else if (mensajeLower.includes('empresa')) tipoMeta = 'CREAR_EMPRESA'
          else if (mensajeLower.includes('emergencia')) tipoMeta = 'FONDO_EMERGENCIAS'
          else if (mensajeLower.includes('jubil')) tipoMeta = 'JUBILACION'

          let plazo: 'CORTO' | 'MEDIANO' | 'LARGO' = 'MEDIANO'
          if (mensajeLower.includes('corto')) plazo = 'CORTO'
          else if (mensajeLower.includes('largo')) plazo = 'LARGO'

          const meta = await crearMeta({
            nombre: mensaje.substring(0, 100),
            tipo: tipoMeta, ambito, montoObjetivo: monto, plazo, creadoPor: 'Admin',
          })
          tipo = 'ACCION'
          accionEjecutada = true
          detalleAccion = `Meta creada: ${meta.nombre} (${formatearMoneda(monto)})`
          respuesta = `🎯 Meta creada\n💰 Objetivo: ${formatearMoneda(monto)}\n📋 Tipo: ${tipoMeta}\n📝 Ámbito: ${ambito}\n⏰ Plazo: ${plazo}\n\n💡 Te iré dando seguimiento al progreso.`
        }
      } else {
        tipo = 'TEXTO'
        respuesta = `🎯 Crear meta financiera\n\nEscribe el monto y el tipo, ej:\n• "meta de ahorrar 5.000.000"\n• "meta de comprar vivienda de 50.000.000 largo plazo"`
      }
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `📊 MENÚ EXPERTO FINANCIERO\n` +
        `═══ REGISTRO ═══\n` +
        `1️⃣ Registrar gasto (ej: "gasto 50000 en comida")\n` +
        `2️⃣ Registrar ingreso (ej: "ingreso 200000 por venta")\n` +
        `═══ ANÁLISIS ═══\n` +
        `3️⃣ Dashboard financiero\n` +
        `4️⃣ Gastos por categoría\n` +
        `5️⃣ Ingresos por categoría\n` +
        `6️⃣ Reporte (diario/semanal/mensual/anual)\n` +
        `7️⃣ Alertas inteligentes\n` +
        `══️ PLANIFICACIÓN ═══\n` +
        `8️⃣ Crear presupuesto\n` +
        `9️⃣ Crear meta financiera\n` +
        `🔟 Ver deudas y activos\n\n` +
        `💡 También pregúntame: "¿cómo puedo ahorrar más?", "¿es buen momento para invertir?", "¿puedo asumir un crédito?"`
    }
        // Default
// Default — dar consejo general
    else {
      tipo = 'TEXTO'
      respuesta = `📊 Soy Experto Financiero, tu asesor financiero.\n\n` +
        `Escribe "menú" para ver opciones, o hazme preguntas como:\n` +
        `• "¿Cómo puedo ahorrar más?"\n` +
        `• "¿Es buen momento para invertir?"\n` +
        `• "¿Puedo asumir un crédito de 5 millones?"\n` +
        `• "Analiza mi salud financiera"\n\n` +
        `También puedo registrar movimientos: "gasto de 50000 en gasolina personal"`
    }
  }


  // === PAGOS (Asistente de Cobros) — Gerente Inteligente de Cobranza ===
  else if (botTipo === 'PAGOS') {
    // 1. Verificar si LLM está activado
    const configLLM = await db.configBot.findUnique({ where: { clave: 'asistente_cobros_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto completo de cartera
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'PAGOS', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        const estado = await obtenerEstadoCartera()
        const r = estado.resumen

        const contextoCartera = `CONTEXTO DE CARTERA (tiempo real — ${new Date().toLocaleString('es-CO')}):

═══ PANORAMA GENERAL ═══
Total solicitudes: ${r.totalPrestamos}
Activos: ${r.totalActivos}
Pendientes desembolso: ${r.totalPendientes}
Al día: ${r.totalAlDia}
En mora: ${r.totalMora} (${r.tasaMora}%)
En jurídico: ${r.totalJuridico}

═══ INDICADORES FINANCIEROS ═══
Capital prestado: ${formatearMoneda(r.capitalPrestado)}
Capital recuperado: ${formatearMoneda(r.capitalRecuperado)} (${r.tasaRecuperacion}%)
Capital pendiente: ${formatearMoneda(r.capitalPendiente)}
Interés corriente pendiente: ${formatearMoneda(r.interesCorrientePendiente)}
Mora acumulada: ${formatearMoneda(r.moraAcumulada)}

═══ RECAUDO ═══
Hoy: ${formatearMoneda(r.recaudoDiario)} (${estado.recaudo.countDiario} pagos)
Semana: ${formatearMoneda(r.recaudoSemanal)} (${estado.recaudo.countSemanal} pagos)
Mes: ${formatearMoneda(r.recaudoMensual)} (${estado.recaudo.countMensual} pagos)
Año: ${formatearMoneda(r.recaudoAnual)} (${estado.recaudo.countAnual} pagos)

═══ VENCIMIENTOS ═══
Vencen hoy: ${r.vencenHoy}
Vencen en 7 días: ${r.vencenProximos7}

═══ MORA ═══
Clientes en mora: ${r.countMorosos}
Promedio días mora: ${r.promedioDiasMora}
Reincidentes: ${r.countReincidentes}

${estado.morosos.length > 0 ? `═══ MOROSOS (top 10) ═══\n${estado.morosos.slice(0, 10).map((m, i) => `${i + 1}. ${m.cliente} (${m.diasMora} días) — ${formatearMoneda(m.saldoTotal)} [${m.severidad}] → ${m.accionRecomendada}`).join('\n')}` : 'Sin morosos'}

${estado.alertas.length > 0 ? `═══ ALERTAS (${estado.alertas.length}) ═══\n${estado.alertas.map((a, i) => `${i + 1}. [${a.severidad}] ${a.titulo}: ${a.descripcion}`).join('\n')}` : 'Sin alertas'}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'PAGOS',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoCartera,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Asistente de Cobros falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones (fallback)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_PAGOS = detectarIntentBot('PAGOS', mensaje)
    if (intentNLP_PAGOS.intent && intentNLP_PAGOS.confianza > 0.15) {
      const keywordsNLP_PAGOS: Record<string, string> = { 'ESTADO_CARTERA': 'cartera', 'MORA': 'mora', 'VENCEN_HOY': 'vencen hoy', 'PROXIMOS_VENCIMIENTOS': 'proximo', 'RECAUDO': 'recaudo', 'INDICADORES': 'indicador', 'RIESGO': 'riesgo', 'ALERTAS_COBROS': 'alerta', 'RECORDATORIO_WA': 'whatsapp', 'ESCALAR_JURIDICO': 'juridico', 'ANALISIS_ESTRATEGICO': 'analisis' }
      const kw = keywordsNLP_PAGOS[intentNLP_PAGOS.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }
    
    // Resumen ejecutivo / estado de cartera
    if (mensajeLower.includes('cartera') || mensajeLower.includes('estado') || mensajeLower.includes('resumen') || mensajeLower.includes('novedad') || mensajeLower.includes('hoy') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      tipo = 'REPORTE'
      respuesta = await generarResumenEjecutivo()
    }
    // Mora
    else if (mensajeLower.includes('mora') || mensajeLower.includes('moroso') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      if (estado.morosos.length === 0) {
        respuesta = `✅ No hay clientes en mora. Cartera al día.`
      } else {
        respuesta = `⚠️ Clientes en mora (${estado.morosos.length}):

`
        estado.morosos.forEach((m, i) => {
          respuesta += `${i + 1}. ${m.cliente} — ${m.diasMora} días
`
          respuesta += `   💰 Saldo: ${formatearMoneda(m.saldoTotal)} (mora: ${formatearMoneda(m.montoMora)})
`
          respuesta += `   📊 Severidad: ${m.severidad}
`
          respuesta += `   🎯 Acción: ${m.accionRecomendada}

`
        })
      }
    }
    // Cuotas que vencen hoy
    else if (mensajeLower.includes('vencen hoy') || mensajeLower.includes('vencimiento hoy') || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      if (estado.vencenHoy.length === 0) {
        respuesta = `✅ No hay cuotas que venzan hoy.`
      } else {
        respuesta = `📅 Cuotas que vencen HOY (${estado.vencenHoy.length}):

`
        estado.vencenHoy.forEach((v, i) => {
          respuesta += `${i + 1}. ${v.cliente}
`
          respuesta += `   📞 ${v.telefono}
`
          respuesta += `   💰 Cuota: ${formatearMoneda(v.montoCuota)}

`
        })
        respuesta += `💡 Envía recordatorio WhatsApp a estos clientes.`
      }
    }
    // Próximos vencimientos (7 días)
    else if (mensajeLower.includes('proximo') || mensajeLower.includes('próximo') || mensajeLower.includes('vencen') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      if (estado.vencenProximos7.length === 0) {
        respuesta = `✅ No hay vencimientos en los próximos 7 días.`
      } else {
        respuesta = `📅 Próximos vencimientos (7 días — ${estado.vencenProximos7.length}):

`
        estado.vencenProximos7.forEach((v, i) => {
          respuesta += `${i + 1}. ${v.cliente} — ${new Date(v.fechaVencimiento!).toLocaleDateString('es-CO')}
`
          respuesta += `   📞 ${v.telefono} | 💰 ${formatearMoneda(v.montoCuota)}
`
        })
      }
    }
    // Recaudo
    else if (mensajeLower.includes('recaudo') || mensajeLower.includes('recuper') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      const r = estado.recaudo
      respuesta = `💰 RECAUDO

`
      respuesta += `═══ HOY ═══
${formatearMoneda(r.diario)} (${r.countDiario} pagos)

`
      respuesta += `═══ SEMANA ═══
${formatearMoneda(r.semanal)} (${r.countSemanal} pagos)

`
      respuesta += `═══ MES ═══
${formatearMoneda(r.mensual)} (${r.countMensual} pagos)

`
      respuesta += `═══ AÑO ═══
${formatearMoneda(r.anual)} (${r.countAnual} pagos)
`
    }
    // Indicadores de recuperación
    else if (mensajeLower.includes('indicador') || mensajeLower.includes('tasa') || mensajeLower.includes('recuperacion') || mensajeLower.includes('recuperación') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      const r = estado.resumen
      respuesta = `📊 INDICADORES DE RECUPERACIÓN

`
      respuesta += `Tasa de recuperación: ${r.tasaRecuperacion}%
`
      respuesta += `Tasa de mora: ${r.tasaMora}%
`
      respuesta += `Promedio días mora: ${r.promedioDiasMora}
`
      respuesta += `Capital prestado: ${formatearMoneda(r.capitalPrestado)}
`
      respuesta += `Capital recuperado: ${formatearMoneda(r.capitalRecuperado)}
`
      respuesta += `Capital pendiente: ${formatearMoneda(r.capitalPendiente)}
`
      respuesta += `Mora acumulada: ${formatearMoneda(r.moraAcumulada)}
`
      respuesta += `
${r.tasaMora < 10 ? '🟢 Cartera saludable' : r.tasaMora < 20 ? '🟡 Atención requerida' : '🔴 Cartera en riesgo'}`
    }
    // Clientes con mayor riesgo
    else if (mensajeLower.includes('riesgo') || mensajeLower.includes('peligro') || mensajeLower === '8' || mensajeLower === '8️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      const riesgos = estado.morosos.filter((m) => m.diasMora >= 15)
      if (riesgos.length === 0) {
        respuesta = `✅ No hay clientes con riesgo alto actualmente.`
      } else {
        respuesta = `🔴 Clientes con mayor riesgo (${riesgos.length}):

`
        riesgos.forEach((m, i) => {
          respuesta += `${i + 1}. ${m.cliente} — ${m.diasMora} días de mora
`
          respuesta += `   💰 ${formatearMoneda(m.saldoTotal)} | Severidad: ${m.severidad}
`
          respuesta += `   🎯 Acción: ${m.accionRecomendada}

`
        })
      }
    }
    // Alertas críticas
    else if (mensajeLower.includes('alerta') || mensajeLower === '9' || mensajeLower === '9️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      if (estado.alertas.length === 0) {
        respuesta = `✅ No hay alertas críticas. Cartera estable.`
      } else {
        respuesta = `🔔 ALERTAS CRÍTICAS (${estado.alertas.length}):

`
        estado.alertas.forEach((a, i) => {
          respuesta += `${i + 1}. [${a.severidad}] ${a.titulo}
   ${a.descripcion}

`
        })
      }
    }
    // Análisis estratégico
    else if (mensajeLower.includes('analisis') || mensajeLower.includes('análisis') || mensajeLower.includes('estrateg') || mensajeLower.includes('prioridad') || mensajeLower.includes('recomend')) {
      tipo = 'REPORTE'
      respuesta = await generarAnalisisEstrategico()
    }
    // Solicitudes activos/pendientes
    else if (mensajeLower.includes('activo') || mensajeLower.includes('pendiente') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      const r = estado.resumen
      respuesta = `📋 SOLICITUDES

`
      respuesta += `Activos: ${r.totalActivos}
`
      respuesta += `Pendientes desembolso: ${r.totalPendientes}
`
      respuesta += `Al día: ${r.totalAlDia}
`
      respuesta += `En mora: ${r.totalMora}
`
      respuesta += `En jurídico: ${r.totalJuridico}
`
      respuesta += `Total: ${r.totalPrestamos}
`
    }
    // Enviar recordatorio WhatsApp (simulado, solo sugerencia)
    else if (mensajeLower.includes('whatsapp') || mensajeLower.includes('recordatorio') || mensajeLower.includes('enviar') || mensajeLower === '10' || mensajeLower === '🔟') {
      tipo = 'TEXTO'
      const estado = await obtenerEstadoCartera()
      const clientesAContactar = [
        ...estado.vencenHoy.map((v) => ({ nombre: v.cliente, telefono: v.telefono, motivo: 'vencimiento hoy' })),
        ...estado.vencenProximos7.map((v) => ({ nombre: v.cliente, telefono: v.telefono, motivo: 'vence en 7 días' })),
      ].slice(0, 10)
      if (clientesAContactar.length === 0) {
        respuesta = `✅ No hay clientes a quien enviar recordatorios actualmente.`
      } else {
        respuesta = `📱 Clientes a contactar por WhatsApp (${clientesAContactar.length}):

`
        clientesAContactar.forEach((c, i) => {
          respuesta += `${i + 1}. ${c.nombre} — ${c.telefono}
   Motivo: ${c.motivo}
`
        })
        respuesta += `
💡 Para enviar recordatorios masivos, ve a Pagos → Próximos Pagos y usa el botón 🔔.`
      }
    }
    // Escalar a jurídico
    else if (mensajeLower.includes('juridico') || mensajeLower.includes('jurídico') || mensajeLower.includes('escalar') || mensajeLower === '0' || mensajeLower === '0️⃣') {
      tipo = 'REPORTE'
      const estado = await obtenerEstadoCartera()
      const candidatosJuridico = estado.morosos.filter((m) => m.diasMora >= 60)
      if (candidatosJuridico.length === 0) {
        respuesta = `✅ No hay clientes para escalar a jurídico (umbral: 60 días de mora).`
      } else {
        respuesta = `⚖️ CANDIDATOS A COBRO JURÍDICO (${candidatosJuridico.length}):

`
        candidatosJuridico.forEach((m, i) => {
          respuesta += `${i + 1}. ${m.cliente} — ${m.diasMora} días
`
          respuesta += `   💰 Saldo: ${formatearMoneda(m.saldoTotal)}
`
          respuesta += `   📞 ${m.telefono}

`
        })
        respuesta += `💡 Para escalar: ve a Jurídico → Nuevo Caso y selecciona el solicitud.`
      }
    }
    // Menú
    else if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help') {
      tipo = 'TEXTO'
      respuesta = `💼 MENÚ ASISTENTE DE COBROS
` +
        `═══ ESTADO CARTERA ═══
` +
        `1️⃣ Resumen ejecutivo (cartera hoy)
` +
        `2️⃣ Solicitudes activos / pendientes
` +
        `3️⃣ Mora actual (clientes + días)
` +
        `4️⃣ Cuotas que vencen hoy
` +
        `5️⃣ Próximos vencimientos (7 días)
` +
        `═══ ANÁLISIS ═══
` +
        `6️⃣ Recaudo (diario/semanal/mensual/anual)
` +
        `7️⃣ Indicadores de recuperación
` +
        `8️⃣ Clientes con mayor riesgo
` +
        `9️⃣ Alertas críticas
` +
        `══️ ACCIONES ═══
` +
        `🔟 Enviar recordatorio WhatsApp
` +
        `0️⃣ Escalar a jurídico

` +
        `💡 También pregúntame: "¿cómo está la cartera?", "¿qué riesgos detectaste?", "análisis estratégico"`
    }
        // Default
// Default
    else {
      tipo = 'TEXTO'
      respuesta = `💼 Soy Asistente de Cobros, tu Gerente Inteligente de Cobranza.

` +
        `Escribe "menú" para ver opciones o pregúntame:
` +
        `• "¿cómo está la cartera hoy?"
` +
        `• "¿qué clientes requieren atención?"
` +
        `• "muéstrame la mora"
` +
        `• "recaudo del mes"
` +
        `• "alertas críticas"
` +
        `• "análisis estratégico"`
    }
  }


  // === CHAT_CLIENTES (Clientes — Customer Success AI con LLM) ===
  else if (botTipo === 'CHAT_CLIENTES') {
    // 1. Verificar modo automático (interruptor del admin)
    const configAuto = await db.configBot.findUnique({ where: { clave: 'asistente_ia_automatico' } })
    const modoAutomatico = configAuto?.valor !== 'false' // Por defecto ON

    if (!modoAutomatico) {
      // Modo Manual: el admin responde personalmente
      return NextResponse.json({
        success: true,
        data: {
          respuesta: 'Gracias por tu mensaje. Un asesor humano te responderá pronto. Tu conversación queda en espera.',
          tipo: 'TEXTO',
          accionEjecutada: false,
          detalleAccion: 'MODO_MANUAL',
        },
      })
    }

    // 2. Verificar si el LLM está activado (config: asistente_ia_llm)
    const configLLM = await db.configBot.findUnique({ where: { clave: 'asistente_ia_llm' } })
    const llmActivado = configLLM?.valor === 'true' // Por defecto OFF (usar patrones)

    // 3. Si LLM está activado, usarlo con contexto completo
    if (llmActivado) {
      try {
        // Cargar instrucciones del bot desde la BD
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'CHAT_CLIENTES', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        // Cargar historial de la conversación (si hay conversacionId)
        let historial: Array<{ remitenteTipo: string; contenido: string; fechaEnvio: string }> = []
        // Nota: el clienteId y conversacionId se pueden pasar en el body, pero BotIcons no los envía actualmente.
        // Para el portal del cliente, el chat ya tiene su propio flujo OTP.

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'CHAT_CLIENTES',
            instrucciones: botConfig?.instrucciones || '',
            clienteId,
            historial,
          },
          mensaje
        )

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: resultadoLLM.escalar
              ? 'ESCALADO_LLM'
              : `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        // Si el LLM falla, caer al modo patrones
        console.error('[Chat] LLM falló, usando patrones:', e?.message)
      }
    }

    // 4. Modo patrones (fallback o cuando LLM está desactivado)
    // NLP semántico: enriquecer mensajeLower con keywords detectados
    const intentNLP_CHAT_CLIENTES = detectarIntentBot('CHAT_CLIENTES', mensaje)
    if (intentNLP_CHAT_CLIENTES.intent && intentNLP_CHAT_CLIENTES.confianza > 0.15) {
      const keywordsNLP_CHAT_CLIENTES: Record<string, string> = { 'SALDO': 'saldo', 'FECHA_PAGO': 'fecha', 'CUOTAS_PAGADAS': 'pagadas', 'RENOVACION': 'renov', 'REQUISITOS': 'requisito', 'ASESOR': 'asesor', 'HORARIOS': 'horario', 'PIN': 'pin', 'ESTADO_CUENTA': 'estado de cuenta' }
      const kw = keywordsNLP_CHAT_CLIENTES[intentNLP_CHAT_CLIENTES.intent]
      if (kw && !mensajeLower.includes(kw)) {
        mensajeLower = mensajeLower + ' ' + kw
      }
    }

    // Buscar primero en FAQs
    try {
      const faqs = await db.faqBot.findMany({ where: { activa: true } })
      for (const faq of faqs) {
        const palabrasClave = (faq.palabrasClave || '').toLowerCase().split(',').map((p) => p.trim()).filter(Boolean)
        const preguntaLower = faq.pregunta.toLowerCase()
        const matchPorPalabra = palabrasClave.some((p) => p && mensajeLower.includes(p))
        const matchPorPregunta = mensajeLower.includes(preguntaLower) || preguntaLower.includes(mensajeLower)
        if (matchPorPalabra || matchPorPregunta) {
          // Incrementar contador de uso
          await db.faqBot.update({ where: { id: faq.id }, data: { vecesUsada: { increment: 1 } } })
          return NextResponse.json({
            success: true,
            data: { respuesta: faq.respuesta, tipo: 'TEXTO', accionEjecutada: true, detalleAccion: `FAQ: ${faq.pregunta}` },
          })
        }
      }
    } catch (e) {
      // Si falla la consulta de FAQs, continuar con lógica hardcodeada
    }

    // 5. Lógica hardcodeada con datos reales del cliente
    const cliente = clienteId ? await db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true, cedula: true, telefono: true }
    }) : null

    const prestamosActivos = cliente ? await db.prestamo.findMany({
      where: { clienteId: cliente.id, estado: { in: ['ACTIVO', 'EN_MORA'] } },
      select: {
        id: true, codigo: true, montoPrincipal: true, saldoTotal: true,
        montoCuota: true, numeroCuotas: true, cuotasPagadas: true,
        fechaVencimiento: true, diasMora: true, estado: true
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    }) : []

    // 6. Menú / saludo
    if (mensajeLower === 'menu' || mensajeLower === 'menú' || mensajeLower === 'ayuda' || mensajeLower === 'hola' || mensajeLower === 'help' || mensajeLower === 'buenos' || mensajeLower === 'buenas') {
      tipo = 'TEXTO'
      respuesta = `💬 ¡Hola${cliente ? `, ${cliente.nombre.split(' ')[0]}` : ''}! Soy Clientes, tu asistente de atención.\n\n` +
        `MENÚ\n` +
        `1️⃣ Consultar saldo de mi solicitud\n` +
        `2️⃣ Ver fecha de mi próximo pago\n` +
        `3️⃣ Ver cuotas pagadas\n` +
        `4️⃣ Información sobre renovación\n` +
        `5️⃣ Requisitos para nuevo crédito\n` +
        `6️⃣ Hablar con un asesor\n` +
        `7️⃣ Horarios de atención\n\n` +
        `💡 Escribe el número o tu pregunta directamente.`
    }
    // 7. Consulta de saldo
    else if (mensajeLower.includes('saldo') || mensajeLower.includes('deuda') || mensajeLower === '1' || mensajeLower === '1️⃣') {
      if (!cliente) {
        tipo = 'TEXTO'
        respuesta = `💰 Consulta de saldo\n\nNo tengo acceso a tu información en este momento. Para consultarlo, ingresa al Portal del Cliente con tu cédula y PIN.\n\nSi necesitas ayuda, escribe "asesor" y te conectaremos con un humano.`
      } else if (prestamosActivos.length === 0) {
        tipo = 'TEXTO'
        respuesta = `💰 Consulta de saldo\n\nHola ${cliente.nombre.split(' ')[0]}, no tienes solicitudes activos actualmente.\n\n¿Te gustaría información sobre requisitos para un nuevo crédito? Escribe "requisitos".`
      } else {
        tipo = 'REPORTE'
        respuesta = `💰 Saldo de tu solicitud${prestamosActivos.length > 1 ? 's' : ''}, ${cliente.nombre.split(' ')[0]}:\n\n`
        prestamosActivos.forEach((p, i) => {
          respuesta += `${i + 1}. Crédito ${p.codigo}\n` +
            `   • Saldo pendiente: ${formatearMoneda(p.saldoTotal)}\n` +
            `   • Cuotas: ${p.cuotasPagadas}/${p.numeroCuotas}\n` +
            `   • Estado: ${p.estado === 'EN_MORA' ? `⚠️ En mora (${p.diasMora} días)` : '✅ Al día'}\n\n`
        })
        respuesta += `💡 Ve al Portal del Cliente para más detalle.`
      }
    }
    // 8. Fecha de pago
    else if (mensajeLower.includes('fecha') || mensajeLower.includes('pago') || mensajeLower.includes('cuota') || mensajeLower === '2' || mensajeLower === '2️⃣') {
      if (!cliente || prestamosActivos.length === 0) {
        tipo = 'TEXTO'
        respuesta = `📅 Fecha de pago\n\nNo tienes solicitudes activos. Tu próxima fecha de pago se muestra en el Portal del Cliente cuando tienes un crédito activo.`
      } else {
        tipo = 'REPORTE'
        respuesta = `📅 Próximos pagos, ${cliente.nombre.split(' ')[0]}:\n\n`
        prestamosActivos.forEach((p, i) => {
          respuesta += `${i + 1}. Crédito ${p.codigo}\n` +
            `   • Valor cuota: ${formatearMoneda(p.montoCuota)}\n` +
            `   • Vencimiento: ${p.fechaVencimiento ? new Date(p.fechaVencimiento).toLocaleDateString('es-CO') : 'Sin fecha'}\n` +
            `   • Cuotas pendientes: ${p.numeroCuotas - p.cuotasPagadas}\n\n`
        })
        respuesta += `💡 Paga a tiempo para evitar mora. Ve al Portal → Pagos.`
      }
    }
    // 9. Cuotas pagadas
    else if (mensajeLower.includes('pagadas') || mensajeLower.includes('historial') || mensajeLower === '3' || mensajeLower === '3️⃣') {
      if (!cliente || prestamosActivos.length === 0) {
        tipo = 'TEXTO'
        respuesta = `📊 Cuotas pagadas\n\nNo tienes solicitudes activos para mostrar historial.`
      } else {
        tipo = 'REPORTE'
        respuesta = `📊 Estado de cuotas, ${cliente.nombre.split(' ')[0]}:\n\n`
        prestamosActivos.forEach((p, i) => {
          const progreso = (p.cuotasPagadas / p.numeroCuotas) * 100
          respuesta += `${i + 1}. Crédito ${p.codigo}\n` +
            `   • Cuotas pagadas: ${p.cuotasPagadas} de ${p.numeroCuotas}\n` +
            `   • Progreso: ${progreso.toFixed(0)}%\n\n`
        })
        respuesta += `💡 Ve al Portal → Historial para ver todos los pagos.`
      }
    }
    // 10. Renovación
    else if (mensajeLower.includes('renov') || mensajeLower === '4' || mensajeLower === '4️⃣') {
      tipo = 'TEXTO'
      respuesta = `🔄 Renovación de crédito\n\n` +
        `Para renovar:\n` +
        `1. Ingresa al Portal del Cliente\n` +
        `2. Ve a "Solicitar crédito"\n` +
        `3. Selecciona "Renovación"\n` +
        `4. Escoge el crédito a renovar\n` +
        `5. El sistema trae tu saldo pendiente automáticamente\n` +
        `6. Ingresa el nuevo capital\n` +
        `7. El sistema calcula el excedente a entregarte\n\n` +
        `💡 Solo puedes renovar si tu solicitud está al día.`
    }
    // 11. Requisitos
    else if (mensajeLower.includes('requisito') || mensajeLower.includes('credito') || mensajeLower.includes('crédito') || mensajeLower.includes('solicitar') || mensajeLower === '5' || mensajeLower === '5️⃣') {
      tipo = 'TEXTO'
      respuesta = `📋 Requisitos para nuevo crédito:\n\n` +
        `• Cédula de ciudadanía\n` +
        `• Teléfono activo (WhatsApp)\n` +
        `• Correo electrónico\n` +
        `• Ingresos comprobables\n` +
        `• Codeudor (opcional)\n\n` +
        `Solicítalo desde el Portal del Cliente → "Solicitar crédito".\n\n` +
        `💡 Un asesor revisará tu solicitud y te contactará.`
    }
    // 12. Hablar con asesor (escalamiento)
    else if (mensajeLower.includes('asesor') || mensajeLower.includes('humano') || mensajeLower.includes('hablar') || mensajeLower === '6' || mensajeLower === '6️⃣') {
      tipo = 'ACCION'
      accionEjecutada = true
      detalleAccion = 'ESCALADO_ASESOR'
      respuesta = `👨‍💼 Escalando a asesor humano\n\n` +
        `Gracias por tu consulta${cliente ? `, ${cliente.nombre.split(' ')[0]}` : ''}. Tu caso será atendido por un asesor a la brevedad.\n\n` +
        `Tu conversación queda marcada como pendiente. Te contactaremos por WhatsApp al teléfono registrado.${cliente?.telefono ? ` (${cliente.telefono.slice(-4).padStart(4, '*')})` : ''}\n\n` +
        `💡 Horarios de atención: lunes a viernes, 8:00 AM - 6:00 PM.`
    }
    // 13. Horarios
    else if (mensajeLower.includes('horario') || mensajeLower.includes('atencion') || mensajeLower.includes('atención') || mensajeLower === '7' || mensajeLower === '7️⃣') {
      tipo = 'TEXTO'
      respuesta = `🕐 Horarios de atención\n\n` +
        `Lunes a viernes: 8:00 AM - 6:00 PM\n` +
        `Sábados: 9:00 AM - 1:00 PM\n` +
        `Domingos y festivos: cerrado\n\n` +
        `📞 WhatsApp: 3103674546\n` +
        `📧 Correo: jsa@jsadr.com.co\n\n` +
        `💡 Fuera de horario, deja tu mensaje y te responderemos al inicio del próximo día hábil.`
    }
    // 14. Default — escalamiento: no sabe la respuesta
    else {
      tipo = 'ACCION'
      accionEjecutada = true
      detalleAccion = 'ESCALADO_NO_RECONOCIDO'
      respuesta = `Gracias por tu mensaje${cliente ? `, ${cliente.nombre.split(' ')[0]}` : ''}.\n\n` +
        `No tengo información suficiente para responder esto con seguridad. Voy a escalar tu caso a un asesor humano, quien te responderá a la brevedad.\n\n` +
        `Tu conversación queda marcada como pendiente. Mientras tanto, puedes escribir "menú" para ver las opciones que puedo atender automáticamente.`
    }
  }

  // === ADMIN_SISTEMA (Asistente Personal) — Personal CFO ===
  else if (botTipo === 'ADMIN_SISTEMA' && botNombre !== 'SOC AI') {
    // 1. Verificar si LLM está activado para Asistente Personal
    const configLLM = await db.configBot.findUnique({ where: { clave: 'asistente_personal_llm' } })
    const llmActivado = configLLM?.valor === 'true'

    // 2. Si LLM activado, usarlo con contexto financiero completo
    if (llmActivado) {
      try {
        const botConfig = await db.bot.findFirst({
          where: { tipo: 'ADMIN_SISTEMA', activo: true },
          select: { instrucciones: true, nombre: true },
        })

        // Cargar contexto financiero completo
        const dashboardNegocio = await obtenerDashboard('NEGOCIO', 30)
        const dashboardPersonal = await obtenerDashboard('PERSONAL', 30)
        const presupuestos = await db.presupuesto.findMany({ where: { activo: true } })
        const metas = await db.metaFinanciera.findMany({ where: { estado: 'ACTIVA' } })
        const categorias = await db.categoriaFinanciera.findMany({ where: { activa: true } })

        const contextoFinanciero = `CONTEXTO FINANCIERO ACTUAL (últimos 30 días):

═══ NEGOCIO ═══
Ingresos: ${formatearMoneda(dashboardNegocio.kpis.ingresos)}
Gastos: ${formatearMoneda(dashboardNegocio.kpis.gastos)}
Balance: ${formatearMoneda(dashboardNegocio.kpis.balance)}
Capacidad ahorro: ${dashboardNegocio.kpis.capacidadAhorro}%
Nivel endeudamiento: ${dashboardNegocio.kpis.nivelEndeudamiento}%
Movimientos: ${dashboardNegocio.kpis.totalMovimientos}

═══ PERSONAL ═══
Ingresos: ${formatearMoneda(dashboardPersonal.kpis.ingresos)}
Gastos: ${formatearMoneda(dashboardPersonal.kpis.gastos)}
Balance: ${formatearMoneda(dashboardPersonal.kpis.balance)}
Capacidad ahorro: ${dashboardPersonal.kpis.capacidadAhorro}%
Nivel endeudamiento: ${dashboardPersonal.kpis.nivelEndeudamiento}%

═══ PRESUPUESTOS ACTIVOS (${presupuestos.length}) ═══
${presupuestos.map(p => `- ${p.nombre} (${p.ambito}): límite ${formatearMoneda(p.montoLimite)}`).join('\n')}

═══ METAS ACTIVAS (${metas.length}) ═══
${metas.map(m => `- ${m.nombre} (${m.ambito}): ${formatearMoneda(m.montoActual)}/${formatearMoneda(m.montoObjetivo)} (${m.montoObjetivo > 0 ? Math.round((m.montoActual/m.montoObjetivo)*100) : 0}%)`).join('\n')}

═══ CATEGORÍAS DISPONIBLES (${categorias.length}) ═══
${categorias.map(c => `- ${c.icono || ''} ${c.nombre} (${c.tipo}/${c.ambito})`).join('\n')}`

        const resultadoLLM = await generarRespuestaLLM(
          {
            botNombre: botNombre,
            botTipo: 'ADMIN_SISTEMA',
            instrucciones: (botConfig?.instrucciones || '') + '\n\n' + contextoFinanciero,
          },
          mensaje
        )

        // Detectar si el LLM quiere ejecutar una acción (registrar gasto/ingreso)
        const lowerResp = resultadoLLM.respuesta.toLowerCase()
        if (lowerResp.includes('registrar') && (lowerResp.includes('gasto') || lowerResp.includes('ingreso'))) {
          // Si el usuario claramente pidió registrar, ejecutar la acción
          const gastoMatch = mensajeLower.match(/(?:gasto|gasté|gaste|pagué|pague)\s+(?:de\s+)?\$?\s*([\d.]+)/)
          const ingresoMatch = mensajeLower.match(/(?:ingreso|recibí|recibi|gané|gane)\s+(?:de\s+)?\$?\s*([\d.]+)/)

          if (gastoMatch) {
            const monto = parseFloat(gastoMatch[1].replace(/\./g, ''))
            if (monto > 0) {
              const ambito = mensajeLower.includes('personal') ? 'PERSONAL' : 'NEGOCIO'
              // Extraer concepto
              const after = mensaje.substring(mensaje.indexOf(gastoMatch[0]) + gastoMatch[0].length).trim()
              const concepto = after.replace(/^(?:en|de|para)\s+/i, '').trim() || 'Gasto'
              const resultado = await registrarMovimiento({
                tipo: 'EGRESO',
                monto,
                concepto,
                ambito: ambito as 'NEGOCIO' | 'PERSONAL',
                usuarioNombre: 'Admin',
              })
              if (resultado.success) {
                return NextResponse.json({
                  success: true,
                  data: {
                    respuesta: `✅ Gasto registrado (${ambito})\n💰 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n\n${resultadoLLM.respuesta}`,
                    tipo: 'ACCION',
                    accionEjecutada: true,
                    detalleAccion: `Gasto ${ambito}: ${formatearMoneda(monto)} (${resultado.categoriaNombre})`,
                  },
                })
              }
            }
          }

          if (ingresoMatch) {
            const monto = parseFloat(ingresoMatch[1].replace(/\./g, ''))
            if (monto > 0) {
              const ambito = mensajeLower.includes('personal') ? 'PERSONAL' : 'NEGOCIO'
              const after = mensaje.substring(mensaje.indexOf(ingresoMatch[0]) + ingresoMatch[0].length).trim()
              const concepto = after.replace(/^(?:por|de|para)\s+/i, '').trim() || 'Ingreso'
              const resultado = await registrarMovimiento({
                tipo: 'INGRESO',
                monto,
                concepto,
                ambito: ambito as 'NEGOCIO' | 'PERSONAL',
                usuarioNombre: 'Admin',
              })
              if (resultado.success) {
                return NextResponse.json({
                  success: true,
                  data: {
                    respuesta: `✅ Ingreso registrado (${ambito})\n💰 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n\n${resultadoLLM.respuesta}`,
                    tipo: 'ACCION',
                    accionEjecutada: true,
                    detalleAccion: `Ingreso ${ambito}: ${formatearMoneda(monto)} (${resultado.categoriaNombre})`,
                  },
                })
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            respuesta: resultadoLLM.respuesta,
            tipo: resultadoLLM.escalar ? 'ACCION' : 'TEXTO',
            accionEjecutada: resultadoLLM.escalar,
            detalleAccion: `LLM (${resultadoLLM.fuente})`,
          },
        })
      } catch (e: any) {
        console.error('[Chat] LLM Asistente Personal falló, usando patrones:', e?.message)
      }
    }

    // 3. Modo patrones con NLP semántico (fallback)
    // Normalizar mensaje para mejor matching
    const mensajeNormalizado = normalizarMensaje(mensaje)

    // Buscar primero en base de conocimiento Q&A
    // Pero NO interceptar si el mensaje coincide con un intent específico
    const intentPrevio = detectarIntent(mensajeNormalizado)
    const qa = (!intentPrevio.intent || intentPrevio.confianza < 0.5) ? buscarRespuestaQA(mensajeNormalizado) : null
    if (qa && !mensajeNormalizado.match(/\$?[\d.]+/)) {
      tipo = 'TEXTO'
      respuesta = `${qa.respuesta}\n\n💡 Escribe "${qa.categoria.toLowerCase()}" para ver más opciones.`
    }
    // Detectar intent con sistema semántico
    else {
      const intentDetectado = intentPrevio
      const ambito = extraerAmbito(mensaje)

      switch (intentDetectado.intent) {
        case 'REGISTRAR_GASTO': {
          const monto = extraerMonto(mensaje)
          if (monto) {
            const validacion = validarMonto(monto)
            if (!validacion.valido) {
              tipo = 'TEXTO'
              respuesta = `❌ ${validacion.error}`
            } else {
              const concepto = extraerConcepto(mensaje, monto)
              // === CONFIRMACIÓN OBLIGATORIA DE ÁMBITO ===
              // Aunque el mensaje contenga "personal" o "negocio", SIEMPRE
              // pedimos confirmación explícita antes de registrar.
              const esPersonalDetectado = /\bpersonal\b/i.test(mensaje) && !/personalizar/i.test(mensaje)
              const esNegocioDetectado = /\b(?:negocio|empresa)\b/i.test(mensaje)
              const sugerenciaDetectada = esPersonalDetectado
                ? 'Detecté "personal" en tu mensaje → responde **personal** para confirmar'
                : esNegocioDetectado
                ? 'Detecté "negocio" en tu mensaje → responde **negocio** para confirmar'
                : ''
              guardarMemoria(sessionId, {
                pendienteConfirmarAmbito: {
                  tipo: 'GASTO',
                  monto,
                  concepto,
                  timestamp: Date.now(),
                },
              } as any)
              tipo = 'CONFIRMACION'
              respuesta = `💰 **Gasto detectado**\n\n💰 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}${sugerenciaDetectada ? `\n\n💡 ${sugerenciaDetectada}` : ''}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ **CONFIRMACIÓN OBLIGATORIA**\n━━━━━━━━━━━━━━━━━━\n\n¿Este gasto es para NEGOCIO o PERSONAL?\n\nResponde:\n  • "negocio" o "1" → Gasto del negocio\n  • "personal" o "2" → Gasto personal\n\n🔒 No puedo registrarlo hasta que confirmes el ámbito.`
            }
          } else {
            tipo = 'TEXTO'
            respuesta = `💰 Para registrar un gasto, incluye el monto. Ejemplos:\n• "gasto de 50000 en comida"\n• "anota 200000 de gasolina personal"\n• "me costó 100000 en marketing"\n• "gasté 50 mil en transporte"`
          }
          break
        }

        case 'REGISTRAR_INGRESO': {
          const monto = extraerMonto(mensaje)
          if (monto) {
            const validacion = validarMonto(monto)
            if (!validacion.valido) {
              tipo = 'TEXTO'
              respuesta = `❌ ${validacion.error}`
            } else {
              const concepto = extraerConcepto(mensaje, monto)
              // === CONFIRMACIÓN OBLIGATORIA DE ÁMBITO ===
              const esPersonalDetectado = /\bpersonal\b/i.test(mensaje) && !/personalizar/i.test(mensaje)
              const esNegocioDetectado = /\b(?:negocio|empresa)\b/i.test(mensaje)
              const sugerenciaDetectada = esPersonalDetectado
                ? 'Detecté "personal" en tu mensaje → responde **personal** para confirmar'
                : esNegocioDetectado
                ? 'Detecté "negocio" en tu mensaje → responde **negocio** para confirmar'
                : ''
              guardarMemoria(sessionId, {
                pendienteConfirmarAmbito: {
                  tipo: 'INGRESO',
                  monto,
                  concepto,
                  timestamp: Date.now(),
                },
              } as any)
              tipo = 'CONFIRMACION'
              respuesta = `📈 **Ingreso detectado**\n\n💵 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}${sugerenciaDetectada ? `\n\n💡 ${sugerenciaDetectada}` : ''}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ **CONFIRMACIÓN OBLIGATORIA**\n━━━━━━━━━━━━━━━━━━\n\n¿Este ingreso es para NEGOCIO o PERSONAL?\n\nResponde:\n  • "negocio" o "1" → Ingreso del negocio\n  • "personal" o "2" → Ingreso personal\n\n🔒 No puedo registrarlo hasta que confirmes el ámbito.`
            }
          } else {
            tipo = 'TEXTO'
            respuesta = `📈 Para registrar un ingreso, incluye el monto. Ejemplos:\n• "ingreso de 2000000 por venta"\n• "recibí 500000 de comisión"\n• "me pagaron 1000000"\n• "cobré 2 millones personal"`
          }
          break
        }

        case 'DASHBOARD': {
          tipo = 'REPORTE'
          const dash = await obtenerDashboard(ambito, 30)
          const k = dash.kpis
          let estado = 'SIN DATOS'
          if (k.ingresos > 0) {
            if (k.balance > 0 && k.capacidadAhorro >= 20) estado = '🟢 SALUDABLE'
            else if (k.balance > 0 && k.capacidadAhorro >= 10) estado = '🟡 ACEPTABLE'
            else if (k.balance >= 0) estado = '🟠 EQUILIBRADO'
            else estado = '🔴 CRÍTICO'
          }
          respuesta = `📊 Dashboard ${ambito} — últimos 30 días\n\n`
          respuesta += `═══ SALUD FINANCIERA: ${estado} ═══\n`
          respuesta += `Ingresos: ${formatearMoneda(k.ingresos)}\n`
          respuesta += `Gastos:   ${formatearMoneda(k.gastos)}\n`
          respuesta += `Balance:  ${formatearMoneda(k.balance)} ${k.balance >= 0 ? '✅' : '⚠️'}\n`
          respuesta += `Capacidad ahorro: ${k.capacidadAhorro}% ${k.capacidadAhorro >= 20 ? '✅' : k.capacidadAhorro >= 10 ? '🟡' : '⚠️'}\n`
          respuesta += `Nivel endeudamiento: ${k.nivelEndeudamiento}% ${k.nivelEndeudamiento < 70 ? '✅' : '⚠️'}\n\n`
          if (dash.topGastos.length > 0) {
            respuesta += `═══ TOP GASTOS ═══\n`
            dash.topGastos.forEach((g, i) => {
              const pct = k.gastos > 0 ? Math.round((g.monto / k.gastos) * 100) : 0
              respuesta += `${i + 1}. ${g.icono} ${g.categoria}: ${formatearMoneda(g.monto)} (${pct}% del total)\n`
            })
            respuesta += '\n'
          }
          if (dash.presupuestos.length > 0) {
            respuesta += `══️ PRESUPUESTOS ═══\n`
            dash.presupuestos.forEach((p) => {
              const emoji = p.porcentaje >= 100 ? '🚨' : p.porcentaje >= 80 ? '⚠️' : '✅'
              respuesta += `${emoji} ${p.nombre}: ${formatearMoneda(p.gastado)}/${formatearMoneda(p.limite)} (${p.porcentaje}%)\n`
            })
          }
          respuesta += `\n💡 Escribe "comparativo" para ver vs mes anterior, "predicción" para proyecciones.`
          break
        }

        case 'ALERTAS': {
          tipo = 'REPORTE'
          const alertas = await detectarAlertas(ambito)
          if (alertas.length === 0) {
            respuesta = `✅ No hay alertas financieras para ${ambito}. Todo está en orden.`
          } else {
            respuesta = `🔔 Alertas financieras (${ambito}) — ${alertas.length} detectadas:\n\n`
            alertas.forEach((a, i) => {
              respuesta += `${i + 1}. ${a.titulo}\n   ${a.descripcion}\n\n`
            })
          }
          break
        }

        case 'REPORTE': {
          tipo = 'REPORTE'
          const periodo = detectarPeriodo(mensaje)
          respuesta = await generarReporte(ambito, periodo)
          break
        }

        case 'COMPARATIVO': {
          tipo = 'REPORTE'
          respuesta = await generarComparativoMes(ambito)
          break
        }

        case 'PRESUPUESTO_CREAR': {
          const monto = extraerMonto(mensaje)
          if (monto) {
            const validacion = validarMonto(monto)
            if (validacion.valido) {
              const categorias = await db.categoriaFinanciera.findMany({ where: { activa: true, ambito: { in: [ambito, 'AMBOS'] } } })
              let categoriaId: string | undefined
              for (const c of categorias) {
                const kws = (c.keywords || '').toLowerCase().split(',').map(k => k.trim())
                if (kws.some(k => mensajeNormalizado.includes(k))) { categoriaId = c.id; break }
              }
              const presupuesto = await crearPresupuesto({
                nombre: `Presupuesto ${ambito} ${new Date().toLocaleDateString('es-CO')}`,
                ambito, montoLimite: monto, categoriaId, creadoPor: 'Admin',
              })
              tipo = 'ACCION'
              accionEjecutada = true
              detalleAccion = `Presupuesto creado: ${presupuesto.nombre} (${formatearMoneda(monto)})`
              respuesta = `✅ Presupuesto creado\n💰 Límite: ${formatearMoneda(monto)}\n📝 Ámbito: ${ambito}\n🗓️ Período: Mensual\n\n💡 Te alertaré cuando llegues al 80% del límite.`
            } else {
              tipo = 'TEXTO'
              respuesta = `❌ ${validacion.error}`
            }
          } else {
            tipo = 'TEXTO'
            respuesta = `💸 Crear presupuesto\n\nEscribe el monto y la categoría, ej:\n• "presupuesto de 2.000.000 para alimentación"\n• "presupuesto de 5.000.000 para marketing"\n• "límite de 1.000.000 para transporte personal"`
          }
          break
        }

        case 'META_CREAR': {
          const monto = extraerMonto(mensaje)
          if (monto) {
            const validacion = validarMonto(monto)
            if (validacion.valido) {
              let tipoMeta = 'AHORRO'
              if (mensajeNormalizado.includes('compr')) tipoMeta = 'COMPRAR_BIEN'
              else if (mensajeNormalizado.includes('pagar') && mensajeNormalizado.includes('deuda')) tipoMeta = 'PAGAR_DEUDA'
              else if (mensajeNormalizado.includes('empresa')) tipoMeta = 'CREAR_EMPRESA'
              else if (mensajeNormalizado.includes('emergencia')) tipoMeta = 'FONDO_EMERGENCIAS'
              else if (mensajeNormalizado.includes('jubil')) tipoMeta = 'JUBILACION'

              let plazo: 'CORTO' | 'MEDIANO' | 'LARGO' = 'MEDIANO'
              if (mensajeNormalizado.includes('corto')) plazo = 'CORTO'
              else if (mensajeNormalizado.includes('largo')) plazo = 'LARGO'

              const meta = await crearMeta({
                nombre: mensaje.substring(0, 100),
                tipo: tipoMeta, ambito, montoObjetivo: monto, plazo, creadoPor: 'Admin',
              })
              tipo = 'ACCION'
              accionEjecutada = true
              detalleAccion = `Meta creada: ${meta.nombre} (${formatearMoneda(monto)})`
              respuesta = `🎯 Meta creada\n💰 Objetivo: ${formatearMoneda(monto)}\n📋 Tipo: ${tipoMeta}\n📝 Ámbito: ${ambito}\n⏰ Plazo: ${plazo}\n\n💡 Te iré dando seguimiento al progreso.`
            } else {
              tipo = 'TEXTO'
              respuesta = `❌ ${validacion.error}`
            }
          } else {
            tipo = 'TEXTO'
            respuesta = `🎯 Crear meta financiera\n\nEscribe el monto y el tipo, ej:\n• "meta de ahorrar 5.000.000"\n• "meta de comprar vivienda de 50.000.000 largo plazo"\n• "fondo de emergencias de 10 millones"`
          }
          break
        }

        case 'VER_METAS': {
          tipo = 'REPORTE'
          const metas = await db.metaFinanciera.findMany({ where: { estado: 'ACTIVA', ambito } })
          if (metas.length === 0) {
            respuesta = `📋 No tienes metas activas en ${ambito}. Crea una con: "meta de ahorrar 5.000.000"`
          } else {
            respuesta = `🎯 Metas activas (${ambito}) — ${metas.length}:\n\n`
            metas.forEach((m, i) => {
              const progreso = m.montoObjetivo > 0 ? Math.round((m.montoActual / m.montoObjetivo) * 100) : 0
              respuesta += `${i + 1}. ${m.nombre}\n   ${formatearMoneda(m.montoActual)} / ${formatearMoneda(m.montoObjetivo)} (${progreso}%)\n   Plazo: ${m.plazo || 'N/A'}\n\n`
            })
          }
          break
        }

        case 'VER_PRESUPUESTOS': {
          tipo = 'REPORTE'
          const presupuestos = await db.presupuesto.findMany({ where: { activo: true, ambito } })
          if (presupuestos.length === 0) {
            respuesta = `📋 No tienes presupuestos activos en ${ambito}. Crea uno con: "presupuesto de 2.000.000 para alimentación"`
          } else {
            respuesta = `💰 Presupuestos activos (${ambito}) — ${presupuestos.length}:\n\n`
            presupuestos.forEach((p, i) => {
              respuesta += `${i + 1}. ${p.nombre}\n   Límite: ${formatearMoneda(p.montoLimite)} | Período: ${p.periodo}\n\n`
            })
          }
          break
        }

        case 'RECOMENDACIONES': {
          tipo = 'TEXTO'
          const dash = await obtenerDashboard(ambito, 30)
          const k = dash.kpis
          respuesta = `💡 Recomendaciones del día (${ambito}):\n\n`
          if (k.balance < 0) {
            respuesta += `🔴 Balance negativo: reducir gastos en ${dash.topGastos[0]?.categoria || 'categoría principal'}\n`
          }
          if (k.capacidadAhorro < 10) {
            respuesta += `🟡 Capacidad de ahorro baja: apunta al 20%\n`
          }
          if (dash.topGastos.length > 0) {
            respuesta += `📊 Top gasto: ${dash.topGastos[0].categoria} (${formatearMoneda(dash.topGastos[0].monto)})\n`
          }
          respuesta += `\n💡 Escribe "consejos" para consejos detallados o "predicción" para análisis predictivo.`
          break
        }

        case 'PREDICTIVO': {
          tipo = 'REPORTE'
          respuesta = await generarAnalisisPredictivo(ambito)
          break
        }

        case 'CONSEJOS_AHORRO': {
          tipo = 'REPORTE'
          respuesta = await generarConsejosAhorro(ambito)
          break
        }

        case 'PREGUNTAS_FRECUENTES': {
          tipo = 'TEXTO'
          respuesta = generarListaPreguntas()
          break
        }

        case 'MOVIMIENTOS_RECIENTES': {
          tipo = 'REPORTE'
          const movs = await db.movimientoCaja.findMany({
            include: { movimientoCajaExtendido: true },
            orderBy: { fechaMovimiento: 'desc' },
            take: 10,
          })
          const filtrados = movs.filter((m) => !m.movimientoCajaExtendido || m.movimientoCajaExtendido.ambito === ambito)
          if (filtrados.length === 0) {
            respuesta = `📋 No hay movimientos recientes en ${ambito}.`
          } else {
            respuesta = `📋 Movimientos recientes (${ambito}) — ${filtrados.length}:\n\n`
            filtrados.forEach((m, i) => {
              const ext = m.movimientoCajaExtendido
              respuesta += `${i + 1}. [${new Date(m.fechaMovimiento).toLocaleDateString('es-CO')}] ${m.tipo === 'INGRESO' ? '📈' : '📉'} ${formatearMoneda(m.monto)}\n`
              respuesta += `   ${m.concepto}${ext?.subcategoria ? ` (${ext.subcategoria})` : ''}\n`
            })
          }
          break
        }

        case 'CAMBIAR_AMBITO': {
          tipo = 'TEXTO'
          const nuevoAmbito = ambito === 'NEGOCIO' ? 'PERSONAL' : 'NEGOCIO'
          respuesta = `🔄 Ámbito cambiado a ${nuevoAmbito}\n\nAhora verás datos de ${nuevoAmbito === 'PERSONAL' ? 'tus finanzas personales' : 'tu negocio Jsadr'}.\n\n💡 Escribe "dashboard" para ver el balance.`
          break
        }

        case 'CUANTO_GASTAR': {
          // === Recomendación de gasto máximo prudente ===
          // Calcula con base en los últimos 30 días:
          //   - Ingreso promedio mensual
          //   - Gasto fijo promedio (recurrente)
          //   - Balance disponible
          //   - Capacidad de ahorro recomendada (20%)
          // Regla 50/30/20 adaptada a Colombia:
          //   50% necesidades, 30% deseos, 20% ahorro
          tipo = 'REPORTE'
          // Permitir override explícito del ámbito en el mensaje
          const esPersonalQ = /\bpersonal\b/i.test(mensaje) && !/personalizar/i.test(mensaje)
          const esNegocioQ = /\b(?:negocio|empresa)\b/i.test(mensaje)
          const ambitoQ = esPersonalQ ? 'PERSONAL' : (esNegocioQ ? 'NEGOCIO' : ambito)
          try {
            const dash = await obtenerDashboard(ambitoQ, 30)
            const k = dash.kpis
            if (k.ingresos <= 0) {
              respuesta = `📊 No tengo ingresos registrados para ${ambitoQ} en los últimos 30 días.\n\nPara darte una recomendación de gasto primero necesito que registres al menos un ingreso. Ejemplo:\n• "ingreso de 1000000 por venta del negocio"\n• "recibí 500000 de comisión personal"`
            } else {
              const ingresoMensual = k.ingresos
              const gastoFijoMensual = k.gastos * 0.6 // aprox: 60% de gastos son fijos
              const disponibleAntesAhorro = Math.max(0, ingresoMensual - gastoFijoMensual)
              const ahorroRecomendado = ingresoMensual * 0.20
              const gastoMaximoRecomendado = Math.max(0, disponibleAntesAhorro - ahorroRecomendado)
              const gastoDisponibleHoy = gastoMaximoRecomendado / 30

              let estadoRecomendacion = '🟢 SALUDABLE'
              if (k.balance < 0) estadoRecomendacion = '🔴 DÉFICIT'
              else if (k.capacidadAhorro < 10) estadoRecomendacion = '🟠 AJUSTADO'
              else if (k.capacidadAhorro < 20) estadoRecomendacion = '🟡 EQUILIBRADO'

              respuesta = `📊 RECOMENDACIÓN DE GASTO — ${ambitoQ}\n`
              respuesta += `═══ Basado en últimos 30 días ═══\n\n`
              respuesta += `Ingresos del mes:        ${formatearMoneda(ingresoMensual)}\n`
              respuesta += `Gastos del mes:          ${formatearMoneda(k.gastos)}\n`
              respuesta += `Balance actual:          ${formatearMoneda(k.balance)} ${k.balance >= 0 ? '✅' : '⚠️'}\n`
              respuesta += `Estado:                  ${estadoRecomendacion}\n\n`
              respuesta += `═══ REGLA 50/30/20 ADAPTADA ═══\n`
              respuesta += `💼 Gastos necesarios (50%):   ${formatearMoneda(ingresoMensual * 0.50)}\n`
              respuesta += `🎉 Gastos opcionales (30%):   ${formatearMoneda(ingresoMensual * 0.30)}\n`
              respuesta += `🐷 Ahorro recomendado (20%):  ${formatearMoneda(ahorroRecomendado)}\n\n`
              respuesta += `═══ TOPE RECOMENDADO ═══\n`
              respuesta += `Gasto máximo prudente este mes: ${formatearMoneda(gastoMaximoRecomendado)}\n`
              respuesta += `Tope diario sugerido:           ${formatearMoneda(gastoDisponibleHoy)}\n\n`
              if (k.gastos >= gastoMaximoRecomendado) {
                respuesta += `⚠️ ATENCIÓN: ya llevas ${formatearMoneda(k.gastos)} gastados este mes (${Math.round((k.gastos / gastoMaximoRecomendado) * 100)}% del tope).\n`
                respuesta += `💡 Considera pausar gastos opcionales hasta el próximo mes.\n\n`
              } else {
                respuesta += `✅ Aún tienes margen: ${formatearMoneda(gastoMaximoRecomendado - k.gastos)} antes de superar el tope.\n\n`
              }
              respuesta += `💡 Escribe "dashboard" para ver más detalles o "presupuesto" para fijar un tope personalizado.`
            }
          } catch (e) {
            respuesta = `❌ No pude calcular la recomendación: ${e instanceof Error ? e.message : 'error desconocido'}`
          }
          break
        }

        default: {
          // Verificar si es saludo/menú
          if (mensajeNormalizado === 'menu' || mensajeNormalizado === 'hola' || mensajeNormalizado === 'ayuda' || mensajeNormalizado === 'help' || mensajeNormalizado === 'que puedes hacer' || mensajeNormalizado === 'que puedes hacer') {
            tipo = 'TEXTO'
            respuesta = `🤖 MENÚ ASISTENTE PERSONAL\n` +
              `═══ REGISTRO ═══\n` +
              `1️⃣ Registrar gasto (ej: "gasto 50000 en comida")\n` +
              `2️⃣ Registrar ingreso (ej: "ingreso 200000 por venta")\n` +
              `3️⃣ Ver movimientos recientes\n` +
              `4️⃣ Cambiar ámbito (Negocio/Personal)\n` +
              `═══ ANÁLISIS ═══\n` +
              `5️⃣ Dashboard financiero\n` +
              `6️⃣ Gastos por categoría\n` +
              `7️⃣ Ingresos por categoría\n` +
              `8️⃣ Reporte (diario/semanal/mensual/anual)\n` +
              `9️⃣ Comparativo mes anterior\n` +
              `══️ PLANIFICACIÓN ═══\n` +
              `A️⃣ Crear presupuesto\n` +
              `B️⃣ Crear meta financiera\n` +
              `C️⃣ Ver metas activas\n` +
              `D️⃣ Ver presupuestos\n` +
              `═══ INTELIGENCIA ═══\n` +
              `E️⃣ Alertas inteligentes\n` +
              `F️⃣ Recomendaciones del día\n` +
              `G️⃣ Análisis predictivo (30/60/90 días)\n` +
              `H️⃣ Consejos de ahorro\n` +
              `I️⃣ ¿Cuánto es recomendable gastar? (regla 50/30/20)\n` +
              `J️⃣ Preguntas frecuentes\n\n` +
              `💡 Escribe el número, letra o tu instrucción directamente.`
          } else {
            tipo = 'TEXTO'
            respuesta = `🤖 Soy Asistente Personal, tu Personal CFO.\n\n` +
              `No reconocí exactamente tu consulta, pero puedo ayudarte con:\n` +
              `• "gasto de 50000 en gasolina" → registra y clasifica\n` +
              `• "cómo van mis finanzas" → dashboard\n` +
              `• "compara con el mes anterior" → comparativo\n` +
              `• "predicción a 90 días" → análisis predictivo\n` +
              `• "consejos de ahorro" → recomendaciones\n` +
              `• "qué preguntas puedes responder" → lista completa\n\n` +
              `💡 Escribe "menú" para ver todas las opciones.`
          }
        }
      }
    }
  }


  // === SOC AI (seguridad) — usa su propio prompt, no mezclar ===
  else if (botNombre === 'SOC AI') {
    if (mensajeLower.includes('vulnerabilidad') || mensajeLower.includes('riesgo')) {
      tipo = 'REPORTE'
      respuesta = `🛡️ Análisis de vulnerabilidades\n\nEl sistema Jsadr cuenta con:\n✅ Bcrypt rounds=12 para contraseñas\n✅ JWT con secretos del .env\n✅ Rate limiting en APIs sensibles\n✅ Middleware con HTTPS redirect\n✅ CSP headers configurados\n✅ Validación de entrada en APIs\n\n⚠️ Recomendaciones:\n• Configurar MFA en todas las cuentas ADMIN\n• Rotar JWT_SECRET periódicamente\n• Revisar logs de auditoría semanalmente\n• Mantener dependencias actualizadas`
    } else if (mensajeLower.includes('usuario') && mensajeLower.includes('riesgo')) {
      const bloqueados = await db.usuario.count({ where: { bloqueadoHasta: { gt: new Date() } } })
      tipo = 'REPORTE'
      respuesta = `🔍 Usuarios con riesgo:\n\nBloqueados: ${bloqueados}\n\nRevisa en Seguridad → Usuarios los usuarios bloqueados y su historial.`
    } else if (mensajeLower.includes('estado') && mensajeLower.includes('seguridad')) {
      tipo = 'REPORTE'
      respuesta = `🛡️ Estado de seguridad del sistema\n\n✅ Autenticación: Bcrypt + JWT\n✅ Rate limiting: Activo\n✅ Audit log: Inmutable\n✅ MFA: Disponible\n✅ Middleware: HTTPS redirect + HSTS\n✅ CSP: Configurado\n\nNivel general: 🟢 SEGURO\n\n💡 Recomendación: Activar MFA en todas las cuentas ADMIN.`
    } else if (mensajeLower.includes('recomend')) {
      tipo = 'REPORTE'
      respuesta = `💡 Recomendaciones de seguridad:\n\n1. 🔴 Activar MFA en todas las cuentas ADMIN\n2. 🟡 Rotar JWT_SECRET cada 90 días\n3. 🟡 Revisar audit log semanalmente\n4. 🟢 Mantener dependencias actualizadas\n5. 🟢 Verificar backups regularmente`
    } else {
      respuesta = `🛡️ Soy SOC AI, tu Asistente de Ciberseguridad.\n\nEscribe "menú" para ver opciones o pregúntame sobre: vulnerabilidades, riesgos, usuarios, permisos, configuraciones inseguras, recomendaciones de seguridad.\n\n⚠️ Solo hablo de SEGURIDAD. No de finanzas ni otros temas.`
    }
  }

  // === Default: bot no reconocido ===
  else {
    respuesta = `Soy ${botNombre}. Escribe "menú" para ver qué puedo hacer.`
  }

  return NextResponse.json({
    success: true,
    data: { respuesta, tipo, accionEjecutada, detalleAccion },
  })
}

// =====================================================
// Función: obtenerMenuBot
// Retorna el menú específico de cada bot
// =====================================================
function obtenerMenuBot(botTipo: string, botNombre: string): string {
  // SOC AI tiene tipo ADMIN_SISTEMA pero menú propio
  if (botNombre === 'SOC AI') {
    return `🛡️ Hola, soy SOC AI, tu CISO inteligente.

Puedo ayudarte con todo lo relacionado a ciberseguridad del sistema. Pregúntame directamente en lenguaje natural, por ejemplo:

• "¿Cómo está la seguridad hoy?"
• "¿Qué vulnerabilidades encontraste?"
• "¿Qué usuarios tienen riesgo?"
• "¿Qué permisos debo corregir?"
• "Genera un informe ejecutivo de seguridad"
• "Dame un plan de acción priorizado"
• "¿Cuál es el nivel de riesgo actual?"

Solo hablo de SEGURIDAD — finanzas y otros temas los manejan los otros bots.`
  }

  const menus: Record<string, string> = {
    'ADMIN_SISTEMA': `🤖 Soy tu Asistente Personal (Personal CFO). Te ayudo con tus finanzas personales y de negocio.

Puedes pedirme cosas como:
• "Registrar gasto 50.000 en comida"
• "Registrar ingreso 200.000 por venta"
• "Ver mis movimientos recientes"
• "Dashboard financiero"
• "Gastos por categoría"
• "Comparar con el mes anterior"
• "Crear meta de ahorro"
• "Crear presupuesto mensual"
• "Alertas inteligentes"
• "Análisis predictivo"
• "Consejos de ahorro"

También puedes cambiar de ámbito (Negocio/Personal) o pedirme un reporte diario, semanal o mensual. Cuéntame qué necesitas.`,
    'PRESTAMOS': `📋 Soy el Asistente de Solicitudes. Te doy visibilidad completa del módulo de créditos.

Pregúntame en lenguaje natural:
• "¿Cuántos solicitudes activos hay?"
• "¿Qué clientes pueden renovar?"
• "¿Cuál es la utilidad del mes?"
• "¿Cuáles son los más rentables?"
• "¿Cuáles tienen mayor riesgo?"
• "¿Qué vence esta semana?"
• "Simula un crédito de 2M a 6 meses"
• "Dame el dashboard ejecutivo"
• "¿Qué clientes tienen excelente pago?"

También puedo generarte documentos (pagaré, carta) o analizar la concentración por categoría. ¿Qué quieres ver?`,
    'JURIDICO': `⚖️ Soy tu Asesor Jurídico. Te ayudo con casos, cobranzas, redacción y cumplimiento normativo.

Puedes pedirme:
• "Casos activos"
• "¿Quiénes van a jurídico?" (60+ días de mora)
• "Cronología del caso X"
• "¿Cómo cobrar un pagaré?"
• "Redacta un requerimiento"
• "¿Qué dice la Ley de Usura?"
• "Cumplimiento Habeas Data"
• "Derecho del consumidor"
• "Derecho laboral"
• "Portal del abogado"

Si necesitas algo más específico, cuéntame el caso y te oriento.`,
    'SEGURIDAD': `🛡️ Soy tu CISO Inteligente. Monitoreo la ciberseguridad del sistema.

Pregúntame:
• "¿Cómo está la seguridad hoy?"
• "¿Qué vulnerabilidades encontraste?"
• "¿Qué usuarios tienen riesgo?"
• "¿Qué permisos debo corregir?"
• "Genera un informe de seguridad"
• "Dame un plan de acción priorizado"
• "¿Qué accesos sospechosos hubo?"
• "¿Están los backups al día?"
• "Recomendaciones de hoy"

Si quieres bloquear/desbloquear un usuario o activar MFA, también lo hacemos desde aquí.`,
    'ADMIN_GENERAL': `🎯 Soy el Asistente Ejecutivo IA (CEO/COO Digital). Te doy la visión consolidada del negocio.

Puedes pedirme:
• "¿Cómo va el negocio?"
• "Dashboard ejecutivo con todos los KPIs"
• "¿Qué decisiones debo tomar este mes?"
• "¿Qué anomalías detectaste?"
• "Análisis estratégico con recomendaciones"
• "Comparativo con el mes anterior"
• "¿Qué oportunidades detectaste?"
• "Plan de acción priorizado"
• "Auditoría interna"
• "Automatizaciones sugeridas"

Tengo acceso a todos los módulos: financieros, comerciales, operativos. ¿Qué quieres revisar?`,
    'CONFIGURACION': `🚀 Soy DevOps IA, el sentinel always-on del sistema. Monitoreo infraestructura y configuración.

Puedes pedirme:
• "¿Está todo funcionando?"
• "Estado general del sistema"
• "Salud de la base de datos"
• "Uso de disco y memoria"
• "Variables de entorno"
• "Configuración SMTP"
• "Certificados SSL"
• "Backups y restauración"
• "Versiones del sistema"
• "¿Qué problemas detectaste?"
• "Optimiza el sistema"
• "Plan de mejora"

Soy el único bot que no se puede apagar — siempre monitoreando.`,
    'CONTABILIDAD': `📊 Soy tu Experto Financiero (CFO + Asesor Patrimonial). Te ayudo con registro, análisis y planificación financiera.

Puedes decirme:
• "Gasto 50000 en comida"
• "Ingreso 200000 por venta"
• "Dashboard financiero"
• "Gastos por categoría"
• "Reporte mensual"
• "Alertas inteligentes"
• "Comparar con el mes anterior"
• "Crear presupuesto"
• "Crear meta de ahorro"
• "¿Cómo ahorrar más?"
• "¿Es buen momento para invertir?"
• "¿Puedo asumir un crédito?"
• "Análisis predictivo a 90 días"

Tengo acceso a tus deudas, activos, movimientos y metas. ¿Qué necesitas?`,
    'PAGOS': `💼 Soy el Asistente de Cobros. Te doy visibilidad de la cartera y te ayudo a gestionarla.

Pregúntame:
• "¿Cómo está la cartera?"
• "Resumen ejecutivo de hoy"
• "Mora actual (clientes y días)"
• "¿Qué vence hoy?"
• "Próximos vencimientos (7 días)"
• "Recaudo del mes"
• "Indicadores de recuperación"
• "Clientes con mayor riesgo"
• "Análisis estratégico de cobranza"
• "Enviar recordatorios por WhatsApp"
• "Escalar a jurídico"
• "Clientes reincidentes en mora"
• "Clientes con excelente pago"

¿Quieres que empiece con un resumen de la cartera?`,
    'CHAT_CLIENTES': `💬 Soy el Asistente del Portal del Cliente. Estoy aquí para ayudarte con tu solicitud.

Puedes preguntarme en lenguaje natural:
• "¿Cuánto debo?"
• "¿Cuándo es mi próximo pago?"
• "¿Cómo voy con mis cuotas?"
• "Quiero renovar mi crédito"
• "Requisitos para nuevo solicitud"
• "¿Cómo pago?"
• "¿Qué pasa si me atraso?"
• "Cambiar mi PIN"
• "Estado de cuenta PDF"
• "Paz y salvo"
• "Hablar con un asesor humano"

Escribe tu pregunta directamente, no necesitas menús.`,
    'SOC_AI': `🛡️ Hola, soy SOC AI, tu CISO inteligente.

Puedo ayudarte con todo lo relacionado a ciberseguridad del sistema. Pregúntame directamente en lenguaje natural, por ejemplo:

• "¿Cómo está la seguridad hoy?"
• "¿Qué vulnerabilidades encontraste?"
• "¿Qué usuarios tienen riesgo?"
• "¿Qué permisos debo corregir?"
• "Genera un informe ejecutivo de seguridad"
• "Dame un plan de acción priorizado"
• "¿Cuál es el nivel de riesgo actual?"

Solo hablo de SEGURIDAD — finanzas y otros temas los manejan los otros bots.`,
  }

  return menus[botTipo] || `Soy ${botNombre}. Cuéntame qué necesitas y te ayudo.`
}

// =====================================================
// GET /api/admin/portal/chat
// Retorna el historial de mensajes del chat admin-sistema
// con el menú completo de opciones
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const { generarMenuBienvenida } = await import('@/lib/bot-admin-v2')

    const menuCompleto = generarMenuBienvenida()

    const bienvenida = [{
      id: 'bienvenida',
      rol: 'SISTEMA',
      contenido: menuCompleto,
      timestamp: new Date().toISOString(),
      tipo: 'TEXTO',
    }]

    return NextResponse.json({
      success: true,
      data: bienvenida,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
