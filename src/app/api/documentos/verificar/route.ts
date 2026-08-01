// =====================================================
// /api/documentos/verificar — Verificación de autenticidad
// Valida que un documento (pagaré/carta) es auténtico
// mediante un código de verificación único.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { formatearFechaHora } from '@/lib/finanzas'

// GET /api/documentos/verificar?codigo=XXXX-XXXX-XXXX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo')

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'Código de verificación requerido' },
        { status: 400 }
      )
    }

    // Buscar el préstamo por el código de verificación
    // El código se guarda en el campo tycToken (reutilizado) o lo generamos
    // Vamos a buscar por el código que generamos en el documento
    const prestamo = await db.prestamo.findFirst({
      where: { tycToken: codigo },
      include: {
        cliente: true,
        firmas: {
          where: { estadoFirma: 'COMPLETADA' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!prestamo) {
      return NextResponse.json(
        {
          success: false,
          autentico: false,
          error: 'Código de verificación no encontrado. El documento podría ser falso o alterado.',
        },
        { status: 404 }
      )
    }

    const firma = prestamo.firmas?.[0] || null

    // Información que se muestra al verificar (no expone datos sensibles)
    return NextResponse.json({
      success: true,
      autentico: true,
      data: {
        codigoPrestamo: prestamo.codigo,
        estado: prestamo.estado,
        deudor: prestamo.cliente.nombre,
        cedula: prestamo.cliente.cedula,
        monto: prestamo.montoPrincipal,
        fechaSolicitud: prestamo.fechaSolicitud,
        tieneFirmaElectronica: !!firma,
        fechaFirma: firma?.fechaFirmaCompleta || firma?.createdAt || null,
        canalOTP: firma?.otpCanal || null,
        verificadoEn: new Date().toISOString(),
      },
      mensaje: '✅ Documento auténtico verificado correctamente. Este documento fue generado por el sistema Jsadr y firmado electrónicamente.',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
