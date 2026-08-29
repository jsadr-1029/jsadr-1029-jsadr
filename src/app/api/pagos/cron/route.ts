import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { calcularPrestamo, calcularDiasMora, getTasaMoraAnual, calcularMoraCompuesta } from '@/lib/finanzas'

// =====================================================
// /api/pagos/cron v4.0 — OLA 3
// Endpoint de mantenimiento diario. Se llama con un cron externo
// (vercel cron, systemd timer, etc.).
// Auth: requiere header X-Cron-Secret igual a process.env.CRON_SECRET
// (si no está seteado, solo permite en dev).
//
// Acciones:
//  1. Marcar como VENCIDO los pagos PENDIENTE con linkExpira < now
//  2. Regenerar tabla PagoProgramado para todos los solicitudes activos
//  3. Actualizar diasMora y moraCalculada en PagoProgramado
// =====================================================

export async function POST(req: NextRequest) {
  try {
    // Auth simple por secret compartido
    const cronSecret = process.env.CRON_SECRET
    const headerSecret = req.headers.get('x-cron-secret')
    if (cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }
    if (!cronSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'CRON_SECRET no configurado' }, { status: 500 })
    }

    const resultado: any = {
      timestamp: new Date().toISOString(),
      linksExpirados: 0,
      pagosProgramadosActualizados: 0,
      pagosProgramadosCreados: 0,
      errores: [] as string[],
    }

    // === 1. Limpiar links PENDIENTE expirados ===
    const linksExpirados = await db.pago.updateMany({
      where: {
        estado: 'PENDIENTE',
        linkExpira: { lt: new Date() },
      },
      data: { estado: 'VENCIDO' },
    })
    resultado.linksExpirados = linksExpirados.count

    // === 2. Regenerar PagoProgramado ===
    const prestamos = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
      include: {
        pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } },
        pagosProgramados: true,
      },
    })

    for (const p of prestamos) {
      try {
        const calculo = calcularPrestamo({
          montoPrincipal: p.montoPrincipal,
          tasaInteresAnual: p.tasaInteresAnual,
          tasaMoraAnual: getTasaMoraAnual(p),
          plazoMeses: p.plazoMeses,
          frecuencia: p.frecuencia as any,
          fechaDesembolso: p.fechaDesembolso || undefined,
        })

        const cuotasPagadasSet = new Set(
          p.pagos.filter((pg) => pg.estado === 'APLICADO' && !pg.esSoloIntereses).map((pg) => pg.numeroCuota)
        )

        for (const cuota of calculo.tablaAmortizacion) {
          if (cuotasPagadasSet.has(cuota.numero)) {
            // Ya pagada: marcar como PAGADO en PagoProgramado
            await db.pagoProgramado.upsert({
              where: { prestamoId_numeroCuota: { prestamoId: p.id, numeroCuota: cuota.numero } },
              create: {
                prestamoId: p.id,
                numeroCuota: cuota.numero,
                fechaVencimiento: cuota.fechaVencimiento,
                montoCapital: cuota.capital,
                montoInteres: cuota.interes,
                montoCuota: cuota.montoCuota,
                saldoCapitalDespues: cuota.saldoCapital,
                estado: 'PAGADO',
                montoPagado: cuota.montoCuota,
              },
              update: { estado: 'PAGADO', montoPagado: cuota.montoCuota },
            })
            continue
          }
          // Cuota pendiente: calcular mora
          const diasMora = calcularDiasMora(cuota.fechaVencimiento)
          const moraCalc = diasMora > 0
            ? calcularMoraCompuesta(p.montoPrincipal, p.tasaMoraDiaria, diasMora)
            : 0

          const pagosCuota = p.pagos.filter((pg) => pg.numeroCuota === cuota.numero)
          const montoPagadoCuota = pagosCuota.reduce((s, pg) => s + pg.montoTotal, 0)
          const estado = diasMora > 0 ? 'VENCIDO' : 'PROGRAMADO'

          // Si ya existe y está APLAZADO, no tocarlo (lo maneja el flujo de solo intereses)
          const existente = p.pagosProgramados.find((pp) => pp.numeroCuota === cuota.numero)
          if (existente?.aplazado) {
            // Solo actualizar diasMora=0 (cuota aplazada no genera mora)
            await db.pagoProgramado.update({
              where: { id: existente.id },
              data: { diasMora: 0, moraCalculada: 0, fechaUltimaActualizacion: new Date() },
            })
            resultado.pagosProgramadosActualizados++
            continue
          }

          await db.pagoProgramado.upsert({
            where: { prestamoId_numeroCuota: { prestamoId: p.id, numeroCuota: cuota.numero } },
            create: {
              prestamoId: p.id,
              numeroCuota: cuota.numero,
              fechaVencimiento: cuota.fechaVencimiento,
              montoCapital: cuota.capital,
              montoInteres: cuota.interes,
              montoCuota: cuota.montoCuota,
              saldoCapitalDespues: cuota.saldoCapital,
              estado,
              montoPagado: montoPagadoCuota,
              moraCalculada: moraCalc,
              diasMora,
              fechaUltimaActualizacion: new Date(),
            },
            update: {
              estado, montoPagado: montoPagadoCuota,
              moraCalculada: moraCalc, diasMora,
              fechaUltimaActualizacion: new Date(),
            },
          })
          resultado.pagosProgramadosActualizados++
        }
      } catch (e: any) {
        resultado.errores.push(`Solicitud ${p.codigo}: ${e.message}`)
      }
    }

    return NextResponse.json({ success: true, data: resultado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
