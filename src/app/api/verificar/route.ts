// =====================================================
// /api/verificar — Página pública de verificación de documentos
// -----------------------------------------------------
// Esta ruta es a la que apunta el QR de los certificados
// de firma electrónica de los pagarés Jsadr.
//
// Flujo:
//   1. Alguien escanea el QR impreso en el pagaré/certificado.
//   2. El QR contiene: https://dominio/api/verificar?codigo=XXXX-XXXX-XXXX-XXXX
//   3. Esta ruta devuelve HTML con el certificado visual.
//   4. Si el código es válido muestra "Certificado de Autenticidad".
//   5. Si no es válido, muestra alerta de documento falso.
//
// Es PÚBLICA — no requiere inicio de sesión — porque un juez,
// notario o tercero debe poder verificar la autenticidad sin
// tener cuenta en el sistema.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function verificarCodigo(codigo: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/documentos/verificar?codigo=${encodeURIComponent(codigo)}`, {
      cache: 'no-store',
    })
    return await res.json()
  } catch (e: any) {
    return { success: false, error: 'No se pudo conectar al servidor de verificación: ' + e.message }
  }
}

function moneda(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('es-CO')
}

function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  } catch {
    return iso
  }
}

function estadoBadge(estado: string | null | undefined): string {
  if (!estado) return 'Desconocido'
  const map: Record<string, { txt: string; cls: string }> = {
    ACTIVO: { txt: 'Activo', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    PAGADO: { txt: 'Pagado', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    FINALIZADO: { txt: 'Finalizado', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    CANCELADO: { txt: 'Cancelado', cls: 'bg-red-100 text-red-700 border-red-300' },
    EN_MORA: { txt: 'En mora', cls: 'bg-red-100 text-red-700 border-red-300' },
    JURIDICO: { txt: 'Jurídico', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    PENDIENTE: { txt: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  }
  const e = map[(estado || '').toUpperCase()]
  return e
    ? `<span class="inline-block px-3 py-1 rounded-full text-xs font-bold border ${e.cls}">${e.txt}</span>`
    : `<span class="inline-block px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-300">${estado}</span>`
}

function renderHTML(codigo: string, data: any): string {
  const autentico = data?.success === true && data?.autentico === true
  const verificadoEn = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })

  let cuerpo = ''
  if (autentico && data.data) {
    const d = data.data
    cuerpo = `
      <div class="cert">
        <div class="cert-stamp">✓ AUTÉNTICO</div>
        <h2>Certificado de Autenticidad</h2>
        <p class="subtitle">Documento verificado electrónicamente — JSADR Jo*** Se*** Al*** D** R**</p>

        <div class="grid">
          <div class="row"><span class="lbl">Deudor:</span><span class="val">${d.deudor || '—'}</span></div>
          <div class="row"><span class="lbl">Cédula:</span><span class="val mono">${d.cedula || '—'}</span></div>
          <div class="row"><span class="lbl">Préstamo:</span><span class="val mono">${d.codigoPrestamo || '—'}</span></div>
          <div class="row"><span class="lbl">Estado:</span><span class="val">${estadoBadge(d.estado)}</span></div>
          <div class="row"><span class="lbl">Monto principal:</span><span class="val">${moneda(d.monto)}</span></div>
          <div class="row"><span class="lbl">Fecha de solicitud:</span><span class="val">${fechaHora(d.fechaSolicitud)}</span></div>
          <div class="row"><span class="lbl">Firma electrónica:</span><span class="val">${d.tieneFirmaElectronica ? '✓ Sí, firmado electrónicamente' : '✗ No'}</span></div>
          <div class="row"><span class="lbl">Fecha de firma:</span><span class="val">${fechaHora(d.fechaFirma)}</span></div>
          <div class="row"><span class="lbl">Canal OTP:</span><span class="val">${d.canalOTP || '—'}</span></div>
          <div class="row"><span class="lbl">IP de firma:</span><span class="val mono">${d.ipFirma || '—'}</span></div>
          <div class="row"><span class="lbl">Tipo de código:</span><span class="val mono">${d.tipoCodigo || '—'}</span></div>
          ${d.firmaId ? `<div class="row"><span class="lbl">ID firma:</span><span class="val mono">${d.firmaId}</span></div>` : ''}
        </div>

        <div class="msg success">
          <strong>✓ Documento auténtico.</strong> ${data.mensaje || 'El código coincide con los registros del sistema.'}
        </div>

        <div class="meta">
          Verificado el <strong>${verificadoEn}</strong> (hora de Colombia · America/Bogota)<br>
          Código verificado: <span class="mono">${codigo}</span>
        </div>

        <div class="legal">
          <h3>Validez legal</h3>
          <p>Este certificado tiene plena validez conforme a la <strong>Ley 527 de 1999</strong> (Colombia) sobre
          mensajes de datos y firmas electrónicas, y el <strong>Decreto 1074 de 2015</strong> (Rector del Sector Comercio).
          La firma electrónica aquí registrada goza de la misma presunción de autenticidad que una firma manuscrita
          conforme al artículo 7 de la Ley 527 de 1999, y constituye <strong>prueba documental admisible</strong>
          en un proceso ejecutivo (art. 419 del Código General del Proceso).</p>
        </div>
      </div>
    `
  } else {
    cuerpo = `
      <div class="cert invalid">
        <div class="cert-stamp invalid">✗ NO VÁLIDO</div>
        <h2>Documento no verificado</h2>
        <p class="subtitle">El código no coincide con ningún documento registrado</p>

        <div class="msg error">
          <strong>⚠ Documento no válido o modificado.</strong><br>
          ${data?.error || 'El código proporcionado no corresponde a ningún documento firmado electrónicamente en el sistema JSADR. Podría tratarse de un documento falso, alterado, o de un código mal ingresado.'}
        </div>

        <div class="meta">
          Verificado el <strong>${verificadoEn}</strong> (hora de Colombia)<br>
          Código recibido: <span class="mono">${codigo}</span>
        </div>

        <div class="actions">
          <a href="/api/verificar" class="btn">Intentar con otro código</a>
        </div>

        <div class="legal warn">
          <h3>¿Qué hacer si el documento no es válido?</h3>
          <ol>
            <li>Verifica que el código ingresado sea exactamente el que aparece junto al QR del certificado.</li>
            <li>Si el documento fue impreso y manipulado, solicita una copia nueva al acreedor.</li>
            <li>Si sospechas falsificación, denuncia ante la Fiscalía General de la Nación (Colombia).</li>
          </ol>
        </div>
      </div>
    `
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${autentico ? '✓ Documento auténtico' : '✗ Documento no válido'} — Verificación JSADR</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#0f172a,#1e293b);margin:0;padding:20px;min-height:100vh}
  .wrap{max-width:760px;margin:20px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.4)}
  .header{background:linear-gradient(135deg,#1e3a8a,#6d28d9);color:#fff;padding:28px 24px;text-align:center;position:relative;overflow:hidden}
  .header::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(255,255,255,.1),transparent 50%);pointer-events:none}
  .header h1{margin:0;font-size:22px;font-weight:700;letter-spacing:.5px}
  .header p{margin:6px 0 0;font-size:12px;opacity:.85}
  .body{padding:28px 24px}
  .cert{position:relative;padding:8px 4px}
  .cert-stamp{position:absolute;top:0;right:8px;background:${autentico ? '#10b981' : '#ef4444'};color:#fff;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;letter-spacing:1px;transform:rotate(6deg);box-shadow:0 6px 14px rgba(0,0,0,.2)}
  .cert h2{color:#1e3a8a;margin:0 0 6px;font-size:24px;font-weight:700}
  .cert .subtitle{color:#64748b;margin:0 0 20px;font-size:13px}
  .grid{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 16px;margin-bottom:18px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;gap:12px}
  .row:last-child{border-bottom:none}
  .lbl{color:#64748b;font-weight:500;flex-shrink:0}
  .val{color:#0f172a;font-weight:600;text-align:right}
  .val.mono,.mono{font-family:'SF Mono',Consolas,monospace;font-size:12px}
  .msg{padding:14px 16px;border-radius:10px;font-size:13px;line-height:1.5;margin-bottom:18px}
  .msg.success{background:#ecfdf5;border:1px solid #10b981;color:#065f46}
  .msg.error{background:#fef2f2;border:1px solid #ef4444;color:#991b1b}
  .meta{padding:12px 16px;background:#f1f5f9;border-radius:8px;font-size:11px;color:#475569;text-align:center;margin-bottom:18px}
  .actions{text-align:center;margin-bottom:18px}
  .btn{display:inline-block;padding:10px 22px;background:#6d28d9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px}
  .btn:hover{background:#5b21b6}
  .legal{padding:16px;background:#fafafa;border-left:4px solid #6d28d9;border-radius:6px;font-size:12px;color:#475569;line-height:1.6}
  .legal.warn{border-left-color:#f59e0b}
  .legal h3{margin:0 0 8px;color:#1e3a8a;font-size:13px;font-weight:700}
  .legal ol{margin:0;padding-left:20px}
  .legal li{margin-bottom:4px}
  .footer{padding:14px 24px;background:#0f172a;color:#94a3b8;text-align:center;font-size:11px}
  .footer strong{color:#e2e8f0}
  @media print{
    body{background:#fff;padding:0}
    .wrap{box-shadow:none;margin:0;max-width:100%}
    .header{background:#1e3a8a !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .cert-stamp{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .footer{display:none}
    .btn{display:none}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>JSADR · Jo*** Se*** Al*** D** R**</h1>
    <p>Verificación oficial de documentos firmados electrónicamente</p>
  </div>
  <div class="body">
    ${cuerpo}
  </div>
  <div class="footer">
    <strong>JSADR Jo*** Se*** Al*** D** R**</strong> · Sistema de firma electrónica con validez legal en Colombia<br>
    Ley 527 de 1999 · Decreto 1074 de 2015 · Código General del Proceso art. 419<br>
    Hora oficial: America/Bogota (UTC-5, sin horario de verano)
  </div>
</div>
</body>
</html>`
}

function renderInputPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verificación de documento — JSADR Jo*** Se*** Al*** D** R**</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;margin:0;padding:0}
  .wrap{max-width:680px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
  .header{background:linear-gradient(135deg,#1e3a8a,#6d28d9);color:#fff;padding:32px 24px;text-align:center}
  .header h1{margin:0;font-size:24px;font-weight:700}
  .header p{margin:8px 0 0;font-size:13px;opacity:.85}
  .body{padding:32px 24px;text-align:center}
  .body h2{color:#1e3a8a;margin:0 0 12px;font-size:18px}
  .body p{color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px}
  .input{padding:12px 16px;border:2px solid #cbd5e1;border-radius:8px;font-family:monospace;font-size:16px;width:100%;max-width:380px;text-align:center;letter-spacing:1px;box-sizing:border-box}
  .btn{margin-top:12px;padding:12px 24px;background:#6d28d9;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px}
  .btn:hover{background:#5b21b6}
  .footer{padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>JSADR · Jo*** Se*** Al*** D** R**</h1>
    <p>Centro público de verificación de documentos firmados electrónicamente</p>
  </div>
  <div class="body">
    <h2>Verificar autenticidad de un documento</h2>
    <p>Ingresa el código de verificación que aparece junto al QR del certificado de firma electrónica (formato: <code>XXXX-XXXX-XXXX-XXXX</code>).</p>
    <form method="get" action="/api/verificar">
      <input class="input" name="codigo" placeholder="abcd-1234-ef56-7890" maxlength="19" required>
      <br>
      <button class="btn" type="submit">Verificar documento</button>
    </form>
  </div>
  <div class="footer">
    JSADR Jo*** Se*** Al*** D** R** · Sistema de firma electrónica con validez legal en Colombia<br>
    Ley 527 de 1999 · Decreto 1074 de 2015 · Habeas Data
  </div>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codigo = searchParams.get('codigo') || ''

  if (!codigo) {
    return new NextResponse(renderInputPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const data = await verificarCodigo(codigo)
  const html = renderHTML(codigo, data)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
