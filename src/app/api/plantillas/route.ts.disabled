// =====================================================
// API /api/plantillas — CRUD de Plantillas
// =====================================================
// GET    /api/plantillas           → lista todas (con filtros)
// POST   /api/plantillas           → crea nueva plantilla
// PATCH  /api/plantillas           → actualiza por id (body.id)
// DELETE /api/plantillas           → elimina por id (body.id) — solo si sistema=false
//
// Tambien soporta preview/test render via POST con action=preview
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { renderizarPlantilla, invalidarCachePlantillas } from '@/lib/plantillas'

// === GET: Listar plantillas (con filtros opcionales) ===
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') // EMAIL | WHATSAPP
    const categoria = searchParams.get('categoria')
    const evento = searchParams.get('evento')
    const activa = searchParams.get('activa')

    const where: any = {}
    if (tipo) where.tipo = tipo
    if (categoria) where.categoria = categoria
    if (evento) where.evento = evento
    if (activa === 'true') where.activa = true
    if (activa === 'false') where.activa = false

    const plantillas = await db.plantilla.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { categoria: 'asc' }, { codigo: 'asc' }],
    })

    return NextResponse.json({ success: true, data: plantillas })
  } catch (e: any) {
    console.error('[API /plantillas GET]', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Error al listar plantillas' },
      { status: 500 }
    )
  }
}

// === POST: Crear nueva plantilla ===
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    // === Action: preview (renderizar con vars de prueba) ===
    if (body.action === 'preview') {
      const contenido = body.contenido || ''
      const asunto = body.asunto || ''
      const vars = body.vars || {}
      const renderedContenido = renderizarPlantilla(contenido, vars)
      const renderedAsunto = renderizarPlantilla(asunto, vars)
      return NextResponse.json({
        success: true,
        data: { asunto: renderedAsunto, contenido: renderedContenido },
      })
    }

    // === Action: test_send (enviar email de prueba) ===
    if (body.action === 'test_send') {
      const { enviarEmail } = await import('@/lib/email')
      const { to, asunto, contenido, contenidoHtml, vars } = body
      const rAsunto = renderizarPlantilla(asunto || '', vars || {})
      const rText = renderizarPlantilla(contenido || '', vars || {})
      const rHtml = contenidoHtml ? renderizarPlantilla(contenidoHtml, vars || {}) : undefined
      const result = await enviarEmail({ to, subject: rAsunto, text: rText, html: rHtml })
      return NextResponse.json({ success: result.success, error: result.error, messageId: result.messageId })
    }

    // === Crear plantilla ===
    const { codigo, nombre, tipo, categoria, descripcion, asunto, contenido, contenidoHtml, variables, evento } = body

    if (!codigo || !nombre || !tipo || !contenido) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios: codigo, nombre, tipo, contenido' },
        { status: 400 }
      )
    }

    if (tipo !== 'EMAIL' && tipo !== 'WHATSAPP') {
      return NextResponse.json(
        { success: false, error: 'Tipo debe ser EMAIL o WHATSAPP' },
        { status: 400 }
      )
    }

    // Verificar unicidad de codigo
    const existente = await db.plantilla.findUnique({ where: { codigo } })
    if (existente) {
      return NextResponse.json(
        { success: false, error: `Ya existe una plantilla con código '${codigo}'` },
        { status: 409 }
      )
    }

    const plantilla = await db.plantilla.create({
      data: {
        codigo,
        nombre,
        tipo,
        categoria: categoria || 'GENERAL',
        descripcion: descripcion || null,
        asunto: tipo === 'EMAIL' ? (asunto || null) : null,
        contenido,
        contenidoHtml: tipo === 'EMAIL' ? (contenidoHtml || null) : null,
        variables: JSON.stringify(variables || []),
        sistema: false, // Las creadas por el admin no son de sistema
        activa: true,
        evento: evento || null,
      },
    })

    invalidarCachePlantillas()

    return NextResponse.json({ success: true, data: plantilla })
  } catch (e: any) {
    console.error('[API /plantillas POST]', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Error al crear plantilla' },
      { status: 500 }
    )
  }
}

// === PATCH: Actualizar plantilla ===
export async function PATCH(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      )
    }

    const existente = await db.plantilla.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      )
    }

    // Si es plantilla del sistema, no permitir cambiar codigo ni tipo
    const updateData: any = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre
    if (data.categoria !== undefined) updateData.categoria = data.categoria
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion
    if (data.asunto !== undefined) updateData.asunto = data.asunto
    if (data.contenido !== undefined) updateData.contenido = data.contenido
    if (data.contenidoHtml !== undefined) updateData.contenidoHtml = data.contenidoHtml
    if (data.variables !== undefined) {
      updateData.variables = typeof data.variables === 'string'
        ? data.variables
        : JSON.stringify(data.variables)
    }
    if (data.activa !== undefined) updateData.activa = data.activa
    if (data.evento !== undefined) updateData.evento = data.evento

    // Solo permitir cambiar codigo/tipo si no es del sistema
    if (!existente.sistema) {
      if (data.codigo !== undefined) updateData.codigo = data.codigo
      if (data.tipo !== undefined) updateData.tipo = data.tipo
    }

    const actualizada = await db.plantilla.update({
      where: { id },
      data: updateData,
    })

    invalidarCachePlantillas()

    return NextResponse.json({ success: true, data: actualizada })
  } catch (e: any) {
    console.error('[API /plantillas PATCH]', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Error al actualizar plantilla' },
      { status: 500 }
    )
  }
}

// === DELETE: Eliminar plantilla ===
export async function DELETE(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      )
    }

    const existente = await db.plantilla.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      )
    }

    if (existente.sistema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Las plantillas del sistema no se pueden eliminar. Puedes desactivarlas.',
        },
        { status: 403 }
      )
    }

    await db.plantilla.delete({ where: { id } })

    invalidarCachePlantillas()

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[API /plantillas DELETE]', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Error al eliminar plantilla' },
      { status: 500 }
    )
  }
}
