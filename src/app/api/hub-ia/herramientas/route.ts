import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { TOOLS } from '@/lib/hub-ia/tools/registry'

export const runtime = 'nodejs'

// GET — lista de herramientas disponibles para la IA
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    return NextResponse.json({
      success: true,
      data: {
        herramientas: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          riesgo: t.riesgo,
        })),
        total: TOOLS.length,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error desconocido' },
      { status: 500 }
    )
  }
}
