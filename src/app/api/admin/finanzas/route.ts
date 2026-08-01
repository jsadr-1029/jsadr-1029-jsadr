// =====================================================
// /api/admin/finanzas — Movimientos financieros (Módulo 6)
// Contabilidad unificada: gastos personales, ingresos, flujo de caja,
// recomendaciones automáticas y proyectos futuros vinculados.
//
//   GET    → lista movimientos (con filtros ?tipo=&categoria=&desde=&hasta=)
//   POST   → crea un nuevo movimiento
//   DELETE → elimina un movimiento (?id=)
//   PATCH  → actualiza un movimiento
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// =====================================================
// GET — Listar movimientos + resumen + recomendaciones + proyectos
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') // INGRESO | GASTO
    const categoria = searchParams.get('categoria')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const resumen = searchParams.get('resumen') === 'true'
    const ambito = searchParams.get('ambito') // NEGOCIO | PERSONAL
    const dashboard = searchParams.get('dashboard') === 'true'

    const where: any = {}
    if (tipo && ['INGRESO', 'GASTO'].includes(tipo)) where.tipo = tipo
    if (categoria) where.categoria = categoria
    if (ambito && ['NEGOCIO', 'PERSONAL'].includes(ambito)) where.ambito = ambito
    if (desde || hasta) {
      where.fecha = {}
      if (desde) where.fecha.gte = new Date(desde)
      if (hasta) where.fecha.lte = new Date(hasta)
    }

    const movimientos = await db.movimientoFinanciero.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 500,
    })

    // === DASHBOARD: estadísticas detalladas para toma de decisiones ===
    if (dashboard) {
      const ahora = new Date()
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

      // Filtrar por ámbito si se especifica
      const whereAmbito = ambito ? { ambito } : {}
      const whereMes = { ...whereAmbito, fecha: { gte: inicioMes } }

      const movsMes = await db.movimientoFinanciero.findMany({ where: whereMes })
      const movsTodos = await db.movimientoFinanciero.findMany({ where: whereAmbito })

      const ingresosMes = movsMes.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
      const gastosMes = movsMes.filter((m) => m.tipo === 'GASTO').reduce((s, m) => s + m.monto, 0)
      const balanceMes = ingresosMes - gastosMes

      // === Estadísticas por categoría (gastos) ===
      const gastosPorCategoria: Record<string, number> = {}
      movsMes.filter((m) => m.tipo === 'GASTO').forEach((m) => {
        gastosPorCategoria[m.categoria] = (gastosPorCategoria[m.categoria] || 0) + m.monto
      })
      const totalGastos = Object.values(gastosPorCategoria).reduce((s, v) => s + v, 0)
      const gastosPorCategoriaArray = Object.entries(gastosPorCategoria)
        .map(([cat, monto]) => ({
          categoria: cat,
          monto,
          porcentaje: totalGastos > 0 ? (monto / totalGastos) * 100 : 0,
        }))
        .sort((a, b) => b.monto - a.monto)

      // === Estadísticas por categoría (ingresos) ===
      const ingresosPorCategoria: Record<string, number> = {}
      movsMes.filter((m) => m.tipo === 'INGRESO').forEach((m) => {
        ingresosPorCategoria[m.categoria] = (ingresosPorCategoria[m.categoria] || 0) + m.monto
      })
      const totalIngresosCat = Object.values(ingresosPorCategoria).reduce((s, v) => s + v, 0)
      const ingresosPorCategoriaArray = Object.entries(ingresosPorCategoria)
        .map(([cat, monto]) => ({
          categoria: cat,
          monto,
          porcentaje: totalIngresosCat > 0 ? (monto / totalIngresosCat) * 100 : 0,
        }))
        .sort((a, b) => b.monto - a.monto)

      // === Estadísticas por método de pago ===
      const porMetodoPago: Record<string, number> = {}
      movsMes.forEach((m) => {
        const metodo = m.metodoPago || 'NO_ESPECIFICADO'
        porMetodoPago[metodo] = (porMetodoPago[metodo] || 0) + m.monto
      })

      // === Separar ingresos del negocio (cuotas de clientes) vs personales ===
      const ingresosNegocio = movsMes
        .filter((m) => m.tipo === 'INGRESO' && m.ambito === 'NEGOCIO')
        .reduce((s, m) => s + m.monto, 0)
      const ingresosPersonal = movsMes
        .filter((m) => m.tipo === 'INGRESO' && m.ambito === 'PERSONAL')
        .reduce((s, m) => s + m.monto, 0)
      const gastosNegocio = movsMes
        .filter((m) => m.tipo === 'GASTO' && m.ambito === 'NEGOCIO')
        .reduce((s, m) => s + m.monto, 0)
      const gastosPersonal = movsMes
        .filter((m) => m.tipo === 'GASTO' && m.ambito === 'PERSONAL')
        .reduce((s, m) => s + m.monto, 0)

      // === Comparativo mes actual vs mes anterior ===
      const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
      const finMesAnt = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59)
      const whereMesAnt = { ...whereAmbito, fecha: { gte: inicioMesAnt, lte: finMesAnt } }
      const movsMesAnt = await db.movimientoFinanciero.findMany({ where: whereMesAnt })
      const ingresosAnt = movsMesAnt.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
      const gastosAnt = movsMesAnt.filter((m) => m.tipo === 'GASTO').reduce((s, m) => s + m.monto, 0)

      // === Promedio diario de gastos ===
      const diasMes = ahora.getDate()
      const promedioGastoDiario = diasMes > 0 ? gastosMes / diasMes : 0
      const promedioIngresoDiario = diasMes > 0 ? ingresosMes / diasMes : 0

      // === Proyección de fin de mes ===
      const diasEnMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()
      const proyeccionIngresos = promedioIngresoDiario * diasEnMes
      const proyeccionGastos = promedioGastoDiario * diasEnMes
      const proyeccionBalance = proyeccionIngresos - proyeccionGastos

      // === Totales históricos ===
      const totalIngresosHist = movsTodos.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
      const totalGastosHist = movsTodos.filter((m) => m.tipo === 'GASTO').reduce((s, m) => s + m.monto, 0)

      return NextResponse.json({
        success: true,
        data: {
          // === KPIs principales del mes ===
          kpis: {
            ingresosMes,
            gastosMes,
            balanceMes,
            ingresosAnt,
            gastosAnt,
            variacionIngresos: ingresosAnt > 0 ? ((ingresosMes - ingresosAnt) / ingresosAnt) * 100 : 0,
            variacionGastos: gastosAnt > 0 ? ((gastosMes - gastosAnt) / gastosAnt) * 100 : 0,
          },
          // === Separación Negocio vs Personal ===
          separacion: {
            ingresosNegocio,
            ingresosPersonal,
            gastosNegocio,
            gastosPersonal,
            balanceNegocio: ingresosNegocio - gastosNegocio,
            balancePersonal: ingresosPersonal - gastosPersonal,
          },
          // === Gastos por categoría ===
          gastosPorCategoria: gastosPorCategoriaArray,
          // === Ingresos por categoría ===
          ingresosPorCategoria: ingresosPorCategoriaArray,
          // === Por método de pago ===
          porMetodoPago,
          // === Promedios y proyecciones ===
          proyecciones: {
            promedioGastoDiario,
            promedioIngresoDiario,
            diasTranscurridos: diasMes,
            diasEnMes,
            proyeccionIngresos,
            proyeccionGastos,
            proyeccionBalance,
          },
          // === Totales históricos ===
          totalesHistoricos: {
            totalIngresos: totalIngresosHist,
            totalGastos: totalGastosHist,
            balanceTotal: totalIngresosHist - totalGastosHist,
            numMovimientos: movsTodos.length,
          },
          // === Últimos 10 movimientos ===
          ultimosMovimientos: movimientos.slice(0, 10),
          // === Filtro activo ===
          ambito: ambito || 'TODOS',
        },
      })
    }

    if (resumen) {
      // === Resumen de flujo de caja (mes actual y mes anterior) ===
      const ahora = new Date()
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
      const finMesAnt = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59)

      const movsMesActual = await db.movimientoFinanciero.findMany({
        where: { fecha: { gte: inicioMes } },
      })
      const movsMesAnterior = await db.movimientoFinanciero.findMany({
        where: { fecha: { gte: inicioMesAnt, lte: finMesAnt } },
      })

      const ingresosMes = movsMesActual
        .filter((m) => m.tipo === 'INGRESO')
        .reduce((s, m) => s + m.monto, 0)
      const gastosMes = movsMesActual
        .filter((m) => m.tipo === 'GASTO')
        .reduce((s, m) => s + m.monto, 0)
      const ingresosAnt = movsMesAnterior
        .filter((m) => m.tipo === 'INGRESO')
        .reduce((s, m) => s + m.monto, 0)
      const gastosAnt = movsMesAnterior
        .filter((m) => m.tipo === 'GASTO')
        .reduce((s, m) => s + m.monto, 0)

      // Totales globales
      const totalIngresos = movimientos
        .filter((m) => m.tipo === 'INGRESO')
        .reduce((s, m) => s + m.monto, 0)
      const totalGastos = movimientos
        .filter((m) => m.tipo === 'GASTO')
        .reduce((s, m) => s + m.monto, 0)

      // === Proyectos futuros vinculados al plan financiero ===
      const proyectosFuturos = await db.planEstrategicoFinanciero.findMany({
        where: {
          estado: { in: ['BORRADOR', 'ACTIVO', 'EN_REVISION'] },
          fechaInicio: { gte: ahora },
        },
        orderBy: { fechaInicio: 'asc' },
        take: 10,
      })

      // === Recomendaciones automáticas ===
      const recomendaciones: { tipo: string; titulo: string; detalle: string; severidad: 'INFO' | 'WARN' | 'ALERT' }[] = []

      const balanceMes = ingresosMes - gastosMes
      const balanceAnt = ingresosAnt - gastosAnt
      const ratioGastoIngreso = ingresosMes > 0 ? gastosMes / ingresosMes : 1

      if (balanceMes < 0) {
        recomendaciones.push({
          tipo: 'NEGATIVE_BALANCE',
          titulo: 'Flujo de caja negativo este mes',
          detalle: `Este mes los gastos (${formatCOP(gastosMes)}) superan los ingresos (${formatCOP(ingresosMes)}). Revisa gastos en categorías altas.`,
          severidad: 'ALERT',
        })
      } else if (balanceMes > 0 && balanceMes > ingresosMes * 0.3) {
        recomendaciones.push({
          tipo: 'POSITIVE_BALANCE',
          titulo: 'Buen margen de ahorro',
          detalle: `El balance del mes es positivo (${formatCOP(balanceMes)}). Considera destinar parte a inversión o un proyecto futuro.`,
          severidad: 'INFO',
        })
      }

      if (ratioGastoIngreso > 0.8 && ingresosMes > 0) {
        recomendaciones.push({
          tipo: 'HIGH_EXPENSE_RATIO',
          titulo: 'Ratio gastos/ingresos alto',
          detalle: `Estás gastando el ${(ratioGastoIngreso * 100).toFixed(0)}% de lo que ingresas. Reduce gastos operativos para mejorar la liquidez.`,
          severidad: 'WARN',
        })
      }

      if (balanceAnt < balanceMes && balanceAnt !== 0) {
        recomendaciones.push({
          tipo: 'IMPROVEMENT',
          titulo: 'Mejora frente al mes anterior',
          detalle: `El balance mejoró de ${formatCOP(balanceAnt)} a ${formatCOP(balanceMes)}. ¡Sigue así!`,
          severidad: 'INFO',
        })
      } else if (balanceAnt > balanceMes && balanceAnt !== 0) {
        recomendaciones.push({
          tipo: 'DECLINE',
          titulo: 'Empeoramiento frente al mes anterior',
          detalle: `El balance bajó de ${formatCOP(balanceAnt)} a ${formatCOP(balanceMes)}. Identifica el origen del desfase.`,
          severidad: 'WARN',
        })
      }

      // Top categoría de gasto
      const porCategoria: Record<string, number> = {}
      movsMesActual
        .filter((m) => m.tipo === 'GASTO')
        .forEach((m) => {
          porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + m.monto
        })
      const topCategoria = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0]
      if (topCategoria) {
        recomendaciones.push({
          tipo: 'TOP_CATEGORY',
          titulo: `Mayor categoría de gasto: ${topCategoria[0]}`,
          detalle: `Este mes gastaste ${formatCOP(topCategoria[1])} en ${topCategoria[0]}. Evalúa si es proporcional a tus ingresos.`,
          severidad: 'INFO',
        })
      }

      // Proyectos vinculados
      if (proyectosFuturos.length > 0) {
        recomendaciones.push({
          tipo: 'FUTURE_PROJECTS',
          titulo: `${proyectosFuturos.length} proyecto(s) futuro(s) vinculado(s) al plan`,
          detalle: proyectosFuturos
            .map((p) => `• ${p.nombre} (inicio ${new Date(p.fechaInicio).toLocaleDateString()}) — presupuesto ${formatCOP(p.presupuestoInversion)}`)
            .join('\n'),
          severidad: 'INFO',
        })
      }

      return NextResponse.json({
        success: true,
        data: movimientos,
        resumen: {
          totalIngresos,
          totalGastos,
          balance: totalIngresos - totalGastos,
          mesActual: {
            ingresos: ingresosMes,
            gastos: gastosMes,
            balance: balanceMes,
          },
          mesAnterior: {
            ingresos: ingresosAnt,
            gastos: gastosAnt,
            balance: balanceAnt,
          },
        },
        recomendaciones,
        proyectosFuturos,
      })
    }

    return NextResponse.json({ success: true, data: movimientos })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

function formatCOP(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor || 0)
}

// =====================================================
// POST — Crear movimiento
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { tipo, categoria, descripcion, monto, fecha, metodoPago, responsable, notas, planFinancieroId, ambito } = body

    if (!tipo || !categoria || !descripcion || monto === undefined) {
      return NextResponse.json(
        { success: false, error: 'tipo, categoria, descripcion y monto son requeridos' },
        { status: 400 }
      )
    }

    if (!['INGRESO', 'GASTO'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'tipo debe ser INGRESO o GASTO' },
        { status: 400 }
      )
    }

    const nuevo = await db.movimientoFinanciero.create({
      data: {
        tipo,
        categoria,
        descripcion,
        monto: parseFloat(monto),
        fecha: fecha ? new Date(fecha) : new Date(),
        metodoPago: metodoPago || null,
        responsable: responsable || auth.username || null,
        notas: notas || null,
        ambito: (ambito === 'PERSONAL' ? 'PERSONAL' : 'NEGOCIO'),
        planFinancieroId: planFinancieroId || null,
      },
    })

    return NextResponse.json({ success: true, data: nuevo })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// PATCH — Actualizar movimiento
// =====================================================
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { id, tipo, categoria, descripcion, monto, fecha, metodoPago, responsable, notas, planFinancieroId } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      )
    }

    const datos: any = {}
    if (tipo !== undefined && ['INGRESO', 'GASTO'].includes(tipo)) datos.tipo = tipo
    if (categoria !== undefined) datos.categoria = categoria
    if (descripcion !== undefined) datos.descripcion = descripcion
    if (monto !== undefined) datos.monto = parseFloat(monto)
    if (fecha !== undefined) datos.fecha = new Date(fecha)
    if (metodoPago !== undefined) datos.metodoPago = metodoPago
    if (responsable !== undefined) datos.responsable = responsable
    if (notas !== undefined) datos.notas = notas
    if (planFinancieroId !== undefined) datos.planFinancieroId = planFinancieroId

    const actualizado = await db.movimientoFinanciero.update({
      where: { id },
      data: datos,
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — Eliminar movimiento
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      )
    }

    await db.movimientoFinanciero.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
