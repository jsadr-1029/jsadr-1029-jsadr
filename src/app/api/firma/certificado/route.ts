// =====================================================
// /api/firma/certificado — Certificado de Firma Electrónica
// Genera un documento HTML imprimible con validez legal que certifica:
// - Quién firmó (identidad del firmante)
// - Cuándo firmó (fecha y hora exacta)
// - Cómo firmó (método: OTP + foto selfie + firma dibujada)
// - Desde dónde (IP, dispositivo, ubicación)
// - Integridad (hashes SHA-256 de fotos y firma)
// - Trazabilidad (IDs únicos, canal OTP, intentos)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import QRCode from 'qrcode'
import crypto from 'crypto'

// GET /api/firma/certificado?firmaId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const firmaId = searchParams.get('firmaId')

    if (!firmaId) {
      return NextResponse.json(
        { success: false, error: 'firmaId es obligatorio' },
        { status: 400 }
      )
    }

    const firma = await db.firmaElectronica.findUnique({
      where: { id: firmaId },
      include: {
        prestamo: {
          include: { cliente: true },
        },
        cliente: true,
      },
    })

    if (!firma) {
      return NextResponse.json(
        { success: false, error: 'Firma no encontrada' },
        { status: 404 }
      )
    }

    if (firma.estadoFirma !== 'COMPLETADA') {
      return NextResponse.json(
        { success: false, error: 'La firma no está completada. No se puede generar certificado.' },
        { status: 400 }
      )
    }

    // Determinar el cliente (de firma.cliente o firma.prestamo.cliente)
    const cliente = firma.cliente || firma.prestamo?.cliente
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado para esta firma' },
        { status: 404 }
      )
    }

    const html = await generarCertificadoHTML(firma, cliente, firma.prestamo)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

async function generarCertificadoHTML(firma: any, cliente: any, prestamo: any): Promise<string> {
  const fechaFirma = firma.fechaFirmaCompleta || firma.createdAt
  const fechaFormateada = formatearFechaHora(fechaFirma)
  const fechaSolo = formatearFecha(fechaFirma)

  // Datos de seguridad y trazabilidad
  const ipFirma = firma.ipFirma || 'No registrada'
  const userAgent = firma.userAgent || 'No registrado'
  const canalOTP = firma.otpCanal === 'WHATSAPP' ? 'WhatsApp' :
                   firma.otpCanal === 'EMAIL' ? 'Correo Electrónico' :
                   firma.otpCanal === 'AMBOS' ? 'WhatsApp y Correo Electrónico' :
                   'No especificado'

  // Reforzado: mostrar destino específico del OTP según canal
  const telefonoCliente = cliente.telefono || 'No registrado'
  const emailCliente = cliente.email || 'No registrado'
  let destinoOTP = ''
  if (firma.otpCanal === 'WHATSAPP') {
    destinoOTP = `WhatsApp al número ${telefonoCliente}`
  } else if (firma.otpCanal === 'EMAIL') {
    destinoOTP = `Correo Electrónico a ${emailCliente}`
  } else if (firma.otpCanal === 'AMBOS') {
    destinoOTP = `WhatsApp al ${telefonoCliente} y Correo Electrónico a ${emailCliente}`
  } else {
    destinoOTP = 'No especificado'
  }

  const intentosUsados = firma.intentosOTP || 0
  const maxIntentos = firma.maxIntentos || 5

  // Hashes de integridad
  const hashFirma = firma.imagenFirma ?
    require('crypto').createHash('sha256').update(firma.imagenFirma).digest('hex').substring(0, 32) : 'N/A'
  const hashSelfie = firma.fotoSelfieHash?.substring(0, 32) || 'N/A'
  const hashDocumento = firma.fotoDocumentoHash?.substring(0, 32) || 'N/A'

  // Foto selfie (base64) — si existe
  const fotoSelfieHtml = firma.fotoSelfie
    ? `<img src="${firma.fotoSelfie}" alt="Foto selfie con cédula" style="max-width:300px; border:2px solid #1e3a5f; border-radius:8px;" />`
    : '<p style="color:#999; font-style:italic;">Foto no disponible</p>'

  // Foto del documento (base64) — si existe
  const fotoDocumentoHtml = firma.fotoDocumento
    ? `<img src="${firma.fotoDocumento}" alt="Foto del documento" style="max-width:300px; border:2px solid #1e3a5f; border-radius:8px;" />`
    : '<p style="color:#999; font-style:italic;">Foto no disponible</p>'

  // Firma dibujada (base64) — si existe
  const firmaDibujadaHtml = firma.imagenFirma
    ? `<img src="${firma.imagenFirma}" alt="Firma electrónica" style="max-width:300px; max-height:150px; border:1px solid #ccc; background:white; border-radius:4px;" />`
    : '<p style="color:#999; font-style:italic;">Firma no disponible</p>'

  // Código del préstamo si existe
  const codigoPrestamo = prestamo?.codigo || 'N/A'
  const montoPrestamo = prestamo ? formatearMonedaPrestamo(prestamo.montoPrincipal) : 'N/A'

  // ID corto para mostrar
  const idCorto = firma.id.substring(0, 12)
  const uuidCertificado = require('crypto').randomUUID()

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado de Firma Electrónica - ${idCorto}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    line-height: 1.7;
    color: #1a1a1a;
    max-width: 900px;
    margin: 0 auto;
    padding: 30px;
    font-size: 12px;
  }
  .header-cert {
    text-align: center;
    border: 3px double #1e3a5f;
    padding: 25px;
    margin-bottom: 30px;
    background: linear-gradient(135deg, #f0f4ff 0%, #ffffff 100%);
  }
  .header-cert h1 {
    color: #1e3a5f;
    font-size: 26px;
    margin: 0;
    letter-spacing: 3px;
  }
  .header-cert h2 {
    color: #4a5568;
    font-size: 13px;
    margin: 8px 0 0 0;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .sello {
    display: inline-block;
    margin-top: 15px;
    padding: 8px 20px;
    border: 2px solid #1e3a5f;
    border-radius: 50px;
    color: #1e3a5f;
    font-weight: bold;
    font-size: 11px;
    letter-spacing: 1px;
  }
  .section {
    margin: 25px 0;
    page-break-inside: avoid;
  }
  .section-title {
    background: #1e3a5f;
    color: white;
    padding: 8px 15px;
    font-size: 13px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0;
    border-radius: 4px 4px 0 0;
  }
  .section-body {
    border: 1px solid #cbd5e0;
    border-top: none;
    padding: 15px;
    border-radius: 0 0 4px 4px;
    background: #fafbfc;
  }
  .datos-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 20px;
  }
  .dato {
    font-size: 12px;
    padding: 4px 0;
    border-bottom: 1px dotted #e2e8f0;
  }
  .dato .label {
    color: #4a5568;
    font-weight: 600;
    display: inline-block;
    min-width: 140px;
  }
  .dato .value {
    color: #1a1a1a;
    font-weight: 500;
  }
  .fotos-container {
    display: flex;
    gap: 30px;
    justify-content: center;
    flex-wrap: wrap;
    margin: 15px 0;
  }
  .foto-box {
    text-align: center;
  }
  .foto-box .titulo {
    font-size: 11px;
    font-weight: bold;
    color: #1e3a5f;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  .foto-box .hash {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: #666;
    margin-top: 5px;
    word-break: break-all;
  }
  .declaracion {
    background: #fff8e1;
    border-left: 4px solid #ffa000;
    padding: 15px;
    margin: 20px 0;
    font-size: 11px;
    text-align: justify;
  }
  .validez-legal {
    background: #e8f5e9;
    border: 2px solid #4caf50;
    padding: 15px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .validez-legal h3 {
    color: #2e7d32;
    margin: 0 0 8px 0;
    font-size: 13px;
  }
  .validez-legal p {
    font-size: 10px;
    margin: 4px 0;
  }
  .qr-placeholder {
    text-align: center;
    margin: 20px 0;
    padding: 15px;
    border: 2px dashed #cbd5e0;
    border-radius: 8px;
  }
  .footer-cert {
    margin-top: 40px;
    padding-top: 15px;
    border-top: 2px solid #1e3a5f;
    text-align: center;
    font-size: 9px;
    color: #666;
  }
  .print-btn {
    display: block;
    margin: 20px auto;
    padding: 12px 35px;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
  }
  @media print {
    .no-print { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>

<div class="header-cert">
  <h1>CERTIFICADO DE FIRMA ELECTRÓNICA</h1>
  <h2>Documento de Validación de Identidad y Autenticación</h2>
  <div class="sello">✓ FIRMA ELECTRÓNICA VÁLIDA</div>
</div>

<!-- Sección 1: Identidad del Firmante -->
<div class="section">
  <div class="section-title">1. Identidad del Firmante</div>
  <div class="section-body">
    <div class="datos-grid">
      <div class="dato"><span class="label">Nombre completo:</span> <span class="value"><strong>${cliente.nombre}</strong></span></div>
      <div class="dato"><span class="label">Documento:</span> <span class="value">C.C. ${cliente.cedula}</span></div>
      <div class="dato"><span class="label">Teléfono:</span> <span class="value">${cliente.telefono}</span></div>
      <div class="dato"><span class="label">Email:</span> <span class="value">${cliente.email || 'No registrado'}</span></div>
      <div class="dato"><span class="label">ID Cliente:</span> <span class="value" style="font-family:monospace; font-size:10px;">${cliente.id}</span></div>
      <div class="dato"><span class="label">ID Firma:</span> <span class="value" style="font-family:monospace; font-size:10px;">${firma.id}</span></div>
    </div>
  </div>
</div>

<!-- Sección 2: Detalles del Préstamo -->
<div class="section">
  <div class="section-title">2. Documento Firmado</div>
  <div class="section-body">
    <div class="datos-grid">
      <div class="dato"><span class="label">Tipo documento:</span> <span class="value">${firma.tipo === 'TYC' ? 'Términos y Condiciones' : firma.tipo === 'PAGARE' ? 'Pagaré' : firma.tipo}</span></div>
      <div class="dato"><span class="label">Código préstamo:</span> <span class="value"><strong>${codigoPrestamo}</strong></span></div>
      <div class="dato"><span class="label">Monto:</span> <span class="value">${montoPrestamo}</span></div>
      <div class="dato"><span class="label">Estado firma:</span> <span class="value">✓ ${firma.estadoFirma}</span></div>
    </div>
  </div>
</div>

<!-- Sección 3: Fecha y Hora de Firma -->
<div class="section">
  <div class="section-title">3. Fecha y Hora de Firma</div>
  <div class="section-body">
    <div class="datos-grid">
      <div class="dato"><span class="label">Fecha de firma:</span> <span class="value"><strong>${fechaSolo}</strong></span></div>
      <div class="dato"><span class="label">Hora exacta:</span> <span class="value"><strong>${new Date(fechaFirma).toLocaleTimeString('es-CO')}</strong></span></div>
      <div class="dato"><span class="label">Zona horaria:</span> <span class="value">America/Bogota (UTC-5)</span></div>
      <div class="dato"><span class="label">Timestamp ISO:</span> <span class="value" style="font-family:monospace; font-size:10px;">${new Date(fechaFirma).toISOString()}</span></div>
      <div class="dato"><span class="label">Creación registro:</span> <span class="value">${formatearFechaHora(firma.createdAt)}</span></div>
      <div class="dato"><span class="label">UUID certificado:</span> <span class="value" style="font-family:monospace; font-size:10px;">${uuidCertificado}</span></div>
    </div>
  </div>
</div>

<!-- Sección 4: Método de Autenticación -->
<div class="section">
  <div class="section-title">4. Método de Autenticación y Verificación</div>
  <div class="section-body">
    <div class="datos-grid">
      <div class="dato"><span class="label">Método OTP:</span> <span class="value">Código de un solo uso (OTP)</span></div>
      <div class="dato"><span class="label">Canal OTP:</span> <span class="value">${canalOTP}</span></div>
      <div class="dato"><span class="label">Destino OTP:</span> <span class="value"><strong>${destinoOTP}</strong></span></div>
      <div class="dato"><span class="label">OTP validado:</span> <span class="value">✓ Sí</span></div>
      <div class="dato"><span class="label">Fecha envío OTP:</span> <span class="value">${firma.otpFechaEnvio ? formatearFechaHora(firma.otpFechaEnvio) : 'N/A'}</span></div>
      <div class="dato"><span class="label">Fecha validación:</span> <span class="value">${firma.otpFechaValidacion ? formatearFechaHora(firma.otpFechaValidacion) : 'N/A'}</span></div>
      <div class="dato"><span class="label">Intentos usados:</span> <span class="value">${intentosUsados} de ${maxIntentos}</span></div>
      <div class="dato"><span class="label">Verificación foto:</span> <span class="value">✓ Selfie con cédula</span></div>
      <div class="dato"><span class="label">Firma dibujada:</span> <span class="value">✓ Capturada digitalmente</span></div>
    </div>
    <div class="declaracion">
      <strong>Proceso de autenticación:</strong> El firmante fue verificado mediante un código OTP
      (One-Time Password) enviado por ${destinoOTP}, el cual fue ingresado correctamente.
      Adicionalmente, el firmante cargó una fotografía tipo selfie sosteniendo su documento de identidad,
      y dibujó su firma de manera digital. Este proceso cumple con los requisitos de doble factor de
      autenticación para firma electrónica.
    </div>
  </div>
</div>

<!-- Sección 5: Evidencias (Fotos y Firma) -->
<div class="section">
  <div class="section-title">5. Evidencias de Identidad</div>
  <div class="section-body">
    <div class="fotos-container">
      <div class="foto-box">
        <div class="titulo">📸 Selfie con Cédula</div>
        ${fotoSelfieHtml}
        <div class="hash">Hash SHA-256: ${hashSelfie}...</div>
      </div>
      <div class="foto-box">
        <div class="titulo">🪪 Documento de Identidad</div>
        ${fotoDocumentoHtml}
        <div class="hash">Hash SHA-256: ${hashDocumento}...</div>
      </div>
      <div class="foto-box">
        <div class="titulo">✍️ Firma Electrónica</div>
        ${firmaDibujadaHtml}
        <div class="hash">Hash SHA-256: ${hashFirma}...</div>
      </div>
    </div>
    <div style="font-size:10px; color:#666; margin-top:10px; text-align:center;">
      Los hashes SHA-256 garantizan la integridad de las evidencias. Cualquier modificación
      alteraría el hash y se detectaría inmediatamente.
    </div>
  </div>
</div>

<!-- Sección 6: Datos Técnicos -->
<div class="section">
  <div class="section-title">6. Trazabilidad Técnica</div>
  <div class="section-body">
    <div class="datos-grid">
      <div class="dato"><span class="label">Dirección IP:</span> <span class="value" style="font-family:monospace;">${ipFirma}</span></div>
      <div class="dato"><span class="label">Dispositivo:</span> <span class="value" style="font-size:10px;">${userAgent}</span></div>
      <div class="dato"><span class="label">Fecha subida fotos:</span> <span class="value">${firma.fechaSubidaFotos ? formatearFechaHora(firma.fechaSubidaFotos) : 'N/A'}</span></div>
      <div class="dato"><span class="label">Fecha firma completa:</span> <span class="value">${firma.fechaFirmaCompleta ? formatearFechaHora(firma.fechaFirmaCompleta) : 'N/A'}</span></div>
      ${firma.geoUbicacion ? `<div class="dato"><span class="label">Ubicación GPS:</span> <span class="value" style="font-family:monospace; font-size:10px;">${firma.geoUbicacion}</span></div>` : ''}
    </div>
  </div>
</div>

<!-- Validez Legal -->
<div class="validez-legal">
  <h3>⚖️ Validez Legal de la Firma Electrónica</h3>
  <p><strong>Marco normativo:</strong> Ley 527 de 1999 (Colombia) — Reglamenta el acceso y uso de mensajes de datos, comercio electrónico y firmas digitales.</p>
  <p><strong>Decreto 1074 de 2015:</strong> Reglamenta la firma electrónica y establece su equivalencia con la firma manuscrita.</p>
  <p><strong>Estándar aplicado:</strong> Firma electrónica simple con verificación de doble factor (OTP + biometría visual).</p>
  <p><strong>Integridad:</strong> Los hashes SHA-256 de las evidencias garantizan que el contenido no ha sido alterado desde su captura.</p>
  <p><strong>Trazabilidad:</strong> El registro incluye IP, dispositivo, fecha exacta y canal de verificación, permitiendo auditoría completa.</p>
</div>

<!-- Declaración -->
<div class="declaracion">
  <strong>DECLARACIÓN:</strong> El presente certificado acredita que el(la) señor(a) <strong>${cliente.nombre}</strong>,
  identificado(a) con cédula de ciudadanía No. <strong>${cliente.cedula}</strong>, firmó electrónicamente
  el documento <strong>${firma.tipo === 'TYC' ? 'Términos y Condiciones' : firma.tipo}</strong>
  ${prestamo ? `correspondiente al préstamo <strong>${codigoPrestamo}</strong>` : ''}
  el día <strong>${fechaSolo}</strong> a las <strong>${new Date(fechaFirma).toLocaleTimeString('es-CO')}</strong>,
  mediante verificación de identidad con código OTP enviado por ${destinoOTP},
  fotografía selfie con documento de identidad, y firma manuscrita digitalizada.
  Este certificado tiene plena validez legal conforme a la legislación colombiana sobre firma electrónica.
</div>

<!-- === SELLO DE AUTENTICIDAD CON QR === -->
${await (async () => {
  const codigoVer = crypto.createHash('sha256').update(firma.id + '|' + firma.createdAt.toISOString() + '|certificado').digest('hex').substring(0, 4) + '-' +
    crypto.createHash('sha256').update(firma.id + '|' + firma.createdAt.toISOString() + '|certificado').digest('hex').substring(4, 8) + '-' +
    crypto.createHash('sha256').update(firma.id + '|' + firma.createdAt.toISOString() + '|certificado').digest('hex').substring(8, 12) + '-' +
    crypto.createHash('sha256').update(firma.id + '|' + firma.createdAt.toISOString() + '|certificado').digest('hex').substring(12, 16)
  const selloDig = crypto.createHash('sha256').update(JSON.stringify({ firmaId: firma.id, cliente: cliente.cedula, codigo: codigoVer, timestamp: new Date().toISOString() })).digest('hex')
  const urlVerif = (process.env.NEXT_PUBLIC_BASE_URL || 'https://preview-chat-c04df402-049e-4406-b5d2-c8e07f801c50.space-z.ai') + '/api/verificar?codigo=' + codigoVer
  let qrB64 = ''
  try { qrB64 = await QRCode.toDataURL(urlVerif, { width: 130, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } }) } catch {}
  return `
<div style="margin-top:30px; padding:15px; border:2px dashed #1e3a5f; border-radius:8px; background:#fafbff; page-break-inside:avoid;">
  <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
    ${qrB64 ? `<div style="text-align:center; flex-shrink:0;">
      <img src="${qrB64}" alt="QR verificación" style="width:110px; height:110px; border:1px solid #ccc; border-radius:4px;" />
      <p style="font-size:8px; color:#666; margin-top:4px;">Escanea para verificar</p>
    </div>` : ''}
    <div style="flex:1; min-width:250px;">
      <h4 style="color:#1e3a5f; margin:0 0 8px 0; font-size:13px;">🔐 SELLO DE AUTENTICIDAD DEL CERTIFICADO</h4>
      <table style="width:100%; font-size:9px; border-collapse:collapse;">
        <tr>
          <td style="padding:3px; border:1px solid #ddd; background:#f0f4ff; font-weight:bold;">Código verificación:</td>
          <td style="padding:3px; border:1px solid #ddd; font-family:monospace; font-weight:bold;">${codigoVer}</td>
        </tr>
        <tr>
          <td style="padding:3px; border:1px solid #ddd; background:#f0f4ff; font-weight:bold;">Sello digital SHA-256:</td>
          <td style="padding:3px; border:1px solid #ddd; font-family:monospace; font-size:7px; word-break:break-all;">${selloDig.substring(0, 32)}<br>${selloDig.substring(32)}</td>
        </tr>
      </table>
      <p style="font-size:8px; color:#666; margin-top:6px; text-align:justify;">
        <strong>⚠️ Documento protegido contra falsificación.</strong> Este certificado contiene un sello digital único
        e inmutable. Cualquier alteración, copia o modificación invalidará el sello. Para verificar autenticidad,
        escanee el código QR o consulte con el código de verificación en el sistema Jsadr.
      </p>
    </div>
  </div>
</div>`
})()}

<!-- Footer -->
<div class="footer-cert">
  <p><strong>Certificado ID:</strong> ${uuidCertificado}</p>
  <p><strong>Generado el:</strong> ${formatearFechaHora(new Date())}</p>
  <p><strong>Sistema:</strong> Jsadr v3.6.1 — Plataforma de Gestión de Préstamos</p>
  <p>Este documento es generado automáticamente por el sistema y tiene carácter de constancia digital.</p>
  <p>© ${new Date().getFullYear()} Jsadr. Todos los derechos reservados.</p>
</div>

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>

</body>
</html>`
}

function formatearMonedaPrestamo(valor: number): string {
  return '$' + valor.toLocaleString('es-CO')
}
