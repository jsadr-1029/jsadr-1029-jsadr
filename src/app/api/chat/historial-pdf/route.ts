// =====================================================
// /api/chat/historial-pdf — HTML imprimible del historial completo
// GET /api/chat/historial-pdf?conversacionId=...
// Devuelve HTML con diseño imprimible (window.print() en el cliente).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

function esc(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
}

function fmtFecha(f: Date | string | null | undefined): string {
  if (!f) return '—'
  const d = typeof f === 'string' ? new Date(f) : f
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const conversacionId = searchParams.get('conversacionId') || ''

    if (!conversacionId) {
      return NextResponse.json(
        { success: false, error: 'conversacionId es obligatorio' },
        { status: 400 }
      )
    }

    const conversacion = await db.conversacionChat.findUnique({
      where: { id: conversacionId },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            direccion: true,
            ciudad: true,
            prestamos: {
              select: {
                codigo: true,
                montoPrincipal: true,
                saldoTotal: true,
                estado: true,
              },
              take: 50,
            },
          },
        },
        asesor: { select: { nombre: true, username: true } },
        mensajes: { orderBy: { fechaEnvio: 'asc' } },
        notasInternas: {
          include: { autor: { select: { nombre: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!conversacion) {
      return NextResponse.json(
        { success: false, error: 'Conversación no encontrada' },
        { status: 404 }
      )
    }

    const totalMensajes = conversacion.mensajes.length
    const saldoTotal = conversacion.cliente.prestamos.reduce(
      (acc, p) => acc + (p.saldoTotal || 0),
      0
    )

    const mensajesHtml = conversacion.mensajes
      .map((m) => {
        const esCliente = m.remitenteTipo === 'CLIENTE'
        const esSistema = m.remitenteTipo === 'SISTEMA'
        const clase = esSistema
          ? 'sistema'
          : esCliente
            ? 'cliente'
            : 'asesor'
        const estadoIcon =
          m.estado === 'LEIDO'
            ? '✓✓ leído'
            : m.estado === 'ENTREGADO'
              ? '✓✓'
              : '✓'
        return `
        <div class="mensaje ${clase}">
          <div class="cabecera">
            <span class="remitente">${esc(m.remitenteNombre)}</span>
            <span class="tipo">${esc(m.remitenteTipo)}</span>
            <span class="fecha">${fmtFecha(m.fechaEnvio)}</span>
          </div>
          <div class="contenido">${esc(m.contenido)}</div>
          ${m.archivoUrl ? `<div class="archivo">📎 ${esc(m.archivoNombre || m.archivoUrl)}</div>` : ''}
          <div class="estado">${estadoIcon}</div>
        </div>`
      })
      .join('')

    const notasHtml = conversacion.notasInternas
      .map(
        (n) => `
        <div class="nota${n.esImportante ? ' importante' : ''}">
          <div class="cabecera">
            <span class="remitente">${esc(n.autor.nombre)}</span>
            <span class="fecha">${fmtFecha(n.createdAt)}</span>
            ${n.esImportante ? '<span class="star">★ Importante</span>' : ''}
          </div>
          <div class="contenido">${esc(n.contenido)}</div>
        </div>`
      )
      .join('')

    const prestamosHtml = conversacion.cliente.prestamos
      .map(
        (p) => `
        <tr>
          <td>${esc(p.codigo)}</td>
          <td>${p.montoPrincipal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
          <td>${p.saldoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
          <td>${esc(p.estado)}</td>
        </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historial Conversación ${esc(conversacion.codigo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #f8fafc; }
    .header { background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; }
    .header .sub { opacity: 0.9; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .card h3 { margin: 0 0 12px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .card .line:last-child { border-bottom: none; }
    .card .line strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 12px; }
    th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; }
    td { padding: 8px 12px; border-top: 1px solid #e2e8f0; }
    .mensajes { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .mensaje { background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 80%; }
    .mensaje.cliente { border-left: 4px solid #94a3b8; align-self: flex-start; }
    .mensaje.asesor { border-left: 4px solid #a855f7; align-self: flex-end; background: #faf5ff; }
    .mensaje.sistema { border-left: 4px solid #f59e0b; align-self: center; background: #fffbeb; font-style: italic; max-width: 100%; text-align: center; }
    .mensaje .cabecera { display: flex; gap: 8px; align-items: center; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .mensaje .remitente { font-weight: 600; color: #0f172a; }
    .mensaje .tipo { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 10px; }
    .mensaje .fecha { margin-left: auto; }
    .mensaje .contenido { font-size: 13px; line-height: 1.5; color: #1e293b; }
    .mensaje .archivo { font-size: 11px; color: #6366f1; margin-top: 4px; }
    .mensaje .estado { font-size: 10px; color: #94a3b8; margin-top: 4px; text-align: right; }
    .notas { display: flex; flex-direction: column; gap: 8px; }
    .nota { background: #fef9c3; padding: 12px; border-radius: 8px; border: 1px solid #fde68a; }
    .nota.importante { background: #fee2e2; border-color: #fecaca; }
    .nota .cabecera { display: flex; gap: 8px; align-items: center; font-size: 11px; color: #475569; margin-bottom: 4px; }
    .nota .star { color: #dc2626; font-weight: 600; }
    .nota .contenido { font-size: 13px; }
    h2 { color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { background: white; padding: 0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .mensaje, .nota, .card { break-inside: avoid; } button { display: none; } }
    .print-btn { position: fixed; top: 16px; right: 16px; background: #6366f1; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
    .print-btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
  <div class="header">
    <h1>Centro de Comunicaciones — Historial</h1>
    <div class="sub">
      ${esc(conversacion.codigo)} · Generado el ${fmtFecha(new Date())} ·
      ${totalMensajes} mensaje(s)
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Cliente</h3>
      <div class="line"><span>Nombre</span><strong>${esc(conversacion.cliente.nombre)}</strong></div>
      <div class="line"><span>Cédula</span><strong>${esc(conversacion.cliente.cedula)}</strong></div>
      <div class="line"><span>Teléfono</span><strong>${esc(conversacion.cliente.telefono)}</strong></div>
      <div class="line"><span>Email</span><strong>${esc(conversacion.cliente.email || '—')}</strong></div>
      <div class="line"><span>Dirección</span><strong>${esc(conversacion.cliente.direccion || '—')}</strong></div>
      <div class="line"><span>Ciudad</span><strong>${esc(conversacion.cliente.ciudad || '—')}</strong></div>
    </div>
    <div class="card">
      <h3>Conversación</h3>
      <div class="line"><span>Asunto</span><strong>${esc(conversacion.asunto)}</strong></div>
      <div class="line"><span>Estado</span><strong>${esc(conversacion.estado)}</strong></div>
      <div class="line"><span>Asesor</span><strong>${esc(conversacion.asesor?.nombre || 'Sin asignar')}</strong></div>
      <div class="line"><span>OTP Verificado</span><strong>${conversacion.otpVerificado ? 'Sí' : 'No'}</strong></div>
      <div class="line"><span>Inicio</span><strong>${fmtFecha(conversacion.createdAt)}</strong></div>
      <div class="line"><span>Última actividad</span><strong>${fmtFecha(conversacion.ultimaActividad)}</strong></div>
      ${conversacion.fechaCierre ? `<div class="line"><span>Cierre</span><strong>${fmtFecha(conversacion.fechaCierre)}</strong></div>` : ''}
      ${conversacion.motivoCierre ? `<div class="line"><span>Motivo cierre</span><strong>${esc(conversacion.motivoCierre)}</strong></div>` : ''}
    </div>
  </div>

  ${conversacion.cliente.prestamos.length > 0 ? `
  <h2>Préstamos del Cliente</h2>
  <table>
    <thead><tr><th>Código</th><th>Monto Principal</th><th>Saldo Total</th><th>Estado</th></tr></thead>
    <tbody>${prestamosHtml}</tbody>
  </table>
  <p style="font-size: 12px; color: #64748b;">Saldo total acumulado: <strong>${saldoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</strong></p>
  ` : ''}

  <h2>Mensajes (${totalMensajes})</h2>
  <div class="mensajes">${mensajesHtml}</div>

  ${conversacion.notasInternas.length > 0 ? `
  <h2>Notas Internas (${conversacion.notasInternas.length})</h2>
  <div class="notas">${notasHtml}</div>
  ` : ''}

  <div class="footer">
    Documento generado por Jsadr · Centro de Comunicaciones<br>
    ${esc(conversacion.codigo)} · ${fmtFecha(new Date())}
  </div>
</body>
</html>`

    // Actualizar pdfHistorialUrl en la conversación (referencia para auditoría)
    await db.conversacionChat.update({
      where: { id: conversacionId },
      data: { pdfHistorialUrl: `/api/chat/historial-pdf?conversacionId=${conversacionId}` },
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
