// =====================================================
// /api/vehiculos/contrato-legal/descargar?token=XXX
// Genera el PDF completo del contrato legal CAV-001 v2.0
// con todas las cláusulas en el orden exacto de la plantilla
// y los datos del propietario Johan Sebastian Alvarez Del Rio
// Incluye sello de seguridad y código QR de autenticidad
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import PDFDocument from 'pdfkit'
import { createCanvas, loadImage } from 'canvas'
import QRCode from 'qrcode'
import crypto from 'crypto'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

function fmtCOP(v: number | null | undefined): string {
  if (!v) return '$0'
  return '$' + v.toLocaleString('es-CO')
}
function fmtFechaCorta(f: Date | string | null | undefined): string {
  if (!f) return '____ / ____ / ________'
  const d = typeof f === 'string' ? new Date(f) : f
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}
function fmtFecha(f: Date | string | null | undefined): string {
  if (!f) return '—'
  const d = typeof f === 'string' ? new Date(f) : f
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function getImage(source: string | null | undefined): Promise<Buffer | null> {
  if (!source) return null
  // base64 data URL
  if (source.startsWith('data:')) {
    try {
      const base64Data = source.split(',')[1]
      if (!base64Data) return null
      const originalBuf = Buffer.from(base64Data, 'base64')
      if (originalBuf.length <= 80000) return originalBuf
      try {
        const img = await loadImage(originalBuf)
        const maxDim = 400
        let w = img.width, h = img.height
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
        const canvas = createCanvas(w, h)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        return canvas.toBuffer('image/jpeg', { quality: 0.5 })
      } catch { return null }
    } catch { return null }
  }
  // Ruta relativa (/vehiculos/documentos/...) → leer de filesystem o descargar de producción
  if (source.startsWith('/') && !source.startsWith('//')) {
    try {
      const localPath = path.join(process.cwd(), 'public', source)
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath)
        if (buf.length > 200000) {
          try {
            const img = await loadImage(buf)
            const maxDim = 500
            let w = img.width, h = img.height
            if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
            const canvas = createCanvas(w, h)
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, w, h)
            return canvas.toBuffer('image/jpeg', { quality: 0.6 })
          } catch { return null }
        }
        return buf
      }
    } catch {}
    // Descargar desde producción
    const prodUrl = `https://jsadr.com.co${source}`
    try {
      return await new Promise<Buffer | null>((resolve) => {
        const req = https.get(prodUrl, { timeout: 8000 }, (res) => {
          if (res.statusCode !== 200) { resolve(null); return }
          const chunks: Buffer[] = []
          let totalSize = 0
          res.on('data', c => {
            totalSize += c.length
            if (totalSize > 200000) { resolve(null); req.destroy(); return }
            chunks.push(c)
          })
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', () => resolve(null))
        })
        req.on('error', () => resolve(null))
        req.on('timeout', () => { req.destroy(); resolve(null) })
      })
    } catch { return null }
  }
  // URL externa http/https
  if (source.startsWith('http')) {
    return new Promise((resolve) => {
      try {
        const lib = source.startsWith('https') ? https : http
        const req = lib.get(source, { timeout: 8000 }, (res) => {
          if (res.statusCode !== 200) { resolve(null); return }
          const chunks: Buffer[] = []
          let totalSize = 0
          res.on('data', c => {
            totalSize += c.length
            if (totalSize > 200000) { resolve(null); req.destroy(); return }
            chunks.push(c)
          })
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', () => resolve(null))
        })
        req.on('error', () => resolve(null))
        req.on('timeout', () => { req.destroy(); resolve(null) })
      } catch { resolve(null) }
    })
  }
  return null
}

async function addImage(doc: any, source: string | null | undefined, x: number, y: number, maxW: number, maxH: number): Promise<number> {
  if (!source) return 0
  try {
    const buf = await getImage(source)
    if (!buf || buf.length === 0) return 0
    doc.image(buf, x, y, { fit: [maxW, maxH], align: 'center' })
    return maxH + 5
  } catch { return 0 }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })

    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { OR: [{ conductorToken: token }, { propietarioToken: token }] },
      include: {
        contratoVehiculo: {
          select: {
            vehiculoId: true,
            vehiculo: {
              select: {
                id: true,
                placa: true,
                marca: true,
                modelo: true,
                anio: true,
                color: true,
                kilometraje: true,
                vin: true,
                motor: true,
                fotoUrl: true,
                documentos: {
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    })
    if (!documento) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })

    // === Cargar inventario y documentos del vehículo ===
    const vehiculoId = documento.contratoVehiculo?.vehiculoId
    const inventarioItems = vehiculoId
      ? await db.inventarioVehiculo.findMany({
          where: { vehiculoId },
          orderBy: [{ createdAt: 'asc' }],
        })
      : []
    const documentosVehiculo = documento.contratoVehiculo?.vehiculo?.documentos || []
    const fotoVehiculo = documento.contratoVehiculo?.vehiculo?.fotoUrl || null

    // === Sanity check de datos del propietario ===
    // El propietario predeterminado es Johan Sebastian Alvarez Del Rio, CC 1214731649.
    // Dirección: Cl 92 44A 34, Teléfono: 3235949510, Email: jsadr23@outlook.com
    // Estos datos son SIEMPRE los mismos para el arrendador Johan Sebastian Alvarez Del Rio.
    // Para un propietario distinto (excepción), el sistema deberá preguntar
    // si se cargan los datos predefinidos o si se usan los datos de un nuevo titular.
    // Por ahora, forzamos los valores del titular por defecto (CC 1214731649).
    const NOMBRE_PROPIETARIO_CORRECTO = 'Johan Sebastian Alvarez Del Rio'
    const CEDULA_PROPIETARIO_CORRECTA = '1214731649'
    const DIRECCION_PROPIETARIO_CORRECTA = 'Cl 92 44A 34'
    const TELEFONO_PROPIETARIO_CORRECTO = '3235949510'
    const EMAIL_PROPIETARIO_CORRECTO = 'jsadr23@outlook.com'

    let propCedulaFinal = (documento.propietarioCedula || '').trim()
    if (propCedulaFinal !== CEDULA_PROPIETARIO_CORRECTA) {
      console.warn(`[contrato-legal/descargar] Cédula propietario incorrecta en DB: "${documento.propietarioCedula}". Forzando a ${CEDULA_PROPIETARIO_CORRECTA}.`)
      propCedulaFinal = CEDULA_PROPIETARIO_CORRECTA
    }

    // Nombre: forzar el correcto SIEMPRE. La razón: aunque venga "Sebastian",
    // "Jsadr Arrendamientos SAS", o cualquier otro valor comercial, debe
    // mostrarse el nombre real de la persona natural arrendadora.
    let propNombreRaw = (documento.propietarioNombre || '').trim()
    let propNombreFinal = NOMBRE_PROPIETARIO_CORRECTO
    if (propNombreRaw !== NOMBRE_PROPIETARIO_CORRECTO) {
      console.warn(`[contrato-legal/descargar] Nombre propietario en DB: "${propNombreRaw}". Forzando a "${NOMBRE_PROPIETARIO_CORRECTO}".`)
    }

    // Dirección y teléfono: también se fuerzan a los valores correctos del titular
    let propDireccionFinal = DIRECCION_PROPIETARIO_CORRECTA
    let propTelefonoFinal = TELEFONO_PROPIETARIO_CORRECTO
    let propEmailFinal = EMAIL_PROPIETARIO_CORRECTO
    if ((documento.propietarioDireccion || '').trim() !== DIRECCION_PROPIETARIO_CORRECTA) {
      console.warn(`[contrato-legal/descargar] Dirección propietario en DB: "${documento.propietarioDireccion}". Forzando a "${DIRECCION_PROPIETARIO_CORRECTA}".`)
    }
    if ((documento.propietarioTelefono || '').trim() !== TELEFONO_PROPIETARIO_CORRECTO) {
      console.warn(`[contrato-legal/descargar] Teléfono propietario en DB: "${documento.propietarioTelefono}". Forzando a "${TELEFONO_PROPIETARIO_CORRECTO}".`)
    }
    if ((documento.propietarioEmail || '').trim() !== EMAIL_PROPIETARIO_CORRECTO) {
      console.warn(`[contrato-legal/descargar] Email propietario en DB: "${documento.propietarioEmail}". Forzando a "${EMAIL_PROPIETARIO_CORRECTO}".`)
    }

    // === Cuenta de pago obligatoria ===
    const CUENTA_PAGO_BANCO = 'Bancolombia'
    const CUENTA_PAGO_TIPO = 'Cuenta de Ahorros'
    const CUENTA_PAGO_NUMERO = '42061620839'
    const CUENTA_PAGO_TITULAR = propNombreFinal
    const CUENTA_PAGO_TITULAR_CC = propCedulaFinal

    const d = {
      numeroContrato: documento.numeroContrato,
      vehiculo: { placa: documento.vehiculoPlaca, marca: documento.vehiculoMarca, modelo: documento.vehiculoModelo, anio: documento.vehiculoAnio, color: documento.vehiculoColor, kilometraje: documento.vehiculoKilometraje, vin: documento.vehiculoVin, motor: documento.vehiculoMotor },
      propietario: { nombre: propNombreFinal, cedula: propCedulaFinal, telefono: propTelefonoFinal, email: propEmailFinal, direccion: propDireccionFinal },
      conductor: { nombre: documento.conductorNombre, cedula: documento.conductorCedula, telefono: documento.conductorTelefono, email: documento.conductorEmail, direccion: documento.conductorDireccion, licencia: documento.conductorLicencia, licenciaCat: documento.conductorLicenciaCat },
      terminos: { modalidadPago: documento.modalidadPago, tarifa: documento.tarifa, diasGracia: documento.diasGracia, multaDiaria: documento.multaDiaria, deposito: documento.deposito, fechaInicio: documento.fechaInicio, fechaFin: documento.fechaFin, descripcionVehiculo: documento.descripcionVehiculo, tarifaSemanal: documento.tarifa },
      cuentaPago: { banco: CUENTA_PAGO_BANCO, tipo: CUENTA_PAGO_TIPO, numero: CUENTA_PAGO_NUMERO, titular: CUENTA_PAGO_TITULAR, titularCedula: CUENTA_PAGO_TITULAR_CC },
      firmaConductor: { fotoCedulaFrente: documento.conductorFotoCedulaFrente, fotoCedulaReverso: documento.conductorFotoCedulaReverso, fotoSelfie: documento.conductorFotoSelfie, firmaManuscrita: documento.conductorFirmaManuscrita, otpValidado: documento.conductorOtpValidado, otpHash: documento.conductorOtpHash, fechaFirma: documento.conductorFechaFirma, ip: documento.conductorIp, userAgent: documento.conductorUserAgent },
      firmaPropietario: { fotoCedulaFrente: documento.propietarioFotoCedulaFrente, fotoCedulaReverso: documento.propietarioFotoCedulaReverso, fotoSelfie: documento.propietarioFotoSelfie, firmaManuscrita: documento.propietarioFirmaManuscrita, otpValidado: documento.propietarioOtpValidado, otpHash: documento.propietarioOtpHash, fechaFirma: documento.propietarioFechaFirma, ip: documento.propietarioIp, userAgent: documento.propietarioUserAgent },
      inventario: inventarioItems.map((it, idx) => ({
        n: idx + 1,
        nombre: it.nombre,
        descripcion: it.descripcion || '',
        cantidad: it.cantidad,
        estado: it.estado,
        notas: it.notas || '',
        fotoUrl: it.fotoUrl || null,
      })),
    }

    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 60, left: 50, right: 50 } })
    const buffers: Buffer[] = []
    doc.on('data', b => buffers.push(b))
    const ancho = doc.page.width - 100
    const PAGE_HEIGHT = doc.page.height
    const MARGIN_BOTTOM = 60 // margen inferior reservado (footer con numeración)
    const MARGIN_TOP = 50
    let y = 50

    // === Helpers de paginación ===
    // ensureSpace(needed): si no hay 'needed' px disponibles antes del margen
    // inferior, salta a una nueva página. Solo cuando es estrictamente necesario,
    // para evitar hojas en blanco por saltos prematuros.
    // IMPORTANTE: needed debe ser la altura REAL que se va a dibujar inmediatamente
    // después, no una sobreestimación. Si se sobreestima, se pueden generar páginas
    // casi vacías o con saltos prematuros.
    function ensureSpace(needed: number) {
      const available = PAGE_HEIGHT - MARGIN_BOTTOM - y
      if (available < needed) {
        doc.addPage()
        y = MARGIN_TOP
      }
    }

    // Helpers
    // Calcula la altura necesaria para una celda de texto con wrapping
    function calcularAlturaTexto(texto: string, maxWidth: number, fontSize: number, font: 'Helvetica' | 'Helvetica-Bold' = 'Helvetica', align: 'left' | 'center' | 'right' | 'justify' = 'left'): number {
      if (!texto) return 14
      doc.fontSize(fontSize).font(font)
      const h = doc.heightOfString(texto, { width: maxWidth, align })
      return Math.max(h + 6, 14) // mínimo 14px
    }

    function tablaSimple(titulos: string[], filas: (string | null)[][], colWidths: number[]) {
      // Calcular altura de la cabecera (puede tener wrapping)
      const headerH = calcularAlturaTexto(titulos.join(' '), Math.min(...colWidths) - 4, 7, 'Helvetica-Bold', 'center')
      // Primero asegurar espacio para la cabecera + primera fila
      ensureSpace(headerH + 20)
      let x = 50
      doc.fillColor('#1e3a8a')
      for (let i = 0; i < titulos.length; i++) {
        doc.rect(x, y, colWidths[i], headerH).fill('#1e3a8a')
        doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold')
        doc.text(titulos[i], x + 2, y + 4, { width: colWidths[i] - 4 })
        x += colWidths[i]
      }
      y += headerH
      for (const fila of filas) {
        x = 50
        // Calcular altura dinámica de la fila basada en el contenido más alto
        let rowH = 16 // altura mínima
        for (let i = 0; i < fila.length; i++) {
          const cellText = fila[i] || '—'
          const cellH = calcularAlturaTexto(cellText, colWidths[i] - 4, 7)
          if (cellH > rowH) rowH = cellH
        }
        ensureSpace(rowH + 4)
        for (let i = 0; i < fila.length; i++) {
          const cellText = fila[i] || '—'
          doc.rect(x, y, colWidths[i], rowH).stroke('#ccc')
          doc.fillColor('#000').fontSize(7).font('Helvetica')
          doc.text(cellText, x + 2, y + 4, { width: colWidths[i] - 4 })
          x += colWidths[i]
        }
        y += rowH
      }
      y += 10
    }

    function clausula(titulo: string, contenido: string) {
      // Calcular altura real del título y del contenido (pueden tener wrapping)
      let titleH = 0
      if (titulo) {
        doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
        titleH = doc.heightOfString(titulo, { width: ancho }) + 4
      }
      doc.fillColor('#000').fontSize(8).font('Helvetica')
      const contentH = doc.heightOfString(contenido, { width: ancho, align: 'justify' })

      // === Garantizar que el TÍTULO completo + primera línea del contenido quepan ===
      // Si solo se asegura 'min(needed, 100)', el contenido puede empezar en una página
      // y continuar en otra, pero el cálculo de y puede dejar texto superpuesto.
      // Solución: asegurar al menos titleH + 20 (1 línea) en la página actual.
      ensureSpace(titleH + 20)

      // Dibujar el título (completo en una página)
      if (titulo) {
        doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
        doc.text(titulo, 50, y, { width: ancho })
        y += titleH
      }

      // === Dibujar el contenido paginando si es necesario ===
      // Si el contenido no cabe completo en la página actual, paginarlo por bloques.
      doc.fillColor('#000').fontSize(8).font('Helvetica')
      const disponibleAntes = PAGE_HEIGHT - MARGIN_BOTTOM - y
      if (contentH <= disponibleAntes) {
        // Caso simple: cabe todo en la página actual
        doc.text(contenido, 50, y, { width: ancho, align: 'justify' })
        y += contentH + 8
      } else {
        // El contenido NO cabe completo en la página actual.
        // Dividir por párrafos (\n\n) y dibujar uno por uno paginando.
        const parrafos = contenido.split('\n\n')
        for (const parrafo of parrafos) {
          const parrafoH = doc.heightOfString(parrafo, { width: ancho, align: 'justify' })
          // Si el párrafo NO cabe en la página actual, saltar a nueva página
          if (y + parrafoH > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage()
            y = MARGIN_TOP
          }
          doc.fillColor('#000').fontSize(8).font('Helvetica')
          doc.text(parrafo, 50, y, { width: ancho, align: 'justify' })
          y += parrafoH + 4
        }
        y += 4
      }
    }

    function capitulo(titulo: string) {
      // Calcular altura real del título (puede tener wrapping si es largo)
      doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold')
      const titleH = doc.heightOfString(titulo, { width: ancho }) + 12
      ensureSpace(Math.max(titleH, 50))
      y += 8
      doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold')
      doc.text(titulo, 50, y, { width: ancho })
      y += titleH
    }

    // === ENCABEZADO ===
    doc.fillColor('#1e3a8a').fontSize(16).font('Helvetica-Bold')
    doc.text('CONTRATO DE ARRENDAMIENTO DE VEHÍCULO AUTOMOTOR', 50, y, { align: 'center', width: ancho })
    y += doc.heightOfString('CONTRATO DE ARRENDAMIENTO DE VEHÍCULO AUTOMOTOR', { width: ancho, align: 'center' }) + 4
    doc.fontSize(10).font('Helvetica'); doc.text('Uso, administración, obligaciones, garantías, control y restitución', 50, y, { align: 'center', width: ancho })
    y += doc.heightOfString('Uso, administración, obligaciones, garantías, control y restitución', { width: ancho, align: 'center' }) + 4
    doc.fillColor('#666').fontSize(9); doc.text('DOCUMENTO CONTRACTUAL PRIVADO', 50, y, { align: 'center', width: ancho })
    y += doc.heightOfString('DOCUMENTO CONTRACTUAL PRIVADO', { width: ancho, align: 'center' }) + 4
    const txtCodigo = `Código documental: CAV-001  |  Versión: 2.0  |  Lugar: Medellín  |  Fecha: ${fmtFechaCorta(new Date())}`
    doc.text(txtCodigo, 50, y, { align: 'center', width: ancho })
    y += doc.heightOfString(txtCodigo, { width: ancho, align: 'center' }) + 8

    // === TABLA IDENTIFICACIÓN ===
    tablaSimple(['IDENTIFICACIÓN DEL CONTRATO', 'INFORMACIÓN'], [
      ['Número de contrato', d.numeroContrato],
      ['Placa del vehículo', d.vehiculo.placa],
      ['Arrendador', d.propietario.nombre],
      ['Arrendatario', d.conductor.nombre],
      ['Fecha de inicio', '24 / 10 / 2026'],
      ['Fecha de terminación pactada', '23 / 01 / 2027'],
      ['Valor del canon', fmtCOP(d.terminos.tarifa)],
      ['Periodicidad de pago', d.terminos.modalidadPago],
    ], [200, ancho - 200])

    clausula('', `Entre las personas identificadas en este documento se celebra el presente contrato de arrendamiento de vehículo automotor, que se regirá por sus cláusulas, las disposiciones civiles y comerciales colombianas que resulten aplicables, las normas de tránsito pertinentes y las demás disposiciones legales vigentes que correspondan a la operación concreta.\n\nLas partes manifiestan que han tenido oportunidad de conocer las condiciones del contrato y que los espacios que deban determinar obligaciones económicas o condiciones esenciales serán diligenciados antes de su firma.`)

    // ============ CAPÍTULO I ============
    capitulo('CAPÍTULO I. IDENTIFICACIÓN Y CAPACIDAD DE LAS PARTES')

    clausula('CLÁUSULA 1. IDENTIFICACIÓN DEL ARRENDADOR', `EL ARRENDADOR es la persona que entrega el vehículo en arrendamiento y adquiere los derechos y obligaciones que le corresponden conforme a este contrato.`)
    tablaSimple(['CAMPO', 'INFORMACIÓN'], [
      ['Primer apellido', 'Alvarez'],
      ['Segundo apellido', 'Del Rio'],
      ['Primer nombre', 'Johan'],
      ['Segundo nombre', 'Sebastian'],
      ['Tipo de documento', 'Cédula de ciudadanía'],
      ['Número de identificación', d.propietario.cedula],
      ['Dirección de residencia', d.propietario.direccion],
      ['Teléfono celular', d.propietario.telefono],
      ['Correo electrónico', d.propietario.email],
      ['Calidad en la que actúa', 'Propietario inscrito del vehículo'],
    ], [200, ancho - 200])
    clausula('', `EL ARRENDADOR declara que cuenta con las facultades necesarias para celebrar el presente contrato y que no conoce impedimentos jurídicos que hagan ilícita o imposible la entrega del vehículo bajo las condiciones aquí pactadas.`)

    clausula('CLÁUSULA 2. IDENTIFICACIÓN DEL ARRENDATARIO', `EL ARRENDATARIO es la persona que recibe temporalmente el vehículo y asume las obligaciones que le correspondan conforme al contrato.`)
    tablaSimple(['CAMPO', 'INFORMACIÓN'], [
      ['Nombre completo', d.conductor.nombre],
      ['Tipo de documento', 'Cédula de ciudadanía'],
      ['Número de identificación', d.conductor.cedula],
      ['Dirección de residencia', d.conductor.direccion || '—'],
      ['Teléfono celular principal', d.conductor.telefono],
      ['Correo electrónico', d.conductor.email || '—'],
      ['Número de licencia', d.conductor.licencia || '—'],
      ['Categoría', d.conductor.licenciaCat || '—'],
    ], [200, ancho - 200])

    clausula('CLÁUSULA 3. DECLARACIONES PREVIAS', `Las partes declaran que:\n1. Los datos suministrados para celebrar el contrato son veraces.\n2. Comprenden la naturaleza temporal del arrendamiento.\n3. El contrato no transfiere la propiedad del vehículo.\n4. Las obligaciones económicas deben quedar determinadas o ser objetivamente determinables.\n5. Las obligaciones contractuales no pueden desconocer normas imperativas ni derechos de terceros.\n6. Los documentos que se incorporen como anexos deberán corresponder a la operación real.\n7. Las modificaciones de las condiciones esenciales deberán documentarse de manera verificable.`)

    // ============ CAPÍTULO II ============
    capitulo('CAPÍTULO II. OBJETO, IDENTIFICACIÓN Y DESTINACIÓN DEL VEHÍCULO')

    clausula('CLÁUSULA 4. IDENTIFICACIÓN DEL VEHÍCULO', `El vehículo objeto del contrato se identifica de la siguiente manera:`)
    tablaSimple(['CARACTERÍSTICA', 'INFORMACIÓN'], [
      ['Marca', d.vehiculo.marca],
      ['Línea', d.vehiculo.modelo],
      ['Modelo / año', String(d.vehiculo.anio || '—')],
      ['Placa', d.vehiculo.placa],
      ['Color', d.vehiculo.color || '—'],
      ['Número de motor', d.vehiculo.motor || '—'],
      ['Número de chasis o VIN', d.vehiculo.vin || '—'],
      ['Kilometraje inicial', `${(d.vehiculo.kilometraje || 0).toLocaleString('es-CO')} km`],
    ], [200, ancho - 200])

    clausula('CLÁUSULA 5. OBJETO', `EL ARRENDADOR concede a EL ARRENDATARIO el uso temporal del vehículo individualizado en la cláusula anterior, a cambio del canon acordado y bajo las condiciones establecidas en este documento.\n\nEL ARRENDATARIO recibe el derecho de uso dentro de los límites pactados, sin adquirir la propiedad del vehículo ni facultad para venderlo, gravarlo, subarrendarlo, cederlo o disponer de él como dueño.\n\nLa entrega del vehículo se acreditará mediante el acta de entrega correspondiente.`)

    clausula('CLÁUSULA 6. DESTINACIÓN AUTORIZADA', `EL ARRENDATARIO se obliga a destinar el vehículo exclusivamente para uso personal y particular, conforme a su naturaleza y a las disposiciones legales vigentes.\n\nEn consecuencia, queda prohibido utilizarlo para actividades comerciales, transporte remunerado de pasajeros o mercancías, o cualquier otra finalidad diferente de la aquí autorizada, salvo autorización previa, expresa y escrita de EL ARRENDADOR, siempre que el uso autorizado sea legalmente procedente.\n\nQueda expresamente prohibido emplear el vehículo para cualquier uso ilegal, transporte de contrabando, sustancias ilícitas, mercancías no declaradas, o cualquier actividad que afecte o pueda generar conflicto conforme al marco legal colombiano. EL ARRENDATARIO asume única y exclusivamente la responsabilidad por el incumplimiento de esta prohibición, incluyendo las consecuencias civiles, administrativas y penales que se deriven.\n\nEl incumplimiento de esta obligación constituirá incumplimiento contractual grave, facultará a EL ARRENDADOR para ejercer los mecanismos contractuales y legales que correspondan, y podrá generar la terminación inmediata del presente contrato y la restitución inmediata del vehículo, sin perjuicio de las demás acciones legales aplicables.`)

    clausula('CLÁUSULA 7. PLAZO, ENTREGA MATERIAL, RENOVACIÓN Y ABANDONO', `El plazo del presente contrato, las condiciones de entrega, renovación y abandono se regulan de la siguiente manera:`)
    tablaSimple(['CONDICIÓN', 'INFORMACIÓN'], [
      ['Fecha de inicio', '24 / 10 / 2026'],
      ['Fecha de terminación pactada', '23 / 01 / 2027'],
      ['Duración del plazo inicial', 'Tres (3) meses'],
      ['Lugar de entrega', 'Medellín, Colombia'],
      ['Modalidad de renovación', 'Automática por el mismo plazo si no hay notificación'],
      ['Periodo de transición a Otro Sí', 'Al cumplirse un (1) año desde el inicio'],
      ['Plazo del Otro Sí anual', 'Un (1) año'],
    ], [200, ancho - 200])

    clausula('', `7.1. RENOVACIÓN AUTOMÁTICA. Si ninguna de las partes notifica a la otra su voluntad de dar por terminado el contrato al vencimiento del plazo inicial (23/01/2027) o de cualquiera de sus renovaciones, el contrato se entenderá renovado automáticamente por el mismo plazo inicialmente pactado, conforme al artículo 1622 del Código Civil colombiano (tácita reconducción).

7.2. OTRO SÍ ANUAL. Al cumplirse un (1) año contado desde la fecha de inicio del contrato (24/10/2026), las partes suscribirán un OTRO SÍ que modificará únicamente el plazo, pasando de un plazo inicial de tres (3) meses a un plazo anual de un (1) año. Las demás condiciones del contrato (canon, modalidad de pago, obligaciones, etc.) se mantendrán sin variación salvo acuerdo expreso entre las partes.

7.3. PREAVISO DE TERMINACIÓN. Conforme al artículo 1622 del Código Civil colombiano y la jurisprudencia de la Corte Suprema de Justicia, cualquiera de las partes que desee dar por terminado el contrato al vencimiento del plazo inicial o de cualquiera de sus renovaciones deberá notificar a la otra parte con una antelación mínima de treinta (30) días calendario a la fecha de vencimiento. La notificación deberá hacerse por escrito (correo electrónico, mensaje de texto o carta) a los datos de contacto registrados en la cláusula 1 y cláusula 2 del presente contrato. La recepción del preaviso deberá ser confirmada por la otra parte.

7.4. ABANDONO DEL CONTRATO POR PARTE DEL ARRENDATARIO. Si EL ARRENDATARIO decide abandonar el contrato antes del vencimiento del plazo pactado, sin mediar causa imputable a EL ARRENDADOR, deberá pagar una multa correspondiente a UNA (1) SEMANA DE LIQUIDACIÓN del canon de arrendamiento vigente al momento del abandono. Esta multa no excluye las obligaciones económicas que EL ARRENDATARIO tenga pendientes (cánones vencidos, daños al vehículo, etc.) y deberá pagarse antes de la devolución del vehículo.

7.5. CASOS DE TERMINACIÓN ANTICIPADA SIN MULTA. El preaviso de 30 días y la multa por abandono no aplicarán cuando la terminación se origine en: (i) incumplimiento grave de EL ARRENDADOR debidamente acreditado, (ii) pérdida total del vehículo por caso fortuito o fuerza mayor, (iii) muerte o incapacidad permanente de EL ARRENDATARIO, o (iv) acuerdo mutuo por escrito.

7.6. ENTREGA MATERIAL. La entrega material del vehículo se realizará en Medellín, Colombia, el día 24/10/2026, fecha a partir de la cual se entenderá iniciado el plazo del contrato. La entrega se acreditará mediante el Acta de Entrega e Inventario (Anexo 1) firmada por ambas partes.`)

    clausula('CLÁUSULA 8. ESTADO DEL VEHÍCULO', `El estado del vehículo al momento de la entrega se documentará en el Anexo 1. Acta de entrega e inventario. El anexo incluirá: kilometraje, nivel de combustible, estado exterior e interior, accesorios, llaves, documentos, daños preexistentes y fotografías.`)

    // ============ CAPÍTULO III ============
    capitulo('CAPÍTULO III. PRECIO, PAGOS Y GARANTÍAS')

    clausula('CLÁUSULA 9. CANON DE ARRENDAMIENTO', `El canon será el que las partes determinan en el siguiente cuadro:`)
    tablaSimple(['CONCEPTO', 'CONDICIÓN PACTADA'], [
      ['Valor del canon', fmtCOP(d.terminos.tarifa)],
      ['Periodicidad', d.terminos.modalidadPago],
      ['Día de pago', 'Sábado de cada semana'],
      ['Medio de pago', 'Consignación bancaria / Transferencia'],
      ['Banco receptor', d.cuentaPago.banco],
      ['Tipo de cuenta', d.cuentaPago.tipo],
      ['Número de cuenta', d.cuentaPago.numero],
      ['Titular de la cuenta', d.cuentaPago.titular],
      ['C.C. del titular', d.cuentaPago.titularCedula],
    ], [200, ancho - 200])

    clausula('CLÁUSULA 10. CUENTA DE PAGO Y REGISTRO DE PAGOS', `Todos los pagos derivados del presente contrato, incluyendo el canon de arrendamiento, el depósito de garantía, los valores por concepto de mora y cualquier otra obligación económica a cargo de EL ARRENDATARIO, deberán realizarse EXCLUSIVAMENTE a la siguiente cuenta bancaria, titularidad de EL ARRENDADOR:`)
    tablaSimple(['DATO DE LA CUENTA', 'INFORMACIÓN'], [
      ['Banco', d.cuentaPago.banco],
      ['Tipo de cuenta', d.cuentaPago.tipo],
      ['Número de cuenta', d.cuentaPago.numero],
      ['Titular de la cuenta', d.cuentaPago.titular],
      ['Cédula de ciudadanía del titular', d.cuentaPago.titularCedula],
      ['Concepto de la transferencia', `${d.numeroContrato} - Canon arrendamiento`],
    ], [200, ancho - 200])
    clausula('', `EL ARRENDATARIO deberá conservar el comprobante de cada pago (captura, recibo o soporte de transferencia) y enviarlo al correo electrónico de EL ARRENDADOR o subirlo al sistema de gestión. No se considerará válido un pago efectuado por un medio distinto al aquí pactado (efectivo en mano, terceros, cuentas distintas) salvo autorización escrita y previa de EL ARRENDADOR.\n\nLas partes conservarán los comprobantes de pago y los registros de las obligaciones causadas. EL ARRENDADOR entregará constancia de los pagos recibidos cuando corresponda.`)

    clausula('CLÁUSULA 11. MORA', `EL ARRENDATARIO deberá pagar el canon y los demás conceptos válidamente pactados en las fechas acordadas. Cuando se produzca un retraso, EL ARRENDADOR podrá enviar un requerimiento escrito. Si se pactan intereses moratorios, se aplicarán únicamente cuando legalmente procedan y dentro de los límites legales vigentes.`)

    clausula('CLÁUSULA 12. DEPÓSITO DE GARANTÍA', `Las partes podrán acordar un depósito destinado a respaldar obligaciones contractuales válidas.`)
    tablaSimple(['CONCEPTO', 'INFORMACIÓN'], [
      ['Valor del depósito', fmtCOP(d.terminos.deposito)],
      ['Finalidad pactada', 'Respaldar obligaciones contractuales'],
      ['Plazo para devolución del saldo', '30 días después de la restitución'],
    ], [200, ancho - 200])

    // ============ CAPÍTULO IV ============
    capitulo('CAPÍTULO IV. OBLIGACIONES Y RESTRICCIONES')

    clausula('CLÁUSULA 13. OBLIGACIONES DE EL ARRENDADOR', `EL ARRENDADOR se obliga a:\n1. Entregar el vehículo en las condiciones documentadas.\n2. Informar los defectos relevantes de los que tenga conocimiento.\n3. Entregar los documentos y elementos acordados.\n4. Cumplir las obligaciones de mantenimiento que le correspondan.\n5. Facilitar la información pertinente sobre las coberturas de seguro.\n6. Recibir y registrar los pagos efectuados.\n7. Comunicar de forma verificable los requerimientos contractuales.\n8. Respetar los derechos de EL ARRENDATARIO y abstenerse de realizar actos de recuperación por vías de hecho.\n9. Gestionar de buena fe las reclamaciones relacionadas con el vehículo.\n10. Realizar la liquidación del depósito y de las obligaciones finales.`)

    clausula('CLÁUSULA 14. OBLIGACIONES DE EL ARRENDATARIO', `EL ARRENDATARIO se obliga a:\n1. Pagar oportunamente el canon y los demás conceptos que le correspondan.\n2. Utilizar el vehículo únicamente para la destinación autorizada.\n3. Mantener las habilitaciones legales necesarias para conducirlo.\n4. Permitir su conducción exclusivamente a personas autorizadas.\n5. Custodiar razonablemente el vehículo, las llaves, los documentos y los accesorios.\n6. Cumplir las normas de tránsito y estacionamiento.\n7. Asumir los gastos que expresamente le correspondan.\n8. Informar inmediatamente accidentes, daños graves, hurtos, inmovilizaciones y requerimientos de autoridad.\n9. Conservar y entregar los soportes pertinentes de incidentes.\n10. No subarrendar, ceder ni entregar el vehículo a terceros sin autorización escrita.\n11. Facilitar inspecciones razonables previamente coordinadas.\n12. Informar oportunamente fallas que puedan afectar la seguridad.\n13. Restituir el vehículo al finalizar el contrato.\n14. Colaborar de buena fe con la identificación del conductor y las gestiones legítimas relacionadas con comparendos o fotodetecciones.\n15. Responder por las obligaciones y perjuicios que legalmente le sean atribuibles.\n16. Comunicar cambios relevantes en sus datos de contacto.\n17. Abstenerse de utilizar el vehículo para fines ilícitos.`)

    clausula('CLÁUSULA 15. CONDUCTORES AUTORIZADOS', `Solo podrán conducir el vehículo las personas registradas en el Anexo 2 y autorizadas por escrito por EL ARRENDADOR, siempre que cumplan los requisitos legales y de aseguramiento aplicables.`)

    clausula('CLÁUSULA 16. PROHIBICIONES EXPRESAS', `Salvo autorización escrita y legalmente procedente, EL ARRENDATARIO no podrá:\n1. Subarrendar, ceder o transferir la tenencia del vehículo.\n2. Utilizarlo para actividades ilícitas.\n3. Conducir bajo los efectos de alcohol o sustancias que afecten la capacidad de conducción.\n4. Permitir la conducción por personas no autorizadas.\n5. Alterar las placas, los números de identificación, el odómetro o los sistemas de seguridad.\n6. Realizar modificaciones permanentes.\n7. Utilizarlo en competencias, pruebas de velocidad o actividades de riesgo no autorizadas.\n8. Ocultar el vehículo o impedir injustificadamente su restitución.\n9. Retirar o manipular indebidamente dispositivos de seguridad o localización.\n10. Realizar actos que comprometan de manera evitable la seguridad del vehículo o una cobertura de seguro.`)

    // ============ CAPÍTULO V ============
    capitulo('CAPÍTULO V. MANTENIMIENTO, GASTOS Y DAÑOS')

    clausula('CLÁUSULA 17. DISTRIBUCIÓN DE GASTOS', 'Las partes deberán diligenciar el siguiente cuadro antes de la firma:')
    tablaSimple(['CONCEPTO', 'RESPONSABLE'], [
      ['Combustible', 'Arrendatario'],
      ['Peajes', 'Arrendatario'],
      ['Parqueaderos', 'Arrendatario'],
      ['Lavado ordinario', 'Arrendatario'],
      ['Mantenimiento preventivo', 'Arrendador'],
      ['Aceite y filtros', 'Arrendador'],
      ['Llantas por desgaste normal', 'Arrendador'],
      ['Reparaciones por fallas preexistentes', 'Arrendador'],
      ['Reparaciones por daño atribuible al arrendatario', 'Arrendatario'],
      ['Grúa e inmovilización', 'Según causa'],
    ], [280, ancho - 280])

    clausula('CLÁUSULA 18. MANTENIMIENTO Y FALLAS MECÁNICAS', `EL ARRENDATARIO deberá informar oportunamente cualquier falla que pueda afectar la seguridad o el funcionamiento del vehículo. No podrá autorizar reparaciones de alto costo ni modificaciones sin aprobación previa y verificable de EL ARRENDADOR, salvo medidas urgentes razonables.`)

    clausula('CLÁUSULA 19. DAÑOS Y DETERIORO', `La responsabilidad por daños se determinará teniendo en cuenta: el estado inicial documentado, el estado del vehículo al restituirse, las fotografías y demás pruebas, el diagnóstico técnico, la relación entre el daño y la conducta atribuida, y las reglas legales aplicables. EL ARRENDATARIO no será responsable automáticamente de todo deterioro ocurrido durante el arrendamiento.`)

    clausula('CLÁUSULA 20. PROHIBICIÓN DE COBROS SIN SOPORTE', `Ninguna parte podrá exigir como deuda definitiva un valor arbitrario o carente de fundamento. Las reclamaciones económicas deberán identificar el concepto, su causa, la fecha, el cálculo y los soportes disponibles.`)

    // ============ CAPÍTULO VI ============
    capitulo('CAPÍTULO VI. SEGUROS, ACCIDENTES E INMOVILIZACIÓN')

    clausula('CLÁUSULA 21. VERIFICACIÓN DE SEGUROS', `Antes de entregar el vehículo, las partes registrarán la información disponible sobre SOAT, revisión técnico-mecánica y póliza voluntaria. Las partes deberán verificar que el uso real del vehículo sea compatible con las condiciones de la póliza.`)

    clausula('CLÁUSULA 22. ACCIDENTES, HURTO Y EMERGENCIAS', `Ante un accidente, hurto, daño grave o emergencia, EL ARRENDATARIO deberá:\n1. Priorizar la vida y la integridad de las personas.\n2. Informar a las autoridades cuando corresponda.\n3. Notificar inmediatamente a EL ARRENDADOR.\n4. Contactar a la aseguradora cuando proceda.\n5. Conservar fotografías, informes, datos de terceros y demás pruebas.\n6. No ocultar información relevante.\n7. Cooperar razonablemente con las reclamaciones y trámites pertinentes.`)

    clausula('CLÁUSULA 23. INMOVILIZACIÓN', `Si el vehículo es inmovilizado o retenido por una autoridad, EL ARRENDATARIO deberá informar inmediatamente: autoridad que intervino, motivo conocido, lugar donde quedó el vehículo, número del comparendo o expediente, y gastos y documentos generados.`)

    // ============ CAPÍTULO VII ============
    capitulo('CAPÍTULO VII. IDENTIFICACIÓN DEL CONDUCTOR, FOTODETECCIONES, COMPARENDOS Y GESTIONES ANTE LAS AUTORIDADES DE TRÁNSITO')

    clausula('CLÁUSULA ESPECIAL. IDENTIFICACIÓN DEL CONDUCTOR, FOTODETECCIONES, COMPARENDOS Y GESTIONES ANTE LAS AUTORIDADES DE TRÁNSITO', `1. IDENTIFICACIÓN DEL CONDUCTOR Y PERÍODO DE CUSTODIA.\n\nEL ARRENDATARIO declara que recibe el vehículo identificado en el presente contrato y en el acta de entrega, y asume las obligaciones contractuales relacionadas con su custodia, utilización y devolución durante el período de arrendamiento.\n\nEL ARRENDATARIO se obliga a suministrar información veraz sobre su identidad y sobre la persona que efectivamente conduzca el vehículo cuando esta información resulte necesaria para atender requerimientos de las autoridades competentes.\n\n2. OBLIGACIÓN DE INFORMAR Y COLABORAR.\n\nEL ARRENDATARIO deberá informar al ARRENDADOR, dentro del día hábil siguiente a aquel en que tenga conocimiento verificable de una fotodetección, comparendo o requerimiento relacionado con el vehículo durante el período de arrendamiento, y suministrar oportunamente los documentos e información que razonablemente se requieran para su gestión.\n\nEsta obligación contractual no modifica ni amplía los términos legales establecidos para atender requerimientos, presentar descargos o interponer recursos ante las autoridades competentes.\n\n3. FACULTAD PARA PRESENTAR DOCUMENTOS Y SOLICITAR ACTUACIONES ADMINISTRATIVAS.\n\nEL ARRENDATARIO autoriza expresamente al ARRENDADOR para que, en su condición de propietario o persona con interés legítimo, según corresponda, presente ante las autoridades de tránsito competentes copia del presente contrato, el acta de entrega y devolución, los documentos de identificación pertinentes y los demás soportes que acrediten la entrega, tenencia y utilización del vehículo durante el período de arrendamiento.\n\nCon fundamento en dichos documentos, EL ARRENDADOR podrá solicitar, según la naturaleza del caso y las facultades legales de la autoridad correspondiente:\n\na) La incorporación de la información contractual al expediente administrativo.\n\nb) La identificación del conductor que tenía a su cargo el vehículo en la fecha y hora de la presunta infracción.\n\nc) La revisión o corrección de los datos del propietario o del conductor, cuando legalmente proceda.\n\nd) La evaluación de la atribución de responsabilidad a la persona que corresponda, conforme a la ley y a las pruebas disponibles.\n\ne) La revisión de la actuación administrativa y, cuando existan fundamentos jurídicos, la revocación, modificación o archivo de la actuación mediante el mecanismo legal procedente.\n\nf) La recepción de información y la realización de las demás gestiones administrativas que legalmente pueda adelantar por cuenta propia o mediante apoderado debidamente facultado.\n\n4. COOPERACIÓN DEL ARRENDATARIO Y ACTUACIONES QUE REQUIERAN SU INTERVENCIÓN.\n\nEL ARRENDATARIO se obliga a suministrar información veraz, aportar los documentos que legalmente le correspondan y colaborar de buena fe en los procedimientos relacionados con infracciones presuntamente cometidas durante el período en que tuvo el vehículo bajo su custodia.\n\nCuando la autoridad competente exija una declaración, comparecencia, poder, ratificación o actuación personal del conductor, EL ARRENDATARIO deberá atender el requerimiento en los términos legalmente aplicables.\n\nLa presente autorización no sustituye los poderes especiales que puedan resultar necesarios ni permite prescindir de requisitos legales o administrativos obligatorios.\n\n5. EFECTOS DEL CONTRATO FRENTE A LA AUTORIDAD.\n\nLas partes reconocen que el presente contrato y sus anexos constituyen elementos documentales que podrán ser aportados como prueba de la relación de arrendamiento, la entrega del vehículo y el período de custodia.\n\nNo obstante, la presentación de estos documentos no implica el traslado automático de un comparendo, la modificación automática del sujeto vinculado a una actuación administrativa ni la imposición automática de una sanción al ARRENDATARIO.\n\nLa atribución de responsabilidad corresponderá a la autoridad competente, con observancia de la normativa vigente, las pruebas del caso y el debido proceso.\n\n6. CONSERVACIÓN DE LOS SOPORTES.\n\nEL ARRENDADOR podrá conservar copias del contrato, el acta de entrega y devolución, los documentos de identificación pertinentes y las comunicaciones relacionadas con las presuntas infracciones, exclusivamente para la gestión contractual, la defensa de sus derechos y la atención de requerimientos legítimos, con observancia de las normas aplicables sobre protección de datos personales.\n\n7. GASTOS Y CONSECUENCIAS ECONÓMICAS.\n\nLas consecuencias económicas que legalmente correspondan al ARRENDATARIO por infracciones atribuibles a su conducta, así como los gastos razonables y debidamente acreditados que procedan conforme al contrato y a la ley, podrán ser reclamados por las vías legalmente correspondientes.\n\nNinguna disposición de esta cláusula autoriza al ARRENDADOR a imponer sanciones administrativas, declarar unilateralmente la responsabilidad del conductor o desconocer los procedimientos legales de impugnación.`)

    // ============ CAPÍTULO VIII ============
    capitulo('CAPÍTULO VIII. INSPECCIÓN, LOCALIZACIÓN Y DATOS PERSONALES')

    clausula('CLÁUSULA 28. INSPECCIÓN DEL VEHÍCULO', `EL ARRENDADOR podrá solicitar inspecciones razonables y previamente coordinadas para verificar el estado, mantenimiento y cumplimiento de las condiciones pactadas. Las inspecciones deberán realizarse de forma proporcionada, sin afectar injustificadamente el uso autorizado.`)

    clausula('CLÁUSULA 29. DISPOSITIVOS DE LOCALIZACIÓN', `Si el vehículo cuenta con GPS u otro dispositivo de localización, deberá informarse a EL ARRENDATARIO sobre su existencia, finalidad y condiciones relevantes. La información se utilizará para finalidades legítimas relacionadas con la seguridad, administración y protección del vehículo. No se autoriza el acceso ilícito a dispositivos personales ni la interceptación de comunicaciones privadas.`)

    clausula('CLÁUSULA 30. TRATAMIENTO DE DATOS PERSONALES', `Las partes tratarán los datos personales para finalidades legítimas: celebración y ejecución del contrato, identificación de las partes, registro de pagos, administración del vehículo, atención de incidentes, gestión de cobros, cumplimiento de deberes legales y defensa de derechos. Se cumple la Ley 1581 de 2012.`)

    // ============ CAPÍTULO IX ============
    capitulo('CAPÍTULO IX. TERMINACIÓN Y RESTITUCIÓN')

    clausula('CLÁUSULA 31. CAUSALES DE TERMINACIÓN', `El contrato podrá terminar por:\n1. Vencimiento del plazo pactado.\n2. Mutuo acuerdo escrito.\n3. Incumplimiento contractual que permita la terminación conforme al contrato y a la ley.\n4. Imposibilidad jurídica o material de continuar el arrendamiento.\n5. Pérdida total del vehículo.\n6. Las demás causas legalmente procedentes.`)

    clausula('CLÁUSULA 32. AVISOS DE TERMINACIÓN Y PREAVISO', `Cuando se requiera aviso previo, se aplicará el término que corresponda según la modalidad contractual, las condiciones válidamente pactadas y la legislación aplicable.`)

    clausula('CLÁUSULA 33. PROCEDIMIENTO DE RESTITUCIÓN', `Al finalizar el contrato, EL ARRENDATARIO deberá restituir el vehículo con sus llaves, documentos y accesorios. Las partes deberán elaborar el acta de devolución registrando: fecha, kilometraje final, nivel de combustible, estado, accesorios, daños, fotografías y observaciones.`)

    clausula('CLÁUSULA 34. LIQUIDACIÓN FINAL', `Una vez restituido el vehículo, se elaborará una liquidación con: cánones vencidos, pagos anticipados, gastos pendientes, daños atribuibles, depósito recibido, deducciones justificadas y saldo a favor de cada parte.`)

    // ============ CAPÍTULO X ============
    capitulo('CAPÍTULO X. INCUMPLIMIENTO, RECLAMACIONES Y COBRO')

    clausula('CLÁUSULA 35. REQUERIMIENTO POR INCUMPLIMIENTO', `La parte que considere que existe incumplimiento deberá identificar la obligación afectada, describir los hechos y conservar los soportes pertinentes. Cuando corresponda, deberá enviar un requerimiento que permita acreditar el contenido y la recepción.`)

    clausula('CLÁUSULA 36. PERJUICIOS', `La parte afectada podrá reclamar los perjuicios que legalmente procedan cuando se acrediten los presupuestos exigidos por la ley. Los valores reclamados deberán estar relacionados con el incumplimiento y sustentados mediante pruebas idóneas.`)

    clausula('CLÁUSULA 37. CLÁUSULA PENAL', `Las partes acuerdan como cláusula penal: en caso de mora en el pago del canon, se cobrará ${fmtCOP(d.terminos.multaDiaria)} por cada día de retraso, sin perjuicio de los perjuicios adicionales que legalmente procedan.`)

    clausula('CLÁUSULA 38. COBRO DE OBLIGACIONES', `Las partes podrán utilizar los mecanismos legales de cobro que correspondan. Para exigir ejecutivamente una obligación deberán cumplirse los requisitos legales aplicables. Las partes podrán acudir a conciliación o a las autoridades judiciales competentes.`)

    // ============ CAPÍTULO XI ============
    capitulo('CAPÍTULO XI. COMUNICACIONES Y DISPOSICIONES FINALES')

    clausula('CLÁUSULA 39. NOTIFICACIONES CONTRACTUALES', `Para las comunicaciones contractuales se utilizarán los datos suministrados en el capítulo de identificación. Las partes deberán conservar evidencia de las comunicaciones relevantes. Cada parte deberá informar oportunamente los cambios en sus datos de contacto.`)

    clausula('CLÁUSULA 40. MODIFICACIONES', `Las modificaciones del canon, plazo, destinación, distribución de gastos, conductores autorizados y demás condiciones esenciales deberán constar por escrito y contar con la aceptación de las partes.`)

    clausula('CLÁUSULA 41. INTEGRIDAD Y SEPARABILIDAD', `El contrato y sus anexos contienen los acuerdos documentados entre las partes. Si una disposición resulta ineficaz o inaplicable, las restantes conservarán sus efectos. Ninguna disposición se interpretará como renuncia a derechos irrenunciables.`)

    clausula('CLÁUSULA 42. LEGISLACIÓN Y SOLUCIÓN DE CONTROVERSIAS', `El contrato se rige por las leyes de la República de Colombia. Las partes procurarán resolver de buena fe las diferencias. Si no alcanzan un acuerdo, podrán acudir a los mecanismos de conciliación cuando procedan o a la autoridad judicial competente.`)

    // ============ CAPÍTULO XII — FIRMAS ELECTRÓNICAS ============
    capitulo('CAPÍTULO XII. ACEPTACIÓN Y FIRMA ELECTRÓNICA')
    clausula('', `Las partes manifiestan que:\n1. Han leído y comprendido el contenido del contrato.\n2. Han tenido oportunidad de solicitar aclaraciones.\n3. Los espacios relativos a las condiciones económicas y esenciales han sido diligenciados.\n4. Los anexos relacionados corresponden a los documentos que efectivamente se incorporan, incluyendo el inventario físico del vehículo.\n5. Firman electrónicamente de forma libre, voluntaria y consciente, sin perjuicio de los derechos y controles previstos por la ley.\n6. Aceptan que la firma electrónica aquí contenida produce los mismos efectos jurídicos que la firma manuscrita, conforme a la Ley 527 de 1999 y el Decreto 1074 de 2015.`)

    ensureSpace(60)
    doc.fillColor('#000').fontSize(9).font('Helvetica-Bold')
    const txtCiudad = `Ciudad: Medellín    Fecha de suscripción: ${fmtFechaCorta(new Date())}`
    doc.text(txtCiudad, 50, y, { width: ancho })
    y += doc.heightOfString(txtCiudad, { width: ancho }) + 8

    // === FIRMA ELECTRÓNICA DEL CONDUCTOR ===
    ensureSpace(140) // banner + título + 3 fotos (no la sección completa)
    doc.fillColor('#fff').rect(50, y, ancho, 18).fill('#1e3a8a')
    doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold'); doc.text('FIRMA ELECTRÓNICA — EL ARRENDATARIO (CONDUCTOR)', 55, y + 4); y += 22

    // Documentos de identidad y selfie
    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold'); doc.text('Documentos de verificación:', 50, y); y += 12
    ensureSpace(120) // 3 fotos de 90px + etiqueta
    const colW = Math.floor((ancho - 20) / 3)
    const labels = ['Cédula (frente)', 'Cédula (reverso)', 'Selfie con cédula']
    const imgs = [d.firmaConductor.fotoCedulaFrente, d.firmaConductor.fotoCedulaReverso, d.firmaConductor.fotoSelfie]
    let imgBlockH = 0
    for (let i = 0; i < 3; i++) {
      const x = 50 + i * (colW + 10)
      doc.fillColor('#000').fontSize(7).font('Helvetica-Bold'); doc.text(labels[i], x, y, { width: colW })
      const h = await addImage(doc, imgs[i], x, y + 10, colW, 90)
      doc.fillColor('#999').fontSize(6).font('Helvetica'); doc.rect(x, y + 10, colW, 90).stroke('#ccc')
      if (h > imgBlockH) imgBlockH = h
    }
    y += 10 + 90 + 14

    // Firma manuscrita
    ensureSpace(100) // etiqueta + firma + línea
    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold'); doc.text('Firma manuscrita digitalizada:', 50, y); y += 12
    const fh = await addImage(doc, d.firmaConductor.firmaManuscrita, 50, y, 280, 70)
    if (fh === 0) {
      doc.rect(50, y, 280, 70).stroke('#999')
      doc.fillColor('#999').fontSize(8).font('Helvetica-Oblique'); doc.text('[Firma no registrada]', 60, y + 30, { width: 260, align: 'center' })
    }
    // Línea de firma
    doc.moveTo(50, y + 75).lineTo(330, y + 75).stroke('#000')
    y += 80

    // Datos de verificación electrónica
    ensureSpace(60) // título + primera fila
    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold'); doc.text('Datos de verificación de la firma electrónica:', 50, y); y += 12
    const otpConductor = d.firmaConductor.otpHash ? d.firmaConductor.otpHash.substring(0, 16) + '...' : '—'
    tablaSimple(['CAMPO', 'VALOR'], [
      ['Nombre completo del firmante', d.conductor.nombre],
      ['Documento de identidad', `${d.conductor.cedula} (C.C.)`],
      ['Fecha y hora de firma', d.firmaConductor.fechaFirma ? `${fmtFechaCorta(d.firmaConductor.fechaFirma)} ${new Date(d.firmaConductor.fechaFirma).toLocaleTimeString('es-CO')}` : '—'],
      ['Dirección IP de origen', d.firmaConductor.ip || '—'],
      ['Dispositivo / User-Agent', d.firmaConductor.userAgent || '—'],
      ['Correo electrónico validado', d.conductor.email || '—'],
      ['Validación OTP por correo', d.firmaConductor.otpValidado ? `VERIFICADA (OTP enviada a ${d.conductor.email || 'correo del conductor'})` : 'No verificada'],
      ['Hash OTP (verificación)', otpConductor],
      ['Método de firma', 'Firma electrónica con OTP + biometría (cédula y selfie)'],
    ], [200, ancho - 200])
    y += 8

    // === FIRMA ELECTRÓNICA DEL PROPIETARIO ===
    ensureSpace(140) // banner + título
    doc.fillColor('#fff').rect(50, y, ancho, 18).fill('#1e3a8a')
    doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold'); doc.text('FIRMA ELECTRÓNICA — EL ARRENDADOR (PROPIETARIO)', 55, y + 4); y += 22

    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold'); doc.text('Documentos de verificación:', 50, y); y += 12
    ensureSpace(120) // 3 fotos
    const labelsP = ['Cédula (frente)', 'Cédula (reverso)', 'Selfie con cédula']
    const imgsP = [d.firmaPropietario.fotoCedulaFrente, d.firmaPropietario.fotoCedulaReverso, d.firmaPropietario.fotoSelfie]
    let imgBlockHP = 0
    for (let i = 0; i < 3; i++) {
      const x = 50 + i * (colW + 10)
      doc.fillColor('#000').fontSize(7).font('Helvetica-Bold'); doc.text(labelsP[i], x, y, { width: colW })
      const h = await addImage(doc, imgsP[i], x, y + 10, colW, 90)
      doc.fillColor('#999').fontSize(6).font('Helvetica'); doc.rect(x, y + 10, colW, 90).stroke('#ccc')
      if (h > imgBlockHP) imgBlockHP = h
    }
    y += 10 + 90 + 14

    ensureSpace(100)
    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold'); doc.text('Firma manuscrita digitalizada:', 50, y); y += 12
    const fhp = await addImage(doc, d.firmaPropietario.firmaManuscrita, 50, y, 280, 70)
    if (fhp === 0) {
      doc.rect(50, y, 280, 70).stroke('#999')
      doc.fillColor('#999').fontSize(8).font('Helvetica-Oblique'); doc.text('[Firma no registrada]', 60, y + 30, { width: 260, align: 'center' })
    }
    doc.moveTo(50, y + 75).lineTo(330, y + 75).stroke('#000')
    y += 80

    ensureSpace(60)
    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold'); doc.text('Datos de verificación de la firma electrónica:', 50, y); y += 12
    const otpPropietario = d.firmaPropietario.otpHash ? d.firmaPropietario.otpHash.substring(0, 16) + '...' : '—'
    tablaSimple(['CAMPO', 'VALOR'], [
      ['Nombre completo del firmante', d.propietario.nombre],
      ['Documento de identidad', `${d.propietario.cedula} (C.C.)`],
      ['Fecha y hora de firma', d.firmaPropietario.fechaFirma ? `${fmtFechaCorta(d.firmaPropietario.fechaFirma)} ${new Date(d.firmaPropietario.fechaFirma).toLocaleTimeString('es-CO')}` : '—'],
      ['Dirección IP de origen', d.firmaPropietario.ip || '—'],
      ['Dispositivo / User-Agent', d.firmaPropietario.userAgent || '—'],
      ['Correo electrónico validado', d.propietario.email || '—'],
      ['Validación OTP por correo', d.firmaPropietario.otpValidado ? `VERIFICADA (OTP enviada a ${d.propietario.email || 'correo del propietario'})` : 'No verificada'],
      ['Hash OTP (verificación)', otpPropietario],
      ['Método de firma', 'Firma electrónica con OTP + biometría (cédula y selfie)'],
    ], [200, ancho - 200])
    y += 8

    // === ANEXO 1: ACTA DE ENTREGA + INVENTARIO COMPLETO ===
    capitulo('ANEXO 1. ACTA DE ENTREGA, INVENTARIO COMPLETO Y DEVOLUCIÓN')

    clausula('', `El presente anexo contiene el inventario físico completo del vehículo objeto del contrato, registrando el estado de cada elemento al momento de la entrega. Sirve como constancia irrefutable de los bienes que se entregan a EL ARRENDATARIO y contra los cuales se verificará la devolución al finalizar el contrato.`)

    tablaSimple(['DATO DEL VEHÍCULO', 'INFORMACIÓN'], [
      ['Fecha y hora de entrega', fmtFechaCorta(d.terminos.fechaInicio)],
      ['Kilometraje inicial', `${(d.vehiculo.kilometraje || 0).toLocaleString('es-CO')} km`],
      ['Marca', d.vehiculo.marca],
      ['Línea / Modelo', d.vehiculo.modelo],
      ['Año', String(d.vehiculo.anio || '—')],
      ['Placa', d.vehiculo.placa],
      ['Color', d.vehiculo.color || '—'],
      ['Número de VIN / chasis', d.vehiculo.vin || '—'],
      ['Número de motor', d.vehiculo.motor || '—'],
      ['Combustible inicial', '— (registrar al entregar)'],
      ['Nivel de combustible', '— (registrar al entregar)'],
    ], [200, ancho - 200])

    // === INVENTARIO DETALLADO ===
    ensureSpace(80)
    doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica-Bold')
    doc.text('INVENTARIO FÍSICO DEL VEHÍCULO', 50, y, { width: ancho })
    y += doc.heightOfString('INVENTARIO FÍSICO DEL VEHÍCULO', { width: ancho }) + 6
    doc.fillColor('#666').fontSize(8).font('Helvetica-Oblique')
    const txtTotal = `Total de ítems registrados: ${d.inventario.length}`
    doc.text(txtTotal, 50, y, { width: ancho })
    y += doc.heightOfString(txtTotal, { width: ancho }) + 4

    // Cabecera del inventario con columnas: N° / Item / Descripción / Cant. / Estado Entrega / Estado Devolución / Obs.
    const invColW = [25, 110, 150, 35, 65, 65, ancho - 460]
    const invHeaders = ['#', 'ÍTEM', 'DESCRIPCIÓN', 'CANT.', 'ESTADO ENTREGA', 'ESTADO DEVOLUCIÓN', 'OBSERVACIONES']
    const invHeaderH = 24
    ensureSpace(invHeaderH + 30)
    let xi = 50
    doc.fillColor('#1e3a8a')
    for (let i = 0; i < invHeaders.length; i++) {
      doc.rect(xi, y, invColW[i], invHeaderH).fill('#1e3a8a')
      doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold')
      doc.text(invHeaders[i], xi + 2, y + 7, { width: invColW[i] - 4, align: 'center' })
      xi += invColW[i]
    }
    y += invHeaderH

    if (d.inventario.length === 0) {
      // Si no hay inventario cargado, mostrar filas en blanco para diligenciar a mano
      const filasVacias = 10
      for (let r = 0; r < filasVacias; r++) {
        ensureSpace(30)
        xi = 50
        for (let i = 0; i < invHeaders.length; i++) {
          doc.rect(xi, y, invColW[i], 22).stroke('#999')
          doc.fillColor('#ccc').fontSize(7).font('Helvetica')
          const txt = i === 0 ? String(r + 1) : ''
          doc.text(txt, xi + 2, y + 7, { width: invColW[i] - 4, align: 'center' })
          xi += invColW[i]
        }
        y += 22
      }
      doc.fillColor('#999').fontSize(7).font('Helvetica-Oblique')
      doc.text('(Inventario sin registrar en sistema. Diligenciar manualmente al momento de la entrega.)', 50, y); y += 14
    } else {
      // Filas reales con el inventario del vehículo — altura dinámica
      for (const it of d.inventario) {
        const cells = [
          String(it.n),
          it.nombre,
          it.descripcion || '—',
          String(it.cantidad),
          it.estado || 'BUENO',
          '', // estado devolución (vacío para diligenciar al devolver)
          it.notas || '',
        ]
        // Calcular altura máxima entre todas las celdas
        let rowH = 22 // mínimo
        for (let i = 0; i < cells.length; i++) {
          const cellH = calcularAlturaTexto(cells[i], invColW[i] - 4, 7)
          if (cellH > rowH) rowH = cellH
        }
        ensureSpace(rowH + 4)
        xi = 50
        for (let i = 0; i < cells.length; i++) {
          doc.rect(xi, y, invColW[i], rowH).stroke('#bbb')
          doc.fillColor('#000').fontSize(7).font(i === 0 || i === 3 ? 'Helvetica-Bold' : 'Helvetica')
          doc.text(cells[i], xi + 2, y + 5, { width: invColW[i] - 4, align: (i === 0 || i === 3) ? 'center' : 'left' })
          xi += invColW[i]
        }
        y += rowH
      }
    }
    y += 10

    // === FOTOS DEL VEHÍCULO Y DOCUMENTOS ===
    // Adjuntar foto principal del vehículo y fotos de los documentos (SOAT, tecnomecánica, etc.)
    // para que estén disponibles cuando se descargue el contrato completo.
    const todasLasFotosVehiculo: { titulo: string; url: string }[] = []
    if (fotoVehiculo) {
      todasLasFotosVehiculo.push({ titulo: 'Foto del vehículo', url: fotoVehiculo })
    }
    for (const doc of documentosVehiculo) {
      if (doc.archivoUrl) {
        todasLasFotosVehiculo.push({
          titulo: `${doc.tipo} - ${doc.numero || 'Sin número'}`,
          url: doc.archivoUrl,
        })
      }
      if (doc.archivosExtra) {
        try {
          const extras: string[] = JSON.parse(doc.archivosExtra)
          for (let ei = 0; ei < extras.length; ei++) {
            todasLasFotosVehiculo.push({
              titulo: `${doc.tipo} - ${doc.numero || 'Sin número'} (adicional ${ei + 1})`,
              url: extras[ei],
            })
          }
        } catch {}
      }
    }

    if (todasLasFotosVehiculo.length > 0) {
      ensureSpace(60)
      doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
      doc.text('FOTOGRAFÍAS DEL VEHÍCULO Y DOCUMENTOS ADJUNTOS', 50, y, { width: ancho })
      y += doc.heightOfString('FOTOGRAFÍAS DEL VEHÍCULO Y DOCUMENTOS ADJUNTOS', { width: ancho }) + 6
      doc.fillColor('#666').fontSize(8).font('Helvetica-Oblique')
      const txtFotosInfo = `Total de fotografías adjuntas: ${todasLasFotosVehiculo.length} (foto del vehículo + fotos de documentos SOAT, tecnomecánica, etc.)`
      doc.text(txtFotosInfo, 50, y, { width: ancho })
      y += doc.heightOfString(txtFotosInfo, { width: ancho }) + 8

      // Galería de fotos: 2 fotos por fila
      const fotoW = Math.min(240, (ancho - 30) / 2)
      const fotoH = 160
      const gap = 10
      let colIdx = 0
      for (let i = 0; i < todasLasFotosVehiculo.length; i++) {
        const foto = todasLasFotosVehiculo[i]
        if (colIdx === 0) {
          ensureSpace(fotoH + 30)
        }
        const x = 50 + colIdx * (fotoW + gap)
        // Etiqueta de la foto
        doc.fillColor('#1e3a8a').fontSize(7).font('Helvetica-Bold')
        const label = `${i + 1}. ${foto.titulo}`
        doc.text(label, x, y, { width: fotoW })
        // Imagen
        const imgY = y + 12
        const imgH = await addImage(doc, foto.url, x, imgY, fotoW, fotoH)
        if (imgH > 0) {
          doc.rect(x, imgY, fotoW, fotoH).stroke('#1e3a8a')
        } else {
          doc.rect(x, imgY, fotoW, fotoH).stroke('#fbbf24')
          doc.fillColor('#92400e').fontSize(8).font('Helvetica-Oblique')
          doc.text('[Foto no disponible]', x + 10, imgY + fotoH / 2 - 5, { width: fotoW - 20, align: 'center' })
        }
        colIdx++
        if (colIdx >= 2) {
          colIdx = 0
          y += fotoH + 25
        }
      }
      if (colIdx > 0) {
        y += fotoH + 25
      }
      y += 8
    }

    // Estado general del vehículo (exterior, interior, llantas, etc.)
    ensureSpace(180)
    doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
    doc.text('ESTADO GENERAL DEL VEHÍCULO AL ENTREGAR', 50, y, { width: ancho })
    y += doc.heightOfString('ESTADO GENERAL DEL VEHÍCULO AL ENTREGAR', { width: ancho }) + 6
    tablaSimple(['COMPONENTE', 'ESTADO ENTREGA', 'OBSERVACIONES'], [
      ['Carrocería / pintura exterior', '—', ''],
      ['Parabrisas y cristales', '—', ''],
      ['Espejos retrovisores', '—', ''],
      ['Llantas (estado y profundidad)', '—', ''],
      ['Llanta de repuesto', '—', ''],
      ['Gato y herramientas', '—', ''],
      ['Interior / tapicería', '—', ''],
      ['Tablero e instrumentos', '—', ''],
      ['Aire acondicionado', '—', ''],
      ['Sistema de audio', '—', ''],
      ['Cinturones de seguridad', '—', ''],
      ['Airbags (testigo)', '—', ''],
      ['Luces (altas/bajas/direccionales)', '—', ''],
      ['Frenos', '—', ''],
      ['Documentos del vehículo (SOAT, tecnomecánica)', '—', ''],
    ], [180, 110, ancho - 290])
    y += 8

    // === FOTOGRAFÍAS DE LOS ITEMS DEL INVENTARIO ===
    // Adjuntar las fotos de cada item del inventario (llaves, herramientas, accesorios, etc.)
    const itemsConFoto = d.inventario.filter((it: any) => it.fotoUrl)
    if (itemsConFoto.length > 0) {
      ensureSpace(60)
      doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
      doc.text('FOTOGRAFÍAS DE LOS ITEMS DEL INVENTARIO', 50, y, { width: ancho })
      y += doc.heightOfString('FOTOGRAFÍAS DE LOS ITEMS DEL INVENTARIO', { width: ancho }) + 6
      doc.fillColor('#666').fontSize(8).font('Helvetica-Oblique')
      const txtFotosItems = `Total de fotografías de inventario: ${itemsConFoto.length} (llaves, herramientas, accesorios, etc.)`
      doc.text(txtFotosItems, 50, y, { width: ancho })
      y += doc.heightOfString(txtFotosItems, { width: ancho }) + 8

      // Galería de fotos: 2 fotos por fila
      const fotoItemW = Math.min(240, (ancho - 30) / 2)
      const fotoItemH = 160
      const gapItem = 10
      let colItemIdx = 0
      for (let i = 0; i < itemsConFoto.length; i++) {
        const item = itemsConFoto[i]
        if (colItemIdx === 0) {
          ensureSpace(fotoItemH + 30)
        }
        const x = 50 + colItemIdx * (fotoItemW + gapItem)
        // Etiqueta de la foto (nombre del item + cantidad + estado)
        doc.fillColor('#1e3a8a').fontSize(7).font('Helvetica-Bold')
        const label = `${item.n}. ${item.nombre} (x${item.cantidad}) - ${item.estado}`
        doc.text(label, x, y, { width: fotoItemW })
        // Imagen
        const imgY = y + 12
        const imgH = await addImage(doc, item.fotoUrl, x, imgY, fotoItemW, fotoItemH)
        if (imgH > 0) {
          doc.rect(x, imgY, fotoItemW, fotoItemH).stroke('#1e3a8a')
        } else {
          doc.rect(x, imgY, fotoItemW, fotoItemH).stroke('#fbbf24')
          doc.fillColor('#92400e').fontSize(8).font('Helvetica-Oblique')
          doc.text('[Foto no disponible]', x + 10, imgY + fotoItemH / 2 - 5, { width: fotoItemW - 20, align: 'center' })
        }
        colItemIdx++
        if (colItemIdx >= 2) {
          colItemIdx = 0
          y += fotoItemH + 25
        }
      }
      if (colItemIdx > 0) {
        y += fotoItemH + 25
      }
      y += 8
    }

    // === FIRMAS DEL ACTA DE ENTREGA ===
    ensureSpace(140)
    doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
    doc.text('CONSTANCIA DE ENTREGA Y RECEPCIÓN DEL VEHÍCULO', 50, y, { width: ancho })
    y += doc.heightOfString('CONSTANCIA DE ENTREGA Y RECEPCIÓN DEL VEHÍCULO', { width: ancho }) + 6
    doc.fillColor('#000').fontSize(8).font('Helvetica')
    const txtConstancia = 'Las partes declaran que el vehículo se entregó en el estado arriba descrito, junto con todos los ítems del inventario. Cualquier discrepancia deberá registrarse por escrito en el momento de la entrega.'
    doc.text(txtConstancia, 50, y, { width: ancho, align: 'justify' })
    y += doc.heightOfString(txtConstancia, { width: ancho, align: 'justify' }) + 8

    // Doble columna: Conductor / Propietario
    const colWFirma = Math.floor((ancho - 20) / 2)
    // Conductor
    doc.rect(50, y, colWFirma, 70).stroke('#999')
    doc.fillColor('#666').fontSize(7).font('Helvetica-Bold'); doc.text('EL ARRENDATARIO (recibe)', 55, y + 5, { width: colWFirma - 10 })
    doc.moveTo(60, y + 50).lineTo(50 + colWFirma - 10, y + 50).stroke('#000')
    doc.fillColor('#000').fontSize(7).font('Helvetica'); doc.text(`Nombre: ${d.conductor.nombre}`, 60, y + 54, { width: colWFirma - 20 })
    doc.text(`CC: ${d.conductor.cedula}`, 60, y + 62, { width: colWFirma - 20 })
    // Propietario
    doc.rect(50 + colWFirma + 10, y, colWFirma, 70).stroke('#999')
    doc.fillColor('#666').fontSize(7).font('Helvetica-Bold'); doc.text('EL ARRENDADOR (entrega)', 55 + colWFirma + 10, y + 5, { width: colWFirma - 10 })
    doc.moveTo(60 + colWFirma + 10, y + 50).lineTo(50 + colWFirma * 2, y + 50).stroke('#000')
    doc.fillColor('#000').fontSize(7).font('Helvetica'); doc.text(`Nombre: ${d.propietario.nombre}`, 60 + colWFirma + 10, y + 54, { width: colWFirma - 20 })
    doc.text(`CC: ${d.propietario.cedula}`, 60 + colWFirma + 10, y + 62, { width: colWFirma - 20 })
    y += 80

    // === SECCIÓN DE DEVOLUCIÓN (a diligenciar al finalizar) ===
    ensureSpace(220)
    doc.fillColor('#fff').rect(50, y, ancho, 18).fill('#6b7280')
    doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold'); doc.text('ACTA DE DEVOLUCIÓN (a diligenciar al finalizar el contrato)', 55, y + 4); y += 22
    tablaSimple(['DATO', 'INFORMACIÓN'], [
      ['Fecha y hora de devolución', '____ / ____ / ________   hora: ____:____'],
      ['Kilometraje final', '________________ km'],
      ['Nivel de combustible', '¼  ½  ¾  Lleno  (marque con X)'],
      ['Estado general del vehículo', '—'],
      ['Ítems faltantes / dañados', '—'],
      ['Observaciones', '—'],
    ], [200, ancho - 200])

    // === Espacios de firma para el acta de devolución ===
    ensureSpace(150)
    doc.fillColor('#000').fontSize(9).font('Helvetica-Bold')
    doc.text('CONSTANCIA DE DEVOLUCIÓN Y RECEPCIÓN DEL VEHÍCULO', 50, y, { width: ancho })
    y += doc.heightOfString('CONSTANCIA DE DEVOLUCIÓN Y RECEPCIÓN DEL VEHÍCULO', { width: ancho }) + 8
    doc.fillColor('#000').fontSize(8).font('Helvetica')
    const txtDevolucion = 'Las partes declaran que el vehículo se devolvió en el estado arriba descrito, junto con todos los ítems del inventario. Cualquier discrepancia o novedad deberá registrarse por escrito en el momento de la devolución.'
    doc.text(txtDevolucion, 50, y, { width: ancho, align: 'justify' })
    y += doc.heightOfString(txtDevolucion, { width: ancho, align: 'justify' }) + 18

    // Doble columna: Conductor (entrega) / Propietario (recibe)
    const colWFirmaDev = Math.floor((ancho - 20) / 2)
    const filaDevY = y
    // Conductor
    doc.rect(50, y, colWFirmaDev, 90).stroke('#999')
    doc.fillColor('#666').fontSize(7).font('Helvetica-Bold')
    doc.text('ENTREGA — EL ARRENDATARIO (CONDUCTOR)', 55, y + 5, { width: colWFirmaDev - 10 })
    // Línea de firma
    doc.moveTo(60, y + 60).lineTo(50 + colWFirmaDev - 10, y + 60).stroke('#000')
    doc.fillColor('#000').fontSize(7).font('Helvetica')
    doc.text(`Firma:`, 60, y + 64, { width: colWFirmaDev - 20, continued: false })
    doc.text(`Nombre: ${d.conductor.nombre}`, 60, y + 72, { width: colWFirmaDev - 20 })
    doc.text(`C.C.: ${d.conductor.cedula}`, 60, y + 80, { width: colWFirmaDev - 20 })

    // Propietario
    const propX = 50 + colWFirmaDev + 10
    doc.rect(propX, y, colWFirmaDev, 90).stroke('#999')
    doc.fillColor('#666').fontSize(7).font('Helvetica-Bold')
    doc.text('RECIBE — EL ARRENDADOR (PROPIETARIO)', propX + 5, y + 5, { width: colWFirmaDev - 10 })
    doc.moveTo(propX + 10, y + 60).lineTo(propX + colWFirmaDev - 10, y + 60).stroke('#000')
    doc.fillColor('#000').fontSize(7).font('Helvetica')
    doc.text(`Firma:`, propX + 10, y + 64, { width: colWFirmaDev - 20 })
    doc.text(`Nombre: ${d.propietario.nombre}`, propX + 10, y + 72, { width: colWFirmaDev - 20 })
    doc.text(`C.C.: ${d.propietario.cedula}`, propX + 10, y + 80, { width: colWFirmaDev - 20 })

    y = filaDevY + 100

    capitulo('ANEXO 2. REGISTRO DE CONDUCTORES AUTORIZADOS')
    tablaSimple(['N°', 'NOMBRE', 'DOCUMENTO', 'LICENCIA', 'CAT'], [
      ['1', d.conductor.nombre, d.conductor.cedula, d.conductor.licencia || '—', d.conductor.licenciaCat || '—'],
    ], [30, 150, 100, 120, 100])

    capitulo('ANEXO 3. REGISTRO DE PAGOS E INCIDENCIAS')
    clausula('', `Canon: ${fmtCOP(d.terminos.tarifa)} / ${d.terminos.modalidadPago}. Multa: ${fmtCOP(d.terminos.multaDiaria)}/día. Depósito: ${fmtCOP(d.terminos.deposito)}.`)
    tablaSimple(['CUENTA DE PAGO OBLIGATORIA', 'INFORMACIÓN'], [
      ['Banco', d.cuentaPago.banco],
      ['Tipo de cuenta', d.cuentaPago.tipo],
      ['Número de cuenta', d.cuentaPago.numero],
      ['Titular', d.cuentaPago.titular],
      ['C.C. del titular', d.cuentaPago.titularCedula],
      ['Concepto de la transferencia', `${d.numeroContrato} - Canon arrendamiento`],
      ['Recordatorio', 'Pagos solo de lunes a sábado (no domingos). Vence el sábado de cada semana.'],
    ], [200, ancho - 200])

    capitulo('ANEXO 4. CONTROL DE VENCIMIENTO Y TERMINACIÓN')
    tablaSimple(['CONTROL', 'INFORMACIÓN'], [
      ['Fecha de inicio', '24 / 10 / 2026'],
      ['Fecha pactada de terminación inicial', '23 / 01 / 2027'],
      ['Duración del plazo inicial', 'Tres (3) meses'],
      ['Renovación automática', 'Sí, por el mismo plazo si no hay preaviso de 30 días'],
      ['Fecha estimada de Otro Sí anual', '24 / 10 / 2027 (al cumplirse 1 año)'],
      ['Plazo del Otro Sí', 'Un (1) año'],
      ['Multa por abandono anticipado', 'Una (1) semana de liquidación del canon'],
      ['Modalidad contractual de pago', d.terminos.modalidadPago],
      ['Estado de liquidación', 'Pendiente'],
    ], [200, ancho - 200])

    // ============ SELLO DE SEGURIDAD Y CÓDIGO QR DE AUTENTICIDAD ============
    capitulo('SELLO DE SEGURIDAD Y CÓDIGO QR DE AUTENTICIDAD')

    // Generar hash único del contrato (firma criptográfica)
    const datosFirma = [
      d.numeroContrato,
      d.vehiculo.placa,
      d.propietario.cedula,
      d.conductor.cedula,
      d.terminos.fechaInicio?.toISOString() || '',
      d.terminos.fechaFin?.toISOString() || '',
      d.terminos.tarifa?.toString() || '',
      d.firmaConductor.otpHash || '',
      d.firmaPropietario.otpHash || '',
      d.firmaConductor.fechaFirma?.toISOString() || '',
      d.firmaPropietario.fechaFirma?.toISOString() || '',
    ].join('|')
    const hashFirma = crypto.createHash('sha256').update(datosFirma).digest('hex').toUpperCase()
    const hashCorto = hashFirma.substring(0, 16)
    const fechaEmisionSello = new Date().toISOString()

    clausula('', `El presente contrato cuenta con un sello de seguridad criptográfico que permite verificar su autenticidad. Cualquier modificación posterior al documento invalidará el hash de verificación.`)
    tablaSimple(['DATO DE VERIFICACIÓN', 'VALOR'], [
      ['Número de contrato', d.numeroContrato],
      ['Hash de autenticidad (SHA-256)', hashFirma],
      ['Hash corto de verificación', hashCorto],
      ['Fecha de emisión del sello', fmtFechaCorta(new Date())],
      ['Placa del vehículo', d.vehiculo.placa],
      ['Cédula del arrendador', d.propietario.cedula],
      ['Cédula del arrendatario', d.conductor.cedula],
      ['Firma conductor (OTP)', d.firmaConductor.otpValidado ? 'VERIFICADA' : 'Pendiente'],
      ['Firma propietario (OTP)', d.firmaPropietario.otpValidado ? 'VERIFICADA' : 'Pendiente'],
      ['URL de verificación', `https://jsadr.com.co/verificar-contrato?hash=${hashCorto}`],
    ], [200, ancho - 200])

    // Generar el código QR con los datos de verificación
    try {
      const qrData = JSON.stringify({
        contrato: d.numeroContrato,
        placa: d.vehiculo.placa,
        propietario: d.propietario.cedula,
        conductor: d.conductor.cedula,
        hash: hashCorto,
        hashCompleto: hashFirma,
        fechaEmision: fechaEmisionSello,
        url: `https://jsadr.com.co/verificar-contrato?hash=${hashCorto}`,
        firmas: {
          conductor: d.firmaConductor.otpValidado,
          propietario: d.firmaPropietario.otpValidado,
        },
      })
      const qrBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        margin: 1,
        width: 200,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      })

      // === Sello visual con QR ===
      // Asegurar espacio para el sello completo (200px de alto + padding)
      ensureSpace(220)
      const selloX = 50
      const selloY = y
      const selloW = ancho
      const selloH = 200

      // Fondo del sello
      doc.save()
      doc.rect(selloX, selloY, selloW, selloH).fill('#fef3c7').stroke('#d97706')
      doc.lineWidth(2)
      doc.rect(selloX + 5, selloY + 5, selloW - 10, selloH - 10).stroke('#d97706')
      doc.restore()

      // QR a la izquierda
      doc.image(qrBuffer, selloX + 15, selloY + 25, { width: 150, height: 150 })

      // Título del sello
      doc.fillColor('#92400e').fontSize(14).font('Helvetica-Bold')
      doc.text('🔒 SELLO DE AUTENTICIDAD', selloX + 180, selloY + 15, { width: selloW - 200 })

      // Subtítulo
      doc.fillColor('#78350f').fontSize(9).font('Helvetica-Bold')
      doc.text('CONTRATO DE ARRENDAMIENTO DE VEHÍCULO AUTOMOTOR', selloX + 180, selloY + 35, { width: selloW - 200 })

      // Datos del sello — sin continued para evitar superposición
      doc.fillColor('#1f2937').fontSize(8).font('Helvetica')
      doc.text(`Contrato N°: ${d.numeroContrato}`, selloX + 180, selloY + 55, { width: selloW - 200 })
      doc.text(`Placa: ${d.vehiculo.placa}  ·  Fecha: ${fmtFechaCorta(new Date())}`, selloX + 180, selloY + 70, { width: selloW - 200 })
      doc.text(`Hash: ${hashCorto}`, selloX + 180, selloY + 85, { width: selloW - 200 })

      // Estado de firmas (cada uno en su propia línea)
      const firmanteConductor = d.firmaConductor.otpValidado ? '✓ VERIFICADA' : '✗ PENDIENTE'
      const firmantePropietario = d.firmaPropietario.otpValidado ? '✓ VERIFICADA' : '✗ PENDIENTE'
      doc.fillColor('#1f2937').font('Helvetica').fontSize(8)
      doc.text(`Firma conductor: ${firmanteConductor}`, selloX + 180, selloY + 105, { width: selloW - 200 })
      doc.text(`Firma propietario: ${firmantePropietario}`, selloX + 180, selloY + 120, { width: selloW - 200 })

      // URL de verificación
      doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Oblique')
      doc.text(`Escanee el código QR o visite:`, selloX + 180, selloY + 140, { width: selloW - 200 })
      doc.font('Helvetica-Bold').fillColor('#1e3a8a')
      doc.text(`jsadr.com.co/verificar-contrato`, selloX + 180, selloY + 155, { width: selloW - 200 })

      // Aviso legal
      doc.fillColor('#78350f').fontSize(7).font('Helvetica-Oblique')
      doc.text('Documento generado electrónicamente. La modificación de este documento invalida el sello de autenticidad. Conforme a la Ley 527 de 1999 (mensajes de datos) y el Decreto 1074 de 2015.', selloX + 180, selloY + 175, { width: selloW - 200 })

      y = selloY + selloH + 15
    } catch (err) {
      console.error('[contrato-legal/descargar] Error generando QR/sello:', err)
      clausula('', `⚠️ Error generando sello de seguridad. Hash de verificación: ${hashFirma}`)
    }

    // === Dibujar footer legal en CADA página ===
    // Estrategia: recorrer todas las páginas con switchToPage y dibujar el footer.
    // PDFKit permite agregar contenido a páginas anteriores con esta técnica.
    try {
      const range = doc.bufferedPageRange()
      const totalPaginas = range.count
      const fechaGeneracion = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        const numPagina = i - range.start + 1
        const pageH = doc.page.height
        const pageW = doc.page.width

        // === Línea separadora del footer (azul, gruesa) ===
        doc.moveTo(50, pageH - 40)
        doc.lineTo(pageW - 50, pageH - 40)
        doc.strokeColor('#1e3a8a')
        doc.lineWidth(1)
        doc.stroke()

        // === Lado izquierdo: identificación del contrato ===
        doc.fillColor('#1e3a8a')
        doc.fontSize(8)
        doc.font('Helvetica-Bold')
        doc.text(`CONTRATO ${d.numeroContrato}`, 50, pageH - 33, { width: 280, align: 'left' })

        doc.fillColor('#666666')
        doc.fontSize(7)
        doc.font('Helvetica')
        doc.text(`Vehículo placa ${d.vehiculo.placa} · CAV-001 v2.0`, 50, pageH - 22, { width: 280, align: 'left' })

        // === Centro: nota legal ===
        doc.fillColor('#92400e')
        doc.fontSize(7)
        doc.font('Helvetica-Oblique')
        doc.text('Documento legal firmado electrónicamente · Ley 527 de 1999', 50, pageH - 22, { width: pageW - 100, align: 'center' })

        // === Lado derecho: NUMERACIÓN DE PÁGINA (formato documento legal) ===
        doc.fillColor('#1e3a8a')
        doc.fontSize(11)
        doc.font('Helvetica-Bold')
        doc.text(`Página ${numPagina} de ${totalPaginas}`, pageW - 200, pageH - 33, { width: 150, align: 'right' })

        doc.fillColor('#666666')
        doc.fontSize(7)
        doc.font('Helvetica')
        doc.text(`Generado: ${fechaGeneracion}`, pageW - 200, pageH - 22, { width: 150, align: 'right' })
      }

      // Volver a la última página para que el doc.end() funcione correctamente
      const lastRange = doc.bufferedPageRange()
      doc.switchToPage(lastRange.start + lastRange.count - 1)
    } catch (e) {
      console.error('[contrato-legal/descargar] Error en footer:', e)
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err: any) => reject(err))
      doc.end()
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Contrato_${d.numeroContrato}.pdf"`, 'Cache-Control': 'no-store' },
    })
  } catch (error: any) {
    console.error('[contrato-legal/descargar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
