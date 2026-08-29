// =====================================================
// /api/paz-y-salvo — Genera PDF/HTML de paz y salvo v3.0
// GET: genera documento de paz y salvo para solicitudes cancelados.
// Autenticación:
//   - Cliente del portal: ?prestamoId=xxx&token=<portal-token>
//     (el token se valida contra Cliente.tokenSesion del dueño del solicitud)
//   - Staff autenticado: requiere JWT (admin/gestor/consultor)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, logError } from '@/lib/error-handler'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { requireAuth } from '@/lib/auth-guard'
import { safeCompare } from '@/lib/security'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const prestamoId = searchParams.get('prestamoId')
    const codigo = searchParams.get('codigo')
    const formato = searchParams.get('formato') || 'html'
    const portalToken = searchParams.get('token')

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
          include: { categoria: true },
        },
        pagos: {
          where: { estado: { in: ['APLICADO', 'REVERSADO'] } },
          orderBy: { numeroCuota: 'asc' },
        },
      },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // === Validación de acceso ===
    if (portalToken) {
      // Cliente desde portal: validar token contra Cliente.tokenSesion
      const now = new Date()
      const tokenValido =
        !!prestamo.cliente.tokenSesion &&
        safeCompare(prestamo.cliente.tokenSesion, portalToken) &&
        !!prestamo.cliente.tokenExpira &&
        prestamo.cliente.tokenExpira > now

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

    // Verificar que el solicitud esté cancelado o completamente pagado
    const estaCancelado = prestamo.estado === 'CANCELADO'
    const estaSaldado = prestamo.saldoTotal <= 0 && prestamo.cuotasPagadas >= prestamo.numeroCuotas

    if (!estaCancelado && !estaSaldado) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El paz y salvo solo se puede generar para solicitudes cancelados o completamente pagados',
          code: 'NOT_CANCELLED',
          estado: prestamo.estado,
          saldoPendiente: prestamo.saldoTotal,
        },
        { status: 400 }
      )
    }

    // Construir paz y salvo
    const pazYSalvo = {
      metadata: {
        fechaGeneracion: new Date().toISOString(),
        tipo: 'PAZ_Y_SALVO',
        codigoVerificacion: `PYS-${prestamo.codigo}-${Date.now().toString(36).toUpperCase()}`,
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
        direccion: prestamo.cliente.direccion,
        categoria: prestamo.cliente.categoria?.nombre || 'Sin categoría',
      },
      resumen: {
        montoPrincipal: prestamo.montoPrincipal,
        totalPagar: prestamo.totalPagar,
        totalInteres: prestamo.totalInteres,
        montoPagado: prestamo.montoPagado,
        cuotasPagadas: prestamo.cuotasPagadas,
        numeroCuotas: prestamo.numeroCuotas,
        saldoTotal: prestamo.saldoTotal,
        saldoCapital: prestamo.saldoCapital,
        saldoInteres: prestamo.saldoInteres,
      },
      totalPagosRegistrados: prestamo.pagos.length,
      ultimoPago: prestamo.pagos[prestamo.pagos.length - 1] || null,
    }

    if (formato === 'json') {
      return NextResponse.json({ success: true, data: pazYSalvo })
    }

    const html = generarPazYSalvoHTML(pazYSalvo)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logError('/api/paz-y-salvo GET', error)
    return errorResponse('/api/paz-y-salvo GET', error)
  }
}

function generarPazYSalvoHTML(pys: any): string {
  const p = pys.prestamo
  const c = pys.cliente
  const r = pys.resumen
  const fechaGen = new Date(pys.metadata.fechaGeneracion).toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Paz y Salvo - ${p.codigo}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1f2937; margin: 0; padding: 40px; font-size: 12px; line-height: 1.6; }
  .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px double #7c2d12; }
  .header h1 { color: #7c2d12; margin: 0 0 8px 0; font-size: 32px; letter-spacing: 4px; font-variant: small-caps; }
  .header .subtitle { color: #92400e; font-size: 12px; margin: 0; font-style: italic; }
  .header .codigo { color: #6b7280; font-size: 10px; margin-top: 8px; font-family: monospace; }
  .documento-body { margin: 30px 0; }
  .documento-body p { text-align: justify; margin: 0 0 16px 0; text-indent: 30px; }
  .destacado { text-align: center; font-size: 14px; font-weight: bold; color: #7c2d12; margin: 24px 0; }
  .datos { background: #fef3c7; padding: 16px 24px; border-left: 4px solid #7c2d12; margin: 24px 0; }
  .datos h3 { margin: 0 0 12px 0; color: #7c2d12; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .datos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; }
  .dato { display: flex; font-size: 11px; }
  .dato .label { color: #6b7280; min-width: 140px; font-weight: 600; }
  .dato .value { color: #1f2937; font-weight: 500; }
  .resumen-financiero { margin: 24px 0; }
  .resumen-financiero table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .resumen-financiero th { background: #7c2d12; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }
  .resumen-financiero td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  .resumen-financiero .num { text-align: right; font-family: monospace; font-weight: 600; }
  .resumen-financiero .total td { background: #fef3c7; font-weight: bold; border-top: 2px solid #7c2d12; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 80px; padding-top: 20px; }
  .firma { text-align: center; }
  .firma .linea { border-top: 1px solid #1f2937; margin-bottom: 8px; padding-top: 60px; }
  .firma .nombre { font-weight: bold; font-size: 11px; }
  .firma .cargo { color: #6b7280; font-size: 10px; font-style: italic; }
  .footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
  .print-button { position: fixed; top: 20px; right: 20px; background: #7c2d12; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.2); z-index: 999; }
  .print-button:hover { background: #581c0e; }
  @media print { .print-button { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Imprimir / PDF</button>

  <div class="header">
    <h1>PAZ Y SALVO</h1>
    <p class="subtitle">Certificado de Cumplimiento de Obligaciones Financieras</p>
    <p class="codigo">Código de verificación: ${pys.metadata.codigoVerificacion}</p>
  </div>

  <div class="documento-body">
    <p>Entre los días de la fecha, en la ciudad donde se expide este documento, el suscrito representante de la entidad financiera hace constar que:</p>

    <div class="datos">
      <h3>Datos del Cliente</h3>
      <div class="datos-grid">
        <div class="dato"><span class="label">Nombre completo:</span><span class="value">${c.nombre}</span></div>
        <div class="dato"><span class="label">Cédula de ciudadanía:</span><span class="value">${c.cedula}</span></div>
        <div class="dato"><span class="label">Teléfono:</span><span class="value">${c.telefono}</span></div>
        <div class="dato"><span class="label">Email:</span><span class="value">${c.email || '—'}</span></div>
        <div class="dato"><span class="label">Dirección:</span><span class="value">${c.direccion || '—'}</span></div>
        <div class="dato"><span class="label">Categoría:</span><span class="value">${c.categoria}</span></div>
      </div>
    </div>

    <p>Ha cumplido en su totalidad con las obligaciones adquiridas mediante el contrato de solicitud identificado con el código <strong>${p.codigo}</strong>, celebrado el ${formatearFecha(p.fechaDesembolso || p.fechaSolicitud)}, por un monto principal de <strong>${formatearMoneda(r.montoPrincipal)}</strong>.</p>

    <div class="destacado">
      ✅ CERTIFICA QUE NO PRESENTA SALDOS PENDIENTES
    </div>

    <div class="resumen-financiero">
      <table>
        <thead>
          <tr><th>Concepto</th><th class="num">Valor</th></tr>
        </thead>
        <tbody>
          <tr><td>Monto Principal del Solicitud</td><td class="num">${formatearMoneda(r.montoPrincipal)}</td></tr>
          <tr><td>Total Interés Generado</td><td class="num">${formatearMoneda(r.totalInteres)}</td></tr>
          <tr><td>Total a Pagar (Capital + Interés)</td><td class="num">${formatearMoneda(r.totalPagar)}</td></tr>
          <tr><td>Total Pagado por el Cliente</td><td class="num">${formatearMoneda(r.montoPagado)}</td></tr>
          <tr><td>Número de Cuotas Pagadas</td><td class="num">${r.cuotasPagadas} / ${r.numeroCuotas}</td></tr>
          <tr class="total"><td>SALDO PENDIENTE FINAL</td><td class="num">${formatearMoneda(r.saldoTotal)}</td></tr>
        </tbody>
      </table>
    </div>

    <p>Por lo anterior, se expide el presente <strong>PAZ Y SALVO</strong> a solicitud del interesado, para los fines que estime convenientes. Este documento no requiere de firma adicional para su validez, pero se anexan las firmas del representante legal y del cliente como constancia de recibido.</p>

    <p>Fecha de expedición: <strong>${fechaGen}</strong></p>
    <p>Estado del solicitud al momento de la expedición: <strong>${p.estado}</strong></p>

    <div class="firmas">
      <div class="firma">
        <div class="linea"></div>
        <div class="nombre">${c.nombre}</div>
        <div class="cargo">Cliente — C.C. ${c.cedula}</div>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <div class="nombre">Representante Legal</div>
        <div class="cargo">Sistema Jsadr</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Documento generado automáticamente por Sistema Jsadr v3.0</p>
    <p>Código de verificación: ${pys.metadata.codigoVerificacion} — Verifique la autenticidad en el portal del cliente.</p>
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
