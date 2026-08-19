// =====================================================
// /api/solicitudes-nuevos-clientes/consulta-publica — Búsqueda pública por cédula
// =====================================================
// Permite a un cliente consultar si tiene una solicitud DEVUELTA para corregir.
// Es público (sin auth) porque el cliente aún no tiene cuenta en el portal.
// Solo devuelve información si hay una solicitud DEVUELTA — no expone datos
// de solicitudes pendientes, aprobadas o convertidas (privacidad).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientInfo } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`solicitud-consulta:${clientInfo.ip}`, 10) // 10 por minuto
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas consultas. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(req.url)
    const cedula = (searchParams.get('cedula') || '').trim()

    if (!cedula || cedula.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Cédula requerida' },
        { status: 400 }
      )
    }

    // Buscar la solicitud más reciente en estado DEVUELTA para esa cédula
    // (No devolvemos datos de otras solicitudes por privacidad)
    const solicitud = await db.solicitudNuevoCliente.findFirst({
      where: {
        cedula,
        estado: 'DEVUELTA',
      },
      orderBy: { fechaDevolucion: 'desc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        apellido: true,
        tipoDocumento: true,
        cedula: true,
        fechaNacimiento: true,
        telefono: true,
        email: true,
        ciudad: true,
        municipio: true,
        direccion: true,
        ocupacion: true,
        ingresoMensual: true,
        banco: true,
        tipoCuenta: true,
        numeroCuenta: true,
        referidoPorNombre: true,
        referidoPorApellido: true,
        referidoPorTelefono: true,
        referidoPorParentesco: true,
        motivoDevolucion: true,
        fechaDevolucion: true,
        vecesDevuelta: true,
        createdAt: true,
        // NO se devuelven las fotos (pesan ~5MB c/u) — el cliente las debe volver a capturar
      },
    })

    if (!solicitud) {
      // No revelar si la cédula existe o no — simplemente decir que no hay
      // solicitudes pendientes de corrección
      return NextResponse.json({
        success: true,
        data: null,
        mensaje: 'No tienes solicitudes pendientes de corrección.',
      })
    }

    return NextResponse.json({
      success: true,
      data: solicitud,
      mensaje: `Tu solicitud ${solicitud.codigo} fue devuelta para corrección.`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
