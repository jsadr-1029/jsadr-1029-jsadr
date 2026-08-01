import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
  formatearMoneda,
  formatearFecha,
} from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { safeCompare } from '@/lib/security'

// GET - estado de cuenta del cliente por cédula (HTML imprimible)
// Uso: /api/estado-cuenta?cedula=1234567890                     (admin/gestor autenticado con JWT)
//      /api/estado-cuenta?cedula=1234567890&token=xxx           (cliente desde portal)
//      /api/estado-cuenta?cedula=1234567890&prestamoId=xyz&token=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const cedula = searchParams.get('cedula')
    const prestamoId = searchParams.get('prestamoId')
    const portalToken = searchParams.get('token')

    if (!cedula) {
      return NextResponse.json(
        { success: false, error: 'Parámetro cedula requerido' },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.findUnique({
      where: { cedula },
      include: {
        categoria: { include: { cuentaRecaudo: true } },
        prestamos: {
          where: prestamoId ? { id: prestamoId } : {},
          include: {
            categoria: { include: { cuentaRecaudo: true } },
            pagos: {
              orderBy: { numeroCuota: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // === Validación de acceso ===
    // Si viene token de portal, validar sesión del cliente.
    // Si no viene token, exigir JWT de staff (admin/gestor/consultor).
    if (portalToken) {
      const now = new Date()
      const tokenValido =
        !!cliente.tokenSesion &&
        safeCompare(cliente.tokenSesion, portalToken) &&
        !!cliente.tokenExpira &&
        cliente.tokenExpira > now

      if (!tokenValido) {
        return NextResponse.json(
          { success: false, error: 'Sesión inválida o expirada. Inicie sesión nuevamente.', code: 'SESSION_EXPIRED' },
          { status: 401 }
        )
      }
    } else {
      // Sin token de portal → debe ser staff autenticado
      const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
      if (auth instanceof NextResponse) return auth
    }

    // Calcular totales
    let totalPrestado = 0
    let totalPagado = 0
    let totalSaldo = 0
    let totalMora = 0

    const prestamosCalculados = cliente.prestamos.map((p) => {
      const calculo = calcularPrestamo({
        montoPrincipal: p.montoPrincipal,
        tasaInteresAnual: p.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(p), // convertir diaria a anual
        plazoMeses: p.plazoMeses,
        frecuencia: p.frecuencia as any,
        fechaDesembolso: p.fechaDesembolso || undefined,
      })

      // Para cada pago, calcular si tiene mora
      const pagosConMora = p.pagos.map((pago) => {
        const diasMora = calcularDiasMora(pago.fechaVencimiento)
        return {
          ...pago,
          diasMora: pago.fechaPago ? calcularDiasMora(pago.fechaVencimiento, pago.fechaPago) : diasMora,
        }
      })

      totalPrestado += p.montoPrincipal
      totalPagado += p.montoPagado
      totalSaldo += p.saldoTotal
      totalMora += p.montoMora

      return {
        ...p,
        tablaAmortizacion: calculo.tablaAmortizacion,
        pagos: pagosConMora,
        cuentaRecaudoPago: p.categoria?.cuentaRecaudo || cliente.categoria?.cuentaRecaudo || null,
      }
    })

    // Generar HTML imprimible
    const html = generarEstadoCuentaHTML({
      cliente: {
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        email: cliente.email || '',
        departamento: cliente.departamento || '',
        municipio: cliente.municipio || '',
        direccion: cliente.direccion || '',
        bancoCliente: cliente.bancoCliente || '',
        tipoCuentaCliente: cliente.tipoCuentaCliente || '',
        numeroCuentaCliente: cliente.numeroCuentaCliente || '',
        categoria: cliente.categoria?.nombre || 'Sin categoría',
      },
      prestamos: prestamosCalculados,
      totales: {
        totalPrestado,
        totalPagado,
        totalSaldo,
        totalMora,
        numPrestamos: prestamosCalculados.length,
      },
      fechaGeneracion: new Date().toISOString(),
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

function generarEstadoCuentaHTML({
  cliente,
  prestamos,
  totales,
  fechaGeneracion,
}: any): string {
  const fechaGen = new Date(fechaGeneracion).toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Estado de Cuenta - ${cliente.nombre}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body {
    font-family: 'Arial', 'Helvetica', sans-serif;
    color: #1f2937;
    margin: 0;
    padding: 20px;
    font-size: 11px;
    line-height: 1.4;
  }
  .header {
    text-align: center;
    border-bottom: 3px solid #1e40af;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .header h1 {
    color: #1e40af;
    margin: 0 0 4px 0;
    font-size: 22px;
    letter-spacing: 1px;
  }
  .header .subtitle {
    color: #6b7280;
    font-size: 11px;
    margin: 0;
  }
  .header .fecha-gen {
    color: #9ca3af;
    font-size: 10px;
    margin-top: 6px;
  }
  .section {
    margin-bottom: 20px;
  }
  .section-title {
    background: #1e40af;
    color: white;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 3px 3px 0 0;
    margin-bottom: 0;
  }
  .section-body {
    border: 1px solid #e5e7eb;
    border-top: none;
    padding: 10px;
    border-radius: 0 0 3px 3px;
  }
  .datos-cliente {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;
  }
  .dato {
    display: flex;
    font-size: 11px;
  }
  .dato .label {
    color: #6b7280;
    min-width: 100px;
    font-weight: 600;
  }
  .dato .value {
    color: #1f2937;
    font-weight: 500;
  }
  .resumen {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-top: 8px;
  }
  .resumen-card {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px 10px;
    text-align: center;
    background: #f9fafb;
  }
  .resumen-card .label {
    color: #6b7280;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .resumen-card .value {
    color: #1e40af;
    font-weight: bold;
    font-size: 14px;
    margin-top: 2px;
  }
  .resumen-card.saldo .value { color: #dc2626; }
  .resumen-card.pagado .value { color: #059669; }
  .resumen-card.mora .value { color: #f59e0b; }
  
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-top: 8px;
  }
  table th {
    background: #f3f4f6;
    color: #374151;
    padding: 5px 6px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #1e40af;
    font-size: 9px;
    text-transform: uppercase;
  }
  table td {
    padding: 5px 6px;
    border-bottom: 1px solid #f3f4f6;
  }
  table tr:hover { background: #f9fafb; }
  table .num { text-align: right; font-family: 'Courier New', monospace; }
  table .total-row td {
    border-top: 2px solid #1e40af;
    font-weight: bold;
    background: #eff6ff;
  }
  
  .prestamo-block {
    margin-bottom: 18px;
    page-break-inside: avoid;
  }
  .prestamo-header {
    background: #eff6ff;
    border-left: 4px solid #1e40af;
    padding: 8px 12px;
    margin-bottom: 6px;
  }
  .prestamo-header .codigo {
    color: #1e40af;
    font-weight: bold;
    font-size: 13px;
  }
  .prestamo-header .estado {
    float: right;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .estado-ACTIVO { background: #d1fae5; color: #065f46; }
  .estado-EN_MORA { background: #fee2e2; color: #991b1b; }
  .estado-CANCELADO { background: #dbeafe; color: #1e40af; }
  .estado-JURIDICO { background: #fef3c7; color: #92400e; }
  .estado-PENDIENTE_ACEPTACION { background: #fef3c7; color: #92400e; }
  
  .prestamo-info {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px 12px;
    font-size: 10px;
    margin-top: 4px;
    color: #4b5563;
  }
  .prestamo-info strong { color: #1f2937; }
  
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 8px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .badge-APLICADO { background: #d1fae5; color: #065f46; }
  .badge-PAGO_PARCIAL { background: #fef3c7; color: #92400e; }
  .badge-REVERSADO { background: #fee2e2; color: #991b1b; }
  .badge-PENDIENTE { background: #e0e7ff; color: #3730a3; }
  
  .cuenta-pago {
    background: #eff6ff;
    border: 1px dashed #1e40af;
    padding: 8px 10px;
    margin-top: 6px;
    border-radius: 3px;
    font-size: 10px;
  }
  
  .footer {
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    font-size: 9px;
    color: #9ca3af;
    text-align: center;
  }
  
  .print-button {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1e40af;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    z-index: 999;
  }
  .print-button:hover { background: #1e3a8a; }
  
  @media print {
    .print-button { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

  <div class="header">
    <h1>ESTADO DE CUENTA</h1>
    <p class="subtitle">Sistema de Gestión de Préstamos</p>
    <p class="fecha-gen">Generado el ${fechaGen}</p>
  </div>

  <!-- Datos del cliente -->
  <div class="section">
    <div class="section-title">📋 Datos del Cliente</div>
    <div class="section-body">
      <div class="datos-cliente">
        <div class="dato"><span class="label">Nombre:</span><span class="value">${cliente.nombre}</span></div>
        <div class="dato"><span class="label">Cédula:</span><span class="value">${cliente.cedula}</span></div>
        <div class="dato"><span class="label">Teléfono:</span><span class="value">${cliente.telefono}</span></div>
        <div class="dato"><span class="label">Email:</span><span class="value">${cliente.email || '—'}</span></div>
        <div class="dato"><span class="label">Departamento:</span><span class="value">${cliente.departamento || '—'}</span></div>
        <div class="dato"><span class="label">Municipio:</span><span class="value">${cliente.municipio || '—'}</span></div>
        <div class="dato"><span class="label">Dirección:</span><span class="value">${cliente.direccion || '—'}</span></div>
        <div class="dato"><span class="label">Categoría:</span><span class="value">${cliente.categoria}</span></div>
        ${cliente.bancoCliente ? `
        <div class="dato"><span class="label">Banco:</span><span class="value">${cliente.bancoCliente}</span></div>
        <div class="dato"><span class="label">Cuenta:</span><span class="value">${cliente.tipoCuentaCliente} ${cliente.numeroCuentaCliente}</span></div>
        ` : ''}
      </div>
    </div>
  </div>

  <!-- Resumen -->
  <div class="section">
    <div class="section-title">💰 Resumen General</div>
    <div class="section-body">
      <div class="resumen">
        <div class="resumen-card">
          <div class="label">Total Prestado</div>
          <div class="value">${formatearMoneda(totales.totalPrestado)}</div>
        </div>
        <div class="resumen-card pagado">
          <div class="label">Total Pagado</div>
          <div class="value">${formatearMoneda(totales.totalPagado)}</div>
        </div>
        <div class="resumen-card saldo">
          <div class="label">Saldo Pendiente</div>
          <div class="value">${formatearMoneda(totales.totalSaldo)}</div>
        </div>
        <div class="resumen-card mora">
          <div class="label">Mora Acumulada</div>
          <div class="value">${formatearMoneda(totales.totalMora)}</div>
        </div>
      </div>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 10px;">
        <strong>${totales.numPrestamos}</strong> préstamo(s) registrado(s)
      </p>
    </div>
  </div>

  <!-- Detalle por préstamo -->
  ${prestamos.map((p: any) => {
    const pagosAplicados = p.pagos.filter((pg: any) => pg.estado === 'APLICADO' || pg.estado === 'PAGO_PARCIAL')
    const totalPagosPrestamo = pagosAplicados.reduce((s: number, pg: any) => s + pg.montoTotal, 0)
    
    return `
    <div class="prestamo-block">
      <div class="prestamo-header">
        <span class="codigo">${p.codigo}</span>
        <span class="estado estado-${p.estado}">${p.estado.replace('_', ' ')}</span>
        <div class="prestamo-info">
          <div><strong>Monto:</strong> ${formatearMoneda(p.montoPrincipal)}</div>
          <div><strong>Cuota:</strong> ${formatearMoneda(p.montoCuota)}</div>
          <div><strong>Cuotas:</strong> ${p.cuotasPagadas}/${p.numeroCuotas} (${p.frecuencia.toLowerCase()})</div>
          <div><strong>Total a pagar:</strong> ${formatearMoneda(p.totalPagar)}</div>
          <div><strong>Saldo:</strong> ${formatearMoneda(p.saldoTotal)}</div>
          <div><strong>Interés anual:</strong> ${p.tasaInteresAnual}%</div>
          <div><strong>Mora diaria:</strong> ${p.tasaMoraDiaria}%</div>
          <div><strong>Desembolso:</strong> ${p.fechaDesembolso ? formatearFecha(p.fechaDesembolso) : '—'}</div>
        </div>
      </div>
      
      ${p.cuentaRecaudoPago ? `
      <div class="cuenta-pago">
        🏦 <strong>Cuenta para pagos:</strong> ${p.cuentaRecaudoPago.banco} — ${p.cuentaRecaudoPago.tipoCuenta} — 
        <span style="font-family: 'Courier New', monospace;">${p.cuentaRecaudoPago.numeroCuenta}</span>
        (Titular: ${p.cuentaRecaudoPago.titular})
      </div>
      ` : ''}
      
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Vencimiento</th>
            <th>Fecha Pago</th>
            <th>Capital</th>
            <th>Interés</th>
            <th>Mora</th>
            <th>Total</th>
            <th>Método</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${p.tablaAmortizacion.map((c: any) => {
            const pago = p.pagos.find((pg: any) => pg.numeroCuota === c.numero && (pg.estado === 'APLICADO' || pg.estado === 'PAGO_PARCIAL'))
            if (pago) {
              return `
              <tr>
                <td>${pago.numeroCuota}</td>
                <td>${formatearFecha(pago.fechaVencimiento)}</td>
                <td>${pago.fechaPago ? formatearFecha(pago.fechaPago) : '—'}</td>
                <td class="num">${formatearMoneda(pago.montoCapital)}</td>
                <td class="num">${formatearMoneda(pago.montoInteres)}</td>
                <td class="num">${pago.montoMora > 0 ? formatearMoneda(pago.montoMora) : '—'}</td>
                <td class="num"><strong>${formatearMoneda(pago.montoTotal)}</strong></td>
                <td>${pago.metodoPago}</td>
                <td><span class="badge badge-${pago.estado}">${pago.estado.replace('_', ' ')}</span></td>
              </tr>
              ${pago.notas ? `<tr><td colspan="9" style="font-style: italic; color: #6b7280; padding-left: 20px; font-size: 9px;">📝 ${pago.notas}</td></tr>` : ''}
              `
            } else {
              // Cuota pendiente
              const diasMora = calcularDiasMora(c.fechaVencimiento)
              const mora = diasMora > 0 ? calcularMoraCompuesta(p.montoPrincipal, p.tasaMoraDiaria, diasMora) : 0
              return `
              <tr style="background: ${diasMora > 0 ? '#fef2f2' : '#fffbeb'}20;">
                <td>${c.numero}</td>
                <td>${formatearFecha(c.fechaVencimiento)}</td>
                <td>—</td>
                <td class="num">${formatearMoneda(c.capital)}</td>
                <td class="num">${formatearMoneda(c.interes)}</td>
                <td class="num">${mora > 0 ? '<span style="color: #dc2626;">' + formatearMoneda(mora) + '</span>' : '—'}</td>
                <td class="num">${formatearMoneda(c.montoCuota + mora)}</td>
                <td>—</td>
                <td><span class="badge badge-PENDIENTE">${diasMora > 0 ? 'VENCIDA (' + diasMora + ' días)' : 'PENDIENTE'}</span></td>
              </tr>
              `
            }
          }).join('')}
          <tr class="total-row">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td class="num">${formatearMoneda(p.montoPrincipal - p.saldoCapital)}</td>
            <td class="num">${formatearMoneda(p.totalInteres - p.saldoInteres)}</td>
            <td class="num">${formatearMoneda(p.montoMora)}</td>
            <td class="num">${formatearMoneda(totalPagosPrestamo)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </div>
    `
  }).join('')}

  <div class="footer">
    <p>Documento generado automáticamente por el Sistema de Gestión de Préstamos</p>
    <p>Este estado de cuenta es una referencia de los pagos registrados. En caso de discrepancia, contacte a su gestor.</p>
    <p>© ${new Date().getFullYear()} - Sistema de Gestión de Préstamos</p>
  </div>

  <script>
    // Auto-abrir diálogo de impresión después de 1 segundo
    setTimeout(() => {
      if (window.location.search.includes('auto=1')) {
        window.print()
      }
    }, 1000)
  </script>
</body>
</html>`
}
