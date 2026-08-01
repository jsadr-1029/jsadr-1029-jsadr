// =====================================================
// /api/bots/faqs — CRUD de Preguntas Frecuentes del bot Clientes
// GET    → lista todas las FAQs activas
// POST   → crea una nueva FAQ (rol ADMIN)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const soloActivas = searchParams.get('activas') !== 'false'

    const faqs = await db.faqBot.findMany({
      where: soloActivas ? { activa: true } : {},
      orderBy: { vecesUsada: 'desc' },
    })

    return NextResponse.json({ success: true, data: faqs })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { pregunta, respuesta, categoria, palabrasClave } = body

    if (!pregunta || !respuesta) {
      return NextResponse.json(
        { success: false, error: 'pregunta y respuesta son obligatorios' },
        { status: 400 }
      )
    }

    const faq = await db.faqBot.create({
      data: {
        pregunta: String(pregunta).slice(0, 500),
        respuesta: String(respuesta).slice(0, 5000),
        categoria: categoria || null,
        palabrasClave: palabrasClave || null,
        creadaPor: auth.nombre,
      },
    })

    return NextResponse.json({ success: true, data: faq })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
