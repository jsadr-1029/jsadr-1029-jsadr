// /api/bots/asistente-prestamos/simular — Simulador de crédito
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { simularPrestamo } from '@/lib/asistente-prestamos'
import { sanitizeError } from '@/lib/error-handler'

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { capital, tasaMensual, plazo, modalidad, cuotaPersonalizada, frecuencia, fondoGarantia } = body

    if (!capital || !tasaMensual || !plazo || !modalidad) {
      return NextResponse.json(
        { success: false, error: 'capital, tasaMensual, plazo y modalidad son obligatorios' },
        { status: 400 }
      )
    }

    const simulacion = simularPrestamo({
      capital: parseFloat(capital),
      tasaMensual: parseFloat(tasaMensual) / 100,
      plazo: parseInt(plazo),
      modalidad,
      cuotaPersonalizada: cuotaPersonalizada ? parseFloat(cuotaPersonalizada) : undefined,
      frecuencia,
      fondoGarantia: fondoGarantia ? parseFloat(fondoGarantia) : 0,
    })

    if ('error' in simulacion) {
      return NextResponse.json({ success: false, error: simulacion.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: simulacion })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
