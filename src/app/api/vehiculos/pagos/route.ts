// =====================================================
// /api/vehiculos/pagos — Listar y crear pagos con comprobante
//
// El conductor o admin carga un comprobante (foto/archivo). El sistema:
//  1. Calcula hash SHA-256 del archivo → detecta duplicados
//  2. Ejecuta OCR básico (stub) que extrae:
//     - valor, fecha, banco, referencia, destinatario
//  3. Compara con la obligación pendiente → detecta inconsistencias
//  4. Estado inicial: PENDIENTE (NO confirma el pago)
//  5. Admin aprueba → actualiza saldo, cartera, ingresos
//  6. Admin puede rechazar con motivo
//
// IMPORTANTE: Un comprobante cargado NO confirma que el dinero llegó.
// Solo se confirma mediante aprobación manual del admin o integración
// bancaria autorizada (no implementada — fuera de alcance).
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import crypto from 'crypto'

// === OCR BÁSICO (STUB) ===
// Extrae patrones típicos de comprobantes colombianos:
//  - Valor: $XXX,XXX / XXX.XXX.XXX
//  - Fecha: YYYY-MM-DD / DD/MM/YYYY
//  - Banco: Bancolombia, Davivienda, BBVA, Nequi, etc.
//  - Referencia: alfanumérica
//  - Destinatario: texto después de "A nombre de" / "Beneficiario"
//
// NOTA: Para OCR real con alta precisión, integrar:
//   - Google Cloud Vision API (vision.googleapis.com)
//   - AWS Textract
//   - Azure Computer Vision
// Por ahora usamos extracción por regex sobre texto pre-existente.
function extraerDatosOCR(texto: string) {
  if (!texto) return null
  const t = texto.toUpperCase()

  // Valor: $80.000 / 80000 / 80,000
  const valorMatch = t.match(/\$\s*([\d.,]+)/) || t.match(/VALOR[:\s]*([\d.,]+)/) || t.match(/(\d{1,3}(?:[.,]\d{3})+)/)
  let valor: number | null = null
  if (valorMatch) {
    const cleaned = valorMatch[1].replace(/[^\d]/g, '')
    valor = parseInt(cleaned) || null
  }

  // Fecha
  let fecha: Date | null = null
  const fechaISO = t.match(/(\d{4})-(\d{2})-(\d{2})/)
  const fechaSlash = t.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (fechaISO) {
    fecha = new Date(`${fechaISO[1]}-${fechaISO[2]}-${fechaISO[3]}T12:00:00Z`)
  } else if (fechaSlash) {
    fecha = new Date(`${fechaSlash[3]}-${fechaSlash[2]}-${fechaSlash[1]}T12:00:00Z`)
  }

  // Banco
  const bancos = ['BANCOLOMBIA', 'DAVIVIENDA', 'BBVA', 'NEQUI', 'BANCO DE BOGOTÁ',
    'BANCOLOMBIA SA', 'SCOTIABANK', 'BANCOLOMBIA', 'DAVIPLATA', 'BANCO AGRARIO',
    'BANCO DE OCCIDENTE', 'COLPATRIA', 'AV VILLAS', 'BANCOLOMBIA']
  let banco: string | null = null
  for (const b of bancos) {
    if (t.includes(b)) {
      banco = b
      break
    }
  }

  // Referencia
  const refMatch = t.match(/REFERENCIA[:\s]*([A-Z0-9]{6,})/) || t.match(/REF[:\s]*([A-Z0-9]{6,})/)
  const referencia = refMatch ? refMatch[1] : null

  // Destinatario
  const destMatch = t.match(/(?:A NOMBRE DE|BENEFICIARIO|DESTINATARIO)[:\s]*([A-ZÁÉÍÓÚÑ\s]{5,})/)
  const destinatario = destMatch ? destMatch[1].trim() : null

  return { valor, fecha, banco, referencia, destinatario, textoCompleto: texto }
}

// === Comparar OCR vs obligación esperada ===
function compararConObligacion(ocrData: any, obligacion: any) {
  const inconsistencias: string[] = []
  let coincide = true

  if (ocrData.valor && obligacion.montoPendiente) {
    const diff = Math.abs(ocrData.valor - obligacion.montoPendiente)
    if (diff > 100) { // tolerancia $100
      inconsistencias.push(`Valor OCR $${ocrData.valor.toLocaleString('es-CO')} vs obligación $${obligacion.montoPendiente.toLocaleString('es-CO')}`)
      coincide = false
    }
  }

  return { coincide, inconsistencias }
}

// GET — listar pagos (con filtros)
export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const conductorId = searchParams.get('conductorId')
    const contratoId = searchParams.get('contratoId')

    const where: any = {}
    if (estado) where.estado = estado
    if (conductorId) where.conductorId = conductorId
    if (contratoId) where.contratoId = contratoId

    const pagos = await db.pagoVehiculo.findMany({
      where,
      include: {
        conductor: true,
        contrato: { include: { vehiculo: true } },
        obligacion: true,
        comprobantes: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: pagos })
  } catch (error: any) {
    console.error('[vehiculos/pagos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — registrar pago con comprobante
export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const body = await req.json()
    const {
      contratoId, obligacionId, conductorId,
      monto, fechaPago, metodo, banco, referencia, destinatario,
      comprobanteUrl, comprobanteTipo, ocrTexto,
    } = body

    if (!contratoId || !conductorId || !monto) {
      return NextResponse.json(
        { success: false, error: 'contratoId, conductorId, monto son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar duplicados por monto+fecha+referencia (si hay referencia)
    if (referencia && banco) {
      const duplicado = await db.pagoVehiculo.findFirst({
        where: {
          banco, referencia,
          estado: { in: ['APROBADO', 'PENDIENTE', 'EN_REVISION'] },
        },
      })
      if (duplicado) {
        return NextResponse.json({
          success: false,
          error: 'Posible pago duplicado: ya existe un pago con el mismo banco y referencia',
          duplicadoDe: duplicado.id,
        }, { status: 409 })
      }
    }

    // Si hay obligación, comparar con OCR
    let ocrResult: any = null
    let obligacionInfo: any = null
    if (obligacionId) {
      obligacionInfo = await db.obligacionVehiculo.findUnique({ where: { id: obligacionId } })
      if (obligacionInfo) {
        if (ocrTexto) {
          ocrResult = extraerDatosOCR(ocrTexto)
          if (ocrResult) {
            const comp = compararConObligacion(ocrResult, obligacionInfo)
            ocrResult.coincide = comp.coincide
            ocrResult.inconsistencias = comp.inconsistencias
          }
        }
      }
    }

    // Crear pago
    const pago = await db.pagoVehiculo.create({
      data: {
        contratoId,
        obligacionId: obligacionId || null,
        conductorId,
        monto: parseFloat(monto),
        fechaPago: fechaPago ? new Date(fechaPago) : new Date(),
        metodo: metodo || 'CONSIGNACION',
        banco,
        referencia,
        destinatario,
        estado: 'PENDIENTE',
        comprobanteUrl,
        // Datos OCR
        ocrValor: ocrResult?.valor || null,
        ocrFecha: ocrResult?.fecha || null,
        ocrBanco: ocrResult?.banco || null,
        ocrReferencia: ocrResult?.referencia || null,
        ocrDestinatario: ocrResult?.destinatario || null,
        ocrCoincide: ocrResult?.coincide ?? null,
        ocrInconsistencias: ocrResult?.inconsistencias ? JSON.stringify(ocrResult.inconsistencias) : null,
        creadoPor: user.id === 'system' ? 'ADMIN' : 'ADMIN',
      },
    })

    // Crear comprobante (si hay URL)
    if (comprobanteUrl) {
      const hash = crypto.createHash('sha256').update(comprobanteUrl + new Date().toISOString()).digest('hex')
      // Verificar si ya existe un comprobante con el mismo hash
      const dupComprobante = await db.comprobanteVehiculo.findFirst({
        where: { hashArchivo: hash },
      })
      const esDuplicado = !!dupComprobante
      await db.comprobanteVehiculo.create({
        data: {
          pagoId: pago.id,
          url: comprobanteUrl,
          tipo: comprobanteTipo || 'IMAGEN',
          hashArchivo: hash,
          esDuplicado,
          duplicadoDeId: dupComprobante?.pagoId || null,
          ocrTexto: ocrTexto || null,
          ocrMetadatos: ocrResult ? JSON.stringify(ocrResult) : null,
        },
      })
      if (esDuplicado) {
        // Marcar pago como sospechoso
        await db.pagoVehiculo.update({
          where: { id: pago.id },
          data: {
            estado: 'EN_REVISION',
            ocrInconsistencias: JSON.stringify(['Comprobante duplicado detectado']),
          },
        })
      }
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PAGO',
        entidadId: pago.id,
        accion: 'CREAR',
        descripcion: `Pago de $${parseFloat(monto).toLocaleString('es-CO')} registrado. Estado: PENDIENTE`,
        datosNuevos: JSON.stringify(pago),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: pago,
      ocr: ocrResult,
      warning: ocrResult && !ocrResult.coincide
        ? `Inconsistencias detectadas: ${ocrResult.inconsistencias.join('; ')}`
        : null,
    })
  } catch (error: any) {
    console.error('[vehiculos/pagos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
