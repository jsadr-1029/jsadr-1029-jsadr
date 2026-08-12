import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, formatearFecha, formatearMoneda, getTasaMoraAnual } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'
import QRCode from 'qrcode'
import crypto from 'crypto'

// =====================================================
// GET /api/documentos
// =====================================================
// Dos modos:
//   1. ?accion=listar  → lista documentos de DocumentoGestor (con filtros opcionales)
//      Query: accion=listar & q=busqueda & tipo=FOTO_SELFI & prestamoId=xxx & clienteId=xxx
//   2. ?prestamoId=xxx & tipo=pagare-diligenciado → genera HTML imprimible del pagaré/carta
//      tipo: pagare-blanco | pagare-diligenciado | carta
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')

    // === MODO LISTAR ===
    if (accion === 'listar') {
      const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
      if (authResult instanceof NextResponse) return authResult

      const q = (searchParams.get('q') || '').trim()
      const tipo = searchParams.get('tipo') || ''
      const prestamoId = searchParams.get('prestamoId') || ''
      const clienteId = searchParams.get('clienteId') || ''
      const limite = parseInt(searchParams.get('limite') || '200', 10)

      const where: any = {}
      if (q) {
        where.OR = [
          { titulo: { contains: q } },
          { descripcion: { contains: q } },
          { cliente: { nombre: { contains: q } } },
          { cliente: { cedula: { contains: q } } },
          { prestamo: { codigo: { contains: q } } },
        ]
      }
      if (tipo) where.tipo = tipo
      if (prestamoId) where.prestamoId = prestamoId
      if (clienteId) where.clienteId = clienteId

      const documentos = await db.documentoGestor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limite, 500),
        include: {
          prestamo: { select: { id: true, codigo: true, clienteId: true } },
          cliente: { select: { id: true, nombre: true, cedula: true } },
        },
      })

      const data = documentos.map((d) => ({
        id: d.id,
        prestamoId: d.prestamoId,
        prestamoCodigo: d.prestamo?.codigo || null,
        clienteId: d.clienteId,
        clienteNombre: d.cliente?.nombre || null,
        clienteCedula: d.cliente?.cedula || null,
        tipo: d.tipo,
        titulo: d.titulo,
        descripcion: d.descripcion,
        archivoNombre: d.archivoNombre,
        archivoTipo: d.archivoTipo,
        archivoTamano: d.archivoTamano,
        subidoPor: d.subidoPor,
        fechaSubida: d.createdAt,
        tieneArchivo: !!d.archivoBase64,
      }))

      return NextResponse.json({ success: true, data })
    }

    // === MODO GENERAR HTML DE PAGARÉ/CARTA ===
    const prestamoId = searchParams.get('prestamoId')
    const tipo = searchParams.get('tipo') || 'pagare-diligenciado'

    if (!prestamoId) {
      return NextResponse.json(
        { success: false, error: 'prestamoId es obligatorio (o usa ?accion=listar)' },
        { status: 400 }
      )
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        cliente: true,
        firmas: {
          where: { estadoFirma: 'COMPLETADA' },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || undefined,
    })

    // Separar firma del deudor y del codeudor
    const firmaElectronica = prestamo.firmas?.find(f => !f.esFirmaCodeudor) || prestamo.firmas?.[0] || null
    const firmaCodeudor = prestamo.firmas?.find(f => f.esFirmaCodeudor) || null

    let html: string

    // tipo=pagare y tipo=pagare-diligenciado generan el pagaré diligenciado
    // tipo=pagare-blanco genera el pagaré en blanco
    // tipo=carta genera la carta de instrucciones
    // tipo=combinado genera un único PDF con pagaré + carta (cada uno con su propia sección de firma)
    if (tipo === 'pagare-blanco') {
      html = await generarPagareBlancoHTML(prestamo, firmaElectronica, firmaCodeudor, req)
    } else if (tipo === 'pagare-diligenciado' || tipo === 'pagare') {
      html = await generarPagareDiligenciadoHTML(prestamo, calculo, firmaElectronica, firmaCodeudor, req)
    } else if (tipo === 'combinado') {
      html = await generarDocumentoCombinadoHTML(prestamo, calculo, firmaElectronica, firmaCodeudor, req)
    } else {
      html = await generarCartaInstruccionesHTML(prestamo, firmaElectronica, firmaCodeudor, req)
    }

    // === Registrar en Bitácora del Préstamo ===
    // Todo documento generado queda trazado en la bitácora del préstamo.
    const tipoLabels: Record<string, string> = {
      'pagare-blanco': 'Pagaré en Blanco',
      'pagare-diligenciado': 'Pagaré Diligenciado',
      'pagare': 'Pagaré Diligenciado',
      'carta': 'Carta de Instrucciones',
      'combinado': 'Pagaré + Carta de Instrucciones (PDF único)',
    }
    const tipoLabel = tipoLabels[tipo] || 'Documento legal'
    try {
      await db.bitacoraPrestamo.create({
        data: {
          prestamoId: prestamo.id,
          prestamoCodigo: prestamo.codigo,
          usuarioNombre: 'Sistema',
          tipo: 'OTRO',
          titulo: `Documento generado: ${tipoLabel}`,
          descripcion: `Se generó el documento «${tipoLabel}» para el préstamo ${prestamo.codigo} del cliente ${prestamo.cliente?.nombre || 'N/A'}. ` +
            `Incluye firma electrónica ${firmaElectronica?.estadoFirma === 'COMPLETADA' ? 'COMPLETADA' : 'pendiente'} ` +
            `${prestamo.tieneCodeudor ? `y firma del codeudor ${firmaCodeudor?.estadoFirma === 'COMPLETADA' ? 'COMPLETADA' : 'pendiente'}` : '(sin codeudor)'}. ` +
            `Documento abierto para impresión/PDF desde el navegador.`,
          resultado: 'Documento generado y abierto en navegador',
        },
      })
    } catch (e) {
      // No bloqueamos la generación del documento si falla el log
      console.error('[documentos] No se pudo registrar bitácora:', e)
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST /api/documentos
// Sube un documento al gestor documental (DocumentoGestor)
// Body: { prestamoId?, clienteId?, tipo, titulo, descripcion?,
//         archivoBase64, archivoNombre, archivoTipo, archivoTamano, subidoPor? }
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`documentos-upload:${clientInfo.ip}`, 20)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const {
      prestamoId,
      clienteId,
      tipo,
      titulo,
      descripcion,
      archivoBase64,
      archivoNombre,
      archivoTipo,
      archivoTamano,
      subidoPor,
    } = body || {}

    // === Validaciones ===
    if (!tipo || typeof tipo !== 'string') {
      return NextResponse.json(
        { success: false, error: 'tipo es requerido' },
        { status: 400 }
      )
    }
    const tiposValidos = [
      'FOTO_CLIENTE', 'PANTALLAZO_CONVERSACION', 'FOTO_DOCUMENTO',
      'FOTO_SELFI', 'COMPROBANTE_PAGO', 'PAGARE_FIRMA', 'CARTA_INSTRUCCIONES',
      'CERTIFICADO_FIRMA', 'OTRO',
    ]
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json(
        { success: false, error: `tipo debe ser uno de: ${tiposValidos.join(', ')}` },
        { status: 400 }
      )
    }
    if (!titulo || typeof titulo !== 'string' || titulo.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'titulo es requerido (mínimo 3 caracteres)' },
        { status: 400 }
      )
    }
    if (!archivoBase64 || typeof archivoBase64 !== 'string') {
      return NextResponse.json(
        { success: false, error: 'archivoBase64 es requerido' },
        { status: 400 }
      )
    }
    // Validar que sea base64 de imagen (data:image/...)
    if (!archivoBase64.startsWith('data:image/') && !archivoBase64.startsWith('data:application/pdf')) {
      return NextResponse.json(
        { success: false, error: 'archivoBase64 debe ser una imagen (data:image/...) o PDF (data:application/pdf)' },
        { status: 400 }
      )
    }
    // Tamaño máximo: 10MB expresado en caracteres base64 (~13.3M chars)
    if (archivoBase64.length > 15 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'El archivo no puede superar 10MB' },
        { status: 400 }
      )
    }

    // Validar préstamo/cliente si se informan
    let prestamo: any = null
    let cliente: any = null
    if (prestamoId) {
      prestamo = await db.prestamo.findUnique({
        where: { id: prestamoId },
        include: { cliente: true },
      })
      if (!prestamo) {
        return NextResponse.json(
          { success: false, error: 'Préstamo no encontrado' },
          { status: 404 }
        )
      }
    }
    if (clienteId) {
      cliente = await db.cliente.findUnique({ where: { id: clienteId } })
      if (!cliente) {
        return NextResponse.json(
          { success: false, error: 'Cliente no encontrado' },
          { status: 404 }
        )
      }
    } else if (prestamo) {
      cliente = prestamo.cliente
    }

    // Crear el documento
    const doc = await db.documentoGestor.create({
      data: {
        prestamoId: prestamoId || null,
        clienteId: cliente?.id || null,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        archivoBase64,
        archivoNombre: archivoNombre || `documento_${Date.now()}`,
        archivoTipo: archivoTipo || 'image/jpeg',
        archivoTamano: archivoTamano || archivoBase64.length,
        subidoPor: subidoPor || user.nombre,
      },
    })

    // Si hay préstamo, registrar en bitácora
    if (prestamo) {
      await db.bitacoraPrestamo.create({
        data: {
          prestamoId: prestamo.id,
          prestamoCodigo: prestamo.codigo,
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          tipo: 'OTRO',
          titulo: `Documento subido: ${titulo.trim()}`,
          descripcion: `Tipo: ${tipo}. ${descripcion?.trim() || ''}`.trim(),
          resultado: `Doc ID: ${doc.id}`,
          fechaEvento: new Date(),
        },
      })
    }

    // Audit log
    await db.auditLog.create({
      data: {
        usuarioId: user.id === 'system' ? null : user.id,
        usuarioNombre: user.nombre,
        accion: 'DOCUMENTO_SUBIDO',
        modulo: 'documentos',
        entidadId: doc.id,
        entidadNombre: `${titulo.trim()} - ${prestamo?.codigo || cliente?.nombre || 'sin vincular'}`,
        detalles: JSON.stringify({
          tipo,
          titulo: titulo.trim(),
          prestamoId: prestamoId || null,
          clienteId: cliente?.id || null,
          archivoNombre: archivoNombre || null,
          archivoTamano: archivoTamano || 0,
        }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        tipo: doc.tipo,
        titulo: doc.titulo,
        fechaSubida: doc.createdAt,
      },
      mensaje: `Documento "${titulo.trim()}" subido correctamente.`,
    })
  } catch (error: any) {
    console.error('[documentos POST] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// FUNCIONES DE VERIFICACIÓN Y SEGURIDAD
// =====================================================

// Generar código de verificación único para el documento
function generarCodigoVerificacion(prestamo: any, tipoDoc: string): string {
  const data = `${prestamo.id}|${tipoDoc}|${prestamo.codigo}|${prestamo.montoPrincipal}|${prestamo.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  // Formato: XXXX-XXXX-XXXX-XXXX (16 chars del hash)
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}

// Generar sello digital anti-alteración
function generarSelloDigital(prestamo: any, tipoDoc: string, codigoVerificacion: string): string {
  const data = JSON.stringify({
    doc: tipoDoc,
    prestamo: prestamo.codigo,
    monto: prestamo.montoPrincipal,
    cliente: prestamo.cliente.cedula,
    codigo: codigoVerificacion,
    timestamp: new Date().toISOString(),
  })
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Generar QR code como base64
async function generarQRCode(codigoVerificacion: string, _req?: NextRequest): Promise<string> {
  // ============================================================
  // URL CANÓNICA de verificación — SIEMPRE usa el dominio de producción
  // configurado en NEXT_PUBLIC_APP_URL (https://jsadr.com.co).
  // ------------------------------------------------------------
  // ANTES se usaba `req.url` para inferir el host, pero cuando el sistema
  // se ejecuta dentro de un sandbox/preview (ej. preview-chat-*.space-z.ai),
  // el QR quedaba apuntando a ese host temporal que luego se desactiva,
  // produciendo al escanear el error:
  //   {"error":"sandbox is inactive"}
  // Por eso ahora SIEMPRE se usa NEXT_PUBLIC_APP_URL, con fallbacks robustos.
  // ============================================================
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://jsadr.com.co'
  const urlVerificacion = `${baseUrl}/api/documentos/verificar?codigo=${codigoVerificacion}`
  try {
    const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
      width: 150,
      margin: 1,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    })
    return qrDataUrl
  } catch {
    return ''
  }
}

// Generar sección de verificación con QR + sello digital
function generarSeccionVerificacion(codigoVerificacion: string, selloDigital: string, qrCode: string, tipoDoc: string): string {
  const selloCorto = selloDigital.substring(0, 32)
  const selloCorto2 = selloDigital.substring(32, 64)
  const fechaGen = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })

  return `
  <!-- === SELLO DE AUTENTICIDAD Y VERIFICACIÓN === -->
  <div style="margin-top:30px; padding:15px; border:2px dashed #1e3a5f; border-radius:8px; background:#fafbff;">
    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
      ${qrCode ? `<div style="text-align:center; flex-shrink:0;">
        <img src="${qrCode}" alt="Código QR de verificación" style="width:120px; height:120px; border:1px solid #ccc; border-radius:4px;" />
        <p style="font-size:8px; color:#666; margin-top:4px;">Escanea para verificar</p>
      </div>` : ''}
      <div style="flex:1; min-width:250px;">
        <h4 style="color:#1e3a5f; margin:0 0 8px 0; font-size:13px;">🔐 SELLO DE AUTENTICIDAD DIGITAL</h4>
        <table style="width:100%; font-size:9px; border-collapse:collapse;">
          <tr>
            <td style="padding:3px; border:1px solid #ddd; background:#f0f4ff; font-weight:bold;">Tipo documento:</td>
            <td style="padding:3px; border:1px solid #ddd;">${tipoDoc === 'pagare-blanco' ? 'Pagaré en Blanco' : tipoDoc === 'pagare-diligenciado' ? 'Pagaré Diligenciado' : 'Carta de Instrucciones'}</td>
          </tr>
          <tr>
            <td style="padding:3px; border:1px solid #ddd; background:#f0f4ff; font-weight:bold;">Código verificación:</td>
            <td style="padding:3px; border:1px solid #ddd; font-family:monospace; font-weight:bold; letter-spacing:1px;">${codigoVerificacion}</td>
          </tr>
          <tr>
            <td style="padding:3px; border:1px solid #ddd; background:#f0f4ff; font-weight:bold;">Generado:</td>
            <td style="padding:3px; border:1px solid #ddd;">${fechaGen}</td>
          </tr>
          <tr>
            <td style="padding:3px; border:1px solid #ddd; background:#f0f4ff; font-weight:bold;">Sello digital:</td>
            <td style="padding:3px; border:1px solid #ddd; font-family:monospace; font-size:8px; word-break:break-all;">${selloCorto}<br>${selloCorto2}...</td>
          </tr>
        </table>
        <p style="font-size:8px; color:#666; margin-top:8px; text-align:justify;">
          <strong>⚠️ Documento protegido contra alteración.</strong> Cualquier modificación a este documento
          invalidará el sello digital SHA-256. Para verificar la autenticidad, escanee el código QR o visite
          el sistema con el código de verificación. Este documento fue generado electrónicamente por Jsadr
          y tiene plena validez legal conforme a la Ley 527 de 1999.
        </p>
      </div>
    </div>
  </div>`
}

// =====================================================
// CSS COMPARTIDO — estilo legal sobrio (Times New Roman, línea 1.8)
// Diseño simple: documento centrado, sin cabecera fija, sin marca de agua.
// =====================================================
const CSS_BASE = `
  @page { size: letter; margin: 2.5cm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', 'Liberation Serif', serif;
    line-height: 1.8;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-size: 13px;
    background: #fff;
  }
  .titulo { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; letter-spacing: 2px; }
  .center { text-align: center; }
  .cuerpo { text-align: justify; margin: 15px 0; }
  .campo { display: inline-block; border-bottom: 1px solid #000; min-width: 200px; padding: 0 4px; }
  .campo-larga { display: inline-block; border-bottom: 1px solid #000; min-width: 380px; padding: 0 4px; }
  .campo-corta { display: inline-block; border-bottom: 1px solid #000; min-width: 120px; padding: 0 4px; }
  .seccion { margin: 15px 0; font-weight: bold; }
  .checklist { background: #fff8e1; border-left: 4px solid #ffa000; padding: 12px; margin: 18px 0; font-size: 11.5px; }
  .bloque-firma { margin-top: 50px; }
  .bloque-firma h4 { font-size: 13px; font-weight: bold; margin: 20px 0 4px 0; }
  .bloque-firma .linea { border-bottom: 1px solid #000; min-height: 24px; margin-bottom: 12px; word-wrap: break-word; }
  .bloque-firma .firma-linea { border-bottom: 1px solid #000; min-height: 60px; margin: 8px 0; }
  .rol-block {
    border: 1px solid #1e3a5f;
    border-radius: 6px;
    padding: 10px 14px;
    margin: 14px 0;
    background: #fbfcfe;
  }
  .rol-block.deudor { border-color: #1e3a5f; }
  .rol-block.codeudor { border-color: #6b4f1d; background: #fffdf5; }
  .rol-block .rol-tag {
    display: inline-block;
    padding: 2px 10px;
    background: #1e3a5f;
    color: #fff;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1px;
    border-radius: 3px;
    margin-bottom: 8px;
  }
  .rol-block.codeudor .rol-tag { background: #6b4f1d; }
  .page-break { page-break-after: always; }
  .doc-separator { text-align:center; padding:8px; background:#1e3a5f; color:#fff; font-size:11px; letter-spacing:2px; margin:0 0 16px 0; border-radius:4px; }
  .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #1e3a5f; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
  @media print { .no-print { display: none; } }
`

// Alias para mantener compatibilidad con código existente
const CSS_PAGARE = CSS_BASE
const CSS_CARTA = CSS_BASE

// =====================================================
// TEXTO LEGAL — CLÁUSULA ACELERATORIA (compartido por pagaré y combinado)
// Texto idéntico al PAGARÉ 2026.docx (párrafos a–cierre)
// =====================================================
const TEXTO_CLAUSULA_ACELERATORIA = `
<p>El(los) suscriptor(es) del presente pagaré reconoce(n), acepta(n) y declara(n) expresamente que el plazo concedido para el pago de la obligación se ha otorgado en beneficio exclusivo del acreedor. En consecuencia, el acreedor podrá declarar vencido anticipadamente el plazo pactado y exigir de forma inmediata la totalidad de la obligación, sin necesidad de requerimiento judicial o extrajudicial previo, constitución en mora, interpelación o notificación adicional alguna, cuando se presente cualquiera de los siguientes eventos:</p>

<p>a) El incumplimiento en el pago de dos (2) cuotas, consecutivas o no, derivadas del presente pagaré, del plan de amortización, acuerdo de pago o cualquier documento que haga parte integral de la obligación.</p>

<p>b) El incumplimiento de cualquiera de las obligaciones, condiciones, garantías o compromisos asumidos por el deudor con ocasión del otorgamiento del crédito.</p>

<p>Configurado cualquiera de los eventos anteriores, el acreedor podrá declarar de pleno derecho terminado el acuerdo de pago y exigir inmediatamente la totalidad del saldo insoluto de la obligación, incluyendo, sin limitación alguna:</p>

<p>El capital pendiente de pago.<br>
Los intereses corrientes causados y no pagados.<br>
Los intereses de mora causados.<br>
Los gastos de cobranza prejudicial.<br>
Los honorarios de abogados y gestores de cobro.<br>
Las costas y agencias en derecho que se generen con ocasión de las acciones de recuperación de la cartera.<br>
Cualquier otro concepto derivado directa o indirectamente de la presente obligación.</p>

<p>A partir de la fecha en que se configure el incumplimiento y hasta el pago total de la obligación, las sumas adeudadas causarán intereses moratorios liquidados a la tasa máxima legal permitida y certificada para cada período por la autoridad competente en Colombia, equivalente al límite máximo autorizado por la ley y vigente al momento de hacerse exigible la obligación, o a la tasa máxima de mora que legalmente pueda cobrarse durante el tiempo que subsista el incumplimiento, sin exceder en ningún caso los límites establecidos por las normas sobre usura y demás disposiciones aplicables.</p>

<p>El deudor acepta expresamente que la tasa de interés moratorio aplicable podrá variar en el tiempo conforme a las certificaciones expedidas por la Superintendencia Financiera de Colombia o la entidad que haga sus veces, aplicándose en cada período la tasa máxima legal vigente al momento de la liquidación de los intereses.</p>

<p>La declaratoria de vencimiento anticipado facultará al acreedor para iniciar de manera inmediata las acciones de cobro prejudicial, ejecutivo, judicial o cualquier otro mecanismo legal tendiente a la recuperación de la totalidad de las sumas adeudadas, sin necesidad de requerimiento adicional alguno.</p>

<p>El deudor o deudores renuncia (mos) expresamente a cualquier requerimiento previo para constituirse en mora y acepta que la sola ocurrencia de cualquiera de los eventos de incumplimiento aquí previstos hará exigible de inmediato la totalidad de la obligación, de conformidad con las disposiciones del Código Civil, el Código de Comercio y demás normas concordantes y aplicables.</p>
`

// =====================================================
// BLOQUE DE DATOS DEL FIRMANTE (deudor / codeudor)
// Renderiza el formato "Nombre: ___ / C.C.: ___ / Dirección: ___ / Teléfono: ___ / Correo: ___ / Firma: ___"
// que coincide con el formato de los documentos de referencia .docx.
// Si hay firma electrónica completada, pinta la imagen de la firma dibujada en la línea de Firma.
// Todos los campos se auto-llenan con los datos del cliente/codeudor registrados en el sistema.
// =====================================================
function generarBloqueDatosFirma(rol: 'deudor' | 'codeudor', datos: { nombre: string; cedula: string; direccion: string; telefono: string; correo: string }, firma?: any): string {
  const titulo = rol === 'deudor' ? 'Nombre Deudor:' : 'Nombre Codeudor:'
  const labelTel = rol === 'deudor' ? 'Teléfono:' : 'Teléfonos:'
  const labelCorreo = rol === 'deudor' ? 'Correo:' : 'correo:'
  const labelDir = 'Dirección, municipio y barrio:'
  const rolTag = rol === 'deudor' ? 'DEUDOR' : 'CODEUDOR'

  // Si la firma electrónica está completada, pintamos la imagen de la firma sobre la línea
  const firmaHtml = (firma && firma.estadoFirma === 'COMPLETADA' && firma.imagenFirma)
    ? `<div style="min-height:60px; padding:4px 0; display:flex; align-items:flex-end;"><img src="${firma.imagenFirma}" alt="Firma electrónica de ${datos.nombre || 'firmante'}" style="max-height:80px; max-width:280px;" /></div>`
    : `<div class="firma-linea"></div>`

  return `
<div class="rol-block ${rol}">
  <span class="rol-tag">${rolTag}</span>
  <h4>${titulo}</h4>
  <div class="linea">${datos.nombre || ''}</div>

  <h4>Identificación (C.C.):</h4>
  <div class="linea">${datos.cedula || ''}</div>

  <h4>${labelDir}</h4>
  <div class="linea">${datos.direccion || ''}</div>

  <h4>${labelTel}</h4>
  <div class="linea">${datos.telefono || ''}</div>

  <h4>${labelCorreo}</h4>
  <div class="linea">${datos.correo || ''}</div>

  <h4>Firma:</h4>
  ${firmaHtml}
</div>`
}

// =====================================================
// PAGARÉ EN BLANCO (texto exacto del abogado — PAGARÉ 2026.docx)
// =====================================================
// El pagaré en blanco deja los campos vacíos para diligenciamiento manual posterior.
// El texto legal ES EXACTAMENTE el del documento de referencia (PAGARÉ 2026.docx).
// =====================================================
async function generarPagareBlancoHTML(prestamo: any, firmaElectronica?: any, firmaCodeudor?: any, req?: NextRequest): Promise<string> {
  const seccionFirma = generarSeccionFirmaElectronica(firmaElectronica, prestamo)
  const seccionFirmaCodeudor = generarSeccionFirmaElectronica(firmaCodeudor, prestamo, true)
  const codigoVerificacion = generarCodigoVerificacion(prestamo, 'pagare-blanco')
  const selloDigital = generarSelloDigital(prestamo, 'pagare-blanco', codigoVerificacion)
  const qrCode = await generarQRCode(codigoVerificacion, req)
  const seccionVerificacion = generarSeccionVerificacion(codigoVerificacion, selloDigital, qrCode, 'pagare-blanco')
  const fecha = new Date()
  const dia = fecha.getDate()
  const mes = fecha.toLocaleString('es-CO', { month: 'long' })
  const anio = fecha.getFullYear()
  const cliente = prestamo.cliente

  // Campos del pagaré en blanco (todos vacíos para diligenciamiento manual)
  const blankNombre = '______________________________________________________________'
  const blankDomicilio = '________________________________'
  const blankDia = '_______'
  const blankMes = '_________________'
  const blankAnio = '_________'
  const blankCapitalLine = '___________________________________________________________________________________________________________________________________________________________________'
  const blankCapitalPesos = '__________________________________________________'
  const blankInteresesLine = '___________________________________________________________________________________________________________________'
  const blankOtrosLine = '_________________________________________________________________________________'
  const blankNumPagare = '____________________________'

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pagaré en Blanco - ${prestamo.codigo}</title>
<style>${CSS_PAGARE}</style>
</head>
<body>

<div class="titulo">PAGARÉ No.</div>
<p class="center">${blankNumPagare}</p>

<div class="cuerpo">
<p>Yo(Nosotros),</p>
<p>${blankNombre} mayor(es) de edad, con domicilio en el municipio de Medellín Antioquia</p>
<p>Domicilio: <span class="campo-larga">${blankDomicilio}</span></p>
<p>identificado(s) como aparece(mos) al pie de mi(nuestras) firma(s), actuando en mi (nuestro) propio nombre, o en la condición indicada al píe de mi(nuestras) firma(s), declaro(amos):</p>

<p><strong>PRIMERO:</strong> Que me(nos) obligo(amos) a pagar solidaria, indivisible, irrevocable e incondicionalmente a la orden de <strong>Johan Sebastian Alvarez Del Rio</strong>. en adelante EL ACREEDOR, o a quien represente sus derechos, el día ( ${blankDia} ) del mes de ${blankMes} del año ${blankAnio} , en sus oficinas del país o en los puntos de pago autorizados expresamente para el efecto, las siguientes sumas de dinero:</p>

<p><strong>POR CAPITAL:</strong></p>
<p>${blankCapitalLine}</p>
<p>($ ${blankCapitalPesos}) M.C.</p>

<p><strong>POR INTERESES CAUSADOS Y NO PAGADOS:</strong></p>
<p>($ ${blankCapitalPesos}) M.C.</p>
<p>${blankInteresesLine}</p>

<p><strong>POR OTROS CONCEPTOS:</strong></p>
<p>($ ${blankCapitalPesos}) M.C.</p>
<p>${blankOtrosLine}</p>

<p><strong>SEGUNDO:</strong> Que pagare(mos) intereses moratorios a la tasa máxima legalmente autorizada sobre la suma de capital insoluto.</p>

<p><strong>TERCERO: CLÁUSULA ACELERATORIA, VENCIMIENTO ANTICIPADO E INTERESES DE MORA</strong></p>

${TEXTO_CLAUSULA_ACELERATORIA}

<p><strong>CUARTO:</strong> Que acepto(amos) expresamente cualquier endoso o cesión que de este pagaré haga EL ACREEDOR reconozco(emos) desde ya al endosatario o cesionario dentro de cualquier proceso judicial.</p>

<p><strong>QUINTO:</strong> EL ACREEDOR se podrá acoger a los términos del artículo 886 del Código de Comercio para el cobro de intereses. El presente pagaré no está sujeto a la presentación para su pago, ni al aviso de rechazo, ni al protesto para todos los efectos legales y se suscribe para ser llenado por EL ACREEDOR o su representante según las instrucciones impartidas por mi(nosotros), las cuales están contenidas en la carta de autorizaciones e instrucciones adjunta al presente documento, de conformidad con lo dispuesto en el artículo 622 del Código de Comercio.</p>

<p>El suscriptor declara haber suministrado voluntariamente al acreedor copia de su documento de identidad, la cual hace parte de los soportes de identificación de la presente obligación.</p>

<p>Para constancia se firma en un (1) original, con destino a <strong>Johan Sebastian Alvarez Del Rio</strong> quien presta el dinero a los ( ${dia} ) días del mes de ${mes} del año ${anio}.</p>
</div>

${generarBloqueDatosFirma('deudor', { nombre: '', cedula: '', direccion: '', telefono: '', correo: '' }, firmaElectronica)}

${generarBloqueDatosFirma('codeudor', { nombre: '', cedula: '', direccion: '', telefono: '', correo: '' }, firmaCodeudor)}

${seccionFirma}

${seccionFirmaCodeudor}

${seccionVerificacion}

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
</body>
</html>`
}

// =====================================================
// PAGARÉ DILIGENCIADO (texto exacto del abogado + datos del préstamo)
// Texto legal idéntico a PAGARÉ 2026.docx.
// IMPORTANTE: Los valores monetarios (capital, intereses, otros conceptos) y las tasas/saldos
// NO se auto-llenan. Quedan como campos en blanco (líneas) para diligenciamiento MANUAL
// por parte del acreedor, conforme al modelo de pagaré en blanco + carta de instrucciones.
// Los datos que SÍ se auto-llenan son: nombres, cédulas, dirección, teléfono y correo
// del deudor y del codeudor (si aplica), tomados de los registros del sistema.
// =====================================================
async function generarPagareDiligenciadoHTML(prestamo: any, calculo: any, firmaElectronica?: any, firmaCodeudor?: any, req?: NextRequest): Promise<string> {
  const seccionFirma = generarSeccionFirmaElectronica(firmaElectronica, prestamo)
  const seccionFirmaCodeudor = generarSeccionFirmaElectronica(firmaCodeudor, prestamo, true)
  const codigoVerificacion = generarCodigoVerificacion(prestamo, 'pagare-diligenciado')
  const selloDigital = generarSelloDigital(prestamo, 'pagare-diligenciado', codigoVerificacion)
  const qrCode = await generarQRCode(codigoVerificacion, req)
  const seccionVerificacion = generarSeccionVerificacion(codigoVerificacion, selloDigital, qrCode, 'pagare-diligenciado')
  const fecha = new Date(prestamo.fechaDesembolso || prestamo.fechaSolicitud)
  const dia = fecha.getDate()
  const mes = fecha.toLocaleString('es-CO', { month: 'long' })
  const anio = fecha.getFullYear()
  const cliente = prestamo.cliente

  // Domicilio del deudor compuesto: dirección + barrio + municipio
  const domicilioDeudor = [
    cliente.direccion,
    cliente.barrio,
    cliente.municipio || cliente.ciudad,
  ].filter(Boolean).join(' · ') || '________________________________'

  // Líneas en blanco para diligenciamiento MANUAL de valores monetarios
  const blankLineLarga = '___________________________________________________________________________________________________________'
  const blankLineMedia = '___________________________________________________________________________'
  const blankLineCorta = '_______________________________________________'
  const blankPesos = '__________________________________________________'

  const contenido = `
<div class="titulo">PAGARÉ No. ${prestamo.codigo}</div>

<div class="cuerpo">
<p>Yo(Nosotros),</p>
<p><strong>${cliente.nombre}</strong> mayor(es) de edad, con domicilio en el municipio de Medellín Antioquia</p>
<p>Domicilio: <span class="campo-larga">${domicilioDeudor}</span></p>
<p>identificado(s) como aparece(mos) al pie de mi(nuestras) firma(s), actuando en mi (nuestro) propio nombre, o en la condición indicada al píe de mi(nuestras) firma(s), declaro(amos):</p>

<p><strong>PRIMERO:</strong> Que me(nos) obligo(amos) a pagar solidaria, indivisible, irrevocable e incondicionalmente a la orden de <strong>Johan Sebastian Alvarez Del Rio</strong>. en adelante EL ACREEDOR, o a quien represente sus derechos, el día ( <span class="campo-corta">${dia}</span> ) del mes de <span class="campo">${mes}</span> del año <span class="campo-corta">${anio}</span> , en sus oficinas del país o en los puntos de pago autorizados expresamente para el efecto, las siguientes sumas de dinero:</p>

<p><strong>POR CAPITAL:</strong></p>
<p><span class="campo-larga" style="min-width:520px;">${blankLineLarga}</span></p>
<p>($ <span class="campo-larga" style="min-width:480px;">${blankPesos}</span>) M.C.</p>

<p><strong>POR INTERESES CAUSADOS Y NO PAGADOS:</strong></p>
<p>($ <span class="campo-larga" style="min-width:480px;">${blankPesos}</span>) M.C.</p>
<p><span class="campo-larga" style="min-width:520px;">${blankLineMedia}</span></p>

<p><strong>POR OTROS CONCEPTOS:</strong></p>
<p>($ <span class="campo-larga" style="min-width:480px;">${blankPesos}</span>) M.C.</p>
<p><span class="campo-larga" style="min-width:520px;">${blankLineCorta}</span></p>

<p><strong>SEGUNDO:</strong> Que pagare(mos) intereses moratorios a la tasa máxima legalmente autorizada sobre la suma de capital insoluto.</p>

<p><strong>TERCERO: CLÁUSULA ACELERATORIA, VENCIMIENTO ANTICIPADO E INTERESES DE MORA</strong></p>

${TEXTO_CLAUSULA_ACELERATORIA}

<p><strong>CUARTO:</strong> Que acepto(amos) expresamente cualquier endoso o cesión que de este pagaré haga EL ACREEDOR reconozco(emos) desde ya al endosatario o cesionario dentro de cualquier proceso judicial.</p>

<p><strong>QUINTO:</strong> EL ACREEDOR se podrá acoger a los términos del artículo 886 del Código de Comercio para el cobro de intereses. El presente pagaré no está sujeto a la presentación para su pago, ni al aviso de rechazo, ni al protesto para todos los efectos legales y se suscribe para ser llenado por EL ACREEDOR o su representante según las instrucciones impartidas por mi(nosotros), las cuales están contenidas en la carta de autorizaciones e instrucciones adjunta al presente documento, de conformidad con lo dispuesto en el artículo 622 del Código de Comercio.</p>

<p>El suscriptor declara haber suministrado voluntariamente al acreedor copia de su documento de identidad, la cual hace parte de los soportes de identificación de la presente obligación.</p>

<p>Para constancia se firma en un (1) original, con destino a <strong>Johan Sebastian Alvarez Del Rio</strong> quien presta el dinero a los ( <span class="campo-corta">${dia}</span> ) días del mes de <span class="campo">${mes}</span> del año <span class="campo-corta">${anio}</span>.</p>
</div>

${generarBloqueDatosFirma('deudor', {
  nombre: cliente.nombre,
  cedula: cliente.cedula,
  direccion: domicilioDeudor,
  telefono: cliente.telefono,
  correo: cliente.email || '',
}, firmaElectronica)}

${prestamo.tieneCodeudor ? generarBloqueDatosFirma('codeudor', {
  nombre: prestamo.codeudorNombre || '',
  cedula: prestamo.codeudorCedula || '',
  direccion: prestamo.codeudorDireccion || '',
  telefono: prestamo.codeudorTelefono || '',
  correo: prestamo.codeudorEmail || '',
}, firmaCodeudor) : ''}

${seccionFirma}

${seccionFirmaCodeudor}

${seccionVerificacion}

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pagaré - ${prestamo.codigo}</title>
<style>${CSS_PAGARE}</style>
</head>
<body>
${contenido}
</body>
</html>`
}

// =====================================================
// CARTA DE INSTRUCCIONES (texto exacto del abogado — carta de instrucciones 2026.docx)
// =====================================================
// Texto legal idéntico al documento de referencia. Datos del deudor y codeudor
// (nombre, cédula, dirección, teléfono, correo) auto-llenados del sistema.
// =====================================================
async function generarCartaInstruccionesHTML(prestamo: any, firmaElectronica?: any, firmaCodeudor?: any, req?: NextRequest): Promise<string> {
  const seccionFirma = generarSeccionFirmaElectronica(firmaElectronica, prestamo)
  const seccionFirmaCodeudor = generarSeccionFirmaElectronica(firmaCodeudor, prestamo, true)
  const codigoVerificacion = generarCodigoVerificacion(prestamo, 'carta')
  const selloDigital = generarSelloDigital(prestamo, 'carta', codigoVerificacion)
  const qrCode = await generarQRCode(codigoVerificacion, req)
  const seccionVerificacion = generarSeccionVerificacion(codigoVerificacion, selloDigital, qrCode, 'carta')
  const cliente = prestamo.cliente
  const fecha = new Date()
  const dia = fecha.getDate()
  const mes = fecha.toLocaleString('es-CO', { month: 'long' })
  const anio = fecha.getFullYear()

  // Domicilio del deudor compuesto: dirección + barrio + municipio
  const domicilioDeudor = [
    cliente.direccion,
    cliente.barrio,
    cliente.municipio || cliente.ciudad,
  ].filter(Boolean).join(' · ') || '________________________________'

  const contenido = `
<div class="titulo">CARTA DE INSTRUCCIONES</div>

<p>Señores</p>

<p><strong>AUTORIZACION E INSTRUCCIONES PERMANENTES PARA EL DILIGENCIAMIENTO DEL PAGARÉ No.</strong></p>
<p class="center">${prestamo.codigo}</p>

<div class="cuerpo">
<p>Yo(Nosotros),</p>
<p><span class="campo-larga"><strong>${cliente.nombre}</strong></span> mayor(es) de edad, con domicilio en el Municipio de Medellín Antioquia Domicilio <span class="campo-larga">${domicilioDeudor}</span></p>
<p>identificado(s) como aparece(mos) al pie mi(nuestras) firma(s), actuando en mi(nuestro) propio nombre, o en la condición indicada al píe de mi(nuestras) firma(s), declaro(amos):</p>

<p>Que de conformidad con lo dispuesto en el artículo 622 del Código de Comercio, por medio del presente documento autorizo(amos) irrevocablemente y de manera permanente al quien presta el dinero en adelante el ACREEDOR o a quien represente sus derechos, para llenar sin previo aviso los espacios en blanco y demás aspectos generales y particulares del pagaré indicado en la referencia, el cual he(mos) otorgado a su orden con espacios en blanco y del que hago(hacemos) entrega con efectos negociables, teniendo en cuenta las siguientes instrucciones:</p>

<p><strong>1.</strong> El pagaré podrá ser llenado cuando exista incumplimiento o mora en el pago de cualquier obligación a mí (nuestro) cargo, individual o conjuntamente, en los casos estipulados en la ley, en el pagaré mismo y demás documentos suscritos por mi (nosotros). Podrá también ser endosado, previo a su diligenciamiento, en razón de ser negociado cualquier derecho de crédito a mi (nuestro) cargo, individual, conjunta y solidariamente.</p>

<p><strong>2.</strong> La fecha de vencimiento del título valor será aquella que corresponda al día en que sea llenado el pagaré. El ACREEDOR determinará la fecha de vencimiento del Pagaré y esta corresponderá a un día cierto, de tal manera que a partir de la misma serán exigibles de inmediato todas las obligaciones contenidas en el Pagaré materia de estas instrucciones.</p>

<p><strong>3.</strong> El espacio relacionado con el valor de capital se llenará con el monto de todas las sumas que por concepto de saldo insoluto de capital deba (mos) al ACREEDOR, en forma separada, conjunta y solidaria, el día en que sean diligenciados los espacios en blanco, conforme a la liquidación que el ACREEDOR efectúe, derivadas de todas las obligaciones exigibles a mí(nuestro) cargo y a favor del ACREEDOR, en especial la correspondiente al mutuo que hemos recibido de parte del ACREEDOR.</p>

<p><strong>4.</strong> El espacio relacionado con los intereses causados y no pagados será el que corresponda por este concepto, tanto de intereses de plazo como de mora, derivados de las obligaciones a mi(nuestro) cargo, conforme a la liquidación que el ACREEDOR efectúe.</p>

<p><strong>5.</strong> El espacio relacionado con el valor de otros conceptos se llenará con el monto de todas las sumas que por cualquier otro concepto yo(nosotros) deba(amos) al ACREEDOR sin atención a su naturaleza o fuente, en especial las relacionadas con los siguientes rubros: (i) Los valores que por mí(nuestra) cuenta haya cancelado el ACREEDOR, por concepto de prima(s) de los seguros que se hayan contratado por mí(nuestra) cuenta. (ii) El monto de cualquier gasto pagado por el ACREEDOR por mi(nuestra) cuenta, especialmente impuestos, timbre, honorarios de abogados, comisiones, gastos administrativos y de cobranzas, así como cualquier otra suma que se deba por concepto distinto de intereses, salvo aquellos intereses que sea permitido capitalizar.</p>

<p><strong>6.</strong> En el evento de que en desarrollo de esta facultad se cometieren errores involuntarios en el diligenciamiento del pagaré, el ACREEDOR queda expresamente facultado para aclararlos, enmendarlos y corregirlos de manera tal que el mismo responda a sus exigencias legales.</p>

<p><strong>7.</strong> En caso de incumplimiento, retardo o existencia de cualquier causal de aceleración contemplada en los pagarés, contratos y reglamentos, frente a cualquiera de las obligaciones a mi(nuestro) cargo, el ACREEDOR queda autorizado para acelerar el vencimiento y exigir anticipadamente el valor de las demás obligaciones de las que sea (amos) deudor(es), garante(s) o avalista(s), individual, conjunta o solidariamente, sin necesidad de requerimiento judicial o extrajudicial para constituir en mora, así como para incorporarlas al Pagaré.</p>

<p><strong>8.</strong> Así mismo, autorizo(amos) diligenciar los espacios en blanco correspondientes al número del pagaré, el cual corresponderá a aquel que le asigne el Banco y que identifique cualquiera de las obligaciones a mi(nuestro) cargo; así como al de mi(nuestro) domicilio, mi(nuestro) nombre y dirección. Declaro(amos) expresamente haber recibido copia del presente documento para todos los efectos legales.</p>

<p><strong>9. CLÁUSULA DE ACEPTACIÓN DE FIRMA ELECTRÓNICA Y TRATAMIENTO DE DATOS BIOMÉTRICOS:</strong> El DEUDOR (y el CODEUDOR, si aplica) acepta, manifiesta y reconoce de manera expresa y voluntaria que el presente Pagaré y su respectiva Carta de Instrucciones son suscritos mediante el mecanismo de firma electrónica de la plataforma <strong>Jsadr Jo*** Se*** Al*** D** R**</strong>. Las partes acuerdan que dicho mecanismo sustituye la firma manuscrita, otorgándole plena validez, autenticidad, integridad y fuerza ejecutiva al título valor aquí constituido, de conformidad con el artículo 7 de la Ley 527 de 1999 y el Decreto 1074 de 2015. Asimismo, el DEUDOR autoriza de forma previa, explícita e informada al ACREEDOR para la captura, almacenamiento y tratamiento de su dato personal sensible consistente en el registro fotográfico de su rostro sosteniendo su documento de identidad (Cédula de Ciudadanía). Esta validación biométrica se realiza con la única finalidad de verificar la identidad del firmante, mitigar riesgos de suplantación y servir como prueba de autoría de la firma electrónica, garantizando en todo momento los derechos de confidencialidad y hábeas data consagrados en la Ley 1581 de 2012.</p>

<p><strong>10.</strong> El deudor autoriza expresa e irrevocablemente al acreedor para exigir, custodiar y conservar copia de su documento de identidad firmada y con impresión de huella dactilar, la cual hará parte integral de los documentos soporte de la obligación. El deudor reconoce que dichos documentos podrán ser utilizados como medio probatorio en procesos de cobro prejudicial, judicial, ejecutivo o cualquier actuación encaminada a la recuperación de la cartera derivada del presente pagaré, sin perjuicio de los demás medios de prueba legalmente admisibles.</p>

<div class="checklist">
<strong>En el expediente del crédito se debe soportar con:</strong><br>
☐ Copia de cédula al 150%<br>
☐ Firma sobre la copia de la cédula<br>
☐ Huella índice derecho o selfie sosteniendo la cédula (de ser firma digital)<br>
☐ Fecha de entrega<br>
☐ Firma de recibido del asesor o responsable
</div>

<p>El pagaré llenado conforme a estas instrucciones, será exigible inmediatamente y prestará mérito ejecutivo sin más requisitos y requerimientos. Declaro(amos) que conozco(cemos) y acepto(amos) los Reglamentos y/o Contratos de los productos, así como que he(mos) recibida copia de esta carta de instrucciones.</p>

<p>Para constancia se firma a los ( <span class="campo-corta">${dia}</span> ) días del mes de <span class="campo">${mes}</span> del año <span class="campo-corta">${anio}</span></p>
</div>

${generarBloqueDatosFirma('deudor', {
  nombre: cliente.nombre,
  cedula: cliente.cedula,
  direccion: domicilioDeudor,
  telefono: cliente.telefono,
  correo: cliente.email || '',
}, firmaElectronica)}

${prestamo.tieneCodeudor ? generarBloqueDatosFirma('codeudor', {
  nombre: prestamo.codeudorNombre || '',
  cedula: prestamo.codeudorCedula || '',
  direccion: prestamo.codeudorDireccion || '',
  telefono: prestamo.codeudorTelefono || '',
  correo: prestamo.codeudorEmail || '',
}, firmaCodeudor) : ''}

${seccionFirma}

${seccionFirmaCodeudor}

${seccionVerificacion}

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Carta de Instrucciones - ${prestamo.codigo}</title>
<style>${CSS_CARTA}</style>
</head>
<body>
${contenido}
</body>
</html>`
}

// =====================================================
// DOCUMENTO COMBINADO (Pagaré + Carta en un único PDF)
// =====================================================
// Genera un único documento HTML imprimible que contiene:
//   1. Pagaré diligenciado completo (texto legal + datos + su propia sección de firma electrónica)
//   2. Salto de página
//   3. Carta de instrucciones completa (texto legal + datos + su PROPIA sección de firma electrónica)
//
// Importante: la sección de firma electrónica aparece DOS veces (una por documento)
// para garantizar que cada documento quedó firmado y entregado por separado, aunque
// físicamente sea el mismo acto de firma. Esto responde al requisito del usuario:
// "las firmas, fotos, códigos otp deben aparecer en ambas secciones para garantizar
// que se cumplió con la entrega de los dos documentos pero estarían en uno solo".
// =====================================================
async function generarDocumentoCombinadoHTML(prestamo: any, calculo: any, firmaElectronica?: any, firmaCodeudor?: any, req?: NextRequest): Promise<string> {
  const codigoPagare = generarCodigoVerificacion(prestamo, 'pagare-diligenciado')
  const selloPagare = generarSelloDigital(prestamo, 'pagare-diligenciado', codigoPagare)
  const qrPagare = await generarQRCode(codigoPagare, req)
  const verifPagare = generarSeccionVerificacion(codigoPagare, selloPagare, qrPagare, 'pagare-diligenciado')

  const codigoCarta = generarCodigoVerificacion(prestamo, 'carta')
  const selloCarta = generarSelloDigital(prestamo, 'carta', codigoCarta)
  const qrCarta = await generarQRCode(codigoCarta, req)
  const verifCarta = generarSeccionVerificacion(codigoCarta, selloCarta, qrCarta, 'carta')

  // Cada documento tiene su propia sección de firma (independiente, aunque sean los mismos datos)
  const firmaPagare = generarSeccionFirmaElectronica(firmaElectronica, prestamo, false, 'PAGARÉ')
  const firmaPagareCodeudor = generarSeccionFirmaElectronica(firmaCodeudor, prestamo, true, 'PAGARÉ')
  const firmaCarta = generarSeccionFirmaElectronica(firmaElectronica, prestamo, false, 'CARTA DE INSTRUCCIONES')
  const firmaCartaCodeudor = generarSeccionFirmaElectronica(firmaCodeudor, prestamo, true, 'CARTA DE INSTRUCCIONES')

  // IMPORTANTE: No se calculan ni se muestran tasas, saldos ni valores monetarios del préstamo.
  // Esos campos quedan en blanco (líneas) para diligenciamiento MANUAL del acreedor, conforme
  // al modelo de pagaré en blanco + carta de instrucciones del abogado.
  const fecha = new Date(prestamo.fechaDesembolso || prestamo.fechaSolicitud)
  const dia = fecha.getDate()
  const mes = fecha.toLocaleString('es-CO', { month: 'long' })
  const anio = fecha.getFullYear()
  const cliente = prestamo.cliente
  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const mesHoy = hoy.toLocaleString('es-CO', { month: 'long' })
  const anioHoy = hoy.getFullYear()

  const domicilioDeudor = [
    cliente.direccion,
    cliente.barrio,
    cliente.municipio || cliente.ciudad,
  ].filter(Boolean).join(' · ') || '________________________________'

  const datosDeudor = {
    nombre: cliente.nombre,
    cedula: cliente.cedula,
    direccion: domicilioDeudor,
    telefono: cliente.telefono,
    correo: cliente.email || '',
  }
  const datosCodeudor = {
    nombre: prestamo.codeudorNombre || '',
    cedula: prestamo.codeudorCedula || '',
    direccion: prestamo.codeudorDireccion || '',
    telefono: prestamo.codeudorTelefono || '',
    correo: prestamo.codeudorEmail || '',
  }

  // Líneas en blanco para diligenciamiento MANUAL de valores monetarios (capital, intereses, otros)
  // No se colocan tasas ni saldos — esos campos quedan vacíos para que el acreedor los llene.
  const blankLineLarga = '___________________________________________________________________________________________________________'
  const blankLineMedia = '___________________________________________________________________________'
  const blankLineCorta = '_______________________________________________'
  const blankPesos = '__________________________________________________'

  const contenidoCombinado = `
<!-- ===================================================== -->
<!-- DOCUMENTO 1: PAGARÉ                                    -->
<!-- ===================================================== -->
<div class="doc-separator">DOCUMENTO 1 DE 2 · PAGARÉ</div>

<div class="titulo">PAGARÉ No. ${prestamo.codigo}</div>

<div class="cuerpo">
<p>Yo(Nosotros),</p>
<p><strong>${cliente.nombre}</strong> mayor(es) de edad, con domicilio en el municipio de Medellín Antioquia</p>
<p>Domicilio: <span class="campo-larga">${domicilioDeudor}</span></p>
<p>identificado(s) como aparece(mos) al pie de mi(nuestras) firma(s), actuando en mi (nuestro) propio nombre, o en la condición indicada al píe de mi(nuestras) firma(s), declaro(amos):</p>

<p><strong>PRIMERO:</strong> Que me(nos) obligo(amos) a pagar solidaria, indivisible, irrevocable e incondicionalmente a la orden de <strong>Johan Sebastian Alvarez Del Rio</strong>. en adelante EL ACREEDOR, o a quien represente sus derechos, el día ( <span class="campo-corta">${dia}</span> ) del mes de <span class="campo">${mes}</span> del año <span class="campo-corta">${anio}</span> , en sus oficinas del país o en los puntos de pago autorizados expresamente para el efecto, las siguientes sumas de dinero:</p>

<p><strong>POR CAPITAL:</strong></p>
<p><span class="campo-larga" style="min-width:520px;">${blankLineLarga}</span></p>
<p>($ <span class="campo-larga" style="min-width:480px;">${blankPesos}</span>) M.C.</p>

<p><strong>POR INTERESES CAUSADOS Y NO PAGADOS:</strong></p>
<p>($ <span class="campo-larga" style="min-width:480px;">${blankPesos}</span>) M.C.</p>
<p><span class="campo-larga" style="min-width:520px;">${blankLineMedia}</span></p>

<p><strong>POR OTROS CONCEPTOS:</strong></p>
<p>($ <span class="campo-larga" style="min-width:480px;">${blankPesos}</span>) M.C.</p>
<p><span class="campo-larga" style="min-width:520px;">${blankLineCorta}</span></p>

<p><strong>SEGUNDO:</strong> Que pagare(mos) intereses moratorios a la tasa máxima legalmente autorizada sobre la suma de capital insoluto.</p>

<p><strong>TERCERO: CLÁUSULA ACELERATORIA, VENCIMIENTO ANTICIPADO E INTERESES DE MORA</strong></p>

${TEXTO_CLAUSULA_ACELERATORIA}

<p><strong>CUARTO:</strong> Que acepto(amos) expresamente cualquier endoso o cesión que de este pagaré haga EL ACREEDOR reconozco(emos) desde ya al endosatario o cesionario dentro de cualquier proceso judicial.</p>

<p><strong>QUINTO:</strong> EL ACREEDOR se podrá acoger a los términos del artículo 886 del Código de Comercio para el cobro de intereses. El presente pagaré no está sujeto a la presentación para su pago, ni al aviso de rechazo, ni al protesto para todos los efectos legales y se suscribe para ser llenado por EL ACREEDOR o su representante según las instrucciones impartidas por mi(nosotros), las cuales están contenidas en la carta de autorizaciones e instrucciones adjunta al presente documento, de conformidad con lo dispuesto en el artículo 622 del Código de Comercio.</p>

<p>El suscriptor declara haber suministrado voluntariamente al acreedor copia de su documento de identidad, la cual hace parte de los soportes de identificación de la presente obligación.</p>

<p>Para constancia se firma en un (1) original, con destino a <strong>Johan Sebastian Alvarez Del Rio</strong> quien presta el dinero a los ( <span class="campo-corta">${dia}</span> ) días del mes de <span class="campo">${mes}</span> del año <span class="campo-corta">${anio}</span>.</p>
</div>

${generarBloqueDatosFirma('deudor', datosDeudor, firmaElectronica)}
${prestamo.tieneCodeudor ? generarBloqueDatosFirma('codeudor', datosCodeudor, firmaCodeudor) : ''}

${firmaPagare}
${firmaPagareCodeudor}
${verifPagare}

<!-- ===================================================== -->
<!-- SALTO DE PÁGINA                                        -->
<!-- ===================================================== -->
<div class="page-break"></div>

<!-- ===================================================== -->
<!-- DOCUMENTO 2: CARTA DE INSTRUCCIONES                    -->
<!-- ===================================================== -->
<div class="doc-separator">DOCUMENTO 2 DE 2 · CARTA DE INSTRUCCIONES</div>

<div class="titulo">CARTA DE INSTRUCCIONES</div>

<p>Señores</p>

<p><strong>AUTORIZACION E INSTRUCCIONES PERMANENTES PARA EL DILIGENCIAMIENTO DEL PAGARÉ No.</strong></p>
<p class="center">${prestamo.codigo}</p>

<div class="cuerpo">
<p>Yo(Nosotros),</p>
<p><span class="campo-larga"><strong>${cliente.nombre}</strong></span> mayor(es) de edad, con domicilio en el Municipio de Medellín Antioquia Domicilio <span class="campo-larga">${domicilioDeudor}</span></p>
<p>identificado(s) como aparece(mos) al pie mi(nuestras) firma(s), actuando en mi(nuestro) propio nombre, o en la condición indicada al píe de mi(nuestras) firma(s), declaro(amos):</p>

<p>Que de conformidad con lo dispuesto en el artículo 622 del Código de Comercio, por medio del presente documento autorizo(amos) irrevocablemente y de manera permanente al quien presta el dinero en adelante el ACREEDOR o a quien represente sus derechos, para llenar sin previo aviso los espacios en blanco y demás aspectos generales y particulares del pagaré indicado en la referencia, el cual he(mos) otorgado a su orden con espacios en blanco y del que hago(hacemos) entrega con efectos negociables, teniendo en cuenta las siguientes instrucciones:</p>

<p><strong>1.</strong> El pagaré podrá ser llenado cuando exista incumplimiento o mora en el pago de cualquier obligación a mí (nuestro) cargo, individual o conjuntamente, en los casos estipulados en la ley, en el pagaré mismo y demás documentos suscritos por mi (nosotros). Podrá también ser endosado, previo a su diligenciamiento, en razón de ser negociado cualquier derecho de crédito a mi (nuestro) cargo, individual, conjunta y solidariamente.</p>

<p><strong>2.</strong> La fecha de vencimiento del título valor será aquella que corresponda al día en que sea llenado el pagaré. El ACREEDOR determinará la fecha de vencimiento del Pagaré y esta corresponderá a un día cierto, de tal manera que a partir de la misma serán exigibles de inmediato todas las obligaciones contenidas en el Pagaré materia de estas instrucciones.</p>

<p><strong>3.</strong> El espacio relacionado con el valor de capital se llenará con el monto de todas las sumas que por concepto de saldo insoluto de capital deba (mos) al ACREEDOR, en forma separada, conjunta y solidaria, el día en que sean diligenciados los espacios en blanco, conforme a la liquidación que el ACREEDOR efectúe, derivadas de todas las obligaciones exigibles a mí(nuestro) cargo y a favor del ACREEDOR, en especial la correspondiente al mutuo que hemos recibido de parte del ACREEDOR.</p>

<p><strong>4.</strong> El espacio relacionado con los intereses causados y no pagados será el que corresponda por este concepto, tanto de intereses de plazo como de mora, derivados de las obligaciones a mi(nuestro) cargo, conforme a la liquidación que el ACREEDOR efectúe.</p>

<p><strong>5.</strong> El espacio relacionado con el valor de otros conceptos se llenará con el monto de todas las sumas que por cualquier otro concepto yo(nosotros) deba(amos) al ACREEDOR sin atención a su naturaleza o fuente, en especial las relacionadas con los siguientes rubros: (i) Los valores que por mí(nuestra) cuenta haya cancelado el ACREEDOR, por concepto de prima(s) de los seguros que se hayan contratado por mí(nuestra) cuenta. (ii) El monto de cualquier gasto pagado por el ACREEDOR por mi(nuestra) cuenta, especialmente impuestos, timbre, honorarios de abogados, comisiones, gastos administrativos y de cobranzas, así como cualquier otra suma que se deba por concepto distinto de intereses, salvo aquellos intereses que sea permitido capitalizar.</p>

<p><strong>6.</strong> En el evento de que en desarrollo de esta facultad se cometieren errores involuntarios en el diligenciamiento del pagaré, el ACREEDOR queda expresamente facultado para aclararlos, enmendarlos y corregirlos de manera tal que el mismo responda a sus exigencias legales.</p>

<p><strong>7.</strong> En caso de incumplimiento, retardo o existencia de cualquier causal de aceleración contemplada en los pagarés, contratos y reglamentos, frente a cualquiera de las obligaciones a mi(nuestro) cargo, el ACREEDOR queda autorizado para acelerar el vencimiento y exigir anticipadamente el valor de las demás obligaciones de las que sea (amos) deudor(es), garante(s) o avalista(s), individual, conjunta o solidariamente, sin necesidad de requerimiento judicial o extrajudicial para constituir en mora, así como para incorporarlas al Pagaré.</p>

<p><strong>8.</strong> Así mismo, autorizo(amos) diligenciar los espacios en blanco correspondientes al número del pagaré, el cual corresponderá a aquel que le asigne el Banco y que identifique cualquiera de las obligaciones a mi(nuestro) cargo; así como al de mi(nuestro) domicilio, mi(nuestro) nombre y dirección. Declaro(amos) expresamente haber recibido copia del presente documento para todos los efectos legales.</p>

<p><strong>9. CLÁUSULA DE ACEPTACIÓN DE FIRMA ELECTRÓNICA Y TRATAMIENTO DE DATOS BIOMÉTRICOS:</strong> El DEUDOR (y el CODEUDOR, si aplica) acepta, manifiesta y reconoce de manera expresa y voluntaria que el presente Pagaré y su respectiva Carta de Instrucciones son suscritos mediante el mecanismo de firma electrónica de la plataforma <strong>Jsadr Jo*** Se*** Al*** D** R**</strong>. Las partes acuerdan que dicho mecanismo sustituye la firma manuscrita, otorgándole plena validez, autenticidad, integridad y fuerza ejecutiva al título valor aquí constituido, de conformidad con el artículo 7 de la Ley 527 de 1999 y el Decreto 1074 de 2015. Asimismo, el DEUDOR autoriza de forma previa, explícita e informada al ACREEDOR para la captura, almacenamiento y tratamiento de su dato personal sensible consistente en el registro fotográfico de su rostro sosteniendo su documento de identidad (Cédula de Ciudadanía). Esta validación biométrica se realiza con la única finalidad de verificar la identidad del firmante, mitigar riesgos de suplantación y servir como prueba de autoría de la firma electrónica, garantizando en todo momento los derechos de confidencialidad y hábeas data consagrados en la Ley 1581 de 2012.</p>

<p><strong>10.</strong> El deudor autoriza expresa e irrevocablemente al acreedor para exigir, custodiar y conservar copia de su documento de identidad firmada y con impresión de huella dactilar, la cual hará parte integral de los documentos soporte de la obligación. El deudor reconoce que dichos documentos podrán ser utilizados como medio probatorio en procesos de cobro prejudicial, judicial, ejecutivo o cualquier actuación encaminada a la recuperación de la cartera derivada del presente pagaré, sin perjuicio de los demás medios de prueba legalmente admisibles.</p>

<div class="checklist">
<strong>En el expediente del crédito se debe soportar con:</strong><br>
☐ Copia de cédula al 150%<br>
☐ Firma sobre la copia de la cédula<br>
☐ Huella índice derecho o selfie sosteniendo la cédula (de ser firma digital)<br>
☐ Fecha de entrega<br>
☐ Firma de recibido del asesor o responsable
</div>

<p>El pagaré llenado conforme a estas instrucciones, será exigible inmediatamente y prestará mérito ejecutivo sin más requisitos y requerimientos. Declaro(amos) que conozco(cemos) y acepto(amos) los Reglamentos y/o Contratos de los productos, así como que he(mos) recibida copia de esta carta de instrucciones.</p>

<p>Para constancia se firma a los ( ${diaHoy} ) días del mes de ${mesHoy} del año ${anioHoy}</p>
</div>

${generarBloqueDatosFirma('deudor', datosDeudor, firmaElectronica)}
${prestamo.tieneCodeudor ? generarBloqueDatosFirma('codeudor', datosCodeudor, firmaCodeudor) : ''}

${firmaCarta}
${firmaCartaCodeudor}
${verifCarta}

<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF (Pagaré + Carta)</button>
`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pagaré + Carta de Instrucciones - ${prestamo.codigo}</title>
<style>${CSS_PAGARE}</style>
</head>
<body>
${contenidoCombinado}
</body>
</html>`
}

// =====================================================
// SECCIÓN DE FIRMA ELECTRÓNICA (común a los 3 documentos)
// Acepta un parámetro opcional `documentoContexto` para etiquetar a qué documento
// pertenece la firma cuando se incluye en un PDF combinado (pagaré vs carta).
// =====================================================
function generarSeccionFirmaElectronica(firma: any, prestamo: any, esCodeudor: boolean = false, documentoContexto?: string): string {
  if (!firma || firma.estadoFirma !== 'COMPLETADA') {
    return ''
  }

  // Si es codeudor pero el préstamo no tiene codeudor, no mostrar
  if (esCodeudor && !prestamo.tieneCodeudor) {
    return ''
  }

  const fechaFirma = firma.fechaFirmaCompleta || firma.createdAt
  const fechaFirmaStr = new Date(fechaFirma).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
  const canalOTP = firma.otpCanal === 'WHATSAPP' ? 'WhatsApp' :
                   firma.otpCanal === 'EMAIL' ? 'Correo Electrónico' :
                   firma.otpCanal === 'AMBOS' ? 'WhatsApp y Correo Electrónico' : 'No especificado'

  const telefonoCliente = prestamo.cliente.telefono || 'No registrado'
  const emailCliente = prestamo.cliente.email || 'No registrado'
  let destinoOTP = ''
  if (firma.otpCanal === 'WHATSAPP') {
    destinoOTP = `WhatsApp al ${telefonoCliente}`
  } else if (firma.otpCanal === 'EMAIL') {
    destinoOTP = `Correo a ${emailCliente}`
  } else if (firma.otpCanal === 'AMBOS') {
    destinoOTP = `WhatsApp ${telefonoCliente} y correo ${emailCliente}`
  } else {
    destinoOTP = 'No especificado'
  }

  const fotoSelfieHtml = firma.fotoSelfie
    ? `<img src="${firma.fotoSelfie}" alt="Selfie con cédula" style="max-width:180px; max-height:240px; border:2px solid #1e3a5f; border-radius:8px;" />`
    : '<p style="color:#999; font-size:11px; font-style:italic;">No disponible</p>'

  // v5.0: incluir foto de la cédula como respaldo adicional de identidad
  const fotoDocumentoHtml = firma.fotoDocumento
    ? `<img src="${firma.fotoDocumento}" alt="Foto del documento de identidad" style="max-width:180px; max-height:240px; border:2px solid #1e3a5f; border-radius:8px;" />`
    : '<p style="color:#999; font-size:11px; font-style:italic;">No disponible</p>'

  const firmaDibujadaHtml = firma.imagenFirma
    ? `<img src="${firma.imagenFirma}" alt="Firma electrónica" style="max-width:200px; max-height:100px; border:1px solid #ccc; background:white; border-radius:4px;" />`
    : '<p style="color:#999; font-size:11px; font-style:italic;">No disponible</p>'

  const hashDocumentoCorto = firma.fotoDocumentoHash?.substring(0, 16) || 'N/A'
  const hashSelfieCorto = firma.fotoSelfieHash?.substring(0, 16) || 'N/A'
  const hashFirmaCorto = firma.imagenFirma
    ? crypto.createHash('sha256').update(firma.imagenFirma).digest('hex').substring(0, 16)
    : 'N/A'

  const contextoStr = documentoContexto ? ` · ${documentoContexto}` : ''
  return `
  <div style="margin-top:40px; padding:20px; border:2px solid #1e3a5f; border-radius:8px; background:#f8faff;">
    <h3 style="color:#1e3a5f; text-align:center; margin:0 0 15px 0; font-size:16px; letter-spacing:1px;">
      ✍️ FIRMA ELECTRÓNICA VERIFICADA ${esCodeudor ? '- CODEUDOR' : '- DEUDOR'}${contextoStr}
    </h3>
    <div style="background:#e8f5e9; border:1px solid #4caf50; padding:10px; border-radius:4px; margin-bottom:15px; font-size:11px;">
      <strong>Método de aceptación:</strong> El ${esCodeudor ? 'codeudor' : 'deudor'} aceptó este documento mediante firma electrónica
      con verificación de doble factor (OTP + biometría visual), conforme a la Ley 527 de 1999 y el
      Decreto 1074 de 2015 sobre firma electrónica en Colombia.
    </div>
    <div style="display:flex; gap:15px; justify-content:center; flex-wrap:wrap; margin:15px 0;">
      <div style="text-align:center;">
        <div style="font-size:11px; font-weight:bold; color:#1e3a5f; margin-bottom:8px;">🪪 FOTO CÉDULA</div>
        ${fotoDocumentoHtml}
        <div style="font-family:monospace; font-size:8px; color:#666; margin-top:4px;">SHA-256: ${hashDocumentoCorto}...</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px; font-weight:bold; color:#1e3a5f; margin-bottom:8px;">📸 SELFIE CON CÉDULA</div>
        ${fotoSelfieHtml}
        <div style="font-family:monospace; font-size:8px; color:#666; margin-top:4px;">SHA-256: ${hashSelfieCorto}...</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px; font-weight:bold; color:#1e3a5f; margin-bottom:8px;">✍️ FIRMA DEL DEUDOR</div>
        ${firmaDibujadaHtml}
        <div style="font-family:monospace; font-size:8px; color:#666; margin-top:4px;">SHA-256: ${hashFirmaCorto}...</div>
      </div>
    </div>
    <table style="width:100%; font-size:10px; border-collapse:collapse; margin-top:10px;">
      <tr>
        <td style="padding:4px; border:1px solid #ccc; background:#f0f4ff; font-weight:bold;">Fecha de firma:</td>
        <td style="padding:4px; border:1px solid #ccc;">${fechaFirmaStr}</td>
        <td style="padding:4px; border:1px solid #ccc; background:#f0f4ff; font-weight:bold;">Canal OTP:</td>
        <td style="padding:4px; border:1px solid #ccc;">${canalOTP}</td>
      </tr>
      <tr>
        <td style="padding:4px; border:1px solid #ccc; background:#f0f4ff; font-weight:bold;">Destino OTP:</td>
        <td style="padding:4px; border:1px solid #ccc;" colspan="3"><strong>${destinoOTP}</strong></td>
      </tr>
      <tr>
        <td style="padding:4px; border:1px solid #ccc; background:#f0f4ff; font-weight:bold;">IP:</td>
        <td style="padding:4px; border:1px solid #ccc; font-family:monospace;">${firma.ipFirma || 'N/A'}</td>
        <td style="padding:4px; border:1px solid #ccc; background:#f0f4ff; font-weight:bold;">ID Firma:</td>
        <td style="padding:4px; border:1px solid #ccc; font-family:monospace; font-size:9px;">${firma.id}</td>
      </tr>
    </table>
    <div style="text-align:center; margin-top:12px;">
      <!-- FIX 2026-08-12: el <a href> no envía el header Authorization,
           por lo que el endpoint /api/firma/certificado (protegido por JWT)
           devolvía 401 al hacer clic. Lo reemplazamos por un <button> con
           un script inline que usa fetch autenticado (con el token JWT del
           localStorage de la app, al que la pestaña tiene acceso porque
           el documento se abrió como blob URL del mismo origin) y abre el
           HTML resultante en una nueva pestaña. -->
      <button type="button" onclick="abrirCertificadoFirma('${firma.id}')"
         style="display:inline-block; padding:8px 20px; background:#1e3a5f; color:white; text-decoration:none; border-radius:4px; font-size:11px; cursor:pointer; border:none;">
        📋 Ver Certificado de Firma Electrónica Completo
      </button>
    </div>
  </div>
  ${generarScriptAbrirCertificadoFirma()}`
}

// Script inline (se inyecta una sola vez por documento gracias al guard
// `window.__certificadoFirmaScriptLoaded`) que define la función global
// `abrirCertificadoFirma(firmaId)` usada por los botones del documento
// imprimible para abrir el certificado de firma con auth JWT.
function generarScriptAbrirCertificadoFirma(): string {
  return `
<script>
(function(){
  if (window.__certificadoFirmaScriptLoaded) return;
  window.__certificadoFirmaScriptLoaded = true;
  window.abrirCertificadoFirma = async function(firmaId) {
    if (!firmaId) { alert('ID de firma no especificado'); return; }
    try {
      var token = null;
      try { token = localStorage.getItem('access_token'); } catch(e) {}
      var headers = {};
      if (token && token.indexOf('portal_cliente_') !== 0) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      var res = await fetch('/api/firma/certificado?firmaId=' + encodeURIComponent(firmaId), {
        method: 'GET',
        credentials: 'same-origin',
        headers: headers
      });
      if (res.status === 401) {
        alert('Tu sesión ha expirado. Cierra sesión e ingresa nuevamente para ver el certificado.');
        return;
      }
      if (!res.ok) {
        var msg = 'HTTP ' + res.status;
        try { var j = await res.json(); msg = j.error || msg; } catch(e) {}
        alert('No se pudo abrir el certificado.\\n\\n' + msg);
        return;
      }
      var blob = await res.blob();
      var blobUrl = URL.createObjectURL(blob);
      var win = window.open(blobUrl, '_blank');
      if (!win) {
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'Certificado_Firma_Electronica_' + firmaId.substring(0,8) + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 5 * 60 * 1000);
    } catch (err) {
      alert('Error al abrir el certificado: ' + (err && err.message ? err.message : err));
    }
  };
})();
</script>`
}
