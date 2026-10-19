// =====================================================
// /api/vehiculos/contratos/[id]/generar-obligaciones
// Permite generar obligaciones adicionales para un contrato existente
// (ej: extensión, ajuste de fechas, modalidad personalizada)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// === Helper: generar fechas de vencimiento según modalidad ===
// REGLA DE NEGOCIO: las liquidaciones son de LUNES a SÁBADO (excluye domingos)
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
    let fechaCursor = new Date(base)
    let generadas = 0
    while (generadas < cantidadCuotas) {
      const dia = fechaCursor.getDay()
      if (dia !== 0) {
        fechas.push(new Date(fechaCursor))
        generadas++
      }
      fechaCursor.setDate(fechaCursor.getDate() + 1)
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
    const { cantidadCuotas, fechasPersonalizadas, tarifa, modalidadPago } = body

    const contrato = await db.contratoVehiculo.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    // Contar obligaciones existentes para continuar numeración
    const existingCount = await db.obligacionVehiculo.count({ where: { contratoId: id } })
    const tarifaFinal = tarifa ? parseFloat(tarifa) : contrato.tarifa
    const modalidadFinal = modalidadPago || contrato.modalidadPago

    // Si hay fechas personalizadas, usarlas como punto de partida desde la última obligación
    let fechaInicioGen = new Date(contrato.fechaInicio)
    if (existingCount > 0) {
      const ultima = await db.obligacionVehiculo.findFirst({
        where: { contratoId: id },
        orderBy: { numeroCuota: 'desc' },
      })
      if (ultima) {
        fechaInicioGen = new Date(ultima.fechaVencimiento)
      }
    }

    const fechas = generarFechasVencimiento(fechaInicioGen, modalidadFinal, cantidadCuotas, fechasPersonalizadas)
    const obligacionesCreadas: any[] = []
    for (let i = 0; i < fechas.length; i++) {
      const oblig = await db.obligacionVehiculo.create({
        data: {
          contratoId: id,
          vehiculoId: contrato.vehiculoId,
          conductorId: contrato.conductorId,
          numeroCuota: existingCount + i + 1,
          fechaVencimiento: fechas[i],
          monto: tarifaFinal,
          montoPendiente: tarifaFinal,
          estado: 'PENDIENTE',
        },
      })
      obligacionesCreadas.push(oblig)
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `${obligacionesCreadas.length} obligaciones adicionales generadas para contrato ${contrato.numeroContrato}`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: { generadas: obligacionesCreadas.length },
    })
  } catch (error: any) {
    console.error('[vehiculos/contratos/generar-obligaciones] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
