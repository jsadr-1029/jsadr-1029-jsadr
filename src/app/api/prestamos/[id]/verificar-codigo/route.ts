import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, getTasaMoraAnual } from '@/lib/finanzas'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { hashOtp, verificarOtp } from '@/lib/otp'
import { esCodigoHasheado } from '@/lib/prestamo-codigo'

// =====================================================
// GET - Consultar estado de verificación de códigos del préstamo.
// Útil para que la UI muestre qué roles ya están verificados y cuáles faltan.
// =====================================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(_req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params

    const prestamo = await db.prestamo.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        estado: true,
        metodoConfirmacion: true,
        tieneCodeudor: true,
        codeudorNombre: true,
        codeudorEmail: true,
        cliente: { select: { nombre: true, email: true } },
      },
    })

    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
    }

    const requiereCodeudor =
      prestamo.tieneCodeudor === true &&
      typeof prestamo.codeudorEmail === 'string' &&
      prestamo.codeudorEmail.trim().length > 0

    const codigos = await db.codigoConfirmacion.findMany({
      where: { prestamoId: id },
      orderBy: { rol: 'asc' },
    })

    const rolesRequeridos: Array<'DEUDOR' | 'CODEUDOR'> = requiereCodeudor
      ? ['DEUDOR', 'CODEUDOR']
      : ['DEUDOR']

    const verificacion: Record<string, any> = {}
    for (const rol of rolesRequeridos) {
      const c = codigos.find(x => x.rol === rol)
      verificacion[rol] = c
        ? {
            email: c.emailCliente,
            verificado: c.verificado,
            fechaVerificacion: c.fechaVerificacion,
            fechaExpiracion: c.fechaExpiracion,
            expirado: new Date() > c.fechaExpiracion,
            intentos: c.intentos,
          }
        : null
    }

    const faltantes = rolesRequeridos.filter(rol => !verificacion[rol]?.verificado)
    const todosVerificados = faltantes.length === 0

    return NextResponse.json({
      success: true,
      data: {
        prestamoId: prestamo.id,
        prestamoCodigo: prestamo.codigo,
        estadoPrestamo: prestamo.estado,
        requiereCodeudor,
        destinatarios: {
          DEUDOR: { nombre: prestamo.cliente.nombre, email: prestamo.cliente.email },
          ...(requiereCodeudor
            ? { CODEUDOR: { nombre: prestamo.codeudorNombre, email: prestamo.codeudorEmail } }
            : {}),
        },
        verificacion,
        faltantes,
        todosVerificados,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// =====================================================
// Verificación de código(s) de confirmación por correo.
//
// REGLA DE NEGOCIO (préstamos con codeudor):
//   El gestor envía el `rol` junto con el `codigo`:
//     { codigo: "ABC123", rol: "DEUDOR" }
//     { codigo: "XYZ789", rol: "CODEUDOR" }
//   El sistema marca ese rol como verificado. El préstamo se
//   activa ÚNICAMENTE cuando todos los roles requeridos estén
//   verificados:
//     - Sin codeudor: basta con DEUDOR verificado.
//     - Con codeudor: requiere DEUDOR y CODEUDOR verificados.
// =====================================================

function normalizarRol(input: any): 'DEUDOR' | 'CODEUDOR' | null {
  if (typeof input !== 'string') return null
  const r = input.trim().toUpperCase()
  if (r === 'DEUDOR' || r === 'CODEUDOR') return r
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { codigo } = body

    if (!codigo || typeof codigo !== 'string') {
      return NextResponse.json(
        { success: false, error: 'El código es obligatorio' },
        { status: 400 }
      )
    }

    // El rol es obligatorio para distinguir a quién pertenece el código.
    // Si no se envía, se asume 'DEUDOR' por retrocompatibilidad (préstamos
    // antiguos generados antes de la lógica dual).
    let rol = normalizarRol(body.rol)
    if (!rol) rol = 'DEUDOR'

    // === Cargar el préstamo para saber si requiere codeudor ===
    const prestamo = await db.prestamo.findUnique({
      where: { id },
      include: { cliente: true },
    })

    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
    }

    // Validar que el rol sea coherente con el préstamo:
    const requiereCodeudor =
      prestamo.tieneCodeudor === true &&
      typeof prestamo.codeudorEmail === 'string' &&
      prestamo.codeudorEmail.trim().length > 0

    if (rol === 'CODEUDOR' && !requiereCodeudor) {
      return NextResponse.json(
        { success: false, error: 'Este préstamo NO tiene codeudor. Verifica el código con rol DEUDOR.' },
        { status: 400 }
      )
    }

    // === Buscar el código de confirmación para este rol ===
    const codigoConfirmacion = await db.codigoConfirmacion.findUnique({
      where: { prestamoId_rol: { prestamoId: id, rol } },
    })

    if (!codigoConfirmacion) {
      return NextResponse.json(
        {
          success: false,
          error: `No hay código de confirmación para el rol ${rol}. Solicita que se envíe primero.`,
        },
        { status: 404 }
      )
    }

    if (codigoConfirmacion.verificado) {
      // Ya estaba verificado: comprobar si ya se puede activar el préstamo
      const estadoVerificacion = await obtenerEstadoVerificacion(id, requiereCodeudor)
      if (estadoVerificacion.todosVerificados) {
        return NextResponse.json(
          { success: true, mensaje: `Este rol (${rol}) ya estaba verificado y el préstamo ya fue activado.` },
          { status: 200 }
        )
      }
      return NextResponse.json(
        {
          success: false,
          error: `El código de ${rol} ya fue verificado anteriormente. Falta verificar: ${estadoVerificacion.faltantes.join(', ')}.`,
        },
        { status: 400 }
      )
    }

    if (new Date() > codigoConfirmacion.fechaExpiracion) {
      return NextResponse.json(
        { success: false, error: `El código de ${rol} ha expirado. Solicita un nuevo código de confirmación.` },
        { status: 400 }
      )
    }

    // === Verificar el código contra el hash almacenado ===
    // Soporta dos formatos en CodigoConfirmacion.codigo:
    //   - Hash SHA-256 (64 hex chars) — nuevo formato, generado por prestamo-codigo.ts
    //   - Plaintext (6 chars) — formato legacy anterior al fix C8
    // Si es legacy y el código es correcto, se migra on-the-fly a hash.
    const storedValue = codigoConfirmacion.codigo
    const codigoIngresadoNormalized = codigo.trim().toUpperCase()
    let codigoCorrecto: boolean
    let needsHashMigration = false

    if (esCodigoHasheado(storedValue)) {
      // Nuevo formato: comparación constant-time contra el hash
      codigoCorrecto = verificarOtp(codigoIngresadoNormalized, storedValue)
    } else {
      // Legacy plaintext: comparación directa case-insensitive
      codigoCorrecto =
        typeof storedValue === 'string' &&
        storedValue.trim().toUpperCase() === codigoIngresadoNormalized
      if (codigoCorrecto) needsHashMigration = true
    }

    // === Incrementar intentos (siempre, para evitar timing oracle) ===
    const actualizado = await db.codigoConfirmacion.update({
      where: { id: codigoConfirmacion.id },
      data: { intentos: { increment: 1 } },
    })

    if (!codigoCorrecto) {
      if (actualizado.intentos >= 5) {
        await db.codigoConfirmacion.update({
          where: { id: codigoConfirmacion.id },
          data: { usado: true },
        })
        return NextResponse.json(
          { success: false, error: `Código de ${rol} incorrecto. Se agotaron los intentos. Solicita un nuevo código.` },
          { status: 401 }
        )
      }
      const intentosRestantes = 5 - actualizado.intentos
      return NextResponse.json(
        { success: false, error: `Código de ${rol} incorrecto. Intentos restantes: ${intentosRestantes}` },
        { status: 401 }
      )
    }

    // === CÓDIGO CORRECTO → marcar como verificado ATÓMICAMENTE ===
    // RACE CONDITION FIX (C7): usar updateMany con where verificado=false
    // para que SOLO UNA llamada concurrente pueda marcarlo como verificado.
    // Si dos gestores llaman simultáneamente, solo el primero pasa (count=1);
    // el segundo recibe count=0 y tratamos su llamada como "ya verificado".
    const updateResult = await db.codigoConfirmacion.updateMany({
      where: { id: codigoConfirmacion.id, verificado: false },
      data: {
        verificado: true,
        usado: true,
        fechaVerificacion: new Date(),
        // Migrar a hash si era plaintext legacy
        ...(needsHashMigration ? { codigo: hashOtp(codigoIngresadoNormalized) } : {}),
      },
    })

    if (updateResult.count === 0) {
      // Otra llamada concurrente ya marcó este rol como verificado entre
      // nuestro findUnique y nuestro updateMany. Tratar como idempotente.
      const estadoVerificacion = await obtenerEstadoVerificacion(id, requiereCodeudor)
      if (estadoVerificacion.todosVerificados) {
        return NextResponse.json(
          { success: true, mensaje: `Este rol (${rol}) fue verificado concurrentemente y el préstamo ya fue activado.` },
          { status: 200 }
        )
      }
      return NextResponse.json(
        {
          success: false,
          error: `El código de ${rol} fue verificado por otra sesión concurrente. Pendiente: ${estadoVerificacion.faltantes.join(', ')}.`,
        },
        { status: 409 }
      )
    }

    await registrarAuditLog({
      usuarioNombre: 'Gestor',
      accion: 'CODIGO_VERIFICADO',
      modulo: 'prestamos',
      entidadId: id,
      entidadNombre: prestamo.codigo,
      detalles: JSON.stringify({
        rol,
        email: codigoConfirmacion.emailCliente,
        // SECURITY: NO persistir el código OTP en plano en audit log.
        codigoHashed: hashOtp(codigoIngresadoNormalized),
        migradoDePlano: needsHashMigration,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    // === Comprobar si ya se verificaron todos los roles requeridos ===
    const estado = await obtenerEstadoVerificacion(id, requiereCodeudor)

    if (!estado.todosVerificados) {
      // Aún falta al menos un rol
      return NextResponse.json({
        success: true,
        activado: false,
        mensaje: `✅ Código de ${rol} verificado correctamente. Pendiente: falta verificar ${estado.faltantes.join(', ')} para activar el préstamo.`,
        data: {
          prestamoCodigo: prestamo.codigo,
          estadoPrestamo: prestamo.estado,
          verificacion: {
            requiereCodeudor,
            verificados: estado.verificados,
            faltantes: estado.faltantes,
          },
        },
      })
    }

    // === TODOS VERIFICADOS → activar el préstamo ATÓMICAMENTE ===
    // RACE CONDITION FIX (C7): envolver update préstamo + audit log + bitácora
    // en una transacción para que la activación sea atómica. Si la bitácora
    // falla, el préstamo NO se activa (rollback) — antes podía quedar activado
    // sin registro histórico.
    //
    // Además, doble-verificación de estado previo a la activación: si otra
    // llamada concurrente ya activó el préstamo, no duplicar la activación.
    const fechaDesembolso = new Date()
    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso,
    })

    const activacionResult = await db.$transaction(async (tx) => {
      // Atomic conditional update: SOLO actualiza si el préstamo sigue
      // en estado pendiente. Si otra llamada ya lo activó, count=0 y no
      // duplicamos la activación ni los logs.
      const updated = await tx.prestamo.updateMany({
        where: { id, estado: { in: ['SOLICITUD', 'PENDIENTE_ACEPTACION'] } },
        data: {
          estado: 'ACTIVO',
          tycAceptado: true,
          tycFechaAceptacion: new Date(),
          fechaDesembolso,
          fechaVencimiento: calculo.fechaVencimiento,
        },
      })

      if (updated.count === 0) {
        // El préstamo ya fue activado por otra llamada concurrente.
        return { yaActivado: true }
      }

      await tx.auditLog.create({
        data: {
          usuarioNombre: 'Gestor',
          accion: 'PRESTAMO_CONFIRMADO_CODIGO',
          modulo: 'prestamos',
          entidadId: id,
          entidadNombre: prestamo.codigo,
          detalles: JSON.stringify({
            metodo: 'CODIGO_CORREO',
            requiereCodeudor,
            verificados: estado.verificados,
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        },
      })

      await tx.bitacoraPrestamo.create({
        data: {
          prestamoId: id,
          prestamoCodigo: prestamo.codigo,
          usuarioNombre: 'Sistema',
          tipo: 'OTRO',
          titulo: requiereCodeudor
            ? 'Préstamo confirmado con códigos de correo (deudor + codeudor)'
            : 'Préstamo confirmado con código de correo',
          descripcion: requiereCodeudor
            ? `El préstamo fue confirmado mediante doble verificación OTP: el DEUDOR (${estado.verificados.DEUDOR?.email}) y el CODEUDOR (${estado.verificados.CODEUDOR?.email}) verificaron su código. El préstamo fue activado y desembolsado.`
            : `El cliente verificó el préstamo mediante código de confirmación enviado a ${estado.verificados.DEUDOR?.email}. El préstamo fue activado y desembolsado.`,
          resultado: 'Préstamo ACTIVO',
        },
      })

      return { yaActivado: false }
    })

    if (activacionResult.yaActivado) {
      // El préstamo ya estaba activo (otra llamada concurrente lo activó).
      // Responder como éxito idempotente para no confundir al gestor.
      return NextResponse.json({
        success: true,
        activado: true,
        mensaje: `El préstamo ${prestamo.codigo} ya estaba activado (verificación concurrente).`,
        data: {
          prestamoCodigo: prestamo.codigo,
          estado: 'ACTIVO',
          verificacion: {
            requiereCodeudor,
            verificados: estado.verificados,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      activado: true,
      mensaje: `✅ Todos los códigos requeridos fueron verificados. El préstamo ${prestamo.codigo} ha sido activado y desembolsado.`,
      data: {
        prestamoCodigo: prestamo.codigo,
        estado: 'ACTIVO',
        fechaDesembolso,
        fechaVencimiento: calculo.fechaVencimiento,
        verificacion: {
          requiereCodeudor,
          verificados: estado.verificados,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// =====================================================
// Helpers
// =====================================================
async function obtenerEstadoVerificacion(
  prestamoId: string,
  requiereCodeudor: boolean
): Promise<{
  verificados: Record<string, { email: string; fechaVerificacion: Date | null }>
  faltantes: string[]
  todosVerificados: boolean
}> {
  const codigos = await db.codigoConfirmacion.findMany({
    where: { prestamoId },
  })

  const verificados: Record<string, { email: string; fechaVerificacion: Date | null }> = {}
  const faltantes: string[] = []

  const rolesRequeridos: Array<'DEUDOR' | 'CODEUDOR'> = requiereCodeudor
    ? ['DEUDOR', 'CODEUDOR']
    : ['DEUDOR']

  for (const rol of rolesRequeridos) {
    const c = codigos.find(x => x.rol === rol)
    if (c && c.verificado) {
      verificados[rol] = { email: c.emailCliente, fechaVerificacion: c.fechaVerificacion }
    } else {
      faltantes.push(rol)
    }
  }

  return {
    verificados,
    faltantes,
    todosVerificados: faltantes.length === 0,
  }
}
