import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, requireEmpresaId } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/dashboard?empresaId=...
// KPIs agregados: empresas activas, declaraciones pendientes, períodos abiertos,
// comprobantes recientes e indicadores financieros (ingresos, gastos, utilidad,
// activos, pasivos) calculados a partir de saldos de cuentas PUC.
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const empresaId = requireEmpresaId(req)
    if (empresaId instanceof NextResponse) return empresaId
    const empId = empresaId as string

    // === KPIs generales (todas las empresas) ===
    const [empresasActivas, totalEmpresas, declaracionesPendientes, periodosAbiertos, comprobantesBorrador] =
      await Promise.all([
        db.contEmpresa.count({ where: { activa: true } }),
        db.contEmpresa.count(),
        db.contDeclaracion.count({
          where: { empresaId: empId, estado: { in: ['BORRADOR', 'EN_REVISION', 'APROBADA'] } },
        }),
        db.contPeriodo.count({ where: { empresaId: empId, estado: 'ABIERTO' } }),
        db.contComprobante.count({ where: { empresaId: empId, estado: 'BORRADOR' } }),
      ])

    // === Indicadores financieros (por empresa) ===
    // Clases PUC: 1=Activo, 2=Pasivo, 3=Patrimonio, 4=Ingresos, 5=Gastos, 6=Costos, 7=Costos Gastos
    const cuentas = await db.contCuentaPUC.findMany({
      where: { empresaId: empId, tipo: 'CLASE' },
      select: { codigo: true, nombre: true, saldo: true, naturaleza: true },
    })

    const indicadores: Record<string, number> = {
      activos: 0,
      pasivos: 0,
      patrimonio: 0,
      ingresos: 0,
      gastos: 0,
      costos: 0,
    }
    for (const c of cuentas) {
      const cod = c.codigo.trim()
      const saldo = Math.abs(c.saldo || 0)
      if (cod.startsWith('1')) indicadores.activos += saldo
      else if (cod.startsWith('2')) indicadores.pasivos += saldo
      else if (cod.startsWith('3')) indicadores.patrimonio += saldo
      else if (cod.startsWith('4')) indicadores.ingresos += saldo
      else if (cod.startsWith('5')) indicadores.gastos += saldo
      else if (cod.startsWith('6') || cod.startsWith('7')) indicadores.costos += saldo
    }
    const utilidad = indicadores.ingresos - (indicadores.gastos + indicadores.costos)

    // === Declaraciones próximas a vencer (30 días) ===
    const ahora = new Date()
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000)
    const declaracionesProximas = await db.contDeclaracion.findMany({
      where: {
        empresaId: empId,
        estado: { in: ['BORRADOR', 'EN_REVISION', 'APROBADA'] },
        fechaVencimiento: { gte: ahora, lte: en30dias },
      },
      orderBy: { fechaVencimiento: 'asc' },
      take: 5,
    })

    // === Últimos comprobantes ===
    const ultimosComprobantes = await db.contComprobante.findMany({
      where: { empresaId: empId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        periodo: { select: { anio: true, mes: true } },
      },
    })

    // === Resumen por tipo de tercero ===
    const tercerosPorTipo = await db.contTercero.groupBy({
      by: ['tipoTercero'],
      where: { empresaId: empId },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          empresasActivas,
          totalEmpresas,
          declaracionesPendientes,
          periodosAbiertos,
          comprobantesBorrador,
        },
        indicadoresFinancieros: {
          activos: indicadores.activos,
          pasivos: indicadores.pasivos,
          patrimonio: indicadores.patrimonio,
          ingresos: indicadores.ingresos,
          gastos: indicadores.gastos,
          costos: indicadores.costos,
          utilidad,
        },
        declaracionesProximas,
        ultimosComprobantes,
        tercerosPorTipo,
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
