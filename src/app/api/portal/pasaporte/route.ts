// =====================================================
// /api/portal/pasaporte — Datos completos del Pasaporte
// GET: retorna toda la información del pasaporte de confianza
// del cliente autenticado en el portal.
//
// Autenticación: token del portal (header x-portal-token
// o query token) validado contra Cliente.tokenSesion.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generarPasaporte, verificarCompromisos, auditarAccion } from '@/lib/pasaporte'
import { safeCompare } from '@/lib/security'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || req.headers.get('x-portal-token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de portal requerido' },
        { status: 401 }
      )
    }

    // Buscar cliente por token de sesión
    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        tokenExpira: true,
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida' },
        { status: 401 }
      )
    }

    // Validar expiración
    if (!cliente.tokenExpira || cliente.tokenExpira < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada. Inicie sesión nuevamente.' },
        { status: 401 }
      )
    }

    // Verificar compromisos cumplidos/incumplidos antes de generar el pasaporte
    await verificarCompromisos(cliente.id)

    // Auditar la consulta
    await auditarAccion({
      clienteId: cliente.id,
      tipoAccion: 'CONSULTA_PASAPORTE',
      descripcion: `Consulta del pasaporte de confianza`,
      ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    // Generar pasaporte completo
    const pasaporte = await generarPasaporte(cliente.id)

    return NextResponse.json({
      success: true,
      data: pasaporte,
    })
  } catch (error: any) {
    console.error('[API /api/portal/pasaporte] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
