import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
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
      const montoPendiente = Math.max(0, totalCuotaConMora - totalPagadoCuota)
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
