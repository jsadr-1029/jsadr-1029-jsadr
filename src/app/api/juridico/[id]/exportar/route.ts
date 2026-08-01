import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatearMoneda, formatearFecha, formatearFechaHora, getTasaMoraAnual } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'

// GET - exportar historial completo de caso jurídico en HTML imprimible (PDF/Word)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato') || 'pdf' // pdf | word

    const caso = await db.casoJuridico.findUnique({
      where: { id },
      include: {
        prestamo: { include: { cliente: true, pagos: true } },
        cronologias: { orderBy: { fecha: 'asc' } },
        documentos: { orderBy: { fechaSubida: 'desc' } },
        alertas: { orderBy: { fechaAlerta: 'asc' } },
      },
    })

    if (!caso) {
      return NextResponse.json({ success: false, error: 'Caso no encontrado' }, { status: 404 })
    }

    const html = generarHTMLCaso(caso)

    if (formato === 'word') {
      // Para Word, el mismo HTML con headers .doc funciona
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="caso_${caso.prestamo.codigo}.doc"`,
        },
      })
    }

    // Para PDF, devolver HTML imprimible (el usuario usa Ctrl+P)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

function generarHTMLCaso(caso: any): string {
  const p = caso.prestamo
  const c = p.cliente
  const fechaReporte = formatearFechaHora(new Date())

  const eventosHTML = caso.cronologia.map((ev: any) => `
    <tr>
      <td>${formatearFechaHora(ev.fecha)}</td>
      <td><strong>${ev.tipoEvento}</strong></td>
      <td>${ev.titulo}</td>
      <td>${ev.descripcion || '—'}</td>
      <td>${ev.resultado || '—'}</td>
      <td>${ev.actor || '—'}</td>
      <td>${ev.monto ? formatearMoneda(ev.monto) : '—'}</td>
    </tr>
  `).join('')

  const documentosHTML = caso.documentos.map((d: any) => `
    <tr>
      <td>${formatearFecha(d.fechaSubida)}</td>
      <td>${d.tipo}</td>
      <td>${d.nombre}</td>
      <td>${d.descripcion || '—'}</td>
    </tr>
  `).join('')

  const alertasHTML = caso.alertas.map((a: any) => `
    <tr>
      <td>${formatearFechaHora(a.fechaAlerta)}</td>
      <td>${a.tipo}</td>
      <td>${a.descripcion}</td>
      <td>${a.atendida ? '✓ Atendida' : '⏳ Pendiente'}</td>
    </tr>
  `).join('')

  const pagosHTML = p.pagos.map((pg: any) => `
    <tr>
      <td>${pg.numeroCuota}</td>
      <td>${formatearFecha(pg.fechaVencimiento)}</td>
      <td>${formatearFecha(pg.fechaPago)}</td>
      <td>${formatearMoneda(pg.montoTotal)}</td>
      <td>${pg.metodoPago}</td>
      <td>${pg.estado}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Expediente Caso Jurídico - ${p.codigo}</title>
<style>
  @page { size: letter; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; line-height: 1.5; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 20px; font-size: 12px; }
  .header { text-align: center; border-bottom: 3px double #1e3a5f; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #1e3a5f; font-size: 22px; margin: 0; letter-spacing: 2px; }
  .header h2 { color: #4a5568; font-size: 13px; margin: 4px 0; font-weight: normal; }
  .seccion { margin: 20px 0; }
  .seccion h3 { background: #1e3a5f; color: white; padding: 6px 12px; font-size: 13px; margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
  table th, table td { border: 1px solid #cbd5e0; padding: 5px 8px; text-align: left; vertical-align: top; }
  table th { background: #e2e8f0; font-weight: bold; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
  .info-item { padding: 6px 10px; background: #f7fafc; border-left: 3px solid #1e3a5f; }
  .info-item strong { color: #1e3a5f; display: block; font-size: 10px; text-transform: uppercase; }
  .info-item span { font-size: 12px; }
  .estado-badge { display: inline-block; padding: 4px 12px; background: ${caso.estado === 'CERRADO' ? '#10b981' : '#f59e0b'}; color: white; font-weight: bold; border-radius: 4px; font-size: 11px; }
  .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #cbd5e0; font-size: 10px; color: #64748b; text-align: center; }
  @media print { .no-print { display: none; } }
  .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #1e3a5f; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
</style>
</head>
<body>
  <div class="header">
    <h1>EXPEDIENTE JURÍDICO</h1>
    <h2>Documento Oficial de Seguimiento de Caso</h2>
    <h2>Caso: ${p.codigo} · Estado: <span class="estado-badge">${caso.estado}</span></h2>
  </div>

  <div class="info-grid">
    <div class="info-item"><strong>Fecha Reporte</strong><span>${fechaReporte}</span></div>
    <div class="info-item"><strong>Fecha Apertura</strong><span>${formatearFecha(caso.fechaApertura)}</span></div>
    <div class="info-item"><strong>Cliente</strong><span>${c.nombre}</span></div>
    <div class="info-item"><strong>Cédula</strong><span>${c.cedula}</span></div>
    <div class="info-item"><strong>Teléfono</strong><span>${c.telefono}</span></div>
    <div class="info-item"><strong>Email</strong><span>${c.email || '—'}</span></div>
    <div class="info-item"><strong>Abogado</strong><span>${caso.abogadoNombre || 'Sin asignar'}</span></div>
    <div class="info-item"><strong>Teléfono Abogado</strong><span>${caso.abogadoTelefono || '—'}</span></div>
    <div class="info-item"><strong>Honorarios</strong><span>${caso.honorarios > 0 ? formatearMoneda(caso.honorarios) : '—'}</span></div>
    <div class="info-item"><strong>Juzgado</strong><span>${caso.juzgado || '—'}</span></div>
    <div class="info-item"><strong>Radicado</strong><span>${caso.radicado || '—'}</span></div>
    <div class="info-item"><strong>Tipo Proceso</strong><span>${caso.tipoProceso || '—'}</span></div>
  </div>

  <div class="seccion">
    <h3>📋 INFORMACIÓN DEL PRÉSTAMO</h3>
    <div class="info-grid">
      <div class="info-item"><strong>Monto Principal</strong><span>${formatearMoneda(p.montoPrincipal)}</span></div>
      <div class="info-item"><strong>Total a Pagar</strong><span>${formatearMoneda(p.totalPagar)}</span></div>
      <div class="info-item"><strong>Saldo Actual</strong><span>${formatearMoneda(p.saldoTotal)}</span></div>
      <div class="info-item"><strong>Monto Pagado</strong><span>${formatearMoneda(p.montoPagado)}</span></div>
      <div class="info-item"><strong>Días de Mora</strong><span>${p.diasMora}</span></div>
      <div class="info-item"><strong>Monto en Mora</strong><span>${formatearMoneda(p.montoMora)}</span></div>
      <div class="info-item"><strong>Tasa Anual</strong><span>${p.tasaInteresAnual}%</span></div>
      <div class="info-item"><strong>Tasa Moratoria</strong><span>${getTasaMoraAnual(p)}% anual</span></div>
    </div>
    ${caso.descripcion ? `<p><strong>Descripción del caso:</strong> ${caso.descripcion}</p>` : ''}
  </div>

  <div class="seccion">
    <h3>📅 CRONOLOGÍA COMPLETA DEL CASO (${caso.cronologia.length} eventos)</h3>
    ${caso.cronologia.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Tipo</th><th>Título</th><th>Descripción</th><th>Resultado</th><th>Actor</th><th>Monto</th>
        </tr>
      </thead>
      <tbody>${eventosHTML}</tbody>
    </table>
    ` : '<p style="text-align:center;color:#64748b;padding:15px;">Sin eventos registrados</p>'}
  </div>

  <div class="seccion">
    <h3>📄 DOCUMENTOS ASOCIADOS (${caso.documentos.length})</h3>
    ${caso.documentos.length > 0 ? `
    <table>
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Nombre</th><th>Descripción</th></tr></thead>
      <tbody>${documentosHTML}</tbody>
    </table>
    ` : '<p style="text-align:center;color:#64748b;padding:15px;">Sin documentos registrados</p>'}
  </div>

  <div class="seccion">
    <h3>⏰ ALERTAS Y VENCIMIENTOS (${caso.alertas.length})</h3>
    ${caso.alertas.length > 0 ? `
    <table>
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Estado</th></tr></thead>
      <tbody>${alertasHTML}</tbody>
    </table>
    ` : '<p style="text-align:center;color:#64748b;padding:15px;">Sin alertas registradas</p>'}
  </div>

  <div class="seccion">
    <h3>💰 HISTORIAL DE PAGOS DEL PRÉSTAMO (${p.pagos.length})</h3>
    ${p.pagos.length > 0 ? `
    <table>
      <thead><tr><th>Cuota</th><th>Vencimiento</th><th>Fecha Pago</th><th>Monto</th><th>Método</th><th>Estado</th></tr></thead>
      <tbody>${pagosHTML}</tbody>
    </table>
    ` : '<p style="text-align:center;color:#64748b;padding:15px;">Sin pagos registrados</p>'}
  </div>

  ${caso.resultadoFinal ? `
  <div class="seccion">
    <h3>✅ RESULTADO FINAL</h3>
    <p>${caso.resultadoFinal}</p>
    <p><strong>Fecha de cierre:</strong> ${formatearFecha(caso.fechaCierre)}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Documento generado el ${fechaReporte}</p>
    <p>Este expediente contiene el seguimiento paso a paso del caso jurídico ${p.codigo}</p>
    <p>Sistema de Gestión de Préstamos v2.0</p>
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
</body>
</html>`
}
