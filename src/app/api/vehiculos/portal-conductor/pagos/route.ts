// =====================================================
// /api/vehiculos/portal-conductor/pagos
// El conductor reporta un pago (sube comprobante).
// Estado inicial: PENDIENTE — debe ser aprobado por admin.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

function extraerDatosOCR(texto: string) {
  if (!texto) return null
  const t = texto.toUpperCase()

  const valorMatch = t.match(/\$\s*([\d.,]+)/) || t.match(/VALOR[:\s]*([\d.,]+)/)
  let valor: number | null = null
  if (valorMatch) {
    const cleaned = valorMatch[1].replace(/[^\d]/g, '')
    valor = parseInt(cleaned) || null
  }

  let fecha: Date | null = null
  const fechaISO = t.match(/(\d{4})-(\d{2})-(\d{2})/)
  const fechaSlash = t.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (fechaISO) {
    fecha = new Date(`${fechaISO[1]}-${fechaISO[2]}-${fechaISO[3]}T12:00:00Z`)
  } else if (fechaSlash) {
    fecha = new Date(`${fechaSlash[3]}-${fechaSlash[2]}-${fechaSlash[1]}T12:00:00Z`)
  }

  const bancos = ['BANCOLOMBIA', 'DAVIVIENDA', 'BBVA', 'NEQUI', 'BANCO DE BOGOTÁ', 'DAVIPLATA']
  let banco: string | null = null
  for (const b of bancos) {
    if (t.includes(b)) {
      banco = b
      break
    }
  }

  const refMatch = t.match(/REFERENCIA[:\s]*([A-Z0-9]{6,})/)
  const referencia = refMatch ? refMatch[1] : null

  const destMatch = t.match(/(?:A NOMBRE DE|BENEFICIARIO)[:\s]*([A-ZÁÉÍÓÚÑ\s]{5,})/)
  const destinatario = destMatch ? destMatch[1].trim() : null

  return { valor, fecha, banco, referencia, destinatario }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }

    const conductor = await db.conductorVehiculo.findFirst({
      where: {
        tokenSesion: token,
        tokenExpira: { gt: new Date() },
        activo: true,
      },
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
          take: 1,
        },
      },
    })

    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    const contrato = conductor.contratos[0]
    if (!contrato) {
      return NextResponse.json({ success: false, error: 'No tienes contrato activo' }, { status: 400 })
    }

    const body = await req.json()
    const {
      obligacionId, monto, fechaPago, metodo,
      banco, referencia, destinatario,
      comprobanteUrl, comprobanteTipo, ocrTexto,
    } = body

    if (!monto || !fechaPago) {
      return NextResponse.json(
        { success: false, error: 'monto y fechaPago son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar duplicados
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
        }, { status: 409 })
      }
    }

    // OCR
    let ocrResult: any = null
    if (ocrTexto) {
      ocrResult = extraerDatosOCR(ocrTexto)
    }

    // Crear pago
    const pago = await db.pagoVehiculo.create({
      data: {
        contratoId: contrato.id,
        obligacionId: obligacionId || null,
        conductorId: conductor.id,
        monto: parseFloat(monto),
        fechaPago: new Date(fechaPago),
        metodo: metodo || 'CONSIGNACION',
        banco,
        referencia,
        destinatario,
        estado: 'PENDIENTE',
        comprobanteUrl,
        ocrValor: ocrResult?.valor || null,
        ocrFecha: ocrResult?.fecha || null,
        ocrBanco: ocrResult?.banco || null,
        ocrReferencia: ocrResult?.referencia || null,
        ocrDestinatario: ocrResult?.destinatario || null,
        creadoPor: 'CONDUCTOR',
      },
    })

    // Crear comprobante
    if (comprobanteUrl) {
      const hash = crypto.createHash('sha256').update(comprobanteUrl + new Date().toISOString()).digest('hex')
      const dupComprobante = await db.comprobanteVehiculo.findFirst({
        where: { hashArchivo: hash },
      })
      await db.comprobanteVehiculo.create({
        data: {
          pagoId: pago.id,
          url: comprobanteUrl,
          tipo: comprobanteTipo || 'IMAGEN',
          hashArchivo: hash,
          esDuplicado: !!dupComprobante,
          duplicadoDeId: dupComprobante?.pagoId || null,
          ocrTexto: ocrTexto || null,
          ocrMetadatos: ocrResult ? JSON.stringify(ocrResult) : null,
        },
      })
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PAGO',
        entidadId: pago.id,
        accion: 'CREAR',
        descripcion: `Pago de $${parseFloat(monto).toLocaleString('es-CO')} reportado por conductor ${conductor.nombre} (${conductor.cedula}). Estado: PENDIENTE`,
        datosNuevos: JSON.stringify(pago),
        usuarioId: conductor.id,
        usuarioNombre: `${conductor.nombre} (CONDUCTOR)`,
      },
    })

    return NextResponse.json({
      success: true,
      data: pago,
      message: 'Pago reportado. Pendiente de verificación por el administrador.',
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/pagos] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Listar pagos del conductor
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }

    const conductor = await db.conductorVehiculo.findFirst({
      where: {
        tokenSesion: token,
        tokenExpira: { gt: new Date() },
        activo: true,
      },
    })

    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    const pagos = await db.pagoVehiculo.findMany({
      where: { conductorId: conductor.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ success: true, data: pagos })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/pagos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
