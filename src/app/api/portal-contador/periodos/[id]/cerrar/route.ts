import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador, sanitizeString } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// POST /api/portal-contador/periodos/[id]/cerrar?empresaId=...
// Cambia el estado del período a CERRADO. Verifica que no haya comprobantes
// en BORRADOR (deben aprobarse o anularse primero).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth
    const user = auth as any

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get('empresaId')

    const where: any = { id }
    if (empresaId) where.empresaId = empresaId

    const periodo = await db.contPeriodo.findFirst({ where })
    if (!periodo) {
      return NextResponse.json(
        { success: false, error: 'Período no encontrado.' },
        { status: 404 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const accion = sanitizeString(body.accion, 20) || 'cerrar'

    // Reapertura: permitida solo cuando el período está CERRADO.
    if (accion === 'reabrir') {
      if (periodo.estado !== 'CERRADO') {
        return NextResponse.json(
          { success: false, error: 'Solo se pueden reabrir períodos CERRADOS.' },
          { status: 400 }
        )
      }
      const motivo = sanitizeString(body.motivo, 500) || 'Reapertura sin motivo especificado'
      const actualizado = await db.contPeriodo.update({
        where: { id },
        data: {
          estado: 'REABIERTO',
          fechaCierre: null,
          cerradoPor: null,
          motivoReapertura: motivo,
        },
      })
      return NextResponse.json({
        success: true,
        data: actualizado,
        message: 'Período reabierto.',
      })
    }

    // Acción cerrar: no permitir si ya está CERRADO.
    if (periodo.estado === 'CERRADO') {
      return NextResponse.json(
        { success: false, error: 'El período ya está CERRADO.' },
        { status: 400 }
      )
    }

    // Verificar comprobantes en BORRADOR
    const borradores = await db.contComprobante.count({
      where: { periodoId: id, estado: 'BORRADOR' },
    })
    if (borradores > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede cerrar el período: hay ${borradores} comprobante(s) en BORRADOR. Apruébelos o anúlelos primero.`,
          code: 'PERIODO_CON_BORRADORES',
          borradores,
        },
        { status: 400 }
      )
    }

    // Acción cerrar (estado pasa a CERRADO)
    const actualizado = await db.contPeriodo.update({
      where: { id },
      data: {
        estado: 'CERRADO',
        fechaCierre: new Date(),
        cerradoPor: user.nombre,
        motivoReapertura: null,
      },
    })

    return NextResponse.json({
      success: true,
      data: actualizado,
      message: 'Período cerrado correctamente.',
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
