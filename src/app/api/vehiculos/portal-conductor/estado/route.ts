// =====================================================
// /api/vehiculos/portal-conductor/estado
// Devuelve el estado completo del conductor autenticado:
//  - Datos del contrato activo + vehículo
//  - Próximos vencimientos (obligaciones pendientes)
//  - Pagos realizados (aprobados)
//  - Multas y saldos
//  - Historial de mantenimiento del vehículo
//  - Próximas revisiones técnicas
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token') || new URL(req.url).searchParams.get('token')
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
          include: {
            vehiculo: {
              include: {
                mantenimientos: {
                  orderBy: { fecha: 'desc' },
                  take: 10,
                },
              },
            },
            obligaciones: {
              orderBy: { fechaVencimiento: 'asc' },
            },
            pagos: {
              where: { estado: 'APROBADO' },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
          take: 1,
        },
      },
    })

    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    const contrato = conductor.contratos[0]
    if (!contrato) {
      return NextResponse.json({
        success: true,
        data: {
          conductor: {
            id: conductor.id,
            nombre: conductor.nombre,
            cedula: conductor.cedula,
          },
          contrato: null,
          mensaje: 'No tienes contrato activo.',
        },
      })
    }

    const ahora = new Date()

    // Clasificar obligaciones
    const proximosVencimientos = contrato.obligaciones
      .filter(o => o.estado !== 'PAGADA')
      .map(o => ({
        id: o.id,
        numeroCuota: o.numeroCuota,
        fechaVencimiento: o.fechaVencimiento,
        diasParaVencer: Math.ceil((o.fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)),
        monto: o.monto,
        multa: o.multa,
        montoPendiente: o.montoPendiente,
        estado: o.estado,
        diasRetraso: o.diasRetraso,
      }))

    const pagosRealizados = contrato.pagos.map(p => ({
      id: p.id,
      fechaPago: p.fechaPago,
      monto: p.monto,
      metodo: p.metodo,
      banco: p.banco,
      referencia: p.referencia,
      estado: p.estado,
    }))

    const mantenimientoHistorial = contrato.vehiculo.mantenimientos.map(m => ({
      id: m.id,
      fecha: m.fecha,
      kilometraje: m.kilometraje,
      tipo: m.tipo,
      trabajoRealizado: m.trabajoRealizado,
      taller: m.taller,
      proximaRevisionKm: m.proximaRevisionKm,
      proximaRevisionFecha: m.proximaRevisionFecha,
    }))

    // Saldos
    // Solo contar como pendiente la semana ACTUAL (la que vence este sábado o ya venció)
    // Las semanas futuras NO se cuentan como pendiente — el conductor solo debe la semana actual
    const obligacionActual = contrato.obligaciones.find(o => o.estado !== 'PAGADA' && o.fechaVencimiento >= new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000))
    const obligacionesVencidas = contrato.obligaciones.filter(o => o.estado !== 'PAGADA' && o.fechaVencimiento < ahora)
    const totalPendiente = (obligacionActual?.montoPendiente || 0) + obligacionesVencidas.reduce((s, o) => s + (o.montoPendiente || 0), 0)
    const totalMultas = (obligacionActual?.multa || 0) + obligacionesVencidas.reduce((s, o) => s + (o.multa || 0), 0)
    const totalPagado = contrato.pagos.reduce((s, p) => s + (p.monto || 0), 0)
    // Total del contrato (todas las semanas) — solo informativo
    const totalContrato = contrato.obligaciones.reduce((s, o) => s + (o.monto || 0), 0)

    // Próximas revisiones (SOAT, tecnomecánica, mantenimiento)
    const proximasRevisiones: any[] = []
    if (contrato.vehiculo.soatVence) {
      const dias = Math.ceil((contrato.vehiculo.soatVence.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
      proximasRevisiones.push({
        tipo: 'SOAT',
        fecha: contrato.vehiculo.soatVence,
        diasParaVencer: dias,
        severidad: dias < 0 ? 'CRITICAL' : dias < 15 ? 'WARNING' : 'INFO',
      })
    }
    if (contrato.vehiculo.tecnomecanicaVence) {
      const dias = Math.ceil((contrato.vehiculo.tecnomecanicaVence.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
      proximasRevisiones.push({
        tipo: 'Tecnomécánica',
        fecha: contrato.vehiculo.tecnomecanicaVence,
        diasParaVencer: dias,
        severidad: dias < 0 ? 'CRITICAL' : dias < 15 ? 'WARNING' : 'INFO',
      })
    }
    // Próxima revisión de mantenimiento
    const proximoMant = contrato.vehiculo.mantenimientos.find(m => m.proximaRevisionFecha || m.proximaRevisionKm)
    if (proximoMant && proximoMant.proximaRevisionFecha) {
      const dias = Math.ceil((proximoMant.proximaRevisionFecha.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
      proximasRevisiones.push({
        tipo: 'Mantenimiento programado',
        fecha: proximoMant.proximaRevisionFecha,
        diasParaVencer: dias,
        severidad: dias < 0 ? 'CRITICAL' : dias < 7 ? 'WARNING' : 'INFO',
      })
    }

    // === Póliza todo riesgo ===
    // Buscar en DocumentoVehiculo los documentos tipo POLIZA_TODO_RIESGO o SEGURO
    // con fecha de vencimiento y agregarlos a próximas revisiones
    const documentosVehiculo = await db.documentoVehiculo.findMany({
      where: {
        vehiculoId: contrato.vehiculoId,
        tipo: { in: ['POLIZA_TODO_RIESGO', 'SEGURO'] },
        fechaVencimiento: { not: null },
      },
      orderBy: { fechaVencimiento: 'asc' },
    })
    for (const doc of documentosVehiculo) {
      if (!doc.fechaVencimiento) continue
      const dias = Math.ceil((doc.fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
      const etiqueta = doc.tipo === 'POLIZA_TODO_RIESGO' ? 'Póliza Todo Riesgo' : 'Seguro'
      const etiquetaCompleta = doc.numero ? `${etiqueta} (${doc.numero})` : etiqueta
      proximasRevisiones.push({
        tipo: etiquetaCompleta,
        fecha: doc.fechaVencimiento,
        diasParaVencer: dias,
        severidad: dias < 0 ? 'CRITICAL' : dias < 15 ? 'WARNING' : 'INFO',
      })
    }

    // Licencia de conducir del conductor
    if (conductor.licenciaVence) {
      const dias = Math.ceil((conductor.licenciaVence.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
      proximasRevisiones.push({
        tipo: 'Licencia de conducir',
        fecha: conductor.licenciaVence,
        diasParaVencer: dias,
        severidad: dias < 0 ? 'CRITICAL' : dias < 30 ? 'WARNING' : 'INFO',
      })
    }

    // Ordenar próximas revisiones por fecha
    proximasRevisiones.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    return NextResponse.json({
      success: true,
      data: {
        conductor: {
          id: conductor.id,
          nombre: conductor.nombre,
          cedula: conductor.cedula,
          telefono: conductor.telefono,
          email: conductor.email,
          direccion: conductor.direccion,
          ciudad: conductor.ciudad,
          licenciaNumero: conductor.licenciaNumero,
          licenciaCategoria: conductor.licenciaCategoria,
          licenciaVence: conductor.licenciaVence,
          fotoUrl: conductor.fotoUrl,
        },
        contrato: {
          id: contrato.id,
          numero: contrato.numeroContrato,
          fechaInicio: contrato.fechaInicio,
          fechaFin: contrato.fechaFin,
          modalidadPago: contrato.modalidadPago,
          tarifa: contrato.tarifa,
          diasGracia: contrato.diasGracia,
          multaDiaria: contrato.multaDiaria,
          deposito: contrato.deposito,
          estado: contrato.estado,
          // Contador de días del contrato
          duracionDias: Math.ceil((ahora.getTime() - contrato.fechaInicio.getTime()) / (1000 * 60 * 60 * 24)),
          diasTranscurridos: Math.max(0, Math.ceil((ahora.getTime() - contrato.fechaInicio.getTime()) / (1000 * 60 * 60 * 24))),
          diasRestantes: contrato.fechaFin
            ? Math.max(0, Math.ceil((contrato.fechaFin.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)))
            : null, // null = indefinido
          tieneFechaFin: !!contrato.fechaFin,
        },
        vehiculo: {
          placa: contrato.vehiculo.placa,
          marca: contrato.vehiculo.marca,
          modelo: contrato.vehiculo.modelo,
          anio: contrato.vehiculo.anio,
          color: contrato.vehiculo.color,
          kilometraje: contrato.vehiculo.kilometraje,
          soatVence: contrato.vehiculo.soatVence,
          tecnomecanicaVence: contrato.vehiculo.tecnomecanicaVence,
        },
        saldos: {
          totalPendiente,
          totalMultas,
          totalPagado,
          totalContrato,
        },
        proximosVencimientos: proximosVencimientos.slice(0, 5),
        proximasRevisiones,
        pagosRealizados: pagosRealizados.slice(0, 10),
        mantenimientoHistorial,
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/estado] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
