// =====================================================
// /api/vehiculos/seed-tecnomecanica-dlw357
// Crea el registro de tecnomecánica para el vehículo DLW357
// con todos los datos del certificado expedido por
// C.D.A. Ciudad Bonita S.A.S. el 19/12/2025.
//
// Endpoint temporal: ejecutar UNA sola vez para poblar la DB.
// Se puede borrar después.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // 1. Buscar el vehículo por placa
    const vehiculo = await db.vehiculo.findFirst({
      where: { placa: 'DLW357' },
    })
    if (!vehiculo) {
      return NextResponse.json({ success: false, error: 'Vehículo con placa DLW357 no encontrado en la DB' }, { status: 404 })
    }

    // 2. Datos del certificado de tecnomecánica
    const NUM_CERTIFICADO = '186227880'
    const ENTIDAD_EMISORA = 'C.D.A. Ciudad Bonita S.A.S.'
    const NIT_EMISORA = '900198494'
    const NUM_ACREDITACION = '10-OIN-078-001'
    const FECHA_EMISION = new Date('2025-12-19T00:00:00.000-05:00')
    const FECHA_VENCIMIENTO = new Date('2026-12-19T00:00:00.000-05:00')

    // 3. Verificar si ya existe un registro de tecnomecánica para este vehículo
    // con este número de certificado. Si existe, actualizarlo.
    const existente = await db.documentoVehiculo.findFirst({
      where: {
        vehiculoId: vehiculo.id,
        tipo: 'TECNOMECANICA',
        numero: NUM_CERTIFICADO,
      },
    })

    const archivoUrl = '/vehiculos/documentos/tecnomecanica-dlw357-frente.jpg'
    const archivosExtra = JSON.stringify([
      '/vehiculos/documentos/tecnomecanica-dlw357-reverso.jpg',
    ])

    const notas = [
      'CERTIFICADO DE REVISIÓN TÉCNICO-MECÁNICA Y DE EMISIONES CONTAMINANTES',
      `Entidad expedidora: ${ENTIDAD_EMISORA}`,
      `NIT: ${NIT_EMISORA}`,
      `Número de acreditación: ${NUM_ACREDITACION}`,
      `Autoridad nacional: Ministerio de Transporte de la República de Colombia`,
      `Certificado emitido bajo el sistema RUNT`,
      '',
      'DATOS DEL VEHÍCULO SEGÚN CERTIFICADO:',
      `- Placa: DLW357`,
      `- Marca: Ford`,
      `- Línea: Fiesta`,
      `- Clase: Automóvil`,
      `- Modelo: 2012`,
      `- Servicio: Particular`,
      `- Color: Blanco Oxford`,
      `- Cilindraje: 1.597 c.c.`,
      `- Combustible: Gasolina`,
      `- Motor: CM133391`,
      `- Chasis: CM133391`,
      `- VIN: 3FADP4BJ0CM133391`,
      `- Propietario registrado: Humberto J. Guerrero G.`,
    ].join('\n')

    let documento
    if (existente) {
      documento = await db.documentoVehiculo.update({
        where: { id: existente.id },
        data: {
          numero: NUM_CERTIFICADO,
          fechaEmision: FECHA_EMISION,
          fechaVencimiento: FECHA_VENCIMIENTO,
          entidadEmisora: ENTIDAD_EMISORA,
          archivoUrl,
          archivosExtra,
          estado: 'VIGENTE',
          notas,
        },
      })
    } else {
      documento = await db.documentoVehiculo.create({
        data: {
          vehiculoId: vehiculo.id,
          tipo: 'TECNOMECANICA',
          numero: NUM_CERTIFICADO,
          fechaEmision: FECHA_EMISION,
          fechaVencimiento: FECHA_VENCIMIENTO,
          entidadEmisora: ENTIDAD_EMISORA,
          archivoUrl,
          archivosExtra,
          estado: 'VIGENTE',
          notas,
        },
      })
    }

    // 4. Actualizar ficha técnica del vehículo (motor, VIN, color, cilindraje)
    // solo si están vacíos o difieren de los datos del certificado.
    const updateVehiculo: any = {}
    if (!vehiculo.motor || vehiculo.motor !== 'CM133391') updateVehiculo.motor = 'CM133391'
    if (!vehiculo.vin || vehiculo.vin !== '3FADP4BJ0CM133391') updateVehiculo.vin = '3FADP4BJ0CM133391'
    if (!vehiculo.color || vehiculo.color !== 'Blanco Oxford') updateVehiculo.color = 'Blanco Oxford'
    if (Object.keys(updateVehiculo).length > 0) {
      await db.vehiculo.update({
        where: { id: vehiculo.id },
        data: updateVehiculo,
      })
    }

    // 5. Auditoría
    try {
      await db.auditoriaVehiculo.create({
        data: {
          entidad: 'DOCUMENTO',
          entidadId: documento.id,
          accion: existente ? 'ACTUALIZAR' : 'CREAR',
          descripcion: `Tecnomecánica ${NUM_CERTIFICADO} (${ENTIDAD_EMISORA}) ${existente ? 'actualizada' : 'creada'} para vehículo DLW357. Vence: ${FECHA_VENCIMIENTO.toLocaleDateString('es-CO')}`,
          datosNuevos: JSON.stringify(documento),
          usuarioId: 'seed-script',
          usuarioNombre: 'Seed Tecnomecánica DLW357',
        },
      })
    } catch (e) {
      console.warn('[seed-tecnomecanica-dlw357] Auditoría no creada:', e)
    }

    return NextResponse.json({
      success: true,
      message: `Tecnomecánica ${existente ? 'actualizada' : 'creada'} para vehículo DLW357`,
      data: {
        documentoId: documento.id,
        numero: NUM_CERTIFICADO,
        entidadEmisora: ENTIDAD_EMISORA,
        fechaEmision: FECHA_EMISION,
        fechaVencimiento: FECHA_VENCIMIENTO,
        estado: 'VIGENTE',
        archivoUrl,
        archivosExtra,
        vehiculoActualizado: Object.keys(updateVehiculo),
      },
    })
  } catch (error: any) {
    console.error('[seed-tecnomecanica-dlw357] Error:', error)
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Use POST para ejecutar el seed',
    info: 'POST /api/vehiculos/seed-tecnomecanica-dlw357',
  })
}
