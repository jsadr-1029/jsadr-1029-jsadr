// =====================================================
// /api/vehiculos/vehiculos/[id]/documentos
// CRUD de documentos del vehículo (SOAT, tecnomecánica, seguro, etc.)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const docs = await db.documentoVehiculo.findMany({
      where: { vehiculoId: id },
      orderBy: { createdAt: 'desc' },
    })

    // Calcular estado dinámico según fecha de vencimiento
    const ahora = new Date()
    const data = docs.map(d => {
      let estadoCalculado = d.estado
      if (d.fechaVencimiento) {
        const dias = Math.ceil((d.fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
        if (dias < 0) estadoCalculado = 'VENCIDO'
        else if (dias < 15) estadoCalculado = 'POR_VENCER'
        else estadoCalculado = 'VIGENTE'
      }
      return { ...d, estado: estadoCalculado }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[vehiculos/documentos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
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
    const {
      tipo, numero, fechaEmision, fechaVencimiento,
      entidadEmisora, archivoUrl, archivosExtra, estado, notas,
    } = body

    if (!tipo) {
      return NextResponse.json({ success: false, error: 'tipo es obligatorio' }, { status: 400 })
    }

    // archivosExtra: array de URLs (base64 o públicas) con fotos adicionales del documento
    // (ej. frente y reverso de tecnomecánica). Se serializa como JSON string.
    let archivosExtraJson: string | null = null
    if (Array.isArray(archivosExtra) && archivosExtra.length > 0) {
      archivosExtraJson = JSON.stringify(archivosExtra.filter(u => typeof u === 'string' && u.length > 0))
    }

    const doc = await db.documentoVehiculo.create({
      data: {
        vehiculoId: id,
        tipo,
        numero,
        fechaEmision: fechaEmision ? new Date(fechaEmision) : null,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        entidadEmisora,
        archivoUrl,
        archivosExtra: archivosExtraJson,
        estado: estado || 'VIGENTE',
        notas,
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'DOCUMENTO',
        entidadId: doc.id,
        accion: 'CREAR',
        descripcion: `Documento ${tipo} ${numero || ''} agregado al vehículo`,
        datosNuevos: JSON.stringify(doc),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: doc })
  } catch (error: any) {
    console.error('[vehiculos/documentos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
