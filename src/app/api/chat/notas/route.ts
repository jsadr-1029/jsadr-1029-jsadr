// =====================================================
// /api/chat/notas — Notas internas (solo asesores)
// GET  /api/chat/notas?conversacionId=    → lista notas
// POST /api/chat/notas                     → crea nota
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

// === GET — listar notas internas ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const conversacionId = searchParams.get('conversacionId') || ''

    if (!conversacionId) {
      return NextResponse.json(
        { success: false, error: 'conversacionId es obligatorio' },
        { status: 400 }
      )
    }

    const notas = await db.notaInterna.findMany({
      where: { conversacionId },
      include: {
        autor: { select: { id: true, nombre: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: notas })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === POST — crear nota interna ===
export async function POST(req: NextRequest) {
  try {
    // Solo ADMIN y GESTOR pueden crear notas (asesores)
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { conversacionId, contenido, esImportante } = body

    if (!conversacionId || !contenido) {
      return NextResponse.json(
        { success: false, error: 'conversacionId y contenido son obligatorios' },
        { status: 400 }
      )
    }

    const conversacion = await db.conversacionChat.findUnique({
      where: { id: conversacionId },
      select: { id: true, codigo: true, permiteNotasInternas: true },
    })
    if (!conversacion) {
      return NextResponse.json(
        { success: false, error: 'Conversación no encontrada' },
        { status: 404 }
      )
    }
    if (!conversacion.permiteNotasInternas) {
      return NextResponse.json(
        { success: false, error: 'La conversación no permite notas internas' },
        { status: 400 }
      )
    }

    const nota = await db.notaInterna.create({
      data: {
        conversacionId,
        autorId: auth.id !== 'system' ? auth.id : (await ensureSystemUser()).id,
        contenido: String(contenido).slice(0, 5000),
        esImportante: !!esImportante,
      },
      include: {
        autor: { select: { id: true, nombre: true, username: true } },
      },
    })

    await registrarAuditLog({
      usuarioId: auth.id !== 'system' ? auth.id : null,
      usuarioNombre: auth.nombre,
      accion: 'CHAT_NOTA_CREADA',
      modulo: 'centro_comunicaciones',
      entidadId: conversacionId,
      entidadNombre: conversacion.codigo,
      detalles: JSON.stringify({ esImportante: !!esImportante }),
      exito: true,
    })

    return NextResponse.json({ success: true, data: nota })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === Helper: asegurar que existe un usuario "system" para FK de autor ===
async function ensureSystemUser() {
  let user = await db.usuario.findFirst({ where: { username: 'system' } })
  if (!user) {
    user = await db.usuario.create({
      data: {
        nombre: 'Sistema',
        email: 'system@aurora.local',
        username: 'system',
        passwordHash: 'disabled',
        rol: 'ADMIN',
        activo: true,
      },
    })
  }
  return user
}
