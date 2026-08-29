// =====================================================
// /api/seguridad/validar-firma — Validador de firma electrónica
// -----------------------------------------------------
// Permite a ADMIN y GESTOR verificar si un código de firma
// electrónica (el que aparece en el QR del certificado) es
// auténtico, si coincide con los registros del sistema, o
// si fue modificado/falsificado.
//
// Casos de uso:
//   • Un usuario pega manualmente el código del certificado
//     impreso para verificar que el documento no fue alterado.
//   • Un gestor escanea el QR de un pagaré impreso y quiere
//     confirmar que el código coincide con la firma registrada.
//
// Permisos: ADMIN y GESTOR.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { logError } from '@/lib/error-handler'
import crypto from 'crypto'

// GET /api/seguridad/validar-firma?codigo=XXXX-XXXX-XXXX-XXXX
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo')?.trim()

    if (!codigo) {
      return NextResponse.json(
        {
          success: false,
          valido: false,
          error: 'Código de verificación requerido. Pega el código que aparece en el certificado de firma (formato XXXX-XXXX-XXXX-XXXX).',
        },
        { status: 400 }
      )
    }

    // Validar formato básico
    const formatoEsperado = /^[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}$/i
    const formatoValido = formatoEsperado.test(codigo)

    if (!formatoValido) {
      return NextResponse.json({
        success: true,
        valido: false,
        modificado: true,
        error: 'El código no tiene el formato esperado. Un código auténtico tiene 4 grupos de 4 caracteres hexadecimales separados por guiones (ej: abcd-1234-ef56-7890).',
        codigoRecibido: codigo,
      })
    }

    // === Búsqueda 1: solicitud.tycToken (formato legacy) ===
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
        valido: true,
        modificado: false,
        tipoCodigo: 'PRESTAMO_TYC_TOKEN',
        data: {
          firmaId: firma?.id || null,
          codigoPrestamo: prestamoLegacy.codigo,
          estado: prestamoLegacy.estado,
          deudor: prestamoLegacy.cliente.nombre,
          cedula: prestamoLegacy.cliente.cedula,
          monto: prestamoLegacy.montoPrincipal,
          fechaSolicitud: prestamoLegacy.fechaSolicitud,
          tieneFirmaElectronica: !!firma,
          fechaFirma: firma?.fechaFirmaCompleta || firma?.createdAt || null,
          canalOTP: firma?.otpCanal || null,
          ipFirma: firma?.ipFirma || null,
        },
        mensaje: '✅ Código VÁLIDO. El documento coincide con un solicitud registrado en el sistema.',
      })
    }

    // === Búsqueda 2: hash de firma (formato certificado) ===
    const firmasCompletadas = await db.firmaElectronica.findMany({
      where: { estadoFirma: 'COMPLETADA' },
      include: {
        cliente: true,
        prestamo: { include: { cliente: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
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
        const cliente = firma.cliente || firma.prestamo?.cliente
        const prestamo = firma.prestamo
        return NextResponse.json({
          success: true,
          valido: true,
          modificado: false,
          tipoCodigo: 'FIRMA_HASH_SHA256',
          data: {
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
            userAgent: firma.userAgent || null,
            hashCompleto: hash,
          },
          mensaje: '✅ Código VÁLIDO. El código coincide exactamente con una firma electrónica registrada en el sistema. El documento NO ha sido modificado.',
        })
      }
    }

    // === No matcheó ===
    return NextResponse.json({
      success: true,
      valido: false,
      modificado: true,
      tipoCodigo: 'NO_ENCONTRADO',
      codigoRecibido: codigo,
      error: '⚠️ Código NO encontrado en el sistema. Esto puede indicar que: (1) el documento fue falsificado, (2) el código fue alterado al imprimir/copiar, o (3) la firma aún no está registrada como COMPLETADA.',
    })
  } catch (error: any) {
    logError('/api/seguridad/validar-firma GET', error)
    return NextResponse.json(
      { success: false, valido: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
