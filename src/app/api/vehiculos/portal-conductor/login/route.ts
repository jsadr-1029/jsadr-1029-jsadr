// =====================================================
// /api/vehiculos/portal-conductor/login
// Login del conductor por cédula (NO reemplaza autenticación segura,
// pero permite al conductor ver SU información).
//
// Estrategia:
//  - Recibe cédula
//  - Si existe conductor con contrato ACTIVO → genera token de sesión
//  - Retorna token + datos básicos del conductor
//  - El token se valida en cada endpoint /portal-conductor/*
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { cedula } = await req.json()

    if (!cedula) {
      return NextResponse.json(
        { success: false, error: 'Cédula requerida' },
        { status: 400 }
      )
    }

    const conductor = await db.conductorVehiculo.findUnique({
      where: { cedula: String(cedula).trim() },
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
          include: { vehiculo: true },
          take: 1,
        },
      },
    })

    if (!conductor || !conductor.activo) {
      return NextResponse.json(
        { success: false, error: 'Cédula no registrada como conductor activo' },
        { status: 404 }
      )
    }

    // Verificar bloqueo
    if (conductor.bloqueadoHasta && conductor.bloqueadoHasta > new Date()) {
      return NextResponse.json({
        success: false,
        error: `Cuenta bloqueada hasta ${conductor.bloqueadoHasta.toLocaleString('es-CO')}`,
      }, { status: 403 })
    }

    // Generar token de sesión (válido 12 horas)
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date()
    expira.setHours(expira.getHours() + 12)

    await db.conductorVehiculo.update({
      where: { id: conductor.id },
      data: {
        tokenSesion: token,
        tokenExpira: expira,
        ultimoAcceso: new Date(),
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    })

    const contratoActivo = conductor.contratos[0]
    if (!contratoActivo) {
      return NextResponse.json({
        success: true,
        data: {
          token,
          conductor: {
            id: conductor.id,
            nombre: conductor.nombre,
            cedula: conductor.cedula,
          },
          contrato: null,
          warning: 'No tienes contrato activo en este momento.',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        token,
        conductor: {
          id: conductor.id,
          nombre: conductor.nombre,
          cedula: conductor.cedula,
          telefono: conductor.telefono,
        },
        contrato: {
          id: contratoActivo.id,
          numero: contratoActivo.numeroContrato,
          fechaInicio: contratoActivo.fechaInicio,
          fechaFin: contratoActivo.fechaFin,
          modalidadPago: contratoActivo.modalidadPago,
          tarifa: contratoActivo.tarifa,
          diasGracia: contratoActivo.diasGracia,
          multaDiaria: contratoActivo.multaDiaria,
          deposito: contratoActivo.deposito,
          vehiculo: {
            placa: contratoActivo.vehiculo.placa,
            marca: contratoActivo.vehiculo.marca,
            modelo: contratoActivo.vehiculo.modelo,
            anio: contratoActivo.vehiculo.anio,
            color: contratoActivo.vehiculo.color,
            kilometraje: contratoActivo.vehiculo.kilometraje,
          },
        },
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/login] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
