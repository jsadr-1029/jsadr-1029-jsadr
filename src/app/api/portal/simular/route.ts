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

    let categoria: Awaited<ReturnType<typeof db.categoriaCliente.findUnique>> = null
    if (categoriaId) {
      categoria = await db.categoriaCliente.findUnique({ where: { id: categoriaId } })
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

    // === Validar monto dentro del rango permitido por la categoría ===
    const montoMin = Number(categoria.montoMinimo)
    const montoMax = Number(categoria.montoMaximo)
    if (montoMax > 0 && montoNum > montoMax) {
      return NextResponse.json(
        {
          error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) supera el máximo permitido para la categoría "${categoria.nombre}": ${montoMax.toLocaleString('es-CO')}.`,
          codigo: 'MONTO_EXCEDE_CATEGORIA',
          montoSolicitado: montoNum,
          montoMaximo: montoMax,
          categoria: { id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo },
        },
        { status: 400 }
      )
    }
    if (montoMin > 0 && montoNum < montoMin) {
      return NextResponse.json(
        {
          error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) es inferior al mínimo permitido para la categoría "${categoria.nombre}": ${montoMin.toLocaleString('es-CO')}.`,
          codigo: 'MONTO_INFERIOR_CATEGORIA',
          montoSolicitado: montoNum,
          montoMinimo: montoMin,
          categoria: { id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo },
        },
        { status: 400 }
      )
    }

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
