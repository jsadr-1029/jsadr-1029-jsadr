import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const caso = await db.casoJuridico.findUnique({
    where: { id },
    include: {
      prestamo: { include: { cliente: true, pagos: true } },
      cronologias: { orderBy: { fecha: 'desc' } },
    },
  })
  if (!caso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({
    ...caso,
    honorarios: Number(caso.honorarios),
    honorariosPagados: Number(caso.honorariosPagados),
    valorReclamado: caso.valorReclamado ? Number(caso.valorReclamado) : null,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const data: any = {}
    const allowed = [
      'estado', 'abogadoNombre', 'abogadoTelefono', 'abogadoEmail', 'abogadoAsignado',
      'honorarios', 'honorariosPagados', 'juzgado', 'radicado', 'tipoProceso',
      'valorReclamado', 'fechaPresentacionDemanda', 'fechaAdmision', 'fechaEmbargo',
      'fechaAudiencia', 'fechaCierre', 'resultadoFinal', 'descripcion',
    ]
    for (const f of allowed) {
      if (body[f] !== undefined) {
        if (['honorarios', 'honorariosPagados', 'valorReclamado'].includes(f)) {
          data[f] = body[f] === null ? null : Number(body[f])
        } else if (['fechaPresentacionDemanda', 'fechaAdmision', 'fechaEmbargo', 'fechaAudiencia', 'fechaCierre'].includes(f)) {
          data[f] = body[f] ? new Date(body[f]) : null
        } else {
          data[f] = body[f]
        }
      }
    }
    const updated = await db.casoJuridico.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Añadir cronología
  try {
    const body = await req.json()
    const { tipoEvento, titulo, descripcion, resultado, actor } = body
    const cron = await db.cronologiaCaso.create({
      data: {
        casoId: id,
        fecha: new Date(),
        tipoEvento: tipoEvento || 'OTRO',
        titulo,
        descripcion: descripcion || null,
        resultado: resultado || null,
        actor: actor || null,
      },
    })
    return NextResponse.json(cron, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
