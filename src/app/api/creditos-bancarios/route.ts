// =====================================================
// /api/creditos-bancarios — CRUD de Préstamos Bancarios v3.0
// Gestiona Préstamos (tipo=PRESTAMO) y Tarjetas de Crédito (tipo=TARJETA_CREDITO)
// Requiere autenticación JWT (cualquier rol para GET, ADMIN/GESTOR para mutaciones)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

// GET - listar todos los créditos bancarios (con filtro opcional por tipo)
export async function GET(req: NextRequest) {
  try {
    const authResult = requireAuth(req)
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') // PRESTAMO | TARJETA_CREDITO

    const where = tipo ? { tipo } : {}

    const creditos = await db.prestamoBancario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: creditos })
  } catch (error) {
    logError('/api/creditos-bancarios GET', error)
    return errorResponse('/api/creditos-bancarios GET', error)
  }
}

// POST - crear nuevo préstamo bancario o tarjeta de crédito
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const {
      nombre,
      banco,
      tipo = 'PRESTAMO',
      montoPrincipal,
      tasaAnual,
      plazoMeses = 0,
      seguroMensual = 0,
      fechaDesembolso,
      descripcion,
      // Campos específicos de tarjeta de crédito
      cupoTotal = 0,
      saldoUtilizado = 0,
      diaCorte = 1,
      diaPago = 15,
      pagoMinimo = 0,
      pagoTotalSin = 0,
      fechaCorteActual,
      fechaPagoProximo,
    } = body

    if (!nombre || !banco) {
      return NextResponse.json(
        { success: false, error: 'Nombre y banco son obligatorios', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    if (tipo === 'PRESTAMO' && (montoPrincipal === undefined || tasaAnual === undefined)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para préstamos: montoPrincipal y tasaAnual son obligatorios',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    if (tipo === 'TARJETA_CREDITO' && !cupoTotal) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para tarjetas de crédito: cupoTotal es obligatorio',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    // Calcular cupo disponible para tarjetas
    const cupoDisponible = Math.max(0, (cupoTotal || 0) - (saldoUtilizado || 0))

    const credito = await db.prestamoBancario.create({
      data: {
        nombre,
        banco,
        tipo,
        montoPrincipal: parseFloat(montoPrincipal) || 0,
        tasaAnual: parseFloat(tasaAnual) || 0,
        plazoMeses: parseInt(plazoMeses) || 0,
        seguroMensual: parseFloat(seguroMensual) || 0,
        fechaDesembolso: fechaDesembolso ? new Date(fechaDesembolso) : new Date(),
        descripcion: descripcion || null,
        cupoTotal: parseFloat(cupoTotal) || 0,
        saldoUtilizado: parseFloat(saldoUtilizado) || 0,
        cupoDisponible,
        diaCorte: parseInt(diaCorte) || 1,
        diaPago: parseInt(diaPago) || 15,
        pagoMinimo: parseFloat(pagoMinimo) || 0,
        pagoTotalSin: parseFloat(pagoTotalSin) || 0,
        fechaCorteActual: fechaCorteActual ? new Date(fechaCorteActual) : null,
        fechaPagoProximo: fechaPagoProximo ? new Date(fechaPagoProximo) : null,
      },
    })

    return NextResponse.json({ success: true, data: credito })
  } catch (error) {
    logError('/api/creditos-bancarios POST', error)
    return errorResponse('/api/creditos-bancarios POST', error)
  }
}

// PATCH - actualizar préstamo bancario existente
export async function PATCH(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { id, ...datos } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido', code: 'MISSING_ID' },
        { status: 400 }
      )
    }

    // Convertir fechas si vienen como string
    const datosLimpios: any = { ...datos }
    if (datosLimpios.fechaDesembolso) {
      datosLimpios.fechaDesembolso = new Date(datosLimpios.fechaDesembolso)
    }
    if (datosLimpios.fechaCorteActual) {
      datosLimpios.fechaCorteActual = new Date(datosLimpios.fechaCorteActual)
    }
    if (datosLimpios.fechaPagoProximo) {
      datosLimpios.fechaPagoProximo = new Date(datosLimpios.fechaPagoProximo)
    }

    // Recalcular cupo disponible si se actualiza saldo o cupo (tarjetas)
    if (datosLimpios.cupoTotal !== undefined || datosLimpios.saldoUtilizado !== undefined) {
      const existente = await db.prestamoBancario.findUnique({ where: { id } })
      if (existente && existente.tipo === 'TARJETA_CREDITO') {
        const cupoTotal = datosLimpios.cupoTotal !== undefined ? parseFloat(datosLimpios.cupoTotal) : existente.cupoTotal
        const saldoUtilizado = datosLimpios.saldoUtilizado !== undefined ? parseFloat(datosLimpios.saldoUtilizado) : existente.saldoUtilizado
        datosLimpios.cupoDisponible = Math.max(0, cupoTotal - saldoUtilizado)
      }
    }

    // Convertir strings numéricos a números
    const camposNumericos = [
      'montoPrincipal',
      'tasaAnual',
      'plazoMeses',
      'seguroMensual',
      'cupoTotal',
      'saldoUtilizado',
      'cupoDisponible',
      'pagoMinimo',
      'pagoTotalSin',
      'diaCorte',
      'diaPago',
    ]
    for (const campo of camposNumericos) {
      if (datosLimpios[campo] !== undefined && typeof datosLimpios[campo] === 'string') {
        datosLimpios[campo] = parseFloat(datosLimpios[campo])
      }
    }

    const actualizado = await db.prestamoBancario.update({
      where: { id },
      data: datosLimpios,
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    logError('/api/creditos-bancarios PATCH', error)
    return errorResponse('/api/creditos-bancarios PATCH', error)
  }
}

// DELETE - eliminar préstamo bancario
export async function DELETE(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido', code: 'MISSING_ID' },
        { status: 400 }
      )
    }

    await db.prestamoBancario.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Crédito bancario eliminado' })
  } catch (error) {
    logError('/api/creditos-bancarios DELETE', error)
    return errorResponse('/api/creditos-bancarios DELETE', error)
  }
}
