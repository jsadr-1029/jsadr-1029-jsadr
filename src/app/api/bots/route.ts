// =====================================================
// /api/bots — CRUD de bots (Módulo 7 - Automatización)
//   GET    → lista todos los bots (opcional ?tipo=)
//   POST   → crea un nuevo bot
//   PATCH  → actualiza un bot existente (activo, auto, instrucciones, etc.)
//   DELETE → elimina un bot
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const TIPOS_VALIDOS = [
  'CHAT_CLIENTES',
  'ADMIN_SISTEMA',
  'CONTABILIDAD',
  'PAGOS',
  'PRESTAMOS',
  'JURIDICO',
  'SEGURIDAD',
  'ADMIN_GENERAL',
  'CONFIGURACION',
]

// =====================================================
// GET — Listar bots
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')

    const bots = await db.bot.findMany({
      where: tipo && TIPOS_VALIDOS.includes(tipo) ? { tipo } : {},
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: bots })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Crear bot
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { nombre, descripcion, tipo, instrucciones, activo, auto } = body

    if (!nombre) {
      return NextResponse.json(
        { success: false, error: 'nombre es requerido' },
        { status: 400 }
      )
    }

    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'CHAT_CLIENTES'

    const nuevo = await db.bot.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        tipo: tipoFinal,
        instrucciones: instrucciones || null,
        activo: typeof activo === 'boolean' ? activo : true,
        auto: typeof auto === 'boolean' ? auto : false,
      },
    })

    try {
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.username,
        accion: 'CREAR_BOT',
        modulo: 'automatizacion',
        entidadNombre: nombre,
        detalles: `Bot creado por ${auth.username}`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch (e) {
      // no bloquear
    }

    return NextResponse.json({ success: true, data: nuevo })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// PATCH — Actualizar bot
// Body: { id, nombre?, descripcion?, tipo?, instrucciones?, activo?, auto?, aprendizajes? }
// =====================================================
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { id, nombre, descripcion, tipo, instrucciones, activo, auto, aprendizajes } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      )
    }

    const existente = await db.bot.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Bot no encontrado' },
        { status: 404 }
      )
    }

    const datos: any = {}
    if (nombre !== undefined) datos.nombre = nombre
    if (descripcion !== undefined) datos.descripcion = descripcion
    if (tipo !== undefined && TIPOS_VALIDOS.includes(tipo)) datos.tipo = tipo
    if (instrucciones !== undefined) datos.instrucciones = instrucciones
    if (typeof activo === 'boolean') datos.activo = activo
    if (typeof auto === 'boolean') datos.auto = auto
    if (aprendizajes !== undefined) datos.aprendizajes = aprendizajes

    const actualizado = await db.bot.update({ where: { id }, data: datos })

    // Si se actualizó el modo auto o el estado, lo registramos
    if (typeof auto === 'boolean' || typeof activo === 'boolean' || aprendizajes !== undefined) {
      try {
        await registrarAuditLog({
          usuarioId: auth.id,
          usuarioNombre: auth.username,
          accion: aprendizajes !== undefined ? 'ENTRENAR_BOT' : 'ACTUALIZAR_BOT',
          modulo: 'automatizacion',
          entidadNombre: existente.nombre,
          detalles:
            aprendizajes !== undefined
              ? `Bot entrenado por ${auth.username}`
              : `Bot actualizado por ${auth.username}`,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        })
      } catch (e) {
        // no bloquear
      }
    }

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — Eliminar bot
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id es requerido (query param)' },
        { status: 400 }
      )
    }

    const existente = await db.bot.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Bot no encontrado' },
        { status: 404 }
      )
    }

    await db.bot.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
