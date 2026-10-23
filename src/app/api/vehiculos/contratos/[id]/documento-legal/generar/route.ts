// =====================================================
// /api/vehiculos/contratos/[id]/documento-legal/generar
// Genera un ContratoDocumentoVehiculo con todos los datos precargados
// (vehículo, propietario, conductor) y envía el link de firma al conductor.
// El propietario se configura con los datos del sistema (Jsadr).
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { getVehiculosPermitidos } from '@/lib/permisos'
import { db } from '@/lib/db'
import { buildAbsoluteUrl } from '@/lib/url'
import { enviarEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const {
      propietarioNombre, propietarioCedula, propietarioTelefono,
      propietarioEmail, propietarioDireccion,
      descripcionVehiculo,
    } = body

    // Buscar el contrato con vehículo y conductor
    const contrato = await db.contratoVehiculo.findUnique({
      where: { id },
      include: { vehiculo: true, conductor: true },
    })

    if (!contrato) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    // Verificar permisos de vehículo
    const vehiculosPermitidos = getVehiculosPermitidos(user.username || user.id)
    if (vehiculosPermitidos !== null && !vehiculosPermitidos.includes(contrato.vehiculo.placa.toUpperCase())) {
      return NextResponse.json({ success: false, error: 'No tienes permiso para este vehículo' }, { status: 403 })
    }

    // Verificar que no exista ya un documento legal para este contrato
    const existente = await db.contratoDocumentoVehiculo.findFirst({
      where: { contratoVehiculoId: id, estado: { in: ['BORRADOR', 'ENVIADO_CONDUCTOR', 'FIRMADO_CONDUCTOR', 'ENVIADO_PROPIETARIO', 'COMPLETADO'] } },
    })
    if (existente) {
      return NextResponse.json({
        success: false,
        error: `Ya existe un documento legal para este contrato (estado: ${existente.estado}). ${existente.estado === 'COMPLETADO' ? 'Use la opción descargar.' : 'Use la opción continuar firma.'}`,
        documentoExistente: existente.id,
      }, { status: 409 })
    }

    // Generar número de contrato
    const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countHoy = await db.contratoDocumentoVehiculo.count({
      where: { numeroContrato: { startsWith: `CTR-${fechaStr}` } },
    })
    const numeroContrato = `CTR-${fechaStr}-${String(countHoy + 1).padStart(6, '0')}`

    // Generar tokens para conductor y propietario
    const conductorToken = crypto.randomBytes(32).toString('hex')
    const propietarioToken = crypto.randomBytes(32).toString('hex')
    const tokenExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días

    // Datos del propietario (valores por defecto del propietario real:
    // Johan Sebastian Alvarez Del Rio, CC 1214731649 - 10 dígitos).
    // Sanity check: si propietarioCedula viene mal del body (12147316499 u otro),
    // se corrige automáticamente al valor correcto.
    const propNombre = (!propietarioNombre || propietarioNombre.toLowerCase() === 'sebastian')
      ? 'Johan Sebastian Alvarez Del Rio'
      : propietarioNombre
    const propCedula = (!propietarioCedula || propietarioCedula.trim() !== '1214731649')
      ? '1214731649'
      : propietarioCedula.trim()
    const propTelefono = propietarioTelefono || '3235949510'
    const propEmail = propietarioEmail || 'jsadr23@outlook.com'
    const propDireccion = propietarioDireccion || 'Cl 92 44a 34'

    // Crear documento legal
    const documento = await db.contratoDocumentoVehiculo.create({
      data: {
        numeroContrato,
        contratoVehiculoId: id,
        // Snapshot del vehículo
        vehiculoPlaca: contrato.vehiculo.placa,
        vehiculoMarca: contrato.vehiculo.marca,
        vehiculoModelo: contrato.vehiculo.modelo,
        vehiculoAnio: contrato.vehiculo.anio,
        vehiculoColor: contrato.vehiculo.color,
        vehiculoKilometraje: contrato.vehiculo.kilometraje,
        vehiculoVin: contrato.vehiculo.vin,
        vehiculoMotor: contrato.vehiculo.motor,
        // Snapshot del propietario
        propietarioNombre: propNombre,
        propietarioCedula: propCedula,
        propietarioTelefono: propTelefono,
        propietarioEmail: propEmail,
        propietarioDireccion: propDireccion,
        // Snapshot del conductor
        conductorNombre: contrato.conductor.nombre,
        conductorCedula: contrato.conductor.cedula,
        conductorTelefono: contrato.conductor.telefono,
        conductorEmail: contrato.conductor.email || '',
        conductorDireccion: contrato.conductor.direccion || '',
        conductorLicencia: contrato.conductor.licenciaNumero,
        conductorLicenciaCat: contrato.conductor.licenciaCategoria,
        // Términos
        modalidadPago: contrato.modalidadPago,
        tarifa: contrato.tarifa,
        diasGracia: contrato.diasGracia,
        multaDiaria: contrato.multaDiaria,
        deposito: contrato.deposito,
        fechaInicio: contrato.fechaInicio,
        fechaFin: contrato.fechaFin,
        cantidadCuotas: 0 ? 0 : 0, // se calcula según obligaciones
        descripcionVehiculo: descripcionVehiculo || `Vehículo ${contrato.vehiculo.marca} ${contrato.vehiculo.modelo} ${contrato.vehiculo.anio || ''}, placa ${contrato.vehiculo.placa}, color ${contrato.vehiculo.color || '—'}, kilometraje ${(contrato.vehiculo.kilometraje || 0).toLocaleString('es-CO')} km`,
        // Estado inicial
        estado: 'ENVIADO_CONDUCTOR',
        // Tokens
        conductorToken,
        conductorTokenExpira: tokenExpira,
        propietarioToken,
        propietarioTokenExpira: tokenExpira,
        creadoPor: user.id,
      },
    })

    // Enviar email al conductor con el link de firma
    const linkFirma = buildAbsoluteUrl(`/firma-contrato-vehiculo/${conductorToken}`)
    let emailEnviado = false
    if (contrato.conductor.email) {
      try {
        await enviarEmail({
          to: contrato.conductor.email,
          subject: `Contrato de Arrendamiento ${numeroContrato} - Firma Electrónica`,
          text: `Estimado/a ${contrato.conductor.nombre},\n\nSe ha generado un contrato de arrendamiento de vehículo a su nombre.\n\nNúmero de contrato: ${numeroContrato}\nVehículo: ${contrato.vehiculo.marca} ${contrato.vehiculo.modelo} - Placa ${contrato.vehiculo.placa}\n\nPara completar la firma electrónica del contrato, ingresa al siguiente enlace:\n${linkFirma}\n\nEl enlace expira en 7 días.\n\nSaludos,\nSistema de Gestión de Vehículos`,
        })
        emailEnviado = true
      } catch (e) {
        console.error('[documento-legal/generar] Error enviando email:', e)
      }
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO_DOCUMENTO',
        entidadId: documento.id,
        accion: 'CREAR',
        descripcion: `Contrato legal ${numeroContrato} creado. Datos precargados: vehículo ${contrato.vehiculo.placa}, conductor ${contrato.conductor.nombre} (CC ${contrato.conductor.cedula}), propietario ${propNombre}. Link de firma enviado al conductor.`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: documento.id,
        numeroContrato: documento.numeroContrato,
        estado: documento.estado,
        linkFirmaConductor: linkFirma,
        conductorEmail: contrato.conductor.email || null,
        emailEnviado,
      },
      message: `Contrato ${numeroContrato} generado. ${emailEnviado ? 'Email enviado al conductor.' : 'No se pudo enviar email (sin correo registrado).'} Comparte el link de firma con el conductor.`,
    })
  } catch (error: any) {
    console.error('[documento-legal/generar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET — lista documentos legales de un contrato
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const documentos = await db.contratoDocumentoVehiculo.findMany({
      where: { contratoVehiculoId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: documentos })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
