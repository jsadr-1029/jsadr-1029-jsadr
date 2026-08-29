// =====================================================
// /api/reportes — Dashboard unificado + Proyecciones v4.13
// Combina KPIs operacionales, financieros, proyecciones y reportes
// RBAC: ADMIN, CONSULTOR (lectura), GESTOR (lectura)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import {
  calcularPrestamo,
  calcularDiasMora, getTasaMoraAnual,
  calcularMoraCompuesta,
  debeIrAJuridico,
  formatearMoneda,
} from '@/lib/finanzas'
import { excluirPruebaCliente, excluirPruebaPago, excluirPruebaPrestamo } from '@/lib/cliente-prueba'

export async function GET(req: NextRequest) {
  try {
    // v4.13 (TC-REP-011): CONSULTOR tiene acceso de lectura a reportes
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const rango = searchParams.get('rango') || '30d' // 7d | 30d | 90d | 12m

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const finHoy = new Date()
    finHoy.setHours(23, 59, 59, 999)

    // Rango de fechas según parámetro
    const fechaInicio = new Date()
    switch (rango) {
      case '7d':
        fechaInicio.setDate(fechaInicio.getDate() - 7)
        break
      case '90d':
        fechaInicio.setDate(fechaInicio.getDate() - 90)
        break
      case '12m':
        fechaInicio.setFullYear(fechaInicio.getFullYear() - 1)
        break
      case '30d':
      default:
        fechaInicio.setDate(fechaInicio.getDate() - 30)
    }

    // === CARGA PARALELA DE DATOS ===
    // Los filtros excluyen automáticamente clientes de prueba (esPrueba=true)
    // para que no contaminen los saldos reales del sistema.
    const filtroCliente = excluirPruebaCliente()
    const filtroPrestamo = excluirPruebaPrestamo()
    const filtroPago = excluirPruebaPago()

    const [
      totalClientes,
      totalPrestamos,
      prestamosActivos,
      prestamosMora,
      prestamosJuridicoCount,
      pagosHoy,
      pagosRango,
      todosPrestamos,
      casosJuridicos,
      cajas,
      categorias,
      cuentas,
      totalMovimientos,
      casosJuridicosRecientes,
    ] = await Promise.all([
      db.cliente.count({ where: filtroCliente }),
      db.prestamo.count({ where: filtroPrestamo }),
      db.prestamo.findMany({ where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, ...filtroPrestamo } }),
      db.prestamo.findMany({ where: { estado: 'EN_MORA', ...filtroPrestamo } }),
      db.prestamo.count({ where: { estado: 'JURIDICO', ...filtroPrestamo } }),
      db.pago.findMany({
        where: { fechaPago: { gte: hoy, lte: finHoy }, estado: 'APLICADO', ...filtroPago },
      }),
      db.pago.findMany({
        where: { fechaPago: { gte: fechaInicio }, estado: 'APLICADO', ...filtroPago },
      }),
      db.prestamo.findMany({
        where: { estado: 'ACTIVO', ...filtroPrestamo },
        include: { cliente: true, pagos: true, categoria: true },
      }),
      db.casoJuridico.findMany({ where: { estado: { not: 'CERRADO' }, prestamo: filtroPrestamo } }),
      db.cajaMenor.findMany({
        include: {
          movimientos: { orderBy: { fechaMovimiento: 'desc' }, take: 10 },
          _count: { select: { movimientos: true } },
        },
      }),
      db.categoriaCliente.findMany({ include: { _count: { select: { clientes: true } } } }),
      db.cuentaRecaudo.findMany({
        include: {
          _count: { select: { pagos: true, clientes: true } },
          pagos: {
            where: { estado: 'APLICADO', ...filtroPago },
            select: { montoTotal: true, montoCapital: true, montoInteres: true, montoMora: true },
          },
          clientes: { select: { id: true, nombre: true, cedula: true, activo: true } },
        },
      }),
      db.movimientoCaja.count(),
      db.casoJuridico.findMany({
        where: { estado: { not: 'CERRADO' }, prestamo: filtroPrestamo },
        include: { prestamo: { include: { cliente: true } } },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // === KPIs OPERACIONALES ===
    const carteraTotal = prestamosActivos.reduce((sum, p) => sum + p.saldoTotal, 0)
    const montoEnMora = prestamosMora.reduce((sum, p) => sum + p.saldoTotal, 0)
    const recaudoHoy = pagosHoy.reduce((sum, p) => sum + p.montoTotal, 0)
    const recaudoRango = pagosRango.reduce((sum, p) => sum + p.montoTotal, 0)

    // === FINANCIEROS / PROYECCIONES ===
    let capitalPendiente = 0
    let interesPendiente = 0
    let totalProyectado = 0
    let moraProyectada = 0

    for (const p of prestamosActivos) {
      capitalPendiente += p.saldoCapital
      interesPendiente += p.saldoInteres
      totalProyectado += p.saldoTotal
      moraProyectada += p.montoMora
    }

    // === PROYECCIÓN 30 DÍAS ===
    const proyeccion30Dias: { fecha: string; monto: number; cuotas: number }[] = []
    for (let i = 0; i < 30; i++) {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + i)
      const fechaStr = fecha.toISOString().split('T')[0]
      let montoDia = 0
      let cuotasDia = 0

      for (const prestamo of todosPrestamos) {
        const calculo = calcularPrestamo({
          montoPrincipal: prestamo.montoPrincipal,
          tasaInteresAnual: prestamo.tasaInteresAnual,
          tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
          plazoMeses: prestamo.plazoMeses,
          frecuencia: prestamo.frecuencia as any,
          fechaDesembolso: prestamo.fechaDesembolso || undefined,
        })

        for (const cuota of calculo.tablaAmortizacion) {
          const fechaCuotaStr = cuota.fechaVencimiento.toISOString().split('T')[0]
          if (fechaCuotaStr === fechaStr) {
            const yaPagada = prestamo.pagos.some(
              (p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO'
            )
            if (!yaPagada) {
              montoDia += cuota.montoCuota
              cuotasDia++
            }
          }
        }
      }

      if (montoDia > 0) proyeccion30Dias.push({ fecha: fechaStr, monto: montoDia, cuotas: cuotasDia })
    }

    // === PROYECCIÓN MENSUAL (12 MESES) ===
    const proyeccionMensual: {
      mes: string
      monto: number
      cuotas: number
      capital: number
      interes: number
    }[] = []
    for (let i = 0; i < 12; i++) {
      const fechaMes = new Date()
      fechaMes.setMonth(fechaMes.getMonth() + i)
      const mesKey = `${fechaMes.getFullYear()}-${String(fechaMes.getMonth() + 1).padStart(2, '0')}`
      const mesNombre = fechaMes.toLocaleString('es-CO', { month: 'short', year: 'numeric' })
      let montoMes = 0
      let cuotasMes = 0
      let capitalMes = 0
      let interesMes = 0

      for (const prestamo of todosPrestamos) {
        const calculo = calcularPrestamo({
          montoPrincipal: prestamo.montoPrincipal,
          tasaInteresAnual: prestamo.tasaInteresAnual,
          tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
          plazoMeses: prestamo.plazoMeses,
          frecuencia: prestamo.frecuencia as any,
          fechaDesembolso: prestamo.fechaDesembolso || undefined,
        })

        for (const cuota of calculo.tablaAmortizacion) {
          const cuotaMesKey = `${cuota.fechaVencimiento.getFullYear()}-${String(
            cuota.fechaVencimiento.getMonth() + 1
          ).padStart(2, '0')}`
          if (cuotaMesKey === mesKey) {
            const yaPagada = prestamo.pagos.some(
              (p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO'
            )
            if (!yaPagada) {
              montoMes += cuota.montoCuota
              capitalMes += cuota.capital
              interesMes += cuota.interes
              cuotasMes++
            }
          }
        }
      }

      proyeccionMensual.push({
        mes: mesNombre,
        monto: montoMes,
        cuotas: cuotasMes,
        capital: capitalMes,
        interes: interesMes,
      })
    }

    // === POR CATEGORÍA ===
    const porCategoriaRaw = await db.prestamo.groupBy({
      by: ['categoriaId'],
      where: filtroPrestamo,
      _count: true,
      _sum: { montoPrincipal: true, saldoTotal: true },
    })

    const categoriasMap = new Map(categorias.map((c) => [c.id, c]))
    const porCategoria = porCategoriaRaw.map((g) => ({
      categoria: categoriasMap.get(g.categoriaId || '')?.nombre || 'Sin categoría',
      codigo: categoriasMap.get(g.categoriaId || '')?.codigo || '—',
      count: g._count,
      montoPrincipal: g._sum.montoPrincipal || 0,
      saldoTotal: g._sum.saldoTotal || 0,
    }))

    // === POR CLIENTE (TOP 15) ===
    const prestamosConCliente = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, ...filtroPrestamo },
      include: { cliente: true },
    })

    const clienteMap = new Map<
      string,
      { clienteId: string; nombre: string; cedula: string; saldoTotal: number; prestamos: number }
    >()

    for (const p of prestamosConCliente) {
      const key = p.clienteId
      const existing = clienteMap.get(key)
      if (existing) {
        existing.saldoTotal += p.saldoTotal
        existing.prestamos++
      } else {
        clienteMap.set(key, {
          clienteId: p.clienteId,
          nombre: p.cliente.nombre,
          cedula: p.cliente.cedula,
          saldoTotal: p.saldoTotal,
          prestamos: 1,
        })
      }
    }

    const porCliente = Array.from(clienteMap.values())
      .sort((a, b) => b.saldoTotal - a.saldoTotal)
      .slice(0, 15)

    // === POR SOLICITUD (TOP 20) ===
    const porPrestamo = prestamosConCliente
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        cliente: p.cliente.nombre,
        cedula: p.cliente.cedula,
        montoPrincipal: p.montoPrincipal,
        saldoTotal: p.saldoTotal,
        estado: p.estado,
        diasMora: p.diasMora,
        fechaVencimiento: p.fechaVencimiento,
      }))
      .sort((a, b) => b.saldoTotal - a.saldoTotal)
      .slice(0, 20)

    // === RESUMEN POR ESTADO ===
    const resumenEstados = await db.prestamo.groupBy({
      by: ['estado'],
      where: filtroPrestamo,
      _count: true,
      _sum: { saldoTotal: true, montoPrincipal: true },
    })

    // === ALERTAS JURÍDICO (solicitudes que superan 60 días de mora) ===
    const alertasJuridico: any[] = []
    for (const p of prestamosMora) {
      const diasMora = await calcularDiasMoraPrestamo(p.id)
      if (debeIrAJuridico(diasMora)) {
        alertasJuridico.push({
          id: p.id,
          codigo: p.codigo,
          diasMora,
          saldoTotal: p.saldoTotal,
        })
      }
    }

    // === RESPUESTA UNIFICADA ===
    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalClientes,
          totalPrestamos,
          carteraTotal,
          montoEnMora,
          cantidadEnMora: prestamosMora.length,
          recaudoHoy,
          recaudoRango,
          cantidadPagosHoy: pagosHoy.length,
          cantidadPagosRango: pagosRango.length,
          casosJuridicos: prestamosJuridicoCount,
          casosJuridicosActivos: casosJuridicos.length,
          totalMovimientosCajas: totalMovimientos,
        },
        financieros: {
          capitalPendiente,
          interesPendiente,
          totalProyectado,
          moraProyectada,
          // Ratio de mora sobre cartera total
          ratioMora: carteraTotal > 0 ? (montoEnMora / carteraTotal) * 100 : 0,
          // Rentabilidad esperada (interés pendiente / capital pendiente)
          rentabilidadEsperada:
            capitalPendiente > 0 ? (interesPendiente / capitalPendiente) * 100 : 0,
        },
        proyeccion30Dias,
        proyeccionMensual,
        porCategoria,
        porCliente,
        porPrestamo,
        resumenEstados,
        cajas,
        categorias,
        cuentas,
        casosJuridicosRecientes,
        alertasJuridico,
        metadata: {
          rango,
          fechaGeneracion: new Date().toISOString(),
          moneda: 'COP',
        },
      },
    })
  } catch (error) {
    logError('/api/reportes GET', error)
    return errorResponse('/api/reportes GET', error)
  }
}

async function calcularDiasMoraPrestamo(prestamoId: string): Promise<number> {
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { pagos: true },
  })
  if (!prestamo) return 0

  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: prestamo.fechaDesembolso || undefined,
  })

  let maxDiasMora = 0
  for (const cuota of calculo.tablaAmortizacion) {
    const pagada = prestamo.pagos.some(
      (p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO'
    )
    if (!pagada) {
      const dias = calcularDiasMora(cuota.fechaVencimiento)
      if (dias > maxDiasMora) maxDiasMora = dias
    }
  }
  return maxDiasMora
}
