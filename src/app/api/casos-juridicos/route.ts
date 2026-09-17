import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const casos = await db.casoJuridico.findMany({
    include: {
      prestamo: { include: { cliente: true } },
      cronologias: { orderBy: { fecha: 'desc' } },
    },
    orderBy: { fechaApertura: 'desc' },
  })

  return NextResponse.json({
    casos: casos.map((c) => ({
      ...c,
      honorarios: Number(c.honorarios),
      honorariosPagados: Number(c.honorariosPagados),
      valorReclamado: c.valorReclamado ? Number(c.valorReclamado) : null,
      prestamo: c.prestamo
        ? {
            ...c.prestamo,
            montoPrincipal: Number(c.prestamo.montoPrincipal),
            saldoTotal: Number(c.prestamo.saldoTotal),
          }
        : null,
    })),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prestamoId, descripcion } = body

    const existe = await db.casoJuridico.findUnique({ where: { prestamoId } })
    if (existe) return NextResponse.json({ error: 'Ya existe un caso para este préstamo' }, { status: 400 })

    const caso = await db.casoJuridico.create({
      data: {
        prestamoId,
        estado: 'RADICADO',
        descripcion: descripcion || 'Caso derivado por incumplimiento de pago',
        fechaApertura: new Date(),
      },
    })

    // Cronología inicial
    await db.cronologiaCaso.create({
      data: {
        casoId: caso.id,
        fecha: new Date(),
        tipoEvento: 'NOTIFICACION',
        titulo: 'Apertura de caso jurídico',
        descripcion: caso.descripcion || '',
        resultado: 'Caso abierto',
      },
    })

    return NextResponse.json(caso, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
