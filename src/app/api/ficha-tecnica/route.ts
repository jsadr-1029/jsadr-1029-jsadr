// =====================================================
// /api/ficha-tecnica — Genera ficha técnica del préstamo v3.0
// GET: genera HTML imprimible o JSON según ?formato=
// Esta ruta es pública (whitelist en middleware) para que el
// cliente pueda verla desde el portal sin autenticación.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, logError } from '@/lib/error-handler'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
  formatearMoneda,
  formatearFecha,
} from '@/lib/finanzas'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const prestamoId = searchParams.get('prestamoId')
    const codigo = searchParams.get('codigo')
    const formato = searchParams.get('formato') || 'html' // html | json

    if (!prestamoId && !codigo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetro prestamoId o codigo requerido',
          code: 'MISSING_PARAMS',
        },
        { status: 400 }
      )
    }

    const prestamo = await db.prestamo.findFirst({
      where: prestamoId ? { id: prestamoId } : { codigo: codigo || undefined },
      include: {
        cliente: {
          include: { categoria: { include: { cuentaRecaudo: true } } },
        },
        categoria: { include: { cuentaRecaudo: true } },
        pagos: { orderBy: { numeroCuota: 'asc' } },
        casoJuridico: true,
        firmas: true,
      },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Calcular ficha técnica
    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || undefined,
    })

    // Construir objeto de ficha técnica
    const ficha = {
      metadata: {
        fechaGeneracion: new Date().toISOString(),
        tipo: 'FICHA_TECNICA',
      },
      prestamo: {
        id: prestamo.id,
        codigo: prestamo.codigo,
        estado: prestamo.estado,
        fechaSolicitud: prestamo.fechaSolicitud,
        fechaAprobacion: prestamo.fechaAprobacion,
        fechaDesembolso: prestamo.fechaDesembolso,
        fechaVencimiento: prestamo.fechaVencimiento,
      },
      cliente: {
        id: prestamo.cliente.id,
        nombre: prestamo.cliente.nombre,
        cedula: prestamo.cliente.cedula,
        telefono: prestamo.cliente.telefono,
        email: prestamo.cliente.email,
        departamento: prestamo.cliente.departamento,
        municipio: prestamo.cliente.municipio,
        direccion: prestamo.cliente.direccion,
        categoria: prestamo.cliente.categoria?.nombre || 'Sin categoría',
      },
      variablesFinancieras: {
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(prestamo), // convertir diaria a anual
        tasaMoraDiaria: prestamo.tasaMoraDiaria,
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia,
        numeroCuotas: prestamo.numeroCuotas,
        montoCuota: prestamo.montoCuota,
        totalInteres: prestamo.totalInteres,
        totalPagar: prestamo.totalPagar,
        tasaAplicada: prestamo.tasaAplicada,
      },
      saldos: {
        saldoCapital: prestamo.saldoCapital,
        saldoInteres: prestamo.saldoInteres,
        saldoTotal: prestamo.saldoTotal,
        cuotasPagadas: prestamo.cuotasPagadas,
        montoPagado: prestamo.montoPagado,
        montoMora: prestamo.montoMora,
        diasMora: prestamo.diasMora,
        moraAcumulada: prestamo.montoMoraAcumulado,
      },
      fondoGarantia: {
        cargado: prestamo.fondoGarantiaCargado,
        monto: prestamo.fondoGarantiaMonto,
      },
      cuentaRecaudo: prestamo.categoria?.cuentaRecaudo || prestamo.cliente.categoria?.cuentaRecaudo || null,
      tablaAmortizacion: calculo.tablaAmortizacion,
      pagos: prestamo.pagos,
      casoJuridico: prestamo.casoJuridico,
      tieneFirma: prestamo.firmas.length > 0,
      calculosCalculados: {
        totalPagarCalculado: calculo.totalPagar,
        totalInteresCalculado: calculo.totalInteres,
        montoCuotaCalculado: calculo.montoCuota,
        fondoGarantiaCalculado: calculo.fondoGarantia,
      },
    }

    if (formato === 'json') {
      return NextResponse.json({ success: true, data: ficha })
    }

    // Generar HTML imprimible
    const html = generarFichaHTML(ficha)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logError('/api/ficha-tecnica GET', error)
    return errorResponse('/api/ficha-tecnica GET', error)
  }
}

function generarFichaHTML(ficha: any): string {
  const p = ficha.prestamo
  const c = ficha.cliente
  const v = ficha.variablesFinancieras
  const s = ficha.saldos
  const fechaGen = new Date(ficha.metadata.fechaGeneracion).toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ficha Técnica - Préstamo ${p.codigo}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 11px; line-height: 1.4; }
  .header { text-align: center; border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { color: #0f766e; margin: 0 0 4px 0; font-size: 22px; letter-spacing: 1px; }
  .header .subtitle { color: #6b7280; font-size: 11px; margin: 0; }
  .header .fecha-gen { color: #9ca3af; font-size: 10px; margin-top: 6px; }
  .section { margin-bottom: 20px; }
  .section-title { background: #0f766e; color: white; padding: 6px 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 3px 3px 0 0; }
  .section-body { border: 1px solid #e5e7eb; border-top: none; padding: 10px; border-radius: 0 0 3px 3px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .dato { display: flex; font-size: 11px; }
  .dato .label { color: #6b7280; min-width: 130px; font-weight: 600; }
  .dato .value { color: #1f2937; font-weight: 500; }
  .resumen-card { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; text-align: center; background: #f9fafb; }
  .resumen-card .label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  .resumen-card .value { color: #0f766e; font-weight: bold; font-size: 14px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
  table th { background: #f3f4f6; color: #374151; padding: 5px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #0f766e; font-size: 9px; text-transform: uppercase; }
  table td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; }
  table .num { text-align: right; font-family: 'Courier New', monospace; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
  .print-button { position: fixed; top: 20px; right: 20px; background: #0f766e; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.2); z-index: 999; }
  .print-button:hover { background: #115e59; }
  @media print { .print-button { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Imprimir / PDF</button>
  <div class="header">
    <h1>FICHA TÉCNICA DEL PRÉSTAMO</h1>
    <p class="subtitle">Código: ${p.codigo} — Estado: ${p.estado}</p>
    <p class="fecha-gen">Generado el ${fechaGen}</p>
  </div>

  <div class="section">
    <div class="section-title">📋 Datos del Cliente</div>
    <div class="section-body">
      <div class="grid">
        <div class="dato"><span class="label">Nombre:</span><span class="value">${c.nombre}</span></div>
        <div class="dato"><span class="label">Cédula:</span><span class="value">${c.cedula}</span></div>
        <div class="dato"><span class="label">Teléfono:</span><span class="value">${c.telefono}</span></div>
        <div class="dato"><span class="label">Email:</span><span class="value">${c.email || '—'}</span></div>
        <div class="dato"><span class="label">Departamento:</span><span class="value">${c.departamento || '—'}</span></div>
        <div class="dato"><span class="label">Municipio:</span><span class="value">${c.municipio || '—'}</span></div>
        <div class="dato"><span class="label">Dirección:</span><span class="value">${c.direccion || '—'}</span></div>
        <div class="dato"><span class="label">Categoría:</span><span class="value">${c.categoria}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">💰 Variables Financieras</div>
    <div class="section-body">
      <div class="grid-4">
        <div class="resumen-card"><div class="label">Monto Principal</div><div class="value">${formatearMoneda(v.montoPrincipal)}</div></div>
        <div class="resumen-card"><div class="label">Cuota</div><div class="value">${formatearMoneda(v.montoCuota)}</div></div>
        <div class="resumen-card"><div class="label">Total a Pagar</div><div class="value">${formatearMoneda(v.totalPagar)}</div></div>
        <div class="resumen-card"><div class="label">Total Interés</div><div class="value">${formatearMoneda(v.totalInteres)}</div></div>
      </div>
      <div class="grid" style="margin-top: 10px;">
        <div class="dato"><span class="label">Tasa Anual:</span><span class="value">${v.tasaInteresAnual}%</span></div>
        <div class="dato"><span class="label">Tasa Mora Anual:</span><span class="value">${v.tasaMoraAnual}%</span></div>
        <div class="dato"><span class="label">Tasa Mora Diaria:</span><span class="value">${v.tasaMoraDiaria}%</span></div>
        <div class="dato"><span class="label">Plazo:</span><span class="value">${v.plazoMeses} meses (${v.frecuencia.toLowerCase()})</span></div>
        <div class="dato"><span class="label">Número Cuotas:</span><span class="value">${v.numeroCuotas}</span></div>
        <div class="dato"><span class="label">Tasa Aplicada:</span><span class="value">${(v.tasaAplicada * 100).toFixed(4)}%</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📊 Saldos Actuales</div>
    <div class="section-body">
      <div class="grid-4">
        <div class="resumen-card"><div class="label">Saldo Capital</div><div class="value">${formatearMoneda(s.saldoCapital)}</div></div>
        <div class="resumen-card"><div class="label">Saldo Interés</div><div class="value">${formatearMoneda(s.saldoInteres)}</div></div>
        <div class="resumen-card"><div class="label">Saldo Total</div><div class="value">${formatearMoneda(s.saldoTotal)}</div></div>
        <div class="resumen-card"><div class="label">Monto Pagado</div><div class="value">${formatearMoneda(s.montoPagado)}</div></div>
      </div>
      <div class="grid" style="margin-top: 10px;">
        <div class="dato"><span class="label">Cuotas Pagadas:</span><span class="value">${s.cuotasPagadas} / ${v.numeroCuotas}</span></div>
        <div class="dato"><span class="label">Días Mora:</span><span class="value">${s.diasMora}</span></div>
        <div class="dato"><span class="label">Monto Mora:</span><span class="value">${formatearMoneda(s.montoMora)}</span></div>
        <div class="dato"><span class="label">Mora Acumulada:</span><span class="value">${formatearMoneda(s.moraAcumulada)}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📅 Tabla de Amortización</div>
    <div class="section-body">
      <table>
        <thead>
          <tr><th>#</th><th>Vencimiento</th><th class="num">Cuota</th><th class="num">Capital</th><th class="num">Interés</th><th class="num">Saldo Capital</th></tr>
        </thead>
        <tbody>
          ${ficha.tablaAmortizacion.map((c: any) => `
            <tr>
              <td>${c.numero}</td>
              <td>${formatearFecha(c.fechaVencimiento)}</td>
              <td class="num">${formatearMoneda(c.montoCuota)}</td>
              <td class="num">${formatearMoneda(c.capital)}</td>
              <td class="num">${formatearMoneda(c.interes)}</td>
              <td class="num">${formatearMoneda(c.saldoCapital)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>Ficha técnica generada automáticamente — Sistema Jsadr v3.0</p>
    <p>© ${new Date().getFullYear()}</p>
  </div>

  <script>
    setTimeout(() => {
      if (window.location.search.includes('auto=1')) window.print()
    }, 1000)
  </script>
</body>
</html>`
}
