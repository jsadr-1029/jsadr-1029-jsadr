import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { enviarEmail, haySmtpConfigurado } from '@/lib/email'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// GET /api/reportes/mensual-informe
// =====================================================
// Genera el informe MENSUAL completo (financiero + técnico) en formato HTML,
// listo para enviar por correo a jsa@jsadr.com.co (o al destinatario indicado).
//
// Query params:
//   ?enviar=true         → envía el correo además de retornar el HTML
//   ?para=email@dominio  → sobreescribe el destinatario (default: jsa@jsadr.com.co)
//   ?mes=YYYY-MM         → genera el informe para un mes específico (default: mes anterior)
//
// El informe se envía automáticamente el día 1 de cada mes a las 09:00 UTC-5
// (ver /api/reportes/mensual-cron y vercel.json cron schedule "0 14 1 * *").

const DESTINATARIO_DEFAULT = 'jsa@jsadr.com.co'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const enviar = searchParams.get('enviar') === 'true'
    const para = searchParams.get('para') || DESTINATARIO_DEFAULT
    const mesParam = searchParams.get('mes') // YYYY-MM

    // Determinar el período del informe (mes anterior por defecto)
    const hoy = new Date()
    let anioInforme: number
    let mesInforme: number // 0-indexed
    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      const [y, m] = mesParam.split('-').map(Number)
      anioInforme = y
      mesInforme = m - 1
    } else {
      // Mes anterior al actual
      if (hoy.getMonth() === 0) {
        anioInforme = hoy.getFullYear() - 1
        mesInforme = 11
      } else {
        anioInforme = hoy.getFullYear()
        mesInforme = hoy.getMonth() - 1
      }
    }
    const inicioMes = new Date(anioInforme, mesInforme, 1, 0, 0, 0, 0)
    const finMes = new Date(anioInforme, mesInforme + 1, 1, 0, 0, 0, 0)
    const nombreMes = inicioMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

    // =====================================================
    // 1) SECCIÓN FINANCIERA
    // =====================================================

    // --- Préstamos creados en el mes ---
    const prestamosCreadosMes = await db.prestamo.findMany({
      where: {
        createdAt: { gte: inicioMes, lt: finMes },
      },
      select: {
        id: true, codigo: true, montoPrincipal: true, estado: true,
        fechaDesembolso: true, cliente: { select: { nombre: true, cedula: true } },
      },
    })
    const totalPrestamosCreados = prestamosCreadosMes.length
    const montoPrestamosCreados = prestamosCreadosMes.reduce((s, p) => s + p.montoPrincipal, 0)

    // --- Préstamos desembolsados en el mes (activados) ---
    const prestamosDesembolsadosMes = await db.prestamo.findMany({
      where: {
        fechaDesembolso: { gte: inicioMes, lt: finMes },
      },
      select: { id: true, codigo: true, montoPrincipal: true, estado: true },
    })
    const totalDesembolsado = prestamosDesembolsadosMes.reduce((s, p) => s + p.montoPrincipal, 0)

    // --- Pagos aplicados en el mes ---
    const pagosMes = await db.pago.findMany({
      where: {
        fechaPago: { gte: inicioMes, lt: finMes },
        estado: 'APLICADO',
      },
      select: {
        id: true, montoTotal: true, montoCapital: true, montoInteres: true, montoMora: true,
        metodoPago: true, fechaPago: true,
        prestamo: { select: { codigo: true, cliente: { select: { nombre: true } } } },
      },
    })
    const totalPagosMes = pagosMes.length
    const montoRecaudadoMes = pagosMes.reduce((s, p) => s + p.montoTotal, 0)
    const montoCapitalMes = pagosMes.reduce((s, p) => s + p.montoCapital, 0)
    const montoInteresMes = pagosMes.reduce((s, p) => s + p.montoInteres, 0)
    const montoMoraMes = pagosMes.reduce((s, p) => s + p.montoMora, 0)

    // Pagos por método
    const pagosPorMetodo: Record<string, { count: number; monto: number }> = {}
    for (const p of pagosMes) {
      const m = p.metodoPago || 'OTRO'
      if (!pagosPorMetodo[m]) pagosPorMetodo[m] = { count: 0, monto: 0 }
      pagosPorMetodo[m].count++
      pagosPorMetodo[m].monto += p.montoTotal
    }

    // --- Cartera actual (snapshot al final del mes) ---
    const carteraActual = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA', 'JURIDICO'] } },
      select: { estado: true, saldoTotal: true, montoMora: true, diasMora: true },
    })
    const saldoCartera = carteraActual.reduce((s, p) => s + p.saldoTotal, 0)
    const carteraActiva = carteraActual.filter((p) => p.estado === 'ACTIVO').reduce((s, p) => s + p.saldoTotal, 0)
    const carteraMora = carteraActual.filter((p) => p.estado === 'EN_MORA').reduce((s, p) => s + p.saldoTotal, 0)
    const carteraJuridico = carteraActual.filter((p) => p.estado === 'JURIDICO').reduce((s, p) => s + p.saldoTotal, 0)
    const moraTotal = carteraActual.reduce((s, p) => s + (p.montoMora || 0), 0)

    // --- Préstamos cancelados (liquidados) en el mes ---
    const prestamosCanceladosMes = await db.prestamo.findMany({
      where: {
        estado: 'CANCELADO',
        updatedAt: { gte: inicioMes, lt: finMes },
      },
      select: { id: true, codigo: true, montoPrincipal: true, montoPagado: true },
    })
    const totalCancelados = prestamosCanceladosMes.length

    // --- Top clientes por monto recaudado en el mes ---
    const pagosPorCliente: Record<string, { nombre: string; monto: number; count: number }> = {}
    for (const p of pagosMes) {
      const nombre = p.prestamo.cliente.nombre
      if (!pagosPorCliente[nombre]) pagosPorCliente[nombre] = { nombre, monto: 0, count: 0 }
      pagosPorCliente[nombre].monto += p.montoTotal
      pagosPorCliente[nombre].count++
    }
    const topClientes = Object.values(pagosPorCliente).sort((a, b) => b.monto - a.monto).slice(0, 10)

    // --- Comparativa con el mes anterior ---
    const inicioMesAnterior = new Date(anioInforme, mesInforme - 1, 1)
    const finMesAnterior = inicioMes
    const pagosMesAnterior = await db.pago.findMany({
      where: {
        fechaPago: { gte: inicioMesAnterior, lt: finMesAnterior },
        estado: 'APLICADO',
      },
      select: { montoTotal: true },
    })
    const montoRecaudadoMesAnterior = pagosMesAnterior.reduce((s, p) => s + p.montoTotal, 0)
    const variacionRecaudo = montoRecaudadoMesAnterior > 0
      ? Math.round(((montoRecaudadoMes - montoRecaudadoMesAnterior) / montoRecaudadoMesAnterior) * 100)
      : 0

    // =====================================================
    // 2) SECCIÓN TÉCNICA
    // =====================================================

    // --- Usuarios activos en el sistema ---
    const totalUsuarios = await db.usuario.count()
    const usuariosActivos = await db.usuario.count({ where: { activo: true } })

    // --- Clientes registrados ---
    const totalClientes = await db.cliente.count()
    const clientesActivos = await db.cliente.count({ where: { activo: true } })
    const clientesNuevosMes = await db.cliente.count({
      where: { createdAt: { gte: inicioMes, lt: finMes } },
    })

    // --- Accesos al portal en el mes ---
    const accesosPortalMes = await db.accesoPortal.count({
      where: { createdAt: { gte: inicioMes, lt: finMes } },
    })
    const accesosExitosos = await db.accesoPortal.count({
      where: { createdAt: { gte: inicioMes, lt: finMes }, exito: true },
    })

    // --- Documentos de firma electrónica completados en el mes ---
    const firmasCompletadasMes = await db.firmaElectronica.count({
      where: {
        estadoFirma: 'COMPLETADA',
        fechaFirmaCompleta: { gte: inicioMes, lt: finMes },
      },
    })

    // --- Otros Sí generados en el mes ---
    const otrosSiMes = await db.otroSiCambioFecha.count({
      where: { createdAt: { gte: inicioMes, lt: finMes } },
    })

    // --- Audit logs del mes (eventos registrados) ---
    const auditLogsMes = await db.auditLog.count({
      where: { fecha: { gte: inicioMes, lt: finMes } },
    })

    // --- Notificaciones enviadas en el mes ---
    const notificacionesMes = await db.notificacionLog.count({
      where: { fechaEnvio: { gte: inicioMes, lt: finMes } },
    })

    // --- Casos jurídicos activos ---
    const casosJuridicosActivos = await db.casoJuridico.count({
      where: { estado: { in: ['ABIERTO', 'EN_PROCESO'] } },
    })

    // --- Tamaño de la base de datos (aproximado) ---
    const totalPrestamos = await db.prestamo.count()
    const totalPagos = await db.pago.count()

    // =====================================================
    // 3) GENERAR HTML DEL INFORME
    // =====================================================

    const html = generarHtmlInforme({
      nombreMes,
      inicioMes,
      finMes,
      // Financiero
      totalPrestamosCreados,
      montoPrestamosCreados,
      totalDesembolsado,
      totalPagosMes,
      montoRecaudadoMes,
      montoCapitalMes,
      montoInteresMes,
      montoMoraMes,
      pagosPorMetodo,
      saldoCartera,
      carteraActiva,
      carteraMora,
      carteraJuridico,
      moraTotal,
      totalCancelados,
      topClientes,
      montoRecaudadoMesAnterior,
      variacionRecaudo,
      // Técnico
      totalUsuarios,
      usuariosActivos,
      totalClientes,
      clientesActivos,
      clientesNuevosMes,
      accesosPortalMes,
      accesosExitosos,
      firmasCompletadasMes,
      otrosSiMes,
      auditLogsMes,
      notificacionesMes,
      casosJuridicosActivos,
      totalPrestamos,
      totalPagos,
    })

    // =====================================================
    // 4) ENVIAR POR CORREO (si enviar=true)
    // =====================================================
    let envio: { success: boolean; messageId?: string; error?: string; configUsada?: boolean } | null = null
    if (enviar) {
      const smtpConfigurado = await haySmtpConfigurado()
      if (!smtpConfigurado) {
        return NextResponse.json({
          success: false,
          error: 'SMTP no configurado. Configure el correo electrónico en Configuración Global.',
          html,
        }, { status: 500 })
      }
      const resultado = await enviarEmail({
        to: para,
        subject: `[JSADR] Informe Mensual — ${nombreMes}`,
        html,
        text: `Informe mensual de operaciones - ${nombreMes}. Disculpe las molestias, este correo requiere un cliente HTML para verse correctamente.`,
      })
      envio = {
        success: resultado.success,
        messageId: resultado.messageId,
        error: resultado.error,
        configUsada: resultado.configUsada,
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        periodo: { nombreMes, inicio: inicioMes.toISOString(), fin: finMes.toISOString() },
        destinatario: para,
        enviado: enviar,
        envio,
        resumen: {
          totalPrestamosCreados,
          montoPrestamosCreados,
          totalDesembolsado,
          totalPagosMes,
          montoRecaudadoMes,
          variacionRecaudo,
          saldoCartera,
          totalClientes,
          clientesNuevosMes,
          accesosPortalMes,
        },
      },
      html,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// Generador del HTML del informe
// =====================================================
function generarHtmlInforme(d: {
  nombreMes: string
  inicioMes: Date
  finMes: Date
  // Financiero
  totalPrestamosCreados: number
  montoPrestamosCreados: number
  totalDesembolsado: number
  totalPagosMes: number
  montoRecaudadoMes: number
  montoCapitalMes: number
  montoInteresMes: number
  montoMoraMes: number
  pagosPorMetodo: Record<string, { count: number; monto: number }>
  saldoCartera: number
  carteraActiva: number
  carteraMora: number
  carteraJuridico: number
  moraTotal: number
  totalCancelados: number
  topClientes: { nombre: string; monto: number; count: number }[]
  montoRecaudadoMesAnterior: number
  variacionRecaudo: number
  // Técnico
  totalUsuarios: number
  usuariosActivos: number
  totalClientes: number
  clientesActivos: number
  clientesNuevosMes: number
  accesosPortalMes: number
  accesosExitosos: number
  firmasCompletadasMes: number
  otrosSiMes: number
  auditLogsMes: number
  notificacionesMes: number
  casosJuridicosActivos: number
  totalPrestamos: number
  totalPagos: number
}): string {
  const fmt = (n: number) => formatearMoneda(n)
  const pct = (n: number) => `${n > 0 ? '+' : ''}${n}%`
  const colorVar = (n: number) => n >= 0 ? '#16a34a' : '#dc2626'
  const fmtFecha = (d: Date) => d.toLocaleDateString('es-CO')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Mensual JSADR — ${d.nombreMes}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
  .container { max-width: 760px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #1e3a8a, #1e40af); color: white; padding: 32px 40px; }
  .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; }
  .header .subtitle { font-size: 14px; opacity: 0.9; }
  .header .periodo { background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; display: inline-block; font-size: 13px; margin-top: 12px; }
  .section { padding: 32px 40px; border-bottom: 1px solid #e2e8f0; }
  .section:last-child { border-bottom: none; }
  .section h2 { font-size: 18px; font-weight: 700; color: #1e3a8a; margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #1e40af; }
  .kpi .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .kpi .value { font-size: 22px; font-weight: 700; color: #0f172a; }
  .kpi .delta { font-size: 12px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  th { background: #f1f5f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  td.monto { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  tr:hover td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .footer { padding: 24px 40px; background: #f8fafc; text-align: center; font-size: 12px; color: #64748b; }
  .progress { background: #e2e8f0; height: 6px; border-radius: 999px; overflow: hidden; margin-top: 4px; }
  .progress > div { height: 100%; background: #1e40af; }
  .alert { padding: 12px 16px; border-radius: 8px; margin-top: 12px; font-size: 13px; }
  .alert-info { background: #eff6ff; color: #1e40af; border-left: 4px solid #3b82f6; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📊 Informe Mensual de Operaciones</h1>
    <div class="subtitle">JSADR Plataforma de Préstamos · Informe Financiero y Técnico</div>
    <div class="periodo">📅 Período: ${d.nombreMes} (del ${fmtFecha(d.inicioMes)} al ${fmtFecha(new Date(d.finMes.getTime() - 1))})</div>
  </div>

  <!-- SECCIÓN FINANCIERA -->
  <div class="section">
    <h2>💰 Sección Financiera</h2>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">Préstamos creados</div>
        <div class="value">${d.totalPrestamosCreados}</div>
        <div class="delta">Monto total: ${fmt(d.montoPrestamosCreados)}</div>
      </div>
      <div class="kpi">
        <div class="label">Desembolsado en el mes</div>
        <div class="value">${fmt(d.totalDesembolsado)}</div>
        <div class="delta">${d.totalPrestamosCreados} créditos</div>
      </div>
      <div class="kpi">
        <div class="label">Recaudo del mes</div>
        <div class="value">${fmt(d.montoRecaudadoMes)}</div>
        <div class="delta" style="color: ${colorVar(d.variacionRecaudo)};">${pct(d.variacionRecaudo)} vs mes anterior (${fmt(d.montoRecaudadoMesAnterior)})</div>
      </div>
      <div class="kpi">
        <div class="label">Pagos aplicados</div>
        <div class="value">${d.totalPagosMes}</div>
        <div class="delta">Promedio: ${d.totalPagosMes > 0 ? fmt(Math.round(d.montoRecaudadoMes / d.totalPagosMes)) : '—'}</div>
      </div>
    </div>

    <h3 style="font-size:14px;color:#475569;margin:24px 0 8px 0;">Detalle del recaudo</h3>
    <table>
      <tr><th>Concepto</th><th class="monto">Monto</th></tr>
      <tr><td>Capital recuperado</td><td class="monto">${fmt(d.montoCapitalMes)}</td></tr>
      <tr><td>Intereses cobrados</td><td class="monto">${fmt(d.montoInteresMes)}</td></tr>
      <tr><td>Mora cobrada</td><td class="monto">${fmt(d.montoMoraMes)}</td></tr>
      <tr style="font-weight:700;background:#f1f5f9;"><td>TOTAL</td><td class="monto">${fmt(d.montoRecaudadoMes)}</td></tr>
    </table>

    <h3 style="font-size:14px;color:#475569;margin:24px 0 8px 0;">Pagos por método</h3>
    <table>
      <tr><th>Método</th><th style="text-align:right;"># Pagos</th><th class="monto">Monto</th></tr>
      ${Object.entries(d.pagosPorMetodo).map(([m, v]) =>
        `<tr><td>${m}</td><td style="text-align:right;">${v.count}</td><td class="monto">${fmt(v.monto)}</td></tr>`
      ).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">Sin pagos en el período</td></tr>'}
    </table>

    <h3 style="font-size:14px;color:#475569;margin:24px 0 8px 0;">Estado de la cartera (al cierre del mes)</h3>
    <div class="kpi-grid">
      <div class="kpi" style="border-left-color:#10b981;">
        <div class="label">Cartera activa</div>
        <div class="value">${fmt(d.carteraActiva)}</div>
      </div>
      <div class="kpi" style="border-left-color:#f59e0b;">
        <div class="label">En mora</div>
        <div class="value">${fmt(d.carteraMora)}</div>
      </div>
      <div class="kpi" style="border-left-color:#ef4444;">
        <div class="label">Jurídico</div>
        <div class="value">${fmt(d.carteraJuridico)}</div>
      </div>
      <div class="kpi" style="border-left-color:#1e40af;">
        <div class="label">Cartera total</div>
        <div class="value">${fmt(d.saldoCartera)}</div>
      </div>
    </div>

    ${d.moraTotal > 0 ? `<div class="alert alert-info">⚠️ Mora acumulada total: <strong>${fmt(d.moraTotal)}</strong>. Se recomienda gestiones de cobro sobre los clientes en mora.</div>` : ''}

    <h3 style="font-size:14px;color:#475569;margin:24px 0 8px 0;">Top 10 clientes por recaudo</h3>
    <table>
      <tr><th>#</th><th>Cliente</th><th style="text-align:right;"># Pagos</th><th class="monto">Monto</th></tr>
      ${d.topClientes.length === 0
        ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin pagos en el período</td></tr>'
        : d.topClientes.map((c, i) =>
          `<tr><td>${i + 1}</td><td>${c.nombre}</td><td style="text-align:right;">${c.count}</td><td class="monto">${fmt(c.monto)}</td></tr>`
        ).join('')}
    </table>

    <div style="margin-top:16px;">
      <span class="badge badge-success">✓ ${d.totalCancelados} créditos cancelados (liquidados) en el mes</span>
    </div>
  </div>

  <!-- SECCIÓN TÉCNICA -->
  <div class="section">
    <h2>⚙️ Sección Técnica</h2>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">Usuarios del sistema</div>
        <div class="value">${d.totalUsuarios}</div>
        <div class="delta">${d.usuariosActivos} activos</div>
      </div>
      <div class="kpi">
        <div class="label">Clientes registrados</div>
        <div class="value">${d.totalClientes}</div>
        <div class="delta">${d.clientesActivos} activos · ${d.clientesNuevosMes} nuevos en el mes</div>
      </div>
      <div class="kpi">
        <div class="label">Accesos al portal</div>
        <div class="value">${d.accesosPortalMes}</div>
        <div class="delta">${d.accesosExitosos} exitosos (${d.accesosPortalMes > 0 ? Math.round(d.accesosExitosos / d.accesosPortalMes * 100) : 0}%)</div>
      </div>
      <div class="kpi">
        <div class="label">Firmas electrónicas</div>
        <div class="value">${d.firmasCompletadasMes}</div>
        <div class="delta">completadas en el mes</div>
      </div>
      <div class="kpi">
        <div class="label">Otros Sí generados</div>
        <div class="value">${d.otrosSiMes}</div>
        <div class="delta">cambios de fecha / flexibilidad</div>
      </div>
      <div class="kpi">
        <div class="label">Eventos auditados</div>
        <div class="value">${d.auditLogsMes}</div>
        <div class="delta">registros en audit log</div>
      </div>
      <div class="kpi">
        <div class="label">Notificaciones enviadas</div>
        <div class="value">${d.notificacionesMes}</div>
        <div class="delta">WhatsApp + email</div>
      </div>
      <div class="kpi">
        <div class="label">Casos jurídicos activos</div>
        <div class="value">${d.casosJuridicosActivos}</div>
        <div class="delta">en proceso legal</div>
      </div>
    </div>

    <h3 style="font-size:14px;color:#475569;margin:24px 0 8px 0;">Volumen de datos</h3>
    <table>
      <tr><th>Recurso</th><th style="text-align:right;">Total registros</th></tr>
      <tr><td>Préstamos (todos los estados)</td><td style="text-align:right;">${d.totalPrestamos}</td></tr>
      <tr><td>Pagos (todos los estados)</td><td style="text-align:right;">${d.totalPagos}</td></tr>
      <tr><td>Clientes</td><td style="text-align:right;">${d.totalClientes}</td></tr>
      <tr><td>Usuarios</td><td style="text-align:right;">${d.totalUsuarios}</td></tr>
    </table>

    <div class="alert alert-info">
      ℹ️ Este informe se genera automáticamente el día 1 de cada mes y se envía a <strong>jsa@jsadr.com.co</strong>.
      Los datos corresponden al mes inmediatamente anterior al envío.
    </div>
  </div>

  <div class="footer">
    <p><strong>JSADR Plataforma de Préstamos</strong> · Informe mensual automático</p>
    <p>Generado el ${new Date().toLocaleString('es-CO')} · Período: ${d.nombreMes}</p>
  </div>
</div>
</body>
</html>`
}
