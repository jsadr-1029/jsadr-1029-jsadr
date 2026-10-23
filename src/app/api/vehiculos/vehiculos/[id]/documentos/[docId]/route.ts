// =====================================================
// /api/vehiculos/vehiculos/[id]/documentos/[docId]
// PATCH: actualiza un documento existente (cuando se vence y se reemplaza)
// Permite actualizar: numero, fechas, entidadEmisora, archivoUrl, archivosExtra,
// estado, notas.
// DELETE: elimina un documento
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id, docId } = await params
    const body = await req.json()
    const {
      numero, fechaEmision, fechaVencimiento,
      entidadEmisora, archivoUrl, archivosExtra,
      estado, notas,
    } = body

    // Verificar que el documento existe y pertenece al vehículo
    const existente = await db.documentoVehiculo.findFirst({
      where: { id: docId, vehiculoId: id },
    })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Documento no encontrado o no pertenece a este vehículo' },
        { status: 404 }
      )
    }

    // Construir objeto de actualización solo con campos presentes
    const updateData: any = {}
    if (numero !== undefined) updateData.numero = numero
    if (fechaEmision !== undefined) updateData.fechaEmision = fechaEmision ? new Date(fechaEmision) : null
    if (fechaVencimiento !== undefined) updateData.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null
    if (entidadEmisora !== undefined) updateData.entidadEmisora = entidadEmisora
    if (archivoUrl !== undefined) updateData.archivoUrl = archivoUrl
    if (estado !== undefined) updateData.estado = estado
    if (notas !== undefined) updateData.notas = notas
    if (archivosExtra !== undefined) {
      if (Array.isArray(archivosExtra)) {
        updateData.archivosExtra = archivosExtra.length > 0
          ? JSON.stringify(archivosExtra.filter((u: any) => typeof u === 'string' && u.length > 0))
          : null
      } else if (typeof archivosExtra === 'string') {
        updateData.archivosExtra = archivosExtra
      } else if (archivosExtra === null) {
        updateData.archivosExtra = null
      }
    }

    const doc = await db.documentoVehiculo.update({
      where: { id: docId },
      data: updateData,
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'DOCUMENTO',
        entidadId: doc.id,
        accion: 'ACTUALIZAR',
        descripcion: `Documento ${existente.tipo} ${numero || existente.numero || ''} actualizado`,
        datosNuevos: JSON.stringify(doc),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: doc })
  } catch (error: any) {
    console.error('[vehiculos/documentos PATCH] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id, docId } = await params

    const existente = await db.documentoVehiculo.findFirst({
      where: { id: docId, vehiculoId: id },
    })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Documento no encontrado' },
        { status: 404 }
      )
    }

    await db.documentoVehiculo.delete({ where: { id: docId } })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'DOCUMENTO',
        entidadId: docId,
        accion: 'ELIMINAR',
        descripcion: `Documento ${existente.tipo} ${existente.numero || ''} eliminado`,
        datosNuevos: JSON.stringify(existente),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[vehiculos/documentos DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
