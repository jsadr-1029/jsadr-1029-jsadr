// /api/bots/asistente-personal/categorias — Listar categorías financieras
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') // INGRESO | GASTO
    const ambito = searchParams.get('ambito') // NEGOCIO | PERSONAL

    const where: any = { activa: true }
    if (tipo) where.tipo = tipo
    if (ambito) where.OR = [{ ambito }, { ambito: 'AMBOS' }]

    const categorias = await db.categoriaFinanciera.findMany({ where, orderBy: { nombre: 'asc' } })
    return NextResponse.json({ success: true, data: categorias })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
