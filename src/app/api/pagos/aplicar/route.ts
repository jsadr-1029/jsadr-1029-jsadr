import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
  calcularCargosInicialesPendientes,
} from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'

// GET - buscar préstamos activos con cuotas pendientes y sugerir cuenta de recaudo
// Incluye desglose completo: cuota base + mora diaria + pendiente anterior - pagado
export async function GET(req: NextRequest) {
  try {
    // Reforzado: rate limit específico + auth
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`pagos-aplicar:${clientInfo.ip}`, 20)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''

    // Buscar préstamos activos o en mora, con cliente y categoría
    const where: any = {
      estado: { in: ['ACTIVO', 'EN_MORA'] },
    }
    if (q) {
      where.OR = [
        { codigo: { contains: q } },
        { cliente: { nombre: { contains: q } } },
        { cliente: { cedula: { contains: q } } },
        { cliente: { telefono: { contains: q } } },
      ]
    }

    const prestamos = await db.prestamo.findMany({
      where,
      include: {
        cliente: {
          include: {
            cuentaRecaudo: true,
            categoria: { include: { cuentaRecaudo: true } },
          },
        },
        categoria: { include: { cuentaRecaudo: true } },
        pagos: {
          where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } },
          orderBy: { numeroCuota: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Para cada préstamo, calcular cuota pendiente, mora en tiempo real y desglose
    const resultados = prestamos.map((p) => {
      // Calcular cuántas cuotas están completamente pagadas
      const cuotasPagadasSet = new Set(
        p.pagos.filter(pg => pg.estado === 'APLICADO').map(pg => pg.numeroCuota)
      )
      const cuotasPagadasCompletamente = cuotasPagadasSet.size

      const proximaCuota = cuotasPagadasCompletamente + 1

      // Calcular fecha de vencimiento de la próxima cuota
      const calculo = calcularPrestamo({
        montoPrincipal: p.montoPrincipal,
        tasaInteresAnual: p.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(p),
        plazoMeses: p.plazoMeses,
        frecuencia: p.frecuencia as any,
        fechaDesembolso: p.fechaDesembolso || p.fechaSolicitud,
      })

      const cuotaPendiente = calculo.tablaAmortizacion.find((c) => c.numero === proximaCuota)
      const fechaVencimiento = cuotaPendiente?.fechaVencimiento

      // === Pagos ya realizados para ESTA cuota (parciales) ===
      const pagosCuota = p.pagos.filter(pg => pg.numeroCuota === proximaCuota)
      const capitalPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoCapital, 0)
      const interesPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoInteres, 0)
      const moraPagadaCuota = pagosCuota.reduce((s, pg) => s + pg.montoMora, 0)
      const totalPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoTotal, 0)

      // === Calcular mora en tiempo real ===
      let diasMora = 0
      let moraActual = 0
      let moraDiariaPesos = 0
      let moraRenegociadaAplicada = false
      if (fechaVencimiento) {
        diasMora = calcularDiasMora(fechaVencimiento)
        moraActual = diasMora > 0
          ? calcularMoraCompuesta(p.montoPrincipal, p.tasaMoraDiaria, diasMora)
          : 0
        // Cuánto crece la mora por día adicional de atraso
        moraDiariaPesos = (p.montoPrincipal * p.tasaMoraDiaria) / 100
      }

      // === Aplicar mora renegociada si existe (anula o reemplaza el cálculo automático) ===
      if (p.moraRenegociada !== null && p.moraRenegociada !== undefined) {
        moraActual = p.moraRenegociada
        // Si la mora fue renegociada, la mora diaria deja de crecer automáticamente
        moraDiariaPesos = 0
        moraRenegociadaAplicada = true
      }

      const moraPendiente = Math.max(0, moraActual - moraPagadaCuota)
      const cuotaBase = cuotaPendiente?.montoCuota || p.montoCuota
      const totalCuotaConMora = cuotaBase + moraPendiente

      // === FIX Task 12: Cargos iniciales en cuota 1 ===
      // Si la próxima cuota es la #1 y hay cargos iniciales pendientes (pagaré,
      // tarifa plataforma, flexibilidad financiera, fondo garantía), se suman
      // al total a pagar para que el cliente los pague junto con la cuota 1.
      //
      // Política: el texto del estado de cuenta dice "Este cargo se aplica una
      // sola vez al inicio del crédito y está incluido en la primera cuota."
      // Por eso solo se suman cuando proximaCuota === 1.
      const cargosInicialesInfo = proximaCuota === 1
        ? calcularCargosInicialesPendientes(p)
        : { cargos: [], totalPendiente: 0, totalConfigurado: 0, totalYaCobrado: 0 }
      // Si la cuota 1 ya fue aplicada (legacy), los cargos del pagaré y del
      // fondo de garantía (que no tienen flag propio de "aplicado") se consideran cobrados.
      const cuota1Aplicada = p.pagos.some(pg => pg.numeroCuota === 1 && pg.estado === 'APLICADO')
      const cargosInicialesInfoAjustada = {
        ...cargosInicialesInfo,
        cargos: cargosInicialesInfo.cargos.map(c => {
          if (c.concepto === 'PAGARE_CARTA' && cuota1Aplicada) return { ...c, yaCobrado: true }
          if (c.concepto === 'FONDO_GARANTIA' && cuota1Aplicada) return { ...c, yaCobrado: true }
          return c
        }),
      }
      const cargosInicialesPendientesMonto = proximaCuota === 1
        ? cargosInicialesInfoAjustada.cargos.filter(c => !c.yaCobrado).reduce((s, c) => s + c.monto, 0)
        : 0
      const totalCuotaConCargos = totalCuotaConMora + cargosInicialesPendientesMonto

      const montoPendiente = Math.max(0, totalCuotaConCargos - totalPagadoCuota)
      const montoTotalPendiente = montoPendiente

      // === Resolución de cuenta de recaudo con prioridad correcta ===
      // 1. Instrucción temporal activa del cliente
      // 2. Cuenta asignada directamente al cliente (cliente.cuentaRecaudoId)
      // 3. Cuenta de la categoría del cliente (cliente.categoria.cuentaRecaudo)
      // 4. Cuenta de la categoría del préstamo (p.categoria.cuentaRecaudo)
      const instruccionActiva = p.cliente.instruccionCuentaId &&
        (!p.cliente.instruccionCuentaExpira || new Date(p.cliente.instruccionCuentaExpira) > new Date())
      const cuentaRecaudo = instruccionActiva
        ? null // la instrucción se resuelve en el backend; el frontend manda null y el POST la resuelve
        : (p.cliente.cuentaRecaudo || p.cliente.categoria?.cuentaRecaudo || p.categoria?.cuentaRecaudo || null)
      const cuentaOrigen = instruccionActiva
        ? 'INSTRUCCION_TEMPORAL'
        : p.cliente.cuentaRecaudo
        ? 'CLIENTE'
        : p.cliente.categoria?.cuentaRecaudo
        ? 'CATEGORIA_CLIENTE'
        : p.categoria?.cuentaRecaudo
        ? 'CATEGORIA_PRESTAMO'
        : 'SIN_CUENTA'

      return {
        id: p.id,
        codigo: p.codigo,
        cliente: {
          id: p.cliente.id,
          nombre: p.cliente.nombre,
          cedula: p.cliente.cedula,
          telefono: p.cliente.telefono,
        },
        montoPrincipal: p.montoPrincipal,
        montoCuota: p.montoCuota,
        numeroCuotas: p.numeroCuotas,
        cuotasPagadas: cuotasPagadasCompletamente,
        proximaCuota,
        cuotaPendiente,
        fechaVencimiento,
        // Mora en tiempo real
        diasMora,
        moraActual,
        moraPagadaCuota,
        moraPendiente,
        moraDiariaPesos,
        tasaMoraDiaria: p.tasaMoraDiaria,
        // === Info de renegociación ===
        moraRenegociada: p.moraRenegociada,
        moraRenegociadaAccion: p.moraRenegociadaAccion,
        moraRenegociadaFecha: p.moraRenegociadaFecha,
        moraRenegociadaPorNombre: p.moraRenegociadaPorNombre,
        moraRenegociadaObservacion: p.moraRenegociadaObservacion,
        moraRenegociadaMoraOriginal: p.moraRenegociadaMoraOriginal,
        moraRenegociadaAplicada,
        // Pagos acumulados en esta cuota
        capitalPagadoCuota,
        interesPagadoCuota,
        totalPagadoCuota,
        // Totales
        cuotaBase,
        totalCuotaConMora,
        montoPendiente,
        montoTotalPendiente,
        saldoTotal: p.saldoTotal,
        estado: p.estado,
        cuentaRecaudo: cuentaRecaudo
          ? {
              id: cuentaRecaudo.id,
              banco: cuentaRecaudo.banco,
              tipoCuenta: cuentaRecaudo.tipoCuenta,
              numeroCuenta: cuentaRecaudo.numeroCuenta,
              titular: cuentaRecaudo.titular,
              nombre: cuentaRecaudo.nombre,
              codigo: cuentaRecaudo.codigo,
            }
          : null,
        cuentaOrigen,
        tieneInstruccionTemporal: instruccionActiva,
        instruccionCuentaNota: instruccionActiva ? p.cliente.instruccionCuentaNota : null,
        instruccionCuentaExpira: instruccionActiva ? p.cliente.instruccionCuentaExpira : null,
        frecuencia: p.frecuencia,
        // === Tarea Q: Flexibilidad Financiera — info para habilitar el botón de uso ===
        flexibilidadFinanciera: p.flexibilidadFinanciera,
        flexibilidadActivada: p.flexibilidadActivada,
        flexibilidadModalidad: p.flexibilidadModalidad,
        flexibilidadUsosDisponibles: p.flexibilidadUsosDisponibles,
        flexibilidadUsosEjercidos: p.flexibilidadUsosEjercidos,
        flexibilidadCosto: p.flexibilidadCosto,
        // ¿El préstamo califica para usar flexibilidad en esta cuota?
        // Reglas: >=4 cuotas, 1ra cuota pagada, próxima cuota >= 2 (no desde prima), usos disponibles
        flexibilidadElegible:
          p.flexibilidadActivada === true &&
          p.flexibilidadUsosDisponibles > 0 &&
          p.numeroCuotas >= 4 &&
          cuotasPagadasCompletamente >= 1 &&
          proximaCuota >= 2,
        flexibilidadRazonInelegible: !(p.flexibilidadActivada === true)
          ? 'El beneficio no está activado para este crédito'
          : p.flexibilidadUsosDisponibles <= 0
          ? 'Ya no quedan usos disponibles (se consumieron todos)'
          : p.numeroCuotas < 4
          ? `El crédito tiene ${p.numeroCuotas} cuotas; flexibilidad requiere mínimo 4`
          : cuotasPagadasCompletamente < 1
          ? 'La primera cuota (prima) debe estar paga para usar el beneficio'
          : proximaCuota < 2
          ? 'No se puede usar flexibilidad desde la prima (primera cuota)'
          : null,
        // === FIX Task 12: información de cargos iniciales en cuota 1 ===
        // Para que el frontend muestre el monto correcto a pagar (cuota + cargos)
        // y el detalle de los conceptos incluidos.
        cargosInicialesPendientes: cargosInicialesInfoAjustada.cargos.filter(c => !c.yaCobrado),
        cargosInicialesPendientesMonto,
        totalCuotaConCargos,  // con cargos (lo que el cliente debe pagar)
      }
    })

    return NextResponse.json({ success: true, data: resultados })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
