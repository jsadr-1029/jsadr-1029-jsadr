// =====================================================
// /api/portal/pasaporte/compromiso — Registro de compromisos
// POST: registra un nuevo compromiso de pago cuando el cliente
//       tiene una novedad (pago excedido, parcial, etc.)
// PATCH: actualiza un compromiso existente (cuando el cliente
//        quiere modificar la fecha/razón o actualizar su situación)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditarAccion, verificarCompromisos } from '@/lib/pasaporte'

// === POST: Registrar nuevo compromiso ===
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de portal requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true, nombre: true },
    })

    if (!cliente || !cliente.tokenExpira || cliente.tokenExpira < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      prestamoId,
      pagoId,
      numeroCuota,
      razon,
      razonOtroTexto,
      observacionCliente,
      fechaComprometida,
      valorComprometido,
    } = body

    // Validaciones
    if (!prestamoId || !razon || !fechaComprometida || valorComprometido === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios: prestamoId, razon, fechaComprometida, valorComprometido' },
        { status: 400 }
      )
    }

    const RAZONES_VALIDAS = [
      'SIN_DISPONIBILIDAD',
      'INCIDENTE_TEMPORAL',
      'ESPERANDO_INGRESO',
      'PROBLEMA_MEDIO_PAGO',
      'SITUACION_PERSONAL',
      'OTRO',
    ]
    if (!RAZONES_VALIDAS.includes(razon)) {
      return NextResponse.json(
        { success: false, error: 'Razón inválida' },
        { status: 400 }
      )
    }

    if (razon === 'OTRO' && !razonOtroTexto?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Debe describir el motivo cuando selecciona "Otro motivo"' },
        { status: 400 }
      )
    }

    // Validar que el préstamo pertenece al cliente
    const prestamo = await db.prestamo.findFirst({
      where: { id: prestamoId, clienteId: cliente.id },
      select: { id: true, codigo: true },
    })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado o no pertenece al cliente' },
        { status: 404 }
      )
    }

    const fechaComp = new Date(fechaComprometida)
    if (isNaN(fechaComp.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Fecha comprometida inválida' },
        { status: 400 }
      )
    }

    // La fecha comprometida debe ser futura (hoy o después)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (fechaComp < hoy) {
      return NextResponse.json(
        { success: false, error: 'La fecha comprometida no puede ser anterior a hoy' },
        { status: 400 }
      )
    }

    const valorNum = parseFloat(valorComprometido)
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'El valor comprometido debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Crear el compromiso
    const compromiso = await db.compromisoPago.create({
      data: {
        clienteId: cliente.id,
        prestamoId,
        pagoId: pagoId || null,
        numeroCuota: numeroCuota || null,
        razon,
        razonOtroTexto: razonOtroTexto?.trim() || null,
        observacionCliente: observacionCliente?.trim() || null,
        fechaComprometida: fechaComp,
        valorComprometido: valorNum,
        estado: 'REGISTRADO',
        ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
      },
    })

    // Auditar
    await auditarAccion({
      clienteId: cliente.id,
      prestamoId,
      compromisoId: compromiso.id,
      tipoAccion: 'COMPROMISO_REGISTRADO',
      descripcion: `Compromiso registrado por ${cliente.nombre}. Razón: ${razon}. Fecha: ${fechaComp.toLocaleDateString('es-CO')}. Valor: $${valorNum.toLocaleString('es-CO')}.`,
      valor: valorNum,
      fechaComprometida: fechaComp,
      estado: 'REGISTRADO',
      ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      data: compromiso,
      mensaje: 'Compromiso registrado correctamente',
    })
  } catch (error: any) {
    console.error('[API /api/portal/pasaporte/compromiso POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// === PATCH: Actualizar compromiso existente (cuando el cliente incumplió) ===
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de portal requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true, nombre: true },
    })

    if (!cliente || !cliente.tokenExpira || cliente.tokenExpira < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { compromisoId, razon, razonOtroTexto, observacionCliente, fechaComprometida, valorComprometido } = body

    if (!compromisoId) {
      return NextResponse.json(
        { success: false, error: 'compromisoId es obligatorio' },
        { status: 400 }
      )
    }

    // Buscar el compromiso y validar que pertenece al cliente
    const compromiso = await db.compromisoPago.findFirst({
      where: { id: compromisoId, clienteId: cliente.id },
    })
    if (!compromiso) {
      return NextResponse.json(
        { success: false, error: 'Compromiso no encontrado' },
        { status: 404 }
      )
    }

    // Solo se puede actualizar si está en estado REGISTRADO, PROXIMO o INCUMPLIDO
    if (!['REGISTRADO', 'PROXIMO', 'INCUMPLIDO'].includes(compromiso.estado)) {
      return NextResponse.json(
        { success: false, error: `No se puede actualizar un compromiso en estado ${compromiso.estado}` },
        { status: 400 }
      )
    }

    // Validar nueva fecha
    const nuevaFecha = new Date(fechaComprometida || compromiso.fechaComprometida)
    if (isNaN(nuevaFecha.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Fecha comprometida inválida' },
        { status: 400 }
      )
    }

    const valorNum = valorComprometido !== undefined
      ? parseFloat(valorComprometido)
      : compromiso.valorComprometido

    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'El valor comprometido debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Construir el historial de actualizaciones
    const actualizacionesPrevias = compromiso.actualizaciones
      ? JSON.parse(compromiso.actualizaciones)
      : []

    const nuevaActualizacion = {
      fecha: new Date().toISOString(),
      razonAnterior: compromiso.razon,
      razonNueva: razon || compromiso.razon,
      valorAnterior: compromiso.valorComprometido,
      valorNuevo: valorNum,
      fechaAnterior: compromiso.fechaComprometida.toISOString(),
      fechaNueva: nuevaFecha.toISOString(),
      observacion: observacionCliente || null,
    }

    // Actualizar
    const compromisoActualizado = await db.compromisoPago.update({
      where: { id: compromisoId },
      data: {
        razon: razon || compromiso.razon,
        razonOtroTexto: razonOtroTexto !== undefined ? (razonOtroTexto?.trim() || null) : compromiso.razonOtroTexto,
        observacionCliente: observacionCliente !== undefined ? (observacionCliente?.trim() || null) : compromiso.observacionCliente,
        fechaComprometida: nuevaFecha,
        valorComprometido: valorNum,
        estado: 'REGISTRADO',  // resetear a REGISTRADO
        actualizaciones: JSON.stringify([...actualizacionesPrevias, nuevaActualizacion]),
        ultimaActualizacion: new Date(),
      },
    })

    // Auditar
    await auditarAccion({
      clienteId: cliente.id,
      prestamoId: compromiso.prestamoId,
      compromisoId: compromiso.id,
      tipoAccion: 'COMPROMISO_ACTUALIZADO',
      descripcion: `Compromiso actualizado por ${cliente.nombre}. Nueva fecha: ${nuevaFecha.toLocaleDateString('es-CO')}. Nuevo valor: $${valorNum.toLocaleString('es-CO')}.`,
      valor: valorNum,
      fechaComprometida: nuevaFecha,
      estado: 'REGISTRADO',
      ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    // Volver a verificar compromisos
    await verificarCompromisos(cliente.id)

    return NextResponse.json({
      success: true,
      data: compromisoActualizado,
      mensaje: 'Compromiso actualizado correctamente',
    })
  } catch (error: any) {
    console.error('[API /api/portal/pasaporte/compromiso PATCH] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// === GET: Listar compromisos del cliente ===
export async function GET_LIST(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de portal requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true },
    })

    if (!cliente || !cliente.tokenExpira || cliente.tokenExpira < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada' },
        { status: 401 }
      )
    }

    const compromisos = await db.compromisoPago.findMany({
      where: { clienteId: cliente.id },
      include: {
        prestamo: {
          select: { codigo: true, montoCuota: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: compromisos,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
