import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/documentos/[id] — obtener documento (metadata + archivoBase64)
// Query: ?accion=descargar → retorna el archivo binario (no JSON)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // === Verificación de auth (IDOR protection) ===
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')

    const doc = await db.documentoGestor.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
    }

    // === MODO DESCARGAR: retornar el archivo binario ===
    if (accion === 'descargar') {
      // Extraer el contenido base64 del data URI
      const matches = doc.archivoBase64.match(/^data:([^;]+);base64,(.*)$/)
      if (!matches) {
        return NextResponse.json(
          { success: false, error: 'Formato de archivo inválido' },
          { status: 500 }
        )
      }
      const mimeType = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Content-Disposition': `inline; filename="${doc.archivoNombre || doc.titulo}"`,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    // === MODO VER (default): retorna JSON con metadata + base64 ===
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        prestamoId: doc.prestamoId,
        clienteId: doc.clienteId,
        tipo: doc.tipo,
        titulo: doc.titulo,
        descripcion: doc.descripcion,
        archivoBase64: doc.archivoBase64,
        archivoNombre: doc.archivoNombre,
        archivoTipo: doc.archivoTipo,
        archivoTamano: doc.archivoTamano,
        subidoPor: doc.subidoPor,
        fechaSubida: doc.createdAt,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// DELETE /api/documentos/[id] — eliminar documento
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // === Verificación de auth (IDOR protection) ===
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const doc = await db.documentoGestor.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
    }
    await db.documentoGestor.delete({ where: { id } })
    return NextResponse.json({ success: true, mensaje: 'Documento eliminado' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// PATCH /api/documentos/[id] — editar documento
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { titulo, descripcion, tipo } = body

    const data: any = {}
    if (titulo !== undefined) data.titulo = titulo
    if (descripcion !== undefined) data.descripcion = descripcion
    if (tipo !== undefined) data.tipo = tipo

    const actualizado = await db.documentoGestor.update({
      where: { id },
      data,
    })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
