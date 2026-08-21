import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
  calcularCargosInicialesPendientes,
  formatearMoneda,
  formatearFecha,
} from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireAuth } from '@/lib/auth-guard'
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
            firmas: {  // incluir firmas electrónicas para sección de aceptación
              where: { estadoFirma: 'COMPLETADA' },
              orderBy: { fechaFirmaCompleta: 'desc' },
              take: 3,  // últimas 3 firmas completadas
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
      const auth = requireAuth(req)
      if (auth instanceof NextResponse) return auth
    }

    // Calcular totales
    let totalPrestado = 0
    let totalPagado = 0
    let totalSaldo = 0
    let totalMora = 0
    let totalCargosInicialesPendientes = 0  // nuevo (Task 12)

    const prestamosCalculados = cliente.prestamos.map((p) => {
      // === Usar la función de cálculo correcta según la modalidad del préstamo ===
      // - TASA_FIJA: calcularPrestamoTasaFijaMensual (interés fijo sobre capital inicial,
      //   cuota constante, mismo capital y mismo interés en todas las cuotas)
      // - FRANCES (default): calcularPrestamo (sistema francés, interés sobre saldo
      //   decreciente, capital crece e interés decrece en cada cuota)
      // - CUOTA_PERSONALIZADA: usar los valores guardados en el préstamo (no recalcular)
      // - INTERES_FIJO_SIN_CAPITAL: no tiene tabla de amortización tradicional
      let calculo: any
      if (p.modalidadAmortizacion === 'TASA_FIJA') {
        calculo = calcularPrestamoTasaFijaMensual({
          montoPrincipal: p.montoPrincipal,
          tasaMensualFija: p.tasaInteresMensual || p.tasaInteresAnual / 12,
          numeroCuotas: p.numeroCuotas,
          frecuencia: p.frecuencia as any,
          // === FIX (2026-08-21): usar fechaInicioAmortizacion si está disponible ===
          fechaDesembolso: p.fechaInicioAmortizacion || p.fechaDesembolso || undefined,
        })
      } else if (p.modalidadAmortizacion === 'INTERES_FIJO_SIN_CAPITAL') {
        // Modalidad especial: no hay tabla de amortización tradicional.
        // El cliente paga intereses fijos mensuales mientras mantenga deuda de capital.
        // Mostramos una "tabla" informativa con el saldo real y la próxima cuota.
        calculo = {
          numeroCuotas: 0,
          montoCuota: p.interesFijoMensual || 0,
          totalInteres: 0,
          totalPagar: p.montoPrincipal,
          tasaAplicada: 0,
          tablaAmortizacion: [],
          fechaVencimiento: null,
          fondoGarantia: 0,
        }
      } else {
        calculo = calcularPrestamo({
          montoPrincipal: p.montoPrincipal,
          tasaInteresAnual: p.tasaInteresAnual,
          tasaMoraAnual: getTasaMoraAnual(p),
          plazoMeses: p.plazoMeses,
          frecuencia: p.frecuencia as any,
          // === FIX (2026-08-21): usar fechaInicioAmortizacion si está disponible ===
          fechaDesembolso: p.fechaInicioAmortizacion || p.fechaDesembolso || undefined,
        })
      }

      // === FIX Task 12: calcular cargos iniciales pendientes de cobrar ===
      // Estos cargos (pagaré + carta, tarifa plataforma, flexibilidad financiera,
      // fondo de garantía) se mostraban en el estado de cuenta como "incluidos
      // en la primera cuota" pero NUNCA se sumaban al saldo pendiente ni a la
      // cuota. Ahora se calculan y se exponen al template HTML para que:
      //   - La primera cuota muestre el monto con cargos incluidos
      //   - El saldo pendiente incluya los cargos pendientes
      const cargosInicialesInfo = calcularCargosInicialesPendientes(p)

      // Verificar si la cuota 1 ya fue pagada (APLICADO) para saber si los
      // cargos del pagaré (que no tiene flag propio) ya se consideran cobrados.
      const cuota1Aplicada = p.pagos.some(pg => pg.numeroCuota === 1 && pg.estado === 'APLICADO')
      // Si la cuota 1 fue aplicada, los cargos del pagaré y del fondo de garantía
      // (que se cobran en cuota 1 y no tienen flag de "aplicado" propio) ya se cobraron.
      const cargosInicialesInfoAjustada = {
        ...cargosInicialesInfo,
        cargos: cargosInicialesInfo.cargos.map(c => {
          if (c.concepto === 'PAGARE_CARTA' && cuota1Aplicada) {
            return { ...c, yaCobrado: true }
          }
          if (c.concepto === 'FONDO_GARANTIA' && cuota1Aplicada) {
            return { ...c, yaCobrado: true }
          }
          return c
        }),
      }
      const cargosInicialesPendientes = cargosInicialesInfoAjustada.cargos
        .filter(c => !c.yaCobrado)
        .reduce((s, c) => s + c.monto, 0)

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
      // === FIX Task 12: sumar cargos iniciales pendientes al saldo mostrado ===
      // IMPORTANTE: Para evitar doble contabilidad, solo sumamos los cargos
      // iniciales pendientes SI el saldoTotal del préstamo NO los incluye ya.
      // El saldoTotal del préstamo incluye los cargos cuando:
      //   - El préstamo fue creado con cargos y el saldo se calculó como
      //     totalPagar (que incluye los cargos) - montoPagado.
      // El saldoTotal NO incluye los cargos cuando:
      //   - El préstamo es legacy (creado antes del fix Task 12).
      // Para distinguir, comparamos: si (saldoTotal + cargosInicialesPendientes)
      // excede significativamente el totalPagar teórico (capital + interés + cargos),
      // es probable que ya estén incluidos.
      //
      // SOLUCIÓN SIMPLE: usar el máximo entre saldoTotal y (saldoTotal sin cargos + cargos),
      // pero evitando doble cuenta. Lo más correcto es:
      //   - Si saldoTotal ya incluye los cargos (caso nuevo): NO sumarlos de nuevo.
      //   - Si saldoTotal no los incluye (caso legacy): sumarlos.
      //
      // Heurística: si saldoTotal >= montoPrincipal + totalInteres + cargosInicialesPendientes - montoPagado - 1,
      // entonces saldoTotal ya incluye los cargos.
      const saldoSinCargos = p.montoPrincipal + p.totalInteres - p.montoPagado
      const saldoConCargosEsperado = saldoSinCargos + cargosInicialesPendientes
      // Si el saldoTotal guardado ya es >= al esperado con cargos, no sumar de nuevo
      const saldoYaIncluyeCargos = p.saldoTotal >= saldoConCargosEsperado - 1
      const saldoParaMostrar = saldoYaIncluyeCargos
        ? p.saldoTotal
        : p.saldoTotal + cargosInicialesPendientes
      totalSaldo += saldoParaMostrar
      totalMora += p.montoMora
      totalCargosInicialesPendientes += cargosInicialesPendientes

      return {
        ...p,
        tablaAmortizacion: calculo.tablaAmortizacion,
        pagos: pagosConMora,
        cuentaRecaudoPago: p.categoria?.cuentaRecaudo || cliente.categoria?.cuentaRecaudo || null,
        // === FIX 2026-08-13 (Task 12): incluir datos del cliente para que la
        // sección de firma electrónica NO muestre "No registrado" cuando el
        // cliente SÍ tiene email/teléfono. Antes este objeto venía sin
        // `cliente` y la plantilla caía en `p.cliente?.email || 'No registrado'`.
        cliente: {
          nombre: cliente.nombre,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          email: cliente.email,
        },
        // === FIX Task 12: información de cargos iniciales para el template ===
        cargosInicialesInfo: cargosInicialesInfoAjustada,
        cargosInicialesPendientes,
        // === FIX (2026-08-20): flag para evitar doble cuenta de cargos iniciales ===
        // Si saldoTotal ya incluye los cargos (préstamos nuevos), el template NO debe
        // sumarlos de nuevo. Si no los incluye (préstamos legacy), el template los suma.
        saldoYaIncluyeCargos,
        cuota1Aplicada,
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
        totalCargosInicialesPendientes,  // nuevo (Task 12)
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
      ${totales.totalCargosInicialesPendientes > 0 ? `
      <div style="margin-top: 10px; padding: 8px 12px; background: #faf5ff; border-left: 4px solid #7c3aed; border-radius: 0 6px 6px 0; font-size: 11px; color: #4c1d95;">
        <strong>📌 Cargos iniciales pendientes (incluidos en la primera cuota):</strong> ${formatearMoneda(totales.totalCargosInicialesPendientes)}
        <div style="font-size: 9px; color: #6d28d9; margin-top: 2px;">
          Corresponde a Pagaré + Carta, Tarifa de Plataforma, Flexibilidad Financiera y/o Fondo de Garantía que aún no han sido cobrados.
          Se suman a la primera cuota pendiente del crédito.
        </div>
      </div>
      ` : ''}
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
          <div><strong>Total a pagar:</strong> ${formatearMoneda(p.saldoYaIncluyeCargos ? p.totalPagar : p.totalPagar + (p.cargosInicialesPendientes || 0))}${p.cargosInicialesPendientes > 0 ? `<br/><span style="font-size:8px;color:#6d28d9;">incluye ${formatearMoneda(p.cargosInicialesPendientes)} cargos iniciales</span>` : ''}</div>
          <div><strong>Saldo:</strong> ${formatearMoneda(p.saldoYaIncluyeCargos ? p.saldoTotal : p.saldoTotal + (p.cargosInicialesPendientes || 0))}${(!p.saldoYaIncluyeCargos && p.cargosInicialesPendientes > 0) ? `<br/><span style="font-size:8px;color:#6d28d9;">+${formatearMoneda(p.cargosInicialesPendientes)} cargos pendientes</span>` : ''}</div>
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
            // === FIX Task 12: en la cuota 1, sumar los cargos iniciales pendientes al total ===
            // Esto refleja que los cargos (pagaré, tarifa plataforma, flexibilidad, fondo garantía)
            // se cobran UNA sola vez al inicio y van sumados a la primera cuota.
            const cargosCuota1 = (c.numero === 1 && !p.cuota1Aplicada) ? (p.cargosInicialesPendientes || 0) : 0
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
              const totalCuotaConCargos = c.montoCuota + mora + cargosCuota1
              return `
              <tr style="background: ${diasMora > 0 ? '#fef2f2' : '#fffbeb'}20;">
                <td>${c.numero}</td>
                <td>${formatearFecha(c.fechaVencimiento)}</td>
                <td>—</td>
                <td class="num">${formatearMoneda(c.capital)}</td>
                <td class="num">${formatearMoneda(c.interes)}</td>
                <td class="num">${mora > 0 ? '<span style="color: #dc2626;">' + formatearMoneda(mora) + '</span>' : '—'}</td>
                <td class="num">${formatearMoneda(totalCuotaConCargos)}${cargosCuota1 > 0 ? `<br/><span style="font-size:8px;color:#6d28d9;">incluye ${formatearMoneda(cargosCuota1)} cargos iniciales</span>` : ''}</td>
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

      ${p.cobroPagareCarta ? `
      <div class="concepto-cobro" style="margin-top: 12px; border-left: 4px solid #7c3aed; background: #faf5ff; padding: 10px 14px; border-radius: 0 8px 8px 0;">
        <div style="font-weight: bold; color: #6d28d9; font-size: 11px; margin-bottom: 4px;">📄 CONCEPTO: Pagaré + Carta de Instrucciones</div>
        <div style="font-size: 10px; color: #4c1d95; line-height: 1.5;">
          Se cobra un valor único de <strong>${formatearMoneda(p.valorPagareCarta || 19900)}</strong> por la elaboración y gestión del pagaré y la carta de instrucciones
          asociados al crédito <strong>${p.codigo}</strong>. Este cargo se aplica una sola vez al inicio del crédito y está incluido en la primera cuota.
          El pagaré y la carta de instrucciones constituyen los documentos legales que respaldan la obligación financiera del cliente.
        </div>
      </div>
      ` : ''}

      ${p.flexibilidadFinanciera ? `
      <div class="concepto-cobro" style="margin-top: 8px; border-left: 4px solid #059669; background: #ecfdf5; padding: 10px 14px; border-radius: 0 8px 8px 0;">
        <div style="font-weight: bold; color: #047857; font-size: 11px; margin-bottom: 4px;">✨ CONCEPTO: Flexibilidad Financiera (${p.flexibilidadModalidad || 'BASICA'})</div>
        <div style="font-size: 10px; color: #064e3b; line-height: 1.5;">
          Se cobra un valor único de <strong>${formatearMoneda(p.flexibilidadCosto || 0)}</strong> por el beneficio de Flexibilidad Financiera
          (${p.flexibilidadModalidad === 'PREMIUM' ? 'Premium — 2 usos disponibles' : 'Básica — 1 uso disponible'} durante la vigencia del crédito).
          Este cargo se aplica una sola vez al inicio del crédito y está incluido en la primera cuota.
          El beneficio permite al cliente <strong>trasladar una cuota al final del crédito</strong> o <strong>solicitar cambio de fecha de pago</strong>
          (genera documento "Otro Sí" firmado electrónicamente con OTP), evitando la generación de intereses moratorios por impago puntual.
          Usos disponibles restantes: <strong>${p.flexibilidadUsosDisponibles ?? (p.flexibilidadModalidad === 'PREMIUM' ? 2 : 1)}</strong> de ${p.flexibilidadModalidad === 'PREMIUM' ? '2' : '1'}.
          Usos ejercidos: <strong>${p.flexibilidadUsosEjercidos ?? 0}</strong>.
        </div>
      </div>
      ` : ''}

      ${(() => {
        // === Tarea Q: Historial de cuotas trasladadas por Flexibilidad Financiera ===
        // Si el préstamo tiene movimientos de flexibilidad registrados (JSON en flexibilidadMovimientos),
        // mostrar el detalle de cada uso con su cuota, fecha original, fecha nueva, intereses causados.
        try {
          if (!p.flexibilidadMovimientos) return ''
          const movimientos = JSON.parse(p.flexibilidadMovimientos)
          if (!Array.isArray(movimientos) || movimientos.length === 0) return ''
          return `
      <div class="concepto-cobro" style="margin-top: 8px; border-left: 4px solid #0d9488; background: #f0fdfa; padding: 10px 14px; border-radius: 0 8px 8px 0;">
        <div style="font-weight: bold; color: #0f766e; font-size: 11px; margin-bottom: 6px;">🔄 CONCEPTO: Cuotas trasladadas al final del crédito (uso de Flexibilidad Financiera)</div>
        <div style="font-size: 10px; color: #134e4a; line-height: 1.5; margin-bottom: 6px;">
          Las siguientes cuotas fueron trasladadas al final del crédito mediante el ejercicio del beneficio de Flexibilidad Financiera.
          Los intereses moratorios causados al momento del traslado se incluyen en el monto de la cuota trasladada (NO se cobran aparte),
          y no se genera mora adicional sobre estas cuotas mientras estén aplazadas.
        </div>
        <table style="width: 100%; font-size: 10px; border-collapse: collapse; margin-top: 4px;">
          <thead>
            <tr style="background: #ccfbf1; color: #134e4a;">
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #99f6e4;">#</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #99f6e4;">Cuota</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #99f6e4;">Vencimiento original</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #99f6e4;">Nuevo vencimiento</th>
              <th style="padding: 4px 6px; text-align: right; border: 1px solid #99f6e4;">Intereses causados</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #99f6e4;">Fecha uso</th>
            </tr>
          </thead>
          <tbody>
            ${movimientos.map((m: any, idx: number) => `
              <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdfa'};">
                <td style="padding: 4px 6px; border: 1px solid #99f6e4;">${idx + 1}</td>
                <td style="padding: 4px 6px; border: 1px solid #99f6e4; font-weight: bold;">#${m.cuotaTrasladada}</td>
                <td style="padding: 4px 6px; border: 1px solid #99f6e4;">${formatearFecha(new Date(m.vencimientoOriginal))}</td>
                <td style="padding: 4px 6px; border: 1px solid #99f6e4; font-weight: bold; color: #0f766e;">${formatearFecha(new Date(m.vencimientoNuevo))}</td>
                <td style="padding: 4px 6px; border: 1px solid #99f6e4; text-align: right; color: #b91c1c;">+${formatearMoneda(m.interesesCausados || 0)}</td>
                <td style="padding: 4px 6px; border: 1px solid #99f6e4;">${formatearFecha(new Date(m.fechaUso))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="font-size: 9px; color: #134e4a; margin-top: 6px; font-style: italic;">
          Cada cuota trasladada se reprograma al final del crédito (después de la última cuota programada), conservando su capital e interés original más los intereses moratorios causados al momento del traslado.
        </div>
      </div>
          `
        } catch (e) {
          return ''
        }
      })()}

      ${p.fondoGarantiaCargado && p.fondoGarantiaMonto > 0 ? `
      <div class="concepto-cobro" style="margin-top: 8px; border-left: 4px solid #0891b2; background: #ecfeff; padding: 10px 14px; border-radius: 0 8px 8px 0;">
        <div style="font-weight: bold; color: #0e7490; font-size: 11px; margin-bottom: 4px;">🛡️ CONCEPTO: Fondo de Garantía</div>
        <div style="font-size: 10px; color: #155e75; line-height: 1.5;">
          Se cobra un valor de <strong>${formatearMoneda(p.fondoGarantiaMonto)}</strong> correspondiente al fondo de garantía (${(p.fondoGarantiaTasa * 100).toFixed(2)}% del monto del crédito).
          Este cargo se aplica una sola vez al inicio del crédito y está incluido en la primera cuota.
          El fondo protege al cliente en caso de imprevistos y será devuelto al finalizar el crédito, previa verificación de cumplimiento de obligaciones.
        </div>
      </div>
      ` : ''}

      ${p.cobroTarifaPlataforma ? `
      <div class="concepto-cobro" style="margin-top: 8px; border-left: 4px solid #d97706; background: #fffbeb; padding: 10px 14px; border-radius: 0 8px 8px 0;">
        <div style="font-weight: bold; color: #b45309; font-size: 11px; margin-bottom: 4px;">💻 CONCEPTO: Tarifa de Uso de Plataforma</div>
        <div style="font-size: 10px; color: #78350f; line-height: 1.5;">
          Se cobra un valor único de <strong>${formatearMoneda(p.valorTarifaPlataforma || 4900)}</strong> por el uso de la plataforma tecnológica
          asociada al crédito <strong>${p.codigo}</strong>. Este cargo se aplica una sola vez al inicio del crédito y está incluido en la primera cuota.
          La tarifa cubre los costos de gestión digital, firma electrónica, verificación de identidad y disponibilidad del portal del cliente.
        </div>
      </div>
      ` : ''}

      ${p.firmas && p.firmas.length > 0 ? `
      <div class="firma-aceptacion" style="margin-top: 20px; border: 2px solid #16a34a; border-radius: 10px; padding: 16px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #16a34a;">
          <span style="font-size: 22px;">✍️</span>
          <h3 style="margin: 0; font-size: 14px; color: #14532d; font-weight: 700; letter-spacing: 0.5px;">ACEPTACIÓN Y FIRMA DEL CLIENTE</h3>
          <span style="margin-left: auto; background: #16a34a; color: white; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700;">✓ FIRMADO</span>
        </div>
        ${p.firmas.map((f: any) => {
          // FIX 2026-08-12 (Task 6): Mostrar el destino concreto del OTP (email
          // o teléfono confirmado por el cliente) al lado del canal, para que
          // el estado de cuenta sea trazable y se pueda verificar a qué correo
          // o WhatsApp llegó el código. Antes solo se veía "EMAIL" / "WHATSAPP"
          // sin saber a qué contacto se envió.
          const telCliente = p.cliente?.telefono || '—'
          const emailCliente = p.cliente?.email || '—'
          let destinoOtpTxt = 'No especificado'
          if (f.otpCanal === 'WHATSAPP') destinoOtpTxt = `WhatsApp al ${telCliente}`
          else if (f.otpCanal === 'EMAIL') destinoOtpTxt = `Correo a ${emailCliente}`
          else if (f.otpCanal === 'AMBOS') destinoOtpTxt = `WhatsApp ${telCliente} y correo ${emailCliente}`
          return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; font-size: 11px; color: #14532d;">
          <div><strong>📄 Tipo documento:</strong> ${f.tipo === 'TYC' ? 'Términos y Condiciones' : f.tipo === 'PAGARE' ? 'Pagaré' : f.tipo === 'CONTRATO' ? 'Contrato' : f.tipo}</div>
          <div><strong>👤 Firmante:</strong> ${f.firmanteNombre || p.cliente?.nombre || '—'}${f.firmanteRol ? ` (${f.firmanteRol})` : ''}</div>
          <div><strong>🆔 Cédula firmante:</strong> ${f.firmanteCedula || p.cliente?.cedula || '—'}</div>
          <div><strong>🔐 Canal OTP:</strong> ${f.otpCanal || '—'}</div>
          <div style="grid-column: 1 / -1;"><strong>📬 Destino OTP confirmado:</strong> <strong>${destinoOtpTxt}</strong></div>
          <div><strong>📅 Fecha firma:</strong> ${f.fechaFirmaCompleta ? formatearFecha(f.fechaFirmaCompleta) : '—'} ${f.fechaFirmaCompleta ? new Date(f.fechaFirmaCompleta).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }) : ''}</div>
          <div><strong>🌍 IP origen:</strong> ${f.ipFirma || '—'}</div>
          <div><strong>🔑 Estado:</strong> <span style="color: #16a34a; font-weight: 700;">COMPLETADA</span></div>
          <div><strong>🆔 ID firma:</strong> <span style="font-family: 'Courier New', monospace; font-size: 10px;">${f.id.substring(0, 18)}…</span></div>
        </div>
        ${f.imagenFirma ? `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #16a34a; display: flex; align-items: center; gap: 16px;">
          <div style="background: white; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px;">
            <img src="${f.imagenFirma.startsWith('data:') ? f.imagenFirma : `data:image/png;base64,${f.imagenFirma}`}" alt="Firma del cliente" style="height: 60px; width: auto; display: block;" />
            <div style="text-align: center; font-size: 9px; color: #6b7280; margin-top: 2px;">Firma manuscrita digital</div>
          </div>
          <div style="font-size: 10px; color: #14532d; line-height: 1.5;">
            <div style="font-weight: 700; margin-bottom: 4px;">Declaración de aceptación:</div>
            El cliente declara haber leído, entendido y aceptado voluntariamente los términos y condiciones del préstamo <strong>${p.codigo}</strong>, así como la obligación de pago según el cronograma arriba detallado. La firma electrónica tiene plena validez legal conforme a la Ley 527 de 1999 y el Decreto 1074 de 2015.
          </div>
        </div>
        ` : `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #16a34a;">
          <div style="font-size: 10px; color: #14532d; line-height: 1.5;">
            <div style="font-weight: 700; margin-bottom: 4px;">Declaración de aceptación:</div>
            El cliente declara haber leído, entendido y aceptado voluntariamente los términos y condiciones del préstamo <strong>${p.codigo}</strong>, así como la obligación de pago según el cronograma arriba detallado. La firma electrónica tiene plena validez legal conforme a la Ley 527 de 1999 y el Decreto 1074 de 2015.
          </div>
        </div>
        `}
        ` }).join('')}
      </div>
      ` : `
      <div class="firma-aceptacion" style="margin-top: 20px; border: 2px dashed #d1d5db; border-radius: 10px; padding: 16px 20px; background: #f9fafb;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="font-size: 18px;">⏳</span>
          <h3 style="margin: 0; font-size: 13px; color: #6b7280; font-weight: 600;">SIN FIRMA ELECTRÓNICA REGISTRADA</h3>
          <span style="margin-left: auto; background: #f3f4f6; color: #6b7280; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600;">PENDIENTE</span>
        </div>
        <div style="font-size: 10px; color: #6b7280; line-height: 1.4;">
          Este préstamo aún no cuenta con firma electrónica registrada. El cliente debe completar el proceso de aceptación y firma para validar el documento.
        </div>
      </div>
      `}
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
