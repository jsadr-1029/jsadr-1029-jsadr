import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, generarCronograma } from '@/lib/finance'

// Simula un préstamo basado en una categoría
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { monto, categoriaId, plazoMeses, frecuencia, token } = body

    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
    }

    let categoria = null
    if (categoriaId) {
      categoria = await db.categoria.findUnique({ where: { id: categoriaId } })
    }
    if (!categoria) {
      // Si no hay categoría, usar valores por defecto
      return NextResponse.json({
        simulacion: {
          monto: Number(monto),
          tasaMensual: 20,
          tasaAnual: 240,
          plazoMeses: Number(plazoMeses) || 1,
          frecuencia: frecuencia || 'MENSUAL',
          ...calcularPrestamo({
            monto: Number(monto),
            tasaMensual: 20,
            plazoMeses: Number(plazoMeses) || 1,
            frecuencia: frecuencia || 'MENSUAL',
          }),
        },
        cronograma: generarCronograma({
          monto: Number(monto),
          tasaMensual: 20,
          plazoMeses: Number(plazoMeses) || 1,
          frecuencia: frecuencia || 'MENSUAL',
        }),
      })
    }

    const montoNum = Number(monto)
    const plazoNum = Number(plazoMeses)
    const frec = frecuencia || 'MENSUAL'

    // Calcular tasa mensual desde la anual de la categoría
    const tasaMensual = Number(categoria.tasaInteresAnual) / 12

    const calc = calcularPrestamo({
      monto: montoNum,
      tasaMensual,
      plazoMeses: plazoNum,
      frecuencia: frec,
    })

    const cronograma = generarCronograma({
      monto: montoNum,
      tasaMensual,
      plazoMeses: plazoNum,
      frecuencia: frec,
    })

    return NextResponse.json({
      simulacion: {
        monto: montoNum,
        tasaMensual,
        tasaAnual: Number(categoria.tasaInteresAnual),
        tasaMoraAnual: Number(categoria.tasaMoraAnual),
        plazoMeses: plazoNum,
        frecuencia: frec,
        categoria: { id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo },
        ...calc,
      },
      cronograma,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
