// =====================================================
// /api/documentos/verificar — Verificación de autenticidad
// -----------------------------------------------------
// Valida que un documento (pagaré/carta) es auténtico
// mediante un código de verificación único.
//
// Acepta DOS formatos de código:
//   1. Código guardado en préstamo.tycToken (formato legacy)
//   2. Código derivado del hash SHA-256 de la firma
//      (formato usado por el certificado de firma electrónica):
//        codigoVer = sha256(firmaId + '|' + createdAt + '|certificado')
//                    .substring(0,4) + '-' + .substring(4,8) + '-' + ...
//
// Si el código no matchea ninguno, devuelve 404 + autentico:false.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import crypto from 'crypto'

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

    // === Intento 1: buscar por préstamo.tycToken (formato legacy) ===
    const prestamoLegacy = await db.prestamo.findFirst({
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

    if (prestamoLegacy) {
      const firma = prestamoLegacy.firmas?.[0] || null
      return NextResponse.json({
        success: true,
        autentico: true,
        data: {
          tipoCodigo: 'PRESTAMO_TYC_TOKEN',
          codigoPrestamo: prestamoLegacy.codigo,
          estado: prestamoLegacy.estado,
          deudor: prestamoLegacy.cliente.nombre,
          cedula: prestamoLegacy.cliente.cedula,
          monto: prestamoLegacy.montoPrincipal,
          fechaSolicitud: prestamoLegacy.fechaSolicitud,
          tieneFirmaElectronica: !!firma,
          fechaFirma: firma?.fechaFirmaCompleta || firma?.createdAt || null,
          canalOTP: firma?.otpCanal || null,
          verificadoEn: new Date().toISOString(),
        },
        mensaje: '✅ Documento auténtico verificado correctamente. Este documento fue generado por el sistema Jsadr y firmado electrónicamente.',
      })
    }

    // === Intento 2: buscar por hash de firma (formato certificado) ===
    // El código del certificado se genera así:
    //   sha256(firmaId + '|' + createdAt.toISOString() + '|certificado')
    //   y se toman los primeros 16 hex en 4 grupos de 4 separados por '-'
    //
    // Como no podemos buscar "por hash" en SQL, iteramos las firmas
    // COMPLETADAS y comparamos el código generado. Es O(n) pero el
    // volumen de firmas es bajo (<1000).
    const firmasCompletadas = await db.firmaElectronica.findMany({
      where: { estadoFirma: 'COMPLETADA' },
      include: {
        cliente: true,
        prestamo: { include: { cliente: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // límite razonable para evitar DoS
    })

    for (const firma of firmasCompletadas) {
      const hash = crypto
        .createHash('sha256')
        .update(firma.id + '|' + firma.createdAt.toISOString() + '|certificado')
        .digest('hex')
      const codigoEsperado =
        hash.substring(0, 4) + '-' +
        hash.substring(4, 8) + '-' +
        hash.substring(8, 12) + '-' +
        hash.substring(12, 16)

      if (codigoEsperado === codigo) {
        // Match — el código es de esta firma
        const cliente = firma.cliente || firma.prestamo?.cliente
        const prestamo = firma.prestamo
        return NextResponse.json({
          success: true,
          autentico: true,
          data: {
            tipoCodigo: 'FIRMA_HASH_SHA256',
            firmaId: firma.id,
            codigoPrestamo: prestamo?.codigo || null,
            estado: prestamo?.estado || null,
            deudor: cliente?.nombre || 'No disponible',
            cedula: cliente?.cedula || 'No disponible',
            monto: prestamo?.montoPrincipal || null,
            fechaSolicitud: prestamo?.fechaSolicitud || null,
            tieneFirmaElectronica: true,
            fechaFirma: firma.fechaFirmaCompleta || firma.createdAt,
            canalOTP: firma.otpCanal || null,
            ipFirma: firma.ipFirma || null,
            verificadoEn: new Date().toISOString(),
          },
          mensaje: '✅ Documento auténtico verificado correctamente. El código QR del certificado de firma electrónica coincide con los registros del sistema Jsadr.',
        })
      }
    }

    // === No matcheó ningún formato ===
    return NextResponse.json(
      {
        success: false,
        autentico: false,
        error: 'Código de verificación no encontrado. El documento podría ser falso o alterado.',
        codigoRecibido: codigo,
      },
      { status: 404 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
