// =====================================================
// Página pública de verificación de autenticidad del contrato
// URL: /verificar-contrato?hash=XXXX
// Permite a cualquier persona verificar si un contrato es auténtico
// consultando el hash SHA-256 impreso en el PDF.
// =====================================================
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hash = searchParams.get('hash')?.toUpperCase().trim()
  const contrato = searchParams.get('contrato')?.trim()

  if (!hash || hash.length < 8) {
    return new Response(renderHTML('Hash inválido', 'El hash proporcionado no es válido. Verifique que esté copiado correctamente desde el PDF del contrato.', 'error'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Buscar contrato por número si se proporciona, si no, buscar en todos
  const where = contrato ? { numeroContrato: contrato } : {}
  const documentos = await db.contratoDocumentoVehiculo.findMany({
    where,
    include: { contratoVehiculo: { select: { vehiculoId: true } } },
    take: 200,
  })

  // Buscar documento cuyo hash coincida
  let encontrado: any = null
  for (const doc of documentos) {
    // Reconstruir el hash igual que en descargar/route.ts
    const datosFirma = [
      doc.numeroContrato,
      doc.vehiculoPlaca,
      doc.propietarioCedula,
      doc.conductorCedula,
      doc.fechaInicio?.toISOString() || '',
      doc.fechaFin?.toISOString() || '',
      doc.tarifa?.toString() || '',
      doc.conductorOtpHash || '',
      doc.propietarioOtpHash || '',
      doc.conductorFechaFirma?.toISOString() || '',
      doc.propietarioFechaFirma?.toISOString() || '',
    ].join('|')
    const hashCalculado = crypto.createHash('sha256').update(datosFirma).digest('hex').toUpperCase()
    const hashCalculadoCorto = hashCalculado.substring(0, 16)

    if (hashCalculado === hash || hashCalculadoCorto === hash) {
      encontrado = doc
      break
    }
  }

  if (!encontrado) {
    return new Response(renderHTML('Contrato NO verificado', `No se encontró ningún contrato cuyo hash de autenticidad coincida con <code>${hash}</code>. Esto puede indicar que el documento fue modificado, alterado o no existe en el sistema.`, 'error'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const html = renderHTML('✓ Contrato verificado', `
    <p>El contrato <strong>${encontrado.numeroContrato}</strong> ha sido verificado exitosamente en el sistema de Jsadr.</p>
    <table class="info-table">
      <tr><td>Número de contrato</td><td><strong>${encontrado.numeroContrato}</strong></td></tr>
      <tr><td>Vehículo</td><td>${encontrado.vehiculoMarca} ${encontrado.vehiculoModelo} - Placa <strong>${encontrado.vehiculoPlaca}</strong></td></tr>
      <tr><td>Arrendador</td><td>${encontrado.propietarioNombre} (CC ${encontrado.propietarioCedula})</td></tr>
      <tr><td>Arrendatario</td><td>${encontrado.conductorNombre} (CC ${encontrado.conductorCedula})</td></tr>
      <tr><td>Fecha de inicio</td><td>${encontrado.fechaInicio?.toLocaleDateString('es-CO') || '—'}</td></tr>
      <tr><td>Fecha de terminación</td><td>${encontrado.fechaFin?.toLocaleDateString('es-CO') || 'Indefinida'}</td></tr>
      <tr><td>Estado del proceso</td><td><span class="badge badge-${encontrado.estado === 'COMPLETADO' ? 'success' : 'warning'}">${encontrado.estado}</span></td></tr>
      <tr><td>Firma del conductor</td><td>${encontrado.conductorOtpValidado ? '<span class="badge badge-success">✓ Verificada</span>' : '<span class="badge badge-warning">Pendiente</span>'}</td></tr>
      <tr><td>Firma del propietario</td><td>${encontrado.propietarioOtpValidado ? '<span class="badge badge-success">✓ Verificada</span>' : '<span class="badge badge-warning">Pendiente</span>'}</td></tr>
      <tr><td>Fecha firma conductor</td><td>${encontrado.conductorFechaFirma ? new Date(encontrado.conductorFechaFirma).toLocaleString('es-CO') : '—'}</td></tr>
      <tr><td>Fecha firma propietario</td><td>${encontrado.propietarioFechaFirma ? new Date(encontrado.propietarioFechaFirma).toLocaleString('es-CO') : '—'}</td></tr>
    </table>
    <p class="note">El presente certificado confirma la autenticidad del documento conforme a la Ley 527 de 1999 (mensajes de datos) y el Decreto 1074 de 2015. La firma electrónica tiene plena validez jurídica.</p>
  `, 'success')

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export { GET as POST }

function renderHTML(title: string, body: string, type: 'success' | 'error' | 'warning' = 'success') {
  const color = type === 'success' ? '#16a34a' : type === 'warning' ? '#ca8a04' : '#dc2626'
  const bgColor = type === 'success' ? '#dcfce7' : type === 'warning' ? '#fef3c7' : '#fee2e2'
  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✗'
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - Jsadr</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    min-height: 100vh;
    margin: 0;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    max-width: 700px;
    width: 100%;
    padding: 40px;
  }
  .header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e5e7eb;
  }
  .logo {
    font-size: 24px;
    font-weight: 700;
    color: #1e3a8a;
    margin: 0;
  }
  .subtitle {
    color: #6b7280;
    font-size: 14px;
    margin-top: 5px;
  }
  .status-card {
    background: ${bgColor};
    border-left: 4px solid ${color};
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 25px;
  }
  .status-title {
    color: ${color};
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 10px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .status-icon {
    background: ${color};
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }
  .info-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
  }
  .info-table td:first-child {
    color: #6b7280;
    font-weight: 500;
    width: 45%;
  }
  .info-table td:last-child {
    color: #111827;
  }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .badge-success { background: #dcfce7; color: #16a34a; }
  .badge-warning { background: #fef3c7; color: #ca8a04; }
  .badge-error { background: #fee2e2; color: #dc2626; }
  .note {
    background: #f9fafb;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    color: #6b7280;
    border-left: 3px solid #d1d5db;
    margin-top: 20px;
  }
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: #1e3a8a;
    word-break: break-all;
  }
  .footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    color: #9ca3af;
    font-size: 12px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">🔒 Jsadr</h1>
      <p class="subtitle">Verificación de autenticidad de contratos</p>
    </div>
    <div class="status-card">
      <h2 class="status-title">
        <span class="status-icon">${icon}</span>
        ${title}
      </h2>
      <div>${body}</div>
    </div>
    <div class="footer">
      Sistema de verificación de contratos electrónicos · Ley 527 de 1999 · Decreto 1074 de 2015<br>
      © ${new Date().getFullYear()} Jsadr · Johan Sebastian Alvarez Del Rio
    </div>
  </div>
</body>
</html>`
}
