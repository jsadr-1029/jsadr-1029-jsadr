/**
 * =====================================================
 * Utilidades para Otro Sí — Acuerdo de cambio de fechas
 * =====================================================
 *
 * Genera el documento HTML imprimible de "Otro Sí Por acuerdo
 * de cambio de fechas durante la vigencia" que se anexa al
 * pagaré y a la carta de instrucciones originales.
 *
 * REGLAS:
 *   - NO modifica el pagaré ni la carta originales.
 *   - Se visualiza aparte (al lado del pagare y la carta).
 *   - Se puede exportar (imprimir / guardar como PDF) solo.
 *   - Requiere firma electrónica con OTP al correo del cliente.
 *
 * Casos de uso:
 *   1. CAMBIO_FECHA: el cliente solicita cambiar la fecha de
 *      pago de una o varias cuotas futuras.
 *   2. TRASLADO_CUOTA: el cliente solicita trasladar una cuota
 *      al final del crédito (se reprograma al final).
 */

export type TipoModificacionOtroSi = 'CAMBIO_FECHA' | 'TRASLADO_CUOTA'

export interface CuotaModificada {
  cuota: number
  fechaAnterior: string  // ISO o "YYYY-MM-DD"
  fechaNueva: string     // ISO o "YYYY-MM-DD"
}

export interface DatosOtroSi {
  // Identificación del Otro Sí
  codigo: string  // OS-001, OS-002, etc.
  tipoModificacion: TipoModificacionOtroSi

  // Datos del préstamo (para contexto del documento)
  prestamoCodigo: string
  clienteNombre: string
  clienteCedula: string
  clienteTelefono?: string
  clienteEmail?: string
  montoPrincipal: number
  montoCuota: number
  numeroCuotas: number
  frecuencia: string

  // Datos del cliente (para ubicación en el documento)
  departamento?: string
  municipio?: string
  ciudad?: string
  barrio?: string
  direccion?: string

  // Modificaciones (el arreglo de cambios de fecha)
  modificaciones: CuotaModificada[]

  // Descripción libre del acuerdo
  descripcion: string

  // Fecha en la que se genera el Otro Sí
  fechaGeneracion: Date
}

/**
 * Formatea una fecha en formato colombiano: "5 de agosto de 2026".
 */
function formatearFechaLarga(fecha: Date | string): string {
  let f: Date
  if (typeof fecha === 'string') {
    const [yyyy, mm, dd] = fecha.split('-').map(Number)
    if (!yyyy || !mm || !dd) return fecha
    f = new Date(yyyy, mm - 1, dd, 12, 0, 0)
  } else {
    f = fecha
  }
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${f.getDate()} de ${meses[f.getMonth()]} de ${f.getFullYear()}`
}

/**
 * Formatea una fecha corta: "05/08/2026".
 */
function formatearFechaCorta(fecha: Date | string): string {
  let f: Date
  if (typeof fecha === 'string') {
    const [yyyy, mm, dd] = fecha.split('-').map(Number)
    if (!yyyy || !mm || !dd) return fecha
    f = new Date(yyyy, mm - 1, dd, 12, 0, 0)
  } else {
    f = fecha
  }
  const dd = String(f.getDate()).padStart(2, '0')
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${f.getFullYear()}`
}

/**
 * Formatea un valor COP: $10.000.
 */
function formatearCOP(valor: number): string {
  return '$' + (valor || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

/**
 * Genera el HTML imprimible del Otro Sí.
 *
 * Este HTML es autocontenido (CSS inline) y está diseñado para:
 *   - Visualizarse dentro de un iframe / modal
 *   - Imprimirse / exportarse como PDF
 *   - No depende de estilos externos
 */
export function generarHtmlOtroSi(datos: DatosOtroSi): string {
  const {
    codigo,
    tipoModificacion,
    prestamoCodigo,
    clienteNombre,
    clienteCedula,
    clienteTelefono,
    clienteEmail,
    montoPrincipal,
    montoCuota,
    numeroCuotas,
    frecuencia,
    departamento,
    municipio,
    ciudad,
    barrio,
    direccion,
    modificaciones,
    descripcion,
    fechaGeneracion,
  } = datos

  const tituloDocumento =
    tipoModificacion === 'TRASLADO_CUOTA'
      ? 'OTRO SÍ — ACUERDO DE TRASLADO DE CUOTA AL FINAL DEL CRÉDITO'
      : 'OTRO SÍ — ACUERDO DE CAMBIO DE FECHAS DURANTE LA VIGENCIA'

  const subtituloDocumento =
    tipoModificacion === 'TRASLADO_CUOTA'
      ? 'Traslado de una cuota al final del crédito, en uso del beneficio de Flexibilidad Financiera.'
      : 'Reprogramación de fechas de pago, en uso del beneficio de Flexibilidad Financiera.'

  // === Construir la tabla de fechas anteriores → nuevas ===
  const filasTabla = modificaciones
    .map(
      (m) => `
      <tr>
        <td style="text-align:center; font-weight:600;">#${m.cuota}</td>
        <td style="text-align:center;">${formatearFechaCorta(m.fechaAnterior)}</td>
        <td style="text-align:center; color:#1e40af; font-weight:600;">${formatearFechaCorta(m.fechaNueva)}</td>
      </tr>`
    )
    .join('')

  // === Ubicación completa del cliente ===
  const ubicacionParts: string[] = []
  if (direccion) ubicacionParts.push(direccion)
  if (barrio) ubicacionParts.push(`Barrio ${barrio}`)
  if (ciudad) ubicacionParts.push(ciudad)
  if (municipio && municipio !== ciudad) ubicacionParts.push(municipio)
  if (departamento) ubicacionParts.push(departamento)
  const ubicacionStr = ubicacionParts.join(', ') || 'No especificada'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${codigo} — Otro Sí ${prestamoCodigo}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 30px;
      color: #1a1a1a;
      line-height: 1.55;
      background: #fff;
    }
    .documento-header {
      text-align: center;
      border-bottom: 3px double #1e40af;
      padding-bottom: 18px;
      margin-bottom: 28px;
    }
    .documento-header h1 {
      font-size: 18px;
      letter-spacing: 1.5px;
      margin: 0 0 6px 0;
      color: #1e40af;
      text-transform: uppercase;
    }
    .documento-header .sub {
      font-size: 13px;
      color: #555;
      font-style: italic;
      margin: 0;
    }
    .codigo-badge {
      display: inline-block;
      background: #1e40af;
      color: white;
      padding: 4px 14px;
      font-size: 12px;
      letter-spacing: 1px;
      margin-top: 10px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
    }
    .seccion {
      margin-bottom: 22px;
    }
    .seccion-titulo {
      background: #f1f5f9;
      border-left: 4px solid #1e40af;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e40af;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      font-size: 13px;
    }
    .info-grid .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-grid .value { font-weight: 600; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 8px;
    }
    th {
      background: #1e40af;
      color: white;
      padding: 10px 8px;
      text-align: center;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .descripcion-caja {
      background: #fef9c3;
      border: 1px solid #facc15;
      border-left: 4px solid #ca8a04;
      padding: 12px 14px;
      font-size: 13px;
      margin: 14px 0;
      border-radius: 4px;
    }
    .clausula {
      margin: 14px 0;
      font-size: 13px;
      text-align: justify;
    }
    .clausula-numero {
      font-weight: bold;
      color: #1e40af;
    }
    .firma-area {
      margin-top: 36px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      page-break-inside: avoid;
    }
    .firma-cuadro {
      text-align: center;
    }
    .firma-linea {
      border-top: 1.5px solid #1a1a1a;
      margin-top: 60px;
      padding-top: 6px;
      font-size: 12px;
      color: #555;
    }
    .firma-nombre {
      font-weight: 600;
      font-size: 13px;
      color: #1a1a1a;
      margin-bottom: 2px;
    }
    .firma-cc {
      font-size: 11px;
      color: #666;
    }
    .footer-doc {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #999;
      text-align: center;
    }
    .alerta-importante {
      background: #fef2f2;
      border: 1px solid #ef4444;
      border-left: 4px solid #b91c1c;
      padding: 10px 12px;
      font-size: 12px;
      margin: 14px 0;
      color: #7f1d1d;
      border-radius: 4px;
    }
    .alerta-importante strong { color: #b91c1c; }
    @media print {
      body { padding: 20px; }
      .documento-header { page-break-after: avoid; }
      .firma-area { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="documento-header">
    <h1>${tituloDocumento}</h1>
    <p class="sub">${subtituloDocumento}</p>
    <span class="codigo-badge">${codigo}</span>
  </div>

  <div class="seccion">
    <div class="seccion-titulo">Identificación del crédito</div>
    <div class="info-grid">
      <div>
        <div class="label">Código del préstamo</div>
        <div class="value">${prestamoCodigo}</div>
      </div>
      <div>
        <div class="label">Fecha del Otro Sí</div>
        <div class="value">${formatearFechaLarga(fechaGeneracion)}</div>
      </div>
      <div>
        <div class="label">Capital del préstamo</div>
        <div class="value">${formatearCOP(montoPrincipal)}</div>
      </div>
      <div>
        <div class="label">Cuota fija</div>
        <div class="value">${formatearCOP(montoCuota)}</div>
      </div>
      <div>
        <div class="label">N° de cuotas totales</div>
        <div class="value">${numeroCuotas}</div>
      </div>
      <div>
        <div class="label">Frecuencia</div>
        <div class="value">${frecuencia}</div>
      </div>
    </div>
  </div>

  <div class="seccion">
    <div class="seccion-titulo">El deudor</div>
    <div class="info-grid">
      <div>
        <div class="label">Nombre completo</div>
        <div class="value">${clienteNombre}</div>
      </div>
      <div>
        <div class="label">Cédula de ciudadanía</div>
        <div class="value">${clienteCedula}</div>
      </div>
      ${clienteTelefono ? `
      <div>
        <div class="label">Teléfono</div>
        <div class="value">${clienteTelefono}</div>
      </div>` : ''}
      ${clienteEmail ? `
      <div>
        <div class="label">Correo electrónico</div>
        <div class="value">${clienteEmail}</div>
      </div>` : ''}
      <div style="grid-column: 1 / -1;">
        <div class="label">Dirección</div>
        <div class="value">${ubicacionStr}</div>
      </div>
    </div>
  </div>

  <div class="seccion">
    <div class="seccion-titulo">Modificaciones pactadas</div>
    <p style="font-size:13px; margin: 0 0 6px 0;">
      El deudor manifiesta su voluntad de modificar las siguientes fechas de vencimiento
      de las cuotas del crédito de referencia, en ejercicio del beneficio de
      <strong>Flexibilidad Financiera</strong> adquirido al momento de la solicitud:
    </p>
    <table>
      <thead>
        <tr>
          <th>Cuota</th>
          <th>Fecha inicial (anterior)</th>
          <th>Fecha nueva (reprogramada)</th>
        </tr>
      </thead>
      <tbody>
        ${filasTabla}
      </tbody>
    </table>

    <div class="descripcion-caja">
      <strong>Descripción del acuerdo:</strong><br/>
      ${descripcion}
    </div>

    <div class="alerta-importante">
      <strong>Importante:</strong> Este Otro Sí <strong>NO modifica</strong> el pagaré
      ni la carta de instrucciones originales del crédito. Dichos documentos conservan
      su contenido y vigencia original. Este documento se anexa como complemento y
      prevalece, únicamente para los efectos aquí descritos, sobre las fechas indicadas.
    </div>
  </div>

  <div class="seccion">
    <div class="seccion-titulo">Cláusulas del acuerdo</div>

    <p class="clausula">
      <span class="clausula-numero">PRIMERA.</span>
      El DEUDOR declara que conoce y acepta que la presente modificación de fechas
      de pago se realiza en uso del beneficio de <strong>Flexibilidad Financiera</strong>,
      el cual fue adquirido al momento de la solicitud del crédito
      <strong>${prestamoCodigo}</strong>, previo pago del costo adicional establecido.
    </p>

    <p class="clausula">
      <span class="clausula-numero">SEGUNDA.</span>
      Las fechas de vencimiento de las cuotas indicadas en la tabla anterior
      quedan reprogramadas conforme a la columna <em>"Fecha nueva"</em>. Las dem&aacute;s
      cuotas del crédito mantienen su fecha de vencimiento original conforme a la
      tabla de amortización inicial.
    </p>

    <p class="clausula">
      <span class="clausula-numero">TERCERA.</span>
      ${tipoModificacion === 'TRASLADO_CUOTA'
        ? `En caso de traslado de cuota, la cuota trasladada se reprograma hacia el final del crédito, inmediatamente despu&eacute;s de la &uacute;ltima cuota original. El n&uacute;mero total de cuotas del cr&eacute;dito se mantiene igual, pero el cronograma se reorganiza seg&uacute;n lo aqu&iacute; pactado.`
        : `El cambio de fecha de pago no altera el monto de la cuota, ni la tasa de inter&eacute;s, ni el plazo total del cr&eacute;dito. &Uacute;nicamente se modifican las fechas de vencimiento de las cuotas aqu&iacute; indicadas.`
      }
    </p>

    <p class="clausula">
      <span class="clausula-numero">CUARTA.</span>
      El deudor acepta que el presente Otro S&iacute; se firma electr&oacute;nicamente
      con verificaci&oacute;n de identidad mediante c&oacute;digo OTP enviado a su
      correo electr&oacute;nico registrado, en cumplimiento de las disposiciones
      legales sobre firmas electr&oacute;nicas.
    </p>

    <p class="clausula">
      <span class="clausula-numero">QUINTA.</span>
      El presente Otro S&iacute; forma parte integral del cr&eacute;dito
      <strong>${prestamoCodigo}</strong> y se anexa al pagar&eacute; y a la carta
      de instrucciones originales, sin modificarlos. Para todos los efectos legales,
      las fechas aqu&iacute; reprogramadas prevalecen sobre las fechas originales
      &uacute;nicamente para las cuotas indicadas.
    </p>
  </div>

  <div class="firma-area">
    <div class="firma-cuadro">
      <div class="firma-nombre">${clienteNombre}</div>
      <div class="firma-cc">C.C. ${clienteCedula}</div>
      <div class="firma-linea">Firma del Deudor</div>
    </div>
    <div class="firma-cuadro">
      <div class="firma-nombre">EL ACREEDOR</div>
      <div class="firma-cc">Representante legal</div>
      <div class="firma-linea">Firma del Acreedor</div>
    </div>
  </div>

  <div class="footer-doc">
    Documento generado el ${formatearFechaLarga(fechaGeneracion)} ·
    Código: ${codigo} ·
    Préstamo: ${prestamoCodigo}
  </div>

</body>
</html>`
}

/**
 * Genera el código consecutivo del Otro Sí: OS-001, OS-002, etc.
 * Basado en la cantidad de Otros Síes ya existentes para el préstamo.
 */
export function generarCodigoOtroSi(conteoPrevio: number): string {
  const n = (conteoPrevio + 1).toString().padStart(3, '0')
  return `OS-${n}`
}

/**
 * Construye la descripción textual automática del Otro Sí, en caso
 * de que el usuario no haya ingresado una manualmente.
 */
export function generarDescripcionAutomatica(
  tipo: TipoModificacionOtroSi,
  modificaciones: CuotaModificada[]
): string {
  if (modificaciones.length === 0) return 'Sin modificaciones especificadas.'

  if (tipo === 'TRASLADO_CUOTA') {
    const m = modificaciones[0]
    return `El deudor solicita trasladar la cuota N° ${m.cuota} (con vencimiento original el ${formatearFechaCorta(m.fechaAnterior)}) al final del crédito, reprogramándola para el ${formatearFechaCorta(m.fechaNueva)}, en uso del beneficio de Flexibilidad Financiera.`
  }

  // CAMBIO_FECHA — general (puede ser una o varias cuotas)
  if (modificaciones.length === 1) {
    const m = modificaciones[0]
    return `El deudor solicita cambiar la fecha de pago de la cuota N° ${m.cuota}, del ${formatearFechaCorta(m.fechaAnterior)} al ${formatearFechaCorta(m.fechaNueva)}, en uso del beneficio de Flexibilidad Financiera.`
  }

  const lista = modificaciones
    .map((m) => `cuota N° ${m.cuota}: de ${formatearFechaCorta(m.fechaAnterior)} a ${formatearFechaCorta(m.fechaNueva)}`)
    .join('; ')
  return `El deudor solicita cambiar las fechas de pago de las siguientes cuotas, en uso del beneficio de Flexibilidad Financiera: ${lista}.`
}
