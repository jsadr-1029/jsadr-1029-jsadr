// =====================================================
// /api/vehiculos/contrato-legal/descargar?token=XXX
// Genera el PDF completo del contrato legal con todas las firmas
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import PDFDocument from 'pdfkit'

function fmtCOP(v: number | null | undefined): string {
  if (!v) return '$0'
  return '$' + v.toLocaleString('es-CO')
}
function fmtFechaCorta(f: Date | string | null | undefined): string {
  if (!f) return '____ / ____ / ________'
  const d = typeof f === 'string' ? new Date(f) : f
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}
function getImage(source: string | null | undefined): Buffer | null {
  if (!source) return null
  if (source.startsWith('data:')) {
    try { return Buffer.from(source.split(',')[1], 'base64') } catch { return null }
  }
  return null
}
function addImage(doc: any, source: string | null | undefined, x: number, y: number, maxW: number, maxH: number): number {
  const buf = getImage(source)
  if (!buf) return 0
  try { doc.image(buf, x, y, { fit: [maxW, maxH], align: 'center' }); return maxH + 5 } catch { return 0 }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })

    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { OR: [{ conductorToken: token }, { propietarioToken: token }] },
    })
    if (!documento) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })

    const d = {
      numeroContrato: documento.numeroContrato,
      vehiculo: { placa: documento.vehiculoPlaca, marca: documento.vehiculoMarca, modelo: documento.vehiculoModelo, anio: documento.vehiculoAnio, color: documento.vehiculoColor, kilometraje: documento.vehiculoKilometraje, vin: documento.vehiculoVin, motor: documento.vehiculoMotor },
      propietario: { nombre: documento.propietarioNombre, cedula: documento.propietarioCedula, telefono: documento.propietarioTelefono, email: documento.propietarioEmail, direccion: documento.propietarioDireccion },
      conductor: { nombre: documento.conductorNombre, cedula: documento.conductorCedula, telefono: documento.conductorTelefono, email: documento.conductorEmail, direccion: documento.conductorDireccion, licencia: documento.conductorLicencia, licenciaCat: documento.conductorLicenciaCat },
      terminos: { modalidadPago: documento.modalidadPago, tarifa: documento.tarifa, diasGracia: documento.diasGracia, multaDiaria: documento.multaDiaria, deposito: documento.deposito, fechaInicio: documento.fechaInicio, fechaFin: documento.fechaFin, descripcionVehiculo: documento.descripcionVehiculo },
      firmaConductor: { fotoCedulaFrente: documento.conductorFotoCedulaFrente, fotoCedulaReverso: documento.conductorFotoCedulaReverso, fotoSelfie: documento.conductorFotoSelfie, firmaManuscrita: documento.conductorFirmaManuscrita, otpValidado: documento.conductorOtpValidado, fechaFirma: documento.conductorFechaFirma, ip: documento.conductorIp, userAgent: documento.conductorUserAgent },
      firmaPropietario: { fotoCedulaFrente: documento.propietarioFotoCedulaFrente, fotoCedulaReverso: documento.propietarioFotoCedulaReverso, fotoSelfie: documento.propietarioFotoSelfie, firmaManuscrita: documento.propietarioFirmaManuscrita, otpValidado: documento.propietarioOtpValidado, fechaFirma: documento.propietarioFechaFirma, ip: documento.propietarioIp, userAgent: documento.propietarioUserAgent },
    }

    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
    const buffers: Buffer[] = []
    doc.on('data', b => buffers.push(b))
    const ancho = doc.page.width - 100
    let y = 50

    // Funciones helper
    function tablaSimple(titulos: string[], filas: (string | null)[][], colWidths: number[]) {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50 }
      let x = 50
      doc.fillColor('#1e3a8a')
      for (let i = 0; i < titulos.length; i++) { doc.rect(x, y, colWidths[i], 14).fill('#1e3a8a'); doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold'); doc.text(titulos[i], x + 2, y + 4, { width: colWidths[i] - 4 }); x += colWidths[i] }
      y += 14
      for (const fila of filas) {
        x = 50
        if (y > doc.page.height - 40) { doc.addPage(); y = 50 }
        for (let i = 0; i < fila.length; i++) { doc.rect(x, y, colWidths[i], 14).stroke('#ccc'); doc.fillColor('#000').fontSize(7).font('Helvetica'); doc.text(fila[i] || '—', x + 2, y + 4, { width: colWidths[i] - 4 }); x += colWidths[i] }
        y += 14
      }
      y += 10
    }
    function clausula(titulo: string, contenido: string) {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50 }
      if (titulo) { doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold'); doc.text(titulo, 50, y, { width: ancho }); y += 14 }
      doc.fillColor('#000').fontSize(8).font('Helvetica'); doc.text(contenido, 50, y, { width: ancho, align: 'justify' }); y += doc.heightOfString(contenido, { width: ancho, align: 'justify' }) + 8
    }
    function capitulo(titulo: string) {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50 }
      y += 10; doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold'); doc.text(titulo, 50, y, { width: ancho }); y += 20
    }

    // ENCABEZADO
    doc.fillColor('#1e3a8a').fontSize(16).font('Helvetica-Bold')
    doc.text('CONTRATO DE ARRENDAMIENTO DE VEHÍCULO AUTOMOTOR', 50, y, { align: 'center', width: ancho }); y += 20
    doc.fontSize(10).font('Helvetica'); doc.text('Uso, administración, obligaciones, garantías, control y restitución', 50, y, { align: 'center', width: ancho }); y += 15
    doc.fillColor('#666').fontSize(9); doc.text('DOCUMENTO CONTRACTUAL PRIVADO', 50, y, { align: 'center', width: ancho }); y += 12
    doc.text(`Código: CAV-001  |  Versión: 2.0  |  Lugar: Medellín  |  Fecha: ${fmtFechaCorta(new Date())}`, 50, y, { align: 'center', width: ancho }); y += 20

    // TABLA IDENTIFICACIÓN
    tablaSimple(['CAMPO', 'INFO', 'CAMPO', 'INFO'], [
      ['Contrato', d.numeroContrato, 'Placa', d.vehiculo.placa],
      ['Arrendador', d.propietario.nombre, 'Arrendatario', d.conductor.nombre],
      ['Inicio', fmtFechaCorta(d.terminos.fechaInicio), 'Terminación', d.terminos.fechaFin ? fmtFechaCorta(d.terminos.fechaFin) : 'Indefinida'],
      ['Canon', fmtCOP(d.terminos.tarifa), 'Periodicidad', d.terminos.modalidadPago],
    ], [80, 215, 80, 215])

    // CAPÍTULOS I-XII
    capitulo('CAPÍTULO I. IDENTIFICACIÓN Y CAPACIDAD DE LAS PARTES')
    clausula('CLÁUSULA 1. ARRENDADOR', `EL ARRENDADOR: ${d.propietario.nombre}, identificado con ${d.propietario.cedula}, domicilio ${d.propietario.direccion || '—'}, teléfono ${d.propietario.telefono || '—'}, email ${d.propietario.email || '—'}. Actúa como propietario inscrito del vehículo.`)
    clausula('CLÁUSULA 2. ARRENDATARIO', `EL ARRENDATARIO: ${d.conductor.nombre}, identificado con CC ${d.conductor.cedula}, residencia ${d.conductor.direccion || '—'}, teléfono ${d.conductor.telefono}, email ${d.conductor.email || '—'}. Licencia ${d.conductor.licenciaCat || '—'} ${d.conductor.licencia || ''}.`)
    clausula('CLÁUSULA 3. DECLARACIONES PREVIAS', 'Las partes declaran que los datos son veraces, comprenden la naturaleza temporal del arrendamiento, el contrato no transfiere propiedad, y las modificaciones deben documentarse verificablemente.')

    capitulo('CAPÍTULO II. OBJETO, IDENTIFICACIÓN Y DESTINACIÓN DEL VEHÍCULO')
    clausula('CLÁUSULA 4. VEHÍCULO', `Marca: ${d.vehiculo.marca}, Modelo: ${d.vehiculo.modelo}, Año: ${d.vehiculo.anio}, Placa: ${d.vehiculo.placa}, Color: ${d.vehiculo.color}, Motor: ${d.vehiculo.motor || '—'}, VIN: ${d.vehiculo.vin || '—'}, Km: ${(d.vehiculo.kilometraje || 0).toLocaleString('es-CO')}.`)
    clausula('CLÁUSULA 5. OBJETO', 'EL ARRENDADOR concede el uso temporal del vehículo. EL ARRENDATARIO no adquiere propiedad ni facultad para venderlo, gravarlo o subarrendarlo.')
    clausula('CLÁUSULA 6. DESTINACIÓN', 'Uso particular y comercial autorizado. EL ARRENDATARIO no podrá modificar la destinación sin autorización.')
    clausula('CLÁUSULA 7. PLAZO', `Inicio: ${fmtFechaCorta(d.terminos.fechaInicio)}. Terminación: ${d.terminos.fechaFin ? fmtFechaCorta(d.terminos.fechaFin) : 'Indefinida'}.`)
    clausula('CLÁUSULA 8. ESTADO', 'El estado se documenta en el Anexo 1. Acta de entrega e inventario.')

    capitulo('CAPÍTULO III. PRECIO, PAGOS Y GARANTÍAS')
    clausula('CLÁUSULA 9. CANON', `Valor: ${fmtCOP(d.terminos.tarifa)}. Periodicidad: ${d.terminos.modalidadPago}. Días de gracia: ${d.terminos.diasGracia}. Multa: ${fmtCOP(d.terminos.multaDiaria)}/día.`)
    clausula('CLÁUSULA 10. REGISTRO DE PAGOS', 'Las partes conservarán comprobantes. EL ARRENDADOR entregará constancia.')
    clausula('CLÁUSULA 11. MORA', 'EL ARRENDATARIO debe pagar en fecha. El retraso generará la multa pactada.')
    clausula('CLÁUSULA 12. DEPÓSITO', `Valor: ${fmtCOP(d.terminos.deposito)}. Devolución: 30 días tras restitución.`)

    capitulo('CAPÍTULO IV. OBLIGACIONES Y RESTRICCIONES')
    clausula('CLÁUSULA 13. OBLIGACIONES ARRENDADOR', '1. Entregar vehículo. 2. Informar defectos. 3. Cumplir mantenimiento. 4. Recibir pagos. 5. Gestionar reclamaciones.')
    clausula('CLÁUSULA 14. OBLIGACIONES ARRENDATARIO', '1. Pagar canon. 2. Usar para destinación autorizada. 3. Mantener habilitaciones. 4. Custodiar vehículo. 5. Cumplir tránsito. 6. Informar accidentes. 7. No subarrendar.')
    clausula('CLÁUSULA 15. CONDUCTORES AUTORIZADOS', 'Solo personas autorizadas por EL ARRENDADOR.')
    clausula('CLÁUSULA 16. PROHIBICIONES', 'No subarrendar, no ilícitos, no alcohol, no alterar sistemas.')

    capitulo('CAPÍTULO V. MANTENIMIENTO, GASTOS Y DAÑOS')
    clausula('CLÁUSULA 17. DISTRIBUCIÓN DE GASTOS', 'Combustible, peajes, parqueaderos: Arrendatario. Mantenimiento, aceite, llantas: Arrendador.')
    clausula('CLÁUSULA 18. MANTENIMIENTO Y FALLAS', 'Informar oportunamente. Sin aprobación para alto costo.')
    clausula('CLÁUSULA 19. DAÑOS', 'Responsabilidad según estado inicial, final y pruebas.')
    clausula('CLÁUSULA 20. COBROS SIN SOPORTE', 'Sin soporte no se puede exigir deuda.')

    capitulo('CAPÍTULO VI. SEGUROS, ACCIDENTES E INMOVILIZACIÓN')
    clausula('CLÁUSULA 21. SEGUROS', 'Verificar SOAT, tecnomecánica y póliza. Compatibilidad con uso.')
    clausula('CLÁUSULA 22. ACCIDENTES', 'Priorizar vida, informar autoridades, notificar arrendador, conservar pruebas.')
    clausula('CLÁUSULA 23. INMOVILIZACIÓN', 'Informar autoridad, motivo, lugar, comparendo y gastos.')

    capitulo('CAPÍTULO VII. COMPARENDOS Y FOTODETECCIONES')
    clausula('CLÁUSULA 24. COLABORACIÓN', 'Responder solicitudes en 2 días hábiles.')
    clausula('CLÁUSULA 25. PROCEDIMIENTO FOTODETECCIONES', 'Identificar, recopilar pruebas, actuar ante autoridad.')
    clausula('CLÁUSULA 26. ALCANCE JURÍDICO', 'No transfiere automáticamente sanciones. Ley 769/2002, Ley 1843/2017, Sentencia C-038/2020.')
    clausula('CLÁUSULA 27. INCUMPLIMIENTO DE COLABORACIÓN', 'Si incumple y causa perjuicio, se reclama.')

    capitulo('CAPÍTULO VIII. INSPECCIÓN, LOCALIZACIÓN Y DATOS')
    clausula('CLÁUSULA 28. INSPECCIÓN', 'Inspecciones razonables y coordinadas.')
    clausula('CLÁUSULA 29. LOCALIZACIÓN', 'GPS informado. Uso legítimo.')
    clausula('CLÁUSULA 30. DATOS PERSONALES', 'Ley 1581 de 2012. Finalidades legítimas.')

    capitulo('CAPÍTULO IX. TERMINACIÓN Y RESTITUCIÓN')
    clausula('CLÁUSULA 31. CAUSALES', 'Vencimiento, mutuo acuerdo, incumplimiento, pérdida total.')
    clausula('CLÁUSULA 32. PREAVISO', 'Según modalidad y legislación.')
    clausula('CLÁUSULA 33. RESTITUCIÓN', 'Devolver con llaves, documentos y accesorios. Acta de devolución.')
    clausula('CLÁUSULA 34. LIQUIDACIÓN', 'Cánones, gastos, daños, depósito y saldo.')

    capitulo('CAPÍTULO X. INCUMPLIMIENTO, RECLAMACIONES Y COBRO')
    clausula('CLÁUSULA 35. REQUERIMIENTO', 'Identificar obligación, describir hechos, conservar soportes.')
    clausula('CLÁUSULA 36. PERJUICIOS', 'Acreditar presupuestos legales.')
    clausula('CLÁUSULA 37. CLÁUSULA PENAL', `Mora: ${fmtCOP(d.terminos.multaDiaria)} por cada día de retraso.`)
    clausula('CLÁUSULA 38. COBRO', 'Mecanismos legales. Requisitos de ejecución.')

    capitulo('CAPÍTULO XI. COMUNICACIONES Y DISPOSICIONES FINALES')
    clausula('CLÁUSULA 39. NOTIFICACIONES', 'Datos del capítulo identificación.')
    clausula('CLÁUSULA 40. MODIFICACIONES', 'Por escrito con aceptación.')
    clausula('CLÁUSULA 41. INTEGRIDAD', 'Disposiciones separables.')
    clausula('CLÁUSULA 42. LEGISLACIÓN', 'Leyes de Colombia. Conciliación o autoridad judicial.')

    // CAPÍTULO XII — FIRMAS
    capitulo('CAPÍTULO XII. ACEPTACIÓN Y FIRMA')
    clausula('', 'Las partes manifiestan que han leído y comprendido el contrato, y firman libremente, sin perjuicio de los derechos previstos por la ley.')

    if (y > doc.page.height - 60) { doc.addPage(); y = 50 }
    doc.fillColor('#000').fontSize(9).font('Helvetica-Bold')
    doc.text(`Ciudad: Medellín    Fecha: ${fmtFechaCorta(new Date())}`, 50, y, { width: ancho }); y += 25

    // FIRMA CONDUCTOR
    if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
    doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold'); doc.text('EL ARRENDATARIO (CONDUCTOR)', 50, y); y += 18
    const h1 = Math.max(addImage(doc, d.firmaConductor.fotoCedulaFrente, 50, y, 150, 100), addImage(doc, d.firmaConductor.fotoCedulaReverso, 210, y, 150, 100), addImage(doc, d.firmaConductor.fotoSelfie, 370, y, 150, 100))
    if (h1 > 0) y += h1 + 8
    const h2 = addImage(doc, d.firmaConductor.firmaManuscrita, 50, y, 250, 80)
    if (h2 > 0) y += h2 + 5
    doc.fillColor('#666').fontSize(7).font('Helvetica')
    doc.text(`Nombre: ${d.conductor.nombre}    CC: ${d.conductor.cedula}    Fecha: ${d.firmaConductor.fechaFirma ? fmtFechaCorta(d.firmaConductor.fechaFirma) : '—'}`, 50, y); y += 10
    doc.text(`IP: ${d.firmaConductor.ip || '—'}    OTP: ${d.firmaConductor.otpValidado ? 'Sí' : 'No'}`, 50, y); y += 20

    // FIRMA PROPIETARIO
    if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
    doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold'); doc.text('EL ARRENDADOR (PROPIETARIO)', 50, y); y += 18
    const h3 = Math.max(addImage(doc, d.firmaPropietario.fotoCedulaFrente, 50, y, 150, 100), addImage(doc, d.firmaPropietario.fotoCedulaReverso, 210, y, 150, 100), addImage(doc, d.firmaPropietario.fotoSelfie, 370, y, 150, 100))
    if (h3 > 0) y += h3 + 8
    const h4 = addImage(doc, d.firmaPropietario.firmaManuscrita, 50, y, 250, 80)
    if (h4 > 0) y += h4 + 5
    doc.fillColor('#666').fontSize(7).font('Helvetica')
    doc.text(`Nombre: ${d.propietario.nombre}    Doc: ${d.propietario.cedula}    Fecha: ${d.firmaPropietario.fechaFirma ? fmtFechaCorta(d.firmaPropietario.fechaFirma) : '—'}`, 50, y); y += 10
    doc.text(`IP: ${d.firmaPropietario.ip || '—'}    OTP: ${d.firmaPropietario.otpValidado ? 'Sí' : 'No'}`, 50, y); y += 20

    // ANEXOS
    capitulo('ANEXO 1. ACTA DE ENTREGA, INVENTARIO Y DEVOLUCIÓN')
    tablaSimple(['DATO', 'INFORMACIÓN'], [['Fecha', fmtFechaCorta(d.terminos.fechaInicio)], ['Kilometraje', `${(d.vehiculo.kilometraje || 0).toLocaleString('es-CO')} km`], ['Marca', d.vehiculo.marca], ['Modelo', d.vehiculo.modelo], ['Placa', d.vehiculo.placa], ['Color', d.vehiculo.color || '—'], ['VIN', d.vehiculo.vin || '—'], ['Motor', d.vehiculo.motor || '—']], [180, ancho - 180])

    capitulo('ANEXO 2. REGISTRO DE CONDUCTORES AUTORIZADOS')
    tablaSimple(['N°', 'NOMBRE', 'DOCUMENTO', 'LICENCIA', 'CAT'], [['1', d.conductor.nombre, d.conductor.cedula, d.conductor.licencia || '—', d.conductor.licenciaCat || '—']], [30, 150, 100, 120, 100])

    capitulo('ANEXO 3. REGISTRO DE PAGOS E INCIDENCIAS')
    clausula('', `Canon: ${fmtCOP(d.terminos.tarifa)} / ${d.terminos.modalidadPago}. Multa: ${fmtCOP(d.terminos.multaDiaria)}/día. Depósito: ${fmtCOP(d.terminos.deposito)}.`)

    capitulo('ANEXO 4. CONTROL DE VENCIMIENTO Y TERMINACIÓN')
    tablaSimple(['CONTROL', 'INFORMACIÓN'], [['Inicio', fmtFechaCorta(d.terminos.fechaInicio)], ['Terminación', d.terminos.fechaFin ? fmtFechaCorta(d.terminos.fechaFin) : 'Indefinida'], ['Modalidad', d.terminos.modalidadPago], ['Estado', 'Pendiente']], [180, ancho - 180])

    // Footer — FIX: usar range.start para evitar switchToPage out of bounds
    try {
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc.fillColor('#999').fontSize(7).font('Helvetica')
        doc.text(`Contrato ${d.numeroContrato} - Placa ${d.vehiculo.placa} - Página ${i - range.start + 1} de ${range.count}`, 50, doc.page.height - 25, { align: 'center', width: ancho })
      }
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
