import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// GET - obtener un cliente por id (incluye referidor y referidos)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cliente = await db.cliente.findUnique({
      where: { id },
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
        referidos: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            createdAt: true,
            activo: true,
          },
        },
        categoria: true,
        cuentaRecaudo: true,
        _count: { select: { prestamos: true, referidos: true } },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: cliente })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PUT - actualizar un cliente
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
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
      // === Preferencia de notificación (v4.4) ===
      preferenciaNotificacion,
    } = body

    // Validar preferenciaNotificacion (si viene)
    const PREF_VALIDAS = ['WHATSAPP', 'EMAIL', 'AMBOS', 'NINGUNO']
    let prefFinal: string | undefined = undefined
    if (preferenciaNotificacion !== undefined) {
      if (!PREF_VALIDAS.includes(preferenciaNotificacion)) {
        return NextResponse.json(
          { success: false, error: `Preferencia de notificación inválida. Valores válidos: ${PREF_VALIDAS.join(', ')}` },
          { status: 400 }
        )
      }
      // Si el cliente elige EMAIL o AMBOS, debe tener email
      if ((preferenciaNotificacion === 'EMAIL' || preferenciaNotificacion === 'AMBOS')) {
        const emailFinal = email !== undefined ? email : (await db.cliente.findUnique({ where: { id }, select: { email: true } }))?.email
        if (!emailFinal) {
          return NextResponse.json(
            { success: false, error: 'Si la preferencia de notificación es EMAIL o AMBOS, el correo electrónico es obligatorio.' },
            { status: 400 }
          )
        }
      }
      prefFinal = preferenciaNotificacion
    }

    // Validar cédula única si se cambia
    if (cedula) {
      const existente = await db.cliente.findFirst({
        where: {
          cedula,
          NOT: { id },
        },
      })
      if (existente) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un cliente con esa cédula' },
          { status: 400 }
        )
      }
    }

    // === v4.5 (QA M02-Clientes TC-CLI-014): email único al actualizar ===
    // Previene que un gestor asigne un email que ya pertenece a otro cliente (riesgo suplantación).
    if (email !== undefined && email && email.trim() !== '') {
      const emailExistente = await db.cliente.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          NOT: { id },
        },
        select: { id: true, nombre: true, cedula: true },
      })
      if (emailExistente) {
        return NextResponse.json(
          {
            success: false,
            error: `El correo "${email}" ya está asignado a otro cliente (${emailExistente.nombre}, cédula ${emailExistente.cedula}). No se permiten emails duplicados para prevenir suplantación.`,
            codigo: 'EMAIL_DUPLICADO',
          },
          { status: 409 }
        )
      }
    }

    // Validar que no se refiera a sí mismo
    if (referidoPorId && referidoPorId === id) {
      return NextResponse.json(
        { success: false, error: 'Un cliente no puede referirse a sí mismo' },
        { status: 400 }
      )
    }

    const clienteActualizado = await db.cliente.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(cedula !== undefined && { cedula }),
        ...(telefono !== undefined && { telefono }),
        ...(email !== undefined && { email: email || null }),
        ...(departamento !== undefined && { departamento: departamento || null }),
        ...(municipio !== undefined && { municipio: municipio || null }),
        ...(salario !== undefined && {
          salario: salario ? parseFloat(salario) : null,
        }),
        ...(fechaIngreso !== undefined && {
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
        }),
        ...(direccion !== undefined && { direccion: direccion || null }),
        ...(ciudad !== undefined && { ciudad: ciudad || null }),
        ...(barrio !== undefined && { barrio: barrio || null }),
        ...(notas !== undefined && { notas: notas || null }),
        ...(bancoCliente !== undefined && {
          bancoCliente: bancoCliente || null,
        }),
        ...(tipoCuentaCliente !== undefined && {
          tipoCuentaCliente: tipoCuentaCliente || null,
        }),
        ...(numeroCuentaCliente !== undefined && {
          numeroCuentaCliente: numeroCuentaCliente || null,
        }),
        ...(referidoPorId !== undefined && {
          referidoPorId: referidoPorId || null,
        }),
        ...(categoriaId !== undefined && {
          categoriaId: categoriaId || null,
        }),
        ...(tieneTasaPersonalizada !== undefined && {
          tieneTasaPersonalizada: tieneTasaPersonalizada === true,
        }),
        ...(tasaPersonalizada !== undefined && {
          tasaPersonalizada:
            tieneTasaPersonalizada && tasaPersonalizada
              ? parseFloat(tasaPersonalizada)
              : null,
        }),
        // === Cuenta de recaudo asignada (v3.7) ===
        ...(cuentaRecaudoId !== undefined && {
          cuentaRecaudoId: cuentaRecaudoId || null,
        }),
        ...(instruccionCuentaId !== undefined && {
          instruccionCuentaId: instruccionCuentaId || null,
        }),
        ...(instruccionCuentaNota !== undefined && {
          instruccionCuentaNota: instruccionCuentaNota || null,
        }),
        ...(instruccionCuentaExpira !== undefined && {
          instruccionCuentaExpira: instruccionCuentaExpira ? new Date(instruccionCuentaExpira) : null,
        }),
        // === Preferencia de notificación (v4.4) ===
        ...(prefFinal !== undefined && { preferenciaNotificacion: prefFinal }),
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

    return NextResponse.json({ success: true, data: clienteActualizado })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH - cambiar estado (activo/inactivo)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { activo } = body

    if (typeof activo !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'El campo "activo" debe ser booleano' },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.update({
      where: { id },
      data: { activo },
    })

    return NextResponse.json({ success: true, data: cliente })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
