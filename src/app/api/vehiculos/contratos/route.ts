// =====================================================
// /api/vehiculos/contratos — CRUD de contratos
// Al crear un contrato ACTIVO: genera automáticamente las obligaciones
// según modalidadPago (DIARIO | SEMANAL | QUINCENAL | MENSUAL | PERSONALIZADO)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// === Helper: generar fechas de vencimiento según modalidad ===
// REGLA DE NEGOCIO: las liquidaciones son de LUNES a SÁBADO (excluye domingos)
// Esto aplica especialmente a la modalidad DIARIO donde cada día hábil
// (L-S) genera una obligación. Los domingos NO se cuentan.
function generarFechasVencimiento(
  fechaInicio: Date,
  modalidad: string,
  cantidadCuotas: number,
  fechasPersonalizadas?: string[]
): Date[] {
  const fechas: Date[] = []
  const base = new Date(fechaInicio)

  if (modalidad === 'PERSONALIZADO' && fechasPersonalizadas && fechasPersonalizadas.length > 0) {
    for (const f of fechasPersonalizadas) {
      fechas.push(new Date(f))
    }
    return fechas
  }

  if (modalidad === 'DIARIO') {
    // Generar fechas saltándose los domingos (0 = Sunday)
    // La fecha de inicio cuenta como primera obligación si es L-S
    let fechaCursor = new Date(base)
    let generadas = 0
    // Avanzar día por día hasta completar cantidadCuotas
    while (generadas < cantidadCuotas) {
      const dia = fechaCursor.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
      if (dia !== 0) {
        // No es domingo → incluir
        fechas.push(new Date(fechaCursor))
        generadas++
      }
      // Avanzar al siguiente día
      fechaCursor.setDate(fechaCursor.getDate() + 1)
      // Safety break: no iterar más de 365 días
      if (fechas.length > 365) break
    }
    return fechas
  }

  for (let i = 1; i <= cantidadCuotas; i++) {
    const venc = new Date(base)
    switch (modalidad) {
      case 'SEMANAL':
        venc.setDate(venc.getDate() + (i * 7))
        break
      case 'QUINCENAL':
        venc.setDate(venc.getDate() + (i * 15))
        break
      case 'MENSUAL':
        venc.setMonth(venc.getMonth() + i)
        break
      default:
        venc.setMonth(venc.getMonth() + i)
    }
    fechas.push(venc)
  }
  return fechas
}

// === Helper: generar obligaciones automáticamente ===
async function generarObligaciones(
  contratoId: string,
  vehiculoId: string,
  conductorId: string,
  tarifa: number,
  modalidad: string,
  fechaInicio: Date,
  cantidadCuotas: number,
  fechasPersonalizadas?: string[]
): Promise<any[]> {
  const fechas = generarFechasVencimiento(fechaInicio, modalidad, cantidadCuotas, fechasPersonalizadas)
  const obligaciones: any[] = []
  for (let i = 0; i < fechas.length; i++) {
    const oblig = await db.obligacionVehiculo.create({
      data: {
        contratoId,
        vehiculoId,
        conductorId,
        numeroCuota: i + 1,
        fechaVencimiento: fechas[i],
        monto: tarifa,
        montoPendiente: tarifa,
        estado: 'PENDIENTE',
      },
    })
    obligaciones.push(oblig)
  }
  return obligaciones
}

// GET — listar contratos
export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const conductorId = searchParams.get('conductorId')
    const vehiculoId = searchParams.get('vehiculoId')

    const where: any = {}
    if (estado) where.estado = estado
    if (conductorId) where.conductorId = conductorId
    if (vehiculoId) where.vehiculoId = vehiculoId

    const contratos = await db.contratoVehiculo.findMany({
      where,
      include: {
        vehiculo: true,
        conductor: true,
        _count: {
          select: {
            obligaciones: true,
            pagos: true,
            mantenimientos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: contratos })
  } catch (error: any) {
    console.error('[vehiculos/contratos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — crear contrato
export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const body = await req.json()
    const {
      vehiculoId, conductorId,
      fechaInicio, fechaFin, estado,
      modalidadPago, tarifa, diasGracia, multaDiaria, deposito,
      renovacionAnticipada, valorRenovacionAnticipada,
      cantidadCuotas,
      fechasPersonalizadas,
      contratoPdfUrl,
    } = body

    if (!vehiculoId || !conductorId || !modalidadPago || tarifa === undefined) {
      return NextResponse.json(
        { success: false, error: 'vehiculoId, conductorId, modalidadPago, tarifa son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar vehículo y conductor
    const vehiculo = await db.vehiculo.findUnique({ where: { id: vehiculoId } })
    if (!vehiculo) {
      return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
    }
    const conductor = await db.conductorVehiculo.findUnique({ where: { id: conductorId } })
    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Conductor no encontrado' }, { status: 404 })
    }

    // Generar número de contrato único: CONTR-YYYYMMDD-XXX
    const hoy = new Date()
    const fechaStr = hoy.toISOString().slice(0, 10).replace(/-/g, '')
    const contratosHoy = await db.contratoVehiculo.count({
      where: { numeroContrato: { startsWith: `CONTR-${fechaStr}` } },
    })
    const numeroContrato = `CONTR-${fechaStr}-${String(contratosHoy + 1).padStart(3, '0')}`

    const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : new Date()
    const estadoInicial = estado || 'ACTIVO'

    // Crear contrato
    const contrato = await db.contratoVehiculo.create({
      data: {
        numeroContrato,
        vehiculoId,
        conductorId,
        fechaInicio: fechaInicioDate,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        estado: estadoInicial,
        modalidadPago,
        tarifa: parseFloat(tarifa),
        diasGracia: diasGracia ? parseInt(diasGracia) : 0,
        multaDiaria: multaDiaria ? parseFloat(multaDiaria) : 0,
        deposito: deposito ? parseFloat(deposito) : 0,
        renovacionAnticipada: Boolean(renovacionAnticipada),
        valorRenovacionAnticipada: valorRenovacionAnticipada ? parseFloat(valorRenovacionAnticipada) : null,
        contratoPdfUrl,
        creadoPor: user.id,
      },
    })

    // Si el contrato es ACTIVO, generar obligaciones automáticamente
    let obligacionesGeneradas: any[] = []
    if (estadoInicial === 'ACTIVO') {
      const nCuotas = cantidadCuotas || calcularCuotasPorDefecto(modalidadPago, fechaInicioDate, fechaFin ? new Date(fechaFin) : null)
      obligacionesGeneradas = await generarObligaciones(
        contrato.id, vehiculoId, conductorId,
        parseFloat(tarifa), modalidadPago,
        fechaInicioDate, nCuotas,
        fechasPersonalizadas,
      )

      // Actualizar estado del vehículo
      await db.vehiculo.update({
        where: { id: vehiculoId },
        data: { estado: 'ASIGNADO' },
      })
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO',
        entidadId: contrato.id,
        accion: 'CREAR',
        descripcion: `Contrato ${numeroContrato} creado. ${obligacionesGeneradas.length} obligaciones generadas.`,
        datosNuevos: JSON.stringify({ contrato, obligacionesGeneradas }),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: { contrato, obligacionesGeneradas: obligacionesGeneradas.length },
    })
  } catch (error: any) {
    console.error('[vehiculos/contratos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// === Helper: calcular cuotas por defecto según modalidad ===
function calcularCuotasPorDefecto(modalidad: string, fechaInicio: Date, fechaFin: Date | null): number {
  if (!fechaFin) {
    // Por defecto 30 cuotas si no hay fecha fin
    return 30
  }
  const diffMs = fechaFin.getTime() - fechaInicio.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  switch (modalidad) {
    case 'DIARIO': return diffDays
    case 'SEMANAL': return Math.ceil(diffDays / 7)
    case 'QUINCENAL': return Math.ceil(diffDays / 15)
    case 'MENSUAL': return Math.ceil(diffDays / 30)
    default: return Math.ceil(diffDays / 30)
  }
}
