// =====================================================
// /api/vehiculos/registro-conductor/admin/[id]/aprobar
// Aprueba la solicitud → crea ConductorVehiculo + ContratoVehiculo
// Body: { vehiculoId, modalidadPago, tarifa, diasGracia, multaDiaria,
//         cantidadCuotas, fechaInicio, fechaFin, deposito }
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

function generarFechasVencimientoL_S(fechaInicio: Date, cantidadCuotas: number): Date[] {
  const fechas: Date[] = []
  let cursor = new Date(fechaInicio)
  let generadas = 0
  while (generadas < cantidadCuotas) {
    const dia = cursor.getDay()
    if (dia !== 0) { // L-S, sin domingos
      fechas.push(new Date(cursor))
      generadas++
    }
    cursor.setDate(cursor.getDate() + 1)
    if (fechas.length > 365) break
  }
  return fechas
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()
    const {
      vehiculoId, modalidadPago, tarifa, diasGracia, multaDiaria,
      cantidadCuotas, fechaInicio, fechaFin, deposito,
    } = body

    const solicitud = await db.solicitudConductorVehiculo.findUnique({ where: { id } })
    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (solicitud.estado !== 'COMPLETADA') {
      return NextResponse.json({
        success: false,
        error: `La solicitud debe estar COMPLETADA (estado actual: ${solicitud.estado})`,
      }, { status: 400 })
    }

    if (!vehiculoId || !modalidadPago || !tarifa) {
      return NextResponse.json({
        success: false, error: 'vehiculoId, modalidadPago y tarifa son obligatorios',
      }, { status: 400 })
    }

    // Verificar vehículo
    const vehiculo = await db.vehiculo.findUnique({ where: { id: vehiculoId } })
    if (!vehiculo) {
      return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Transacción: crear conductor + contrato + obligaciones + actualizar solicitud
    const resultado = await db.$transaction(async (tx) => {
      // Crear conductor
      const conductor = await tx.conductorVehiculo.create({
        data: {
          cedula: solicitud.cedula,
          nombre: solicitud.nombre,
          telefono: solicitud.telefono,
          email: solicitud.email,
          direccion: solicitud.direccion,
          ciudad: solicitud.ciudad,
          licenciaNumero: solicitud.licenciaNumero || '',
          licenciaCategoria: solicitud.licenciaCategoria,
          licenciaVence: solicitud.licenciaVence,
          // Foto de perfil del conductor (selfie tomada en el registro)
          fotoUrl: solicitud.fotoSelfie || null,
          // Documentos como JSON
          documentos: JSON.stringify({
            fotoCedulaFrente: solicitud.fotoCedulaFrente,
            fotoCedulaReverso: solicitud.fotoCedulaReverso,
            fotoLicenciaFrente: solicitud.fotoLicenciaFrente,
            fotoLicenciaReverso: solicitud.fotoLicenciaReverso,
            fotoSelfie: solicitud.fotoSelfie,
            fotoReciboServicios: solicitud.fotoReciboServicios,
            firmaElectronica: solicitud.firmaElectronica,
            contactoEmergencia: {
              nombre: solicitud.contactoEmergenciaNombre,
              telefono: solicitud.contactoEmergenciaTelefono,
              parentesco: solicitud.contactoEmergenciaParentesco,
            },
          }),
          activo: true,
          notas: `Creado desde solicitud de registro. Barrio: ${solicitud.barrio || '—'}. Contacto emergencia: ${solicitud.contactoEmergenciaNombre || '—'} (${solicitud.contactoEmergenciaTelefono || '—'})`,
        },
      })

      // Generar número de contrato
      const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const contratosHoy = await tx.contratoVehiculo.count({
        where: { numeroContrato: { startsWith: `CONTR-${fechaStr}` } },
      })
      const numeroContrato = `CONTR-${fechaStr}-${String(contratosHoy + 1).padStart(3, '0')}`

      const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : new Date()
      const tarifaNum = parseFloat(tarifa)

      // Crear contrato ACTIVO
      const contrato = await tx.contratoVehiculo.create({
        data: {
          numeroContrato,
          vehiculoId,
          conductorId: conductor.id,
          fechaInicio: fechaInicioDate,
          fechaFin: fechaFin ? new Date(fechaFin) : null,
          estado: 'ACTIVO',
          modalidadPago,
          tarifa: tarifaNum,
          diasGracia: diasGracia ? parseInt(diasGracia) : 0,
          multaDiaria: multaDiaria ? parseFloat(multaDiaria) : 0,
          deposito: deposito ? parseFloat(deposito) : 0,
          creadoPor: user.id,
        },
      })

      // Generar obligaciones según modalidad
      let obligacionesGeneradas = 0
      if (modalidadPago === 'DIARIO') {
        const nCuotas = cantidadCuotas || 24
        const fechas = generarFechasVencimientoL_S(fechaInicioDate, nCuotas)
        for (let i = 0; i < fechas.length; i++) {
          await tx.obligacionVehiculo.create({
            data: {
              contratoId: contrato.id,
              vehiculoId,
              conductorId: conductor.id,
              numeroCuota: i + 1,
              fechaVencimiento: fechas[i],
              monto: tarifaNum,
              montoPendiente: tarifaNum,
              estado: 'PENDIENTE',
            },
          })
          obligacionesGeneradas++
        }
      }

      // Marcar vehículo como ASIGNADO
      await tx.vehiculo.update({
        where: { id: vehiculoId },
        data: { estado: 'ASIGNADO' },
      })

      // Actualizar solicitud
      await tx.solicitudConductorVehiculo.update({
        where: { id },
        data: {
          estado: 'APROBADA',
          aprobadoPor: user.id,
          aprobadoAt: new Date(),
          conductorCreadoId: conductor.id,
          vehiculoIdPreasignado: vehiculoId,
          contratoIdPreasignado: contrato.id,
        },
      })

      // Auditoría
      await tx.auditoriaVehiculo.create({
        data: {
          entidad: 'SOLICITUD_CONDUCTOR',
          entidadId: id,
          accion: 'APROBAR',
          descripcion: `Solicitud aprobada por ${user.nombre}. Conductor: ${conductor.nombre} (${conductor.cedula}). Contrato: ${numeroContrato}. ${obligacionesGeneradas} obligaciones generadas.`,
          usuarioId: user.id,
          usuarioNombre: user.nombre,
        },
      })

      return { conductor, contrato, obligacionesGeneradas }
    })

    return NextResponse.json({
      success: true,
      data: resultado,
      message: `Solicitud aprobada. Conductor creado con contrato ${resultado.contrato.numeroContrato} y ${resultado.obligacionesGeneradas} obligaciones.`,
    })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/admin/aprobar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
