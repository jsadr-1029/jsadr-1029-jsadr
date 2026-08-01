import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clienteSchema, validateInput } from '@/lib/validators'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// GET - listar todos los clientes (con referidor incluido)
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const soloActivos = searchParams.get('activos') === '1'

    const clientes = await db.cliente.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        referidoPor: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            departamento: true,
            municipio: true,
            direccion: true,
            bancoCliente: true,
            tipoCuentaCliente: true,
            numeroCuentaCliente: true,
          },
        },
        cuentaRecaudo: true,
        _count: {
          select: { prestamos: true, referidos: true },
        },
      },
    })
    return NextResponse.json({ success: true, data: clientes })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// POST - crear nuevo cliente
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()

    // Reforzado: validar con Zod antes de procesar
    const validacion = validateInput(clienteSchema, body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: validacion.error, fieldErrors: validacion.fieldErrors },
        { status: 400 }
      )
    }

    const {
      nombre,
      cedula,
      telefono,
      email,
      departamento,
      municipio,
      salario,
      fechaIngreso,
      direccion,
      ciudad,
      barrio,
      notas,
      bancoCliente,
      tipoCuentaCliente,
      numeroCuentaCliente,
      referidoPorId,
      categoriaId,
      tieneTasaPersonalizada,
      tasaPersonalizada,
      // === Cuenta de recaudo asignada (v3.7) ===
      cuentaRecaudoId,
      instruccionCuentaId,
      instruccionCuentaNota,
      instruccionCuentaExpira,
    } = body

    if (!nombre || !cedula || !telefono) {
      return NextResponse.json(
        { success: false, error: 'Nombre, cédula y teléfono son obligatorios' },
        { status: 400 }
      )
    }

    // Validar cédula única
    const existente = await db.cliente.findUnique({ where: { cedula } })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un cliente con esa cédula' },
        { status: 400 }
      )
    }

    // Validar referidor si viene
    if (referidoPorId) {
      const ref = await db.cliente.findUnique({
        where: { id: referidoPorId },
      })
      if (!ref) {
        return NextResponse.json(
          { success: false, error: 'El cliente referidor no existe' },
          { status: 400 }
        )
      }
    }

    const cliente = await db.cliente.create({
      data: {
        nombre,
        cedula,
        telefono,
        email: email || null,
        departamento: departamento || null,
        municipio: municipio || null,
        salario: salario ? parseFloat(salario) : null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
        direccion: direccion || null,
        ciudad: ciudad || null,
        barrio: barrio || null,
        notas: notas || null,
        bancoCliente: bancoCliente || null,
        tipoCuentaCliente: tipoCuentaCliente || null,
        numeroCuentaCliente: numeroCuentaCliente || null,
        referidoPorId: referidoPorId || null,
        categoriaId: categoriaId || null,
        tieneTasaPersonalizada: tieneTasaPersonalizada === true,
        tasaPersonalizada:
          tieneTasaPersonalizada && tasaPersonalizada
            ? parseFloat(tasaPersonalizada)
            : null,
        // === Cuenta de recaudo asignada (v3.7) ===
        cuentaRecaudoId: cuentaRecaudoId || null,
        instruccionCuentaId: instruccionCuentaId || null,
        instruccionCuentaNota: instruccionCuentaNota || null,
        instruccionCuentaExpira: instruccionCuentaExpira ? new Date(instruccionCuentaExpira) : null,
      },
      include: {
        referidoPor: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
            departamento: true,
            municipio: true,
            direccion: true,
            bancoCliente: true,
            tipoCuentaCliente: true,
            numeroCuentaCliente: true,
          },
        },
        cuentaRecaudo: true,
      },
    })

    return NextResponse.json({ success: true, data: cliente })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
