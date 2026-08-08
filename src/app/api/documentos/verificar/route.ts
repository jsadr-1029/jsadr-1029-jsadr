// =====================================================
// /api/documentos/verificar — Verificación de autenticidad
// -----------------------------------------------------
// Valida que un documento (pagaré/carta) es auténtico
// mediante un código de verificación único.
//
// Acepta TRES formatos de código:
//   1. Código guardado en préstamo.tycToken (formato legacy)
//   2. Código derivado del hash SHA-256 de la firma
//      (formato usado por el certificado de firma electrónica):
//        codigoVer = sha256(firmaId + '|' + createdAt + '|certificado')
//                    .substring(0,4) + '-' + .substring(4,8) + '-' + ...
//   3. Código derivado del hash SHA-256 del préstamo + tipoDoc
//      (formato usado por el QR del pagaré/carta de instrucciones):
//        codigoVer = sha256(prestamoId + '|' + tipoDoc + '|' + codigo + '|' + montoPrincipal + '|' + createdAt)
//                    .substring(0,4) + '-' + .substring(4,8) + '-' + ...
//      donde tipoDoc ∈ {pagare-blanco, pagare-diligenciado, carta}
//
// Si el código no matchea ninguno, devuelve 404 + autentico:false.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import crypto from 'crypto'

// Tipos de documento que pueden generar código QR en /api/documentos
const TIPOS_DOC_QR = ['pagare-blanco', 'pagare-diligenciado', 'carta'] as const

// Función helper que replica exactamente generarCodigoVerificacion() de /api/documentos/route.ts
function generarCodigoDoc(prestamo: { id: string; codigo: string; montoPrincipal: number; createdAt: Date }, tipoDoc: string): string {
  const data = `${prestamo.id}|${tipoDoc}|${prestamo.codigo}|${prestamo.montoPrincipal}|${prestamo.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}

// GET /api/documentos/verificar?codigo=XXXX-XXXX-XXXX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo')?.trim().toLowerCase()

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
          tipoDocumento: 'Términos y Condiciones',
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

    // === Intento 2: buscar por hash de préstamo + tipoDoc (formato pagaré/carta) ===
    // Este es el formato que usa el QR que se imprime en el pagaré diligenciado,
    // pagaré en blanco y carta de instrucciones.
    //
    // El código se genera así:
    //   sha256(prestamoId + '|' + tipoDoc + '|' + prestamo.codigo + '|' + montoPrincipal + '|' + createdAtISO)
    //   y se toman los primeros 16 hex en 4 grupos de 4 separados por '-'
    //
    // Iteramos todos los préstamos y comparamos el código generado para cada tipoDoc.
    // Traemos createdAt incluido en la consulta para poder regenerar el hash.
    const prestamosParaQR = await db.prestamo.findMany({
      select: {
        id: true,
        codigo: true,
        montoPrincipal: true,
        createdAt: true,
        estado: true,
        fechaSolicitud: true,
        cliente: { select: { nombre: true, cedula: true } },
        firmas: {
          where: { estadoFirma: 'COMPLETADA' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, fechaFirmaCompleta: true, createdAt: true, otpCanal: true, ipFirma: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000, // límite razonable
    })

    for (const prestamo of prestamosParaQR) {
      for (const tipoDoc of TIPOS_DOC_QR) {
        const codigoEsperado = generarCodigoDoc(prestamo, tipoDoc).toLowerCase()
        if (codigoEsperado === codigo) {
          // Match — el código es del préstamo para este tipoDoc
          const firma = prestamo.firmas?.[0] || null
          const tipoDocLabel =
            tipoDoc === 'pagare-blanco' ? 'Pagaré en Blanco' :
            tipoDoc === 'pagare-diligenciado' ? 'Pagaré Diligenciado' :
            'Carta de Instrucciones'
          return NextResponse.json({
            success: true,
            autentico: true,
            data: {
              tipoCodigo: 'PRESTAMO_DOC_HASH_SHA256',
              tipoDocumento: tipoDocLabel,
              codigoPrestamo: prestamo.codigo,
              estado: prestamo.estado,
              deudor: prestamo.cliente?.nombre || 'No disponible',
              cedula: prestamo.cliente?.cedula || 'No disponible',
              monto: prestamo.montoPrincipal,
              fechaSolicitud: prestamo.fechaSolicitud,
              tieneFirmaElectronica: !!firma,
              fechaFirma: firma?.fechaFirmaCompleta || firma?.createdAt || null,
              canalOTP: firma?.otpCanal || null,
              ipFirma: firma?.ipFirma || null,
              verificadoEn: new Date().toISOString(),
            },
            mensaje: `✅ Documento auténtico verificado correctamente. El código QR del documento "${tipoDocLabel}" coincide con los registros del sistema Jsadr.`,
          })
        }
      }
    }

    // === Intento 3: buscar por hash de firma (formato certificado de firma) ===
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

      if (codigoEsperado.toLowerCase() === codigo) {
        // Match — el código es de esta firma
        const cliente = firma.cliente || firma.prestamo?.cliente
        const prestamo = firma.prestamo
        return NextResponse.json({
          success: true,
          autentico: true,
          data: {
            tipoCodigo: 'FIRMA_HASH_SHA256',
            tipoDocumento: 'Certificado de Firma Electrónica',
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
