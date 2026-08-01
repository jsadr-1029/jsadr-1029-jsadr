import { NextRequest, NextResponse } from 'next/server'
import { calcularPrestamo, Frecuencia } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'

// POST - simular crédito
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { montoPrincipal, tasaInteresAnual, plazoMeses, frecuencia } = body

    if (!montoPrincipal || !tasaInteresAnual || !plazoMeses || !frecuencia) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos son obligatorios' },
        { status: 400 }
      )
    }

    const calculo = calcularPrestamo({
      montoPrincipal: parseFloat(montoPrincipal),
      tasaInteresAnual: parseFloat(tasaInteresAnual),
      tasaMoraAnual: parseFloat(tasaInteresAnual), // no aplica para simulación
      plazoMeses: parseInt(plazoMeses),
      frecuencia: frecuencia as Frecuencia,
    })

    return NextResponse.json({ success: true, data: calculo })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
