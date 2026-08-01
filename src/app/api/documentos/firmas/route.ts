import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'

// =====================================================
// GET /api/documentos/firmas
// Lista todas las firmas electrónicas con sus fotos (selfie + firma dibujada)
// Esto permite ver las fotos de identidad y firmas registradas al aceptar T&C.
//
// Query: ?q=busqueda & prestamoId=xxx & clienteId=xxx & estado=COMPLETADA
//        &accion=detalle&id=xxx  → retorna una firma específica con fotos
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`documentos-firmas:${clientInfo.ip}`, 30)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')

    // === MODO DETALLE: retornar 1 firma específica con fotos ===
    if (accion === 'detalle') {
      const id = searchParams.get('id')
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'id es requerido cuando accion=detalle' },
          { status: 400 }
        )
      }
      const firma = await db.firmaElectronica.findUnique({
        where: { id },
        include: {
          prestamo: { select: { id: true, codigo: true } },
          cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true } },
        },
      })
      if (!firma) {
        return NextResponse.json(
          { success: false, error: 'Firma no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, data: firma })
    }

    // === MODO LISTAR ===
    const q = (searchParams.get('q') || '').trim()
    const prestamoId = searchParams.get('prestamoId') || ''
    const clienteId = searchParams.get('clienteId') || ''
    const estado = searchParams.get('estado') || ''
    const limite = parseInt(searchParams.get('limite') || '200', 10)

    const where: any = {}
    if (q) {
      where.OR = [
        { cliente: { nombre: { contains: q } } },
        { cliente: { cedula: { contains: q } } },
        { prestamo: { codigo: { contains: q } } },
        { firmanteNombre: { contains: q } },
        { firmanteCedula: { contains: q } },
      ]
    }
    if (prestamoId) where.prestamoId = prestamoId
    if (clienteId) where.clienteId = clienteId
    if (estado) where.estadoFirma = estado

    const firmas = await db.firmaElectronica.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 500),
      include: {
        prestamo: { select: { id: true, codigo: true } },
        cliente: { select: { id: true, nombre: true, cedula: true } },
      },
    })

    const data = firmas.map((f) => ({
      id: f.id,
      prestamoId: f.prestamoId,
      prestamoCodigo: f.prestamo?.codigo || null,
      clienteId: f.clienteId,
      clienteNombre: f.cliente?.nombre || null,
      clienteCedula: f.cliente?.cedula || null,
      tipo: f.tipo,
      estadoFirma: f.estadoFirma,
      esFirmaCodeudor: f.esFirmaCodeudor,
      firmanteRol: f.firmanteRol,
      firmanteNombre: f.firmanteNombre,
      firmanteCedula: f.firmanteCedula,
      // Indicadores (sin el base64, que es pesado)
      tieneSelfie: !!f.fotoSelfie,
      tieneFotoDocumento: !!f.fotoDocumento,
      tieneFirmaDibujada: !!f.imagenFirma,
      tieneDocumentoFirmado: !!f.documentoFirmado,
      // OTP info
      otpCanal: f.otpCanal,
      otpValidado: f.otpValidado,
      otpFechaEnvio: f.otpFechaEnvio,
      otpFechaValidacion: f.otpFechaValidacion,
      intentosOTP: f.intentosOTP,
      // Metadata
      ipFirma: f.ipFirma,
      userAgent: f.userAgent,
      geoUbicacion: f.geoUbicacion,
      fechaSubidaFotos: f.fechaSubidaFotos,
      fechaFirmaCompleta: f.fechaFirmaCompleta,
      createdAt: f.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      resumen: {
        total: data.length,
        completadas: data.filter((f) => f.estadoFirma === 'COMPLETADA').length,
        pendientes: data.filter((f) => f.estadoFirma === 'PENDIENTE').length,
        conSelfie: data.filter((f) => f.tieneSelfie).length,
        conFirmaDibujada: data.filter((f) => f.tieneFirmaDibujada).length,
      },
    })
  } catch (error: any) {
    console.error('[documentos/firmas GET] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
