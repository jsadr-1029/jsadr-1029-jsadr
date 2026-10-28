import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email'
import { buildAbsoluteUrl } from '@/lib/url'

export async function POST(req: NextRequest) {
  try {
    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { numeroContrato: 'CTR-20261028-000001' },
    })
    if (!documento) {
      return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
    }

    const linkConductor = buildAbsoluteUrl(`/firma-contrato-vehiculo/${documento.conductorToken}`)
    const linkPropietario = buildAbsoluteUrl(`/firma-contrato-vehiculo/${documento.propietarioToken}`)
    const resultados: any = {}

    if (documento.conductorEmail) {
      try {
        await enviarEmail({
          to: documento.conductorEmail,
          subject: `Contrato de Arrendamiento ${documento.numeroContrato} - Vehiculo ${documento.vehiculoPlaca} - Firma Electronica`,
          text: `Estimado/a ${documento.conductorNombre},\n\nSe ha generado un contrato de arrendamiento de vehiculo a su nombre.\n\nContrato: ${documento.numeroContrato}\nVehiculo: ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}\nModalidad: ${documento.modalidadPago} - $${documento.tarifa.toLocaleString('es-CO')}\nFecha de inicio: 24 de octubre de 2026\nFecha de terminacion: 23 de enero de 2027\nArrendador: ${documento.propietarioNombre} (CC ${documento.propietarioCedula})\n\nPara completar la firma electronica del contrato, ingresa al siguiente enlace:\n${linkConductor}\n\nEl enlace expira en 7 dias.\n\nSaludos,\nSistema de Gestion de Arrendamiento de Vehiculos - Jsadr`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#1e3a8a;">Contrato de Arrendamiento de Vehiculo - Firma Electronica</h2><p>Estimado/a <strong>${documento.conductorNombre}</strong>,</p><div style="background:#f3f4f6;padding:15px;border-radius:8px;margin:15px 0;"><p style="margin:4px 0;"><strong>Contrato:</strong> ${documento.numeroContrato}</p><p style="margin:4px 0;"><strong>Vehiculo:</strong> ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}</p><p style="margin:4px 0;"><strong>Modalidad:</strong> ${documento.modalidadPago} - $${documento.tarifa.toLocaleString('es-CO')}</p><p style="margin:4px 0;"><strong>Inicio:</strong> 24 de octubre de 2026</p><p style="margin:4px 0;"><strong>Terminacion:</strong> 23 de enero de 2027</p><p style="margin:4px 0;"><strong>Arrendador:</strong> ${documento.propietarioNombre} (CC ${documento.propietarioCedula})</p></div><p>Para firmar electronicamente:</p><div style="text-align:center;margin:25px 0;"><a href="${linkConductor}" style="background:#1e3a8a;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Firmar Contrato</a></div><p style="color:#6b7280;font-size:12px;">El enlace expira en 7 dias.</p></div>`,
        })
        resultados.conductor = { success: true, email: documento.conductorEmail }
      } catch (e: any) {
        resultados.conductor = { success: false, error: e.message }
      }
    }

    if (documento.propietarioEmail) {
      try {
        await enviarEmail({
          to: documento.propietarioEmail,
          subject: `Contrato de Arrendamiento ${documento.numeroContrato} - Vehiculo ${documento.vehiculoPlaca} - Firma Electronica (Propietario)`,
          text: `Estimado/a ${documento.propietarioNombre},\n\nSe ha generado un contrato de arrendamiento de vehiculo en su condicion de propietario.\n\nContrato: ${documento.numeroContrato}\nVehiculo: ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}\nConductor: ${documento.conductorNombre} (CC ${documento.conductorCedula})\n\nIMPORTANTE: El conductor debe firmar primero. Despues podras firmar tu como propietario:\n${linkPropietario}\n\nSaludos,\nSistema de Gestion de Arrendamiento de Vehiculos - Jsadr`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#1e3a8a;">Contrato - Firma Electronica (Propietario)</h2><p>Estimado/a <strong>${documento.propietarioNombre}</strong>,</p><div style="background:#f3f4f6;padding:15px;border-radius:8px;margin:15px 0;"><p style="margin:4px 0;"><strong>Contrato:</strong> ${documento.numeroContrato}</p><p style="margin:4px 0;"><strong>Vehiculo:</strong> ${documento.vehiculoMarca} ${documento.vehiculoModelo} - Placa ${documento.vehiculoPlaca}</p><p style="margin:4px 0;"><strong>Conductor:</strong> ${documento.conductorNombre} (CC ${documento.conductorCedula})</p></div><div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:15px 0;border-radius:4px;"><p style="margin:0;color:#92400e;font-size:13px;"><strong>Importante:</strong> El conductor debe firmar primero.</p></div><div style="text-align:center;margin:25px 0;"><a href="${linkPropietario}" style="background:#1e3a8a;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Firmar como Propietario</a></div></div>`,
        })
        resultados.propietario = { success: true, email: documento.propietarioEmail }
      } catch (e: any) {
        resultados.propietario = { success: false, error: e.message }
      }
    }

    return NextResponse.json({ success: true, resultados })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) { return POST(req) }
