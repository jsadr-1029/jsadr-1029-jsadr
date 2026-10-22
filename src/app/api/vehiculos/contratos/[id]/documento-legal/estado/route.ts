// =====================================================
// /api/vehiculos/contratos/[id]/documento-legal/estado
// Devuelve el estado del documento legal por token (conductor o propietario)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })
    }

    // Buscar por token de conductor o propietario
    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: {
        OR: [
          { conductorToken: token },
          { propietarioToken: token },
        ],
      },
    })

    if (!documento) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 404 })
    }

    // Determinar quién es el firmante
    const esConductor = documento.conductorToken === token
    const tokenExpira = esConductor ? documento.conductorTokenExpira : documento.propietarioTokenExpira
    if (tokenExpira && new Date() > tokenExpira) {
      return NextResponse.json({ success: false, error: 'El enlace ha expirado' }, { status: 401 })
    }

    // Verificar que el flujo esté correcto
    // Conductor firma primero, luego propietario
    if (!esConductor && documento.estado !== 'FIRMADO_CONDUCTOR' && documento.estado !== 'ENVIADO_PROPIETARIO') {
      return NextResponse.json({
        success: false,
        error: `El conductor aún no ha firmado el contrato. Estado actual: ${documento.estado}. Debes esperar a que el conductor complete su firma primero.`,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: documento.id,
        numeroContrato: documento.numeroContrato,
        estado: documento.estado,
        esConductor,
        esPropietario: !esConductor,
        // Datos del vehículo
        vehiculo: {
          placa: documento.vehiculoPlaca,
          marca: documento.vehiculoMarca,
          modelo: documento.vehiculoModelo,
          anio: documento.vehiculoAnio,
          color: documento.vehiculoColor,
          kilometraje: documento.vehiculoKilometraje,
          vin: documento.vehiculoVin,
          motor: documento.vehiculoMotor,
        },
        // Datos del propietario
        propietario: {
          nombre: documento.propietarioNombre,
          cedula: documento.propietarioCedula,
          telefono: documento.propietarioTelefono,
          email: documento.propietarioEmail,
        },
        // Datos del conductor
        conductor: {
          nombre: documento.conductorNombre,
          cedula: documento.conductorCedula,
          telefono: documento.conductorTelefono,
          email: documento.conductorEmail,
          licencia: documento.conductorLicencia,
          licenciaCat: documento.conductorLicenciaCat,
        },
        // Términos
        terminos: {
          modalidadPago: documento.modalidadPago,
          tarifa: documento.tarifa,
          diasGracia: documento.diasGracia,
          multaDiaria: documento.multaDiaria,
          deposito: documento.deposito,
          fechaInicio: documento.fechaInicio,
          fechaFin: documento.fechaFin,
          descripcionVehiculo: documento.descripcionVehiculo,
        },
        // Estado de firma del firmante actual
        firmaActual: esConductor ? {
          fotoCedulaFrente: documento.conductorFotoCedulaFrente,
          fotoCedulaReverso: documento.conductorFotoCedulaReverso,
          fotoSelfie: documento.conductorFotoSelfie,
          firmaManuscrita: documento.conductorFirmaManuscrita,
          otpValidado: documento.conductorOtpValidado,
          fechaFirma: documento.conductorFechaFirma,
        } : {
          fotoCedulaFrente: documento.propietarioFotoCedulaFrente,
          fotoCedulaReverso: documento.propietarioFotoCedulaReverso,
          fotoSelfie: documento.propietarioFotoSelfie,
          firmaManuscrita: documento.propietarioFirmaManuscrita,
          otpValidado: documento.propietarioOtpValidado,
          fechaFirma: documento.propietarioFechaFirma,
        },
      },
    })
  } catch (error: any) {
    console.error('[documento-legal/estado] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
