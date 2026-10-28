import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

export const runtime = 'nodejs'

// GET — estadísticas de uso (tokens, costo, por provider/modelo/usuario)
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const dias = parseInt(searchParams.get('dias') || '30', 10)
    const desde = new Date(Date.now() - dias * 86400000)

    const [usos, porProvider, porModelo, porUsuario, total] = await Promise.all([
      db.hubIAUso.findMany({
        where: { createdAt: { gte: desde } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, usuarioNombre: true, provider: true, modelo: true,
          tokensInput: true, tokensOutput: true, costo: true,
          exito: true, errorMessage: true, createdAt: true,
        },
      }),
      db.hubIAUso.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: desde } },
        _sum: { tokensInput: true, tokensOutput: true, costo: true },
        _count: true,
      }),
      db.hubIAUso.groupBy({
        by: ['modelo'],
        where: { createdAt: { gte: desde } },
        _sum: { tokensInput: true, tokensOutput: true, costo: true },
        _count: true,
      }),
      db.hubIAUso.groupBy({
        by: ['usuarioNombre'],
        where: { createdAt: { gte: desde } },
        _sum: { tokensInput: true, tokensOutput: true, costo: true },
        _count: true,
        orderBy: { _sum: { costo: 'desc' } },
        take: 10,
      }),
      db.hubIAUso.aggregate({
        where: { createdAt: { gte: desde } },
        _sum: { tokensInput: true, tokensOutput: true, costo: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        dias,
        desde: desde.toISOString(),
        hasta: new Date().toISOString(),
        total: {
          solicitudes: total._count,
          tokensInput: total._sum.tokensInput || 0,
          tokensOutput: total._sum.tokensOutput || 0,
          costo: total._sum.costo || 0,
        },
        porProvider,
        porModelo,
        porUsuario,
        usosRecientes: usos,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
