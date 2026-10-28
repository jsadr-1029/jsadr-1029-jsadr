// =====================================================
// /api/vehiculos/seed-enviar-correos-contrato
// Endpoint público temporal que envía los correos de firma del contrato
// legal CTR-20261028-000001 a las dos partes (conductor y propietario).
//
// Ejecutar una sola vez y luego se puede eliminar.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email'
import { buildAbsoluteUrl } from '@/lib/url'

const NUMERO_CONTRATO = 'CTR-20261028-000001'

export async function POST(req: NextRequest) {
  try {
    // Buscar el documento legal
    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { numeroContrato: NUMERO_CONTRATO },
    })
    if (!documento) {
      return NextResponse.json({ success: false, error: 'Documento legal no encontrado' }, { status: 404 })
    }

    const resultados: any = { conductor: null, propietario: null }

    // === 1. Enviar correo al CONDUCTOR ===
    if (documento.conductorToken && documento.conductorEmail) {
      const linkFirma = buildAbsoluteUrl(`/firma-contrato-vehiculo/${documento.conductorToken}`)
      try {
        await enviarEmail({
          to: documento.conductorEmail,
          subject: `Contrato de Arrendamiento ${documento.numeroContrato} - Vehículo ${documento.vehiculoPlaca} - Firma Electrónica`,
          text: `Estimado/a ${documento.conductorNombre},

Se ha generado un contrato de arrendamiento de vehículo automotor a su nombre.

Número de contrato: ${documento.numeroContrato}
Vehículo: ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}
Modalidad: ${documento.modalidadPago} - $${documento.tarifa.toLocaleString('es-CO')}
Fecha de inicio: 24 de octubre de 2026
Fecha de terminación: 23 de enero de 2027
Arrendador: ${documento.propietarioNombre} (CC ${documento.propietarioCedula})

Para completar la firma electrónica del contrato, ingresa al siguiente enlace:
${linkFirma}

El enlace expira en 7 días. No compartas este enlace con nadie.

El contrato incluye sello de seguridad y código QR de autenticidad conforme a la Ley 527 de 1999 y el Decreto 1074 de 2015.

Saludos,
Sistema de Gestión de Arrendamiento de Vehículos - Jsadr`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e3a8a;">🚗 Contrato de Arrendamiento de Vehículo - Firma Electrónica</h2>
  <p>Estimado/a <strong>${documento.conductorNombre}</strong>,</p>
  <p>Se ha generado un contrato de arrendamiento de vehículo automotor a su nombre con los siguientes datos:</p>
  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 4px 0;"><strong>Número de contrato:</strong> ${documento.numeroContrato}</p>
    <p style="margin: 4px 0;"><strong>Vehículo:</strong> ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}</p>
    <p style="margin: 4px 0;"><strong>Modalidad:</strong> ${documento.modalidadPago} - $${documento.tarifa.toLocaleString('es-CO')}/semana</p>
    <p style="margin: 4px 0;"><strong>Fecha de inicio:</strong> 24 de octubre de 2026</p>
    <p style="margin: 4px 0;"><strong>Fecha de terminación:</strong> 23 de enero de 2027</p>
    <p style="margin: 4px 0;"><strong>Arrendador:</strong> ${documento.propietarioNombre} (CC ${documento.propietarioCedula})</p>
  </div>
  <p>Para completar la firma electrónica del contrato, ingresa al siguiente enlace:</p>
  <div style="text-align: center; margin: 25px 0;">
    <a href="${linkFirma}" style="background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      🔐 Firmar Contrato Electrónicamente
    </a>
  </div>
  <p style="color: #6b7280; font-size: 12px;">
    ⏰ El enlace expira en 7 días.<br>
    ⚠️ No compartas este enlace con nadie.<br>
    El contrato incluye sello de seguridad y código QR de autenticidad conforme a la Ley 527 de 1999.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 11px; text-align: center;">
    © 2026 Jsadr · Sistema de Gestión de Arrendamiento de Vehículos
  </p>
</div>`,
        })
        resultados.conductor = { success: true, email: documento.conductorEmail, link: linkFirma }
      } catch (e: any) {
        resultados.conductor = { success: false, error: e.message }
      }
    }

    // === 2. Enviar correo al PROPIETARIO ===
    if (documento.propietarioToken && documento.propietarioEmail) {
      const linkFirmaProp = buildAbsoluteUrl(`/firma-contrato-vehiculo/${documento.propietarioToken}`)
      try {
        await enviarEmail({
          to: documento.propietarioEmail,
          subject: `Contrato de Arrendamiento ${documento.numeroContrato} - Vehículo ${documento.vehiculoPlaca} - Firma Electrónica (Propietario)`,
          text: `Estimado/a ${documento.propietarioNombre},

Se ha generado un contrato de arrendamiento de vehículo automotor en su condición de propietario/arrendador.

Número de contrato: ${documento.numeroContrato}
Vehículo: ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}
Modalidad: ${documento.modalidadPago} - $${documento.tarifa.toLocaleString('es-CO')}
Fecha de inicio: 24 de octubre de 2026
Fecha de terminación: 23 de enero de 2027
Arrendatario (Conductor): ${documento.conductorNombre} (CC ${documento.conductorCedula})

IMPORTANTE: El conductor debe firmar primero el contrato. Una vez que él complete su firma, podrás firmar tú como propietario usando este enlace:
${linkFirmaProp}

El enlace expira en 7 días. No compartas este enlace con nadie.

Saludos,
Sistema de Gestión de Arrendamiento de Vehículos - Jsadr`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e3a8a;">🚗 Contrato de Arrendamiento de Vehículo - Firma Electrónica</h2>
  <p>Estimado/a <strong>${documento.propietarioNombre}</strong>,</p>
  <p>Se ha generado un contrato de arrendamiento de vehículo automotor en su condición de propietario/arrendador:</p>
  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 4px 0;"><strong>Número de contrato:</strong> ${documento.numeroContrato}</p>
    <p style="margin: 4px 0;"><strong>Vehículo:</strong> ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}</p>
    <p style="margin: 4px 0;"><strong>Modalidad:</strong> ${documento.modalidadPago} - $${documento.tarifa.toLocaleString('es-CO')}/semana</p>
    <p style="margin: 4px 0;"><strong>Fecha de inicio:</strong> 24 de octubre de 2026</p>
    <p style="margin: 4px 0;"><strong>Fecha de terminación:</strong> 23 de enero de 2027</p>
    <p style="margin: 4px 0;"><strong>Arrendatario (Conductor):</strong> ${documento.conductorNombre} (CC ${documento.conductorCedula})</p>
  </div>
  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px;">
    <p style="margin: 0; color: #92400e; font-size: 13px;">
      ⚠️ <strong>Importante:</strong> El conductor debe firmar primero el contrato. Una vez que él complete su firma, podrás firmar tú como propietario usando este enlace.
    </p>
  </div>
  <p>Enlace para tu firma electrónica:</p>
  <div style="text-align: center; margin: 25px 0;">
    <a href="${linkFirmaProp}" style="background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      🔐 Firmar Contrato como Propietario
    </a>
  </div>
  <p style="color: #6b7280; font-size: 12px;">
    ⏰ El enlace expira en 7 días.<br>
    ⚠️ No compartas este enlace con nadie.<br>
    El contrato incluye sello de seguridad y código QR de autenticidad conforme a la Ley 527 de 1999.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 11px; text-align: center;">
    © 2026 Jsadr · Sistema de Gestión de Arrendamiento de Vehículos
  </p>
</div>`,
        })
        resultados.propietario = { success: true, email: documento.propietarioEmail, link: linkFirmaProp }
      } catch (e: any) {
        resultados.propietario = { success: false, error: e.message }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Correos enviados',
      contrato: NUMERO_CONTRATO,
      resultados,
    })
  } catch (error: any) {
    console.error('[seed-enviar-correos-contrato] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
// trigger redeploy 1793159121
