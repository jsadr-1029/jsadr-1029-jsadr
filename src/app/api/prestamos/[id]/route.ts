import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, calcularMoraCompuesta, calcularDiasMora, getTasaMoraDiaria, debeIrAJuridico } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'
import { buildAbsoluteUrl } from '@/lib/url'
import { rateLimit, getClientInfo } from '@/lib/security'

// GET - detalle de un solicitud
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params

    const prestamo = await db.prestamo.findUnique({
      where: { id },
      include: {
        cliente: { include: { categoria: true } },
        categoria: true,
        pagos: { orderBy: { numeroCuota: 'asc' }, include: { cuentaRecaudo: true } },
        casoJuridico: {
          include: {
            cronologias: { orderBy: { fecha: 'desc' } },
            documentos: { orderBy: { fechaSubida: 'desc' } },
            alertas: { orderBy: { fechaAlerta: 'asc' } },
          },
        },
        notificaciones: { orderBy: { fechaEnvio: 'desc' } },
        firmas: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrado' }, { status: 404 })
    }

    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraDiaria(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || undefined,
    })

    const tasaMoraEfectiva = getTasaMoraDiaria(prestamo)

    const tablaConEstado = calculo.tablaAmortizacion.map((cuota) => {
      const pago = prestamo.pagos.find((p) => p.numeroCuota === cuota.numero)
      const diasMora = pago ? 0 : calcularDiasMora(cuota.fechaVencimiento)
      // Mora sobre CAPITAL INICIAL PRESTADO (política del usuario: % diario sobre capital inicial)
      const moraGenerada =
        pago ? 0 :
        diasMora > 0
          ? calcularMoraCompuesta(prestamo.montoPrincipal, tasaMoraEfectiva, diasMora)
          : 0
      return {
        ...cuota,
        pagada: !!pago,
        fechaPago: pago?.fechaPago || null,
        diasMora,
        moraGenerada,
        enviarJuridico: !pago && debeIrAJuridico(diasMora),
      }
    })

    // Calcular mora total actual
    const moraTotalActual = tablaConEstado
      .filter((c) => !c.pagada && c.diasMora > 0)
      .reduce((sum, c) => sum + c.moraGenerada, 0)

    // Verificar si debe ir a jurídico (60 días)
    const diasMoraMaximo = Math.max(
      0,
      ...tablaConEstado.filter((c) => !c.pagada).map((c) => c.diasMora)
    )
    const enviarAJuridico = debeIrAJuridico(diasMoraMaximo)

    return NextResponse.json({
      success: true,
      data: {
        ...prestamo,
        tablaAmortizacion: tablaConEstado,
        moraTotalActual,
        diasMoraMaximo,
        enviarAJuridico,
        tasaMoraEfectiva,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// PATCH - actualizar estado (aceptar T&C, aprobar, cancelar, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth
  const user = auth // AuthUser
  try {
    const { id } = await params
    const body = await req.json()
    const { accion, tasaMoraPersonalizada, datosFirma, motivo } = body

    const prestamo = await db.prestamo.findUnique({
      where: { id },
      include: { cliente: true },
    })

    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrado' }, { status: 404 })
    }

    let datosActualizacion: any = {}
    let bitacoraEntrada: { tipo: string; titulo: string; descripcion: string; resultado: string } | null = null

    switch (accion) {
      case 'aprobar_y_enviar_tyc': {
        // Guard: solo se puede aprobar desde SOLICITUD
        if (prestamo.estado !== 'SOLICITUD') {
          return NextResponse.json(
            { success: false, error: `No se puede aprobar: el solicitud está en estado ${prestamo.estado} (solo se aprueba desde SOLICITUD).` },
            { status: 400 }
          )
        }
        // Aprobar y enviar T&C al cliente para aceptación
        const { generarTokenTyC } = await import('@/lib/finanzas')
        const { enviarWhatsApp, mensajeAprobacionTyC } = await import('@/lib/whatsapp')
        const tycToken = generarTokenTyC()
        const linkAceptacion = buildAbsoluteUrl(`/?tyc=${tycToken}`)

        datosActualizacion = {
          estado: 'PENDIENTE_ACEPTACION',
          fechaAprobacion: new Date(),
          tycEnviado: true,
          tycToken,
        }

        const mensaje = mensajeAprobacionTyC({
          nombreCliente: prestamo.cliente.nombre,
          codigoPrestamo: prestamo.codigo,
          monto: prestamo.montoPrincipal,
          cuota: prestamo.montoCuota,
          numeroCuotas: prestamo.numeroCuotas,
          tasaAnual: prestamo.tasaInteresAnual,
          totalPagar: prestamo.totalPagar,
          linkAceptacion,
        })
        const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
        await db.notificacionLog.create({
          data: {
            prestamoId: prestamo.id,
            clienteTelefono: prestamo.cliente.telefono,
            tipo: 'TYC',
            mensaje,
            estado: envio.exito ? 'ENVIADO' : 'FALLIDO',
            error: envio.error || null,
          },
        })
        bitacoraEntrada = {
          tipo: 'APROBACION',
          titulo: 'Solicitud aprobado y TyC enviado',
          descripcion: `Se aprobó el solicitud ${prestamo.codigo} por $${prestamo.montoPrincipal.toLocaleString()} (${prestamo.plazoMeses} meses, ${prestamo.numeroCuotas} cuotas). Se envió el link de aceptación de TyC al cliente ${prestamo.cliente.nombre} por WhatsApp.`,
          resultado: envio.exito ? 'TyC enviado correctamente al cliente' : `Envío falló: ${envio.error || 'error desconocido'}`,
        }
        break
      }

      case 'aceptar_tyc': {
        // Guard: solo se puede aceptar TyC desde PENDIENTE_ACEPTACION
        if (prestamo.estado !== 'PENDIENTE_ACEPTACION') {
          return NextResponse.json(
            { success: false, error: `No se puede aceptar TyC: el solicitud está en estado ${prestamo.estado} (solo se acepta desde PENDIENTE_ACEPTACION).` },
            { status: 400 }
          )
        }
        // ====================================================
        // SEGURIDAD: Validar tycToken Y que todos los OTPs
        // requeridos estén verificados (deudor + codeudor si aplica).
        // Esto evita que un gestor active un solicitud sin que el
        // cliente haya confirmado mediante el flujo de OTP dual.
        // ====================================================
        const tycTokenRecibido = body.tycToken
        if (!tycTokenRecibido || tycTokenRecibido !== prestamo.tycToken) {
          return NextResponse.json(
            { success: false, error: 'Token de TyC inválido o ausente. El cliente debe aceptar los TyC desde el enlace enviado por WhatsApp o el gestor debe verificar los códigos OTP mediante /api/prestamos/[id]/verificar-codigo.' },
            { status: 403 }
          )
        }

        // Verificar que todos los OTP requeridos estén verificados
        const requiereCodeudorAceptacion =
          prestamo.tieneCodeudor === true &&
          typeof prestamo.codeudorEmail === 'string' &&
          prestamo.codeudorEmail.trim().length > 0

        const codigosConfirmacion = await db.codigoConfirmacion.findMany({
          where: { prestamoId: id },
        })
        const rolesRequeridos: Array<'DEUDOR' | 'CODEUDOR'> = requiereCodeudorAceptacion
          ? ['DEUDOR', 'CODEUDOR']
          : ['DEUDOR']
        const faltantes = rolesRequeridos.filter(rol => {
          const c = codigosConfirmacion.find(x => x.rol === rol)
          return !c || !c.verificado
        })
        if (faltantes.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `No se puede activar el solicitud: faltan verificar los códigos OTP de los roles: ${faltantes.join(', ')}.`,
              faltantes,
            },
            { status: 400 }
          )
        }

        // Todos los checks pasaron → activar
        datosActualizacion = {
          estado: 'ACTIVO',
          tycAceptado: true,
          tycFechaAceptacion: new Date(),
          fechaDesembolso: new Date(),
          tycToken: null, // consumir el token después de usado
        }
        bitacoraEntrada = {
          tipo: 'ACTIVACION',
          titulo: 'Solicitud activado (TyC aceptado)',
          descripcion: `El cliente ${prestamo.cliente.nombre} aceptó los Términos y Condiciones${requiereCodeudorAceptacion ? ' (junto con el codeudor)' : ''}. Solicitud ${prestamo.codigo} pasa a estado ACTIVO con fecha de desembolso ${new Date().toLocaleString('es-CO')}.`,
          resultado: 'Solicitud activado y desembolsado',
        }
        break
      }

      case 'rechazar':
        // Guard: solo se puede rechazar desde SOLICITUD o PENDIENTE_ACEPTACION
        if (!['SOLICITUD', 'PENDIENTE_ACEPTACION'].includes(prestamo.estado)) {
          return NextResponse.json(
            { success: false, error: `No se puede rechazar: el solicitud está en estado ${prestamo.estado}.` },
            { status: 400 }
          )
        }
        datosActualizacion = { estado: 'RECHAZADO' }
        bitacoraEntrada = {
          tipo: 'RECHAZO',
          titulo: 'Solicitud rechazado',
          descripcion: `Se rechazó el solicitud ${prestamo.codigo} del cliente ${prestamo.cliente.nombre}.`,
          resultado: 'Solicitud marcado como RECHAZADO',
        }
        break

      case 'cerrar':
        // Guard: solo se puede cerrar desde ACTIVO, EN_MORA o JURIDICO
        if (!['ACTIVO', 'EN_MORA', 'JURIDICO'].includes(prestamo.estado)) {
          return NextResponse.json(
            { success: false, error: `No se puede cerrar: el solicitud está en estado ${prestamo.estado}.` },
            { status: 400 }
          )
        }
        datosActualizacion = {
          estado: 'CANCELADO',
          saldoCapital: 0,
          saldoInteres: 0,
          saldoTotal: 0,
        }
        bitacoraEntrada = {
          tipo: 'CIERRE',
          titulo: 'Solicitud cerrado/liquidado',
          descripcion: `Se cerró el solicitud ${prestamo.codigo}. Saldo anterior: capital $${prestamo.saldoCapital?.toLocaleString() || 0}, interés $${prestamo.saldoInteres?.toLocaleString() || 0}, total $${prestamo.saldoTotal?.toLocaleString() || 0}.`,
          resultado: 'Solicitud marcado como CANCELADO con saldos en cero',
        }
        break

      case 'anular':
        // === v4.6 (QA M03 TC-PRE-009): anular solicitud ===
        // Solo ADMIN puede anular. Solo se puede anular desde ACTIVO (sin pagos).
        // El Excel espera estado=ANULADO. El schema actual no contempla ANULADO
        // como valor distinto de CANCELADO/RECHAZADO, así que mapeamos a RECHAZADO
        // (que es el estado canónico del sistema para "solicitud cancelado sin desembolsar/fallido").
        // Guard: solo ADMIN
        if (user.rol !== 'ADMIN') {
          return NextResponse.json(
            { success: false, error: 'Solo el ADMIN puede anular solicitudes.', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
        // Guard: solo desde ACTIVO o SOLICITUD o PENDIENTE_ACEPTACION, y sin pagos aplicados
        if (!['ACTIVO', 'SOLICITUD', 'PENDIENTE_ACEPTACION'].includes(prestamo.estado)) {
          return NextResponse.json(
            { success: false, error: `No se puede anular: el solicitud está en estado ${prestamo.estado}.` },
            { status: 400 }
          )
        }
        if (prestamo.estado === 'ACTIVO') {
          const pagosAplicados = await db.pago.count({
            where: { prestamoId: id, estado: 'APLICADO' },
          })
          if (pagosAplicados > 0) {
            return NextResponse.json(
              { success: false, error: `No se puede anular: el solicitud tiene ${pagosAplicados} pago(s) aplicado(s). Revierta los pagos primero o use la acción 'cerrar'.` },
              { status: 400 }
            )
          }
        }
        datosActualizacion = {
          estado: 'RECHAZADO', // estado canónico del sistema para anulado/rechazado
          notas: (prestamo.notas || '') + `\n[ANULADO ${new Date().toISOString()}] Motivo: ${motivo || 'No especificado'}`,
        }
        bitacoraEntrada = {
          tipo: 'ANULACION',
          titulo: 'Solicitud anulado',
          descripcion: `Solicitud ${prestamo.codigo} anulado por ${user?.nombre || 'ADMIN'}. Motivo: ${motivo || 'No especificado'}.`,
          resultado: 'Solicitud marcado como RECHAZADO (anulado)',
        }
        break

      case 'enviar_juridico':
        // Guard: solo se puede enviar a jurídico desde EN_MORA
        if (prestamo.estado !== 'EN_MORA') {
          return NextResponse.json(
            { success: false, error: `No se puede enviar a jurídico: el solicitud está en estado ${prestamo.estado} (solo se envía desde EN_MORA).` },
            { status: 400 }
          )
        }
        datosActualizacion = { estado: 'JURIDICO' }
        bitacoraEntrada = {
          tipo: 'JURIDICO',
          titulo: 'Solicitud enviado a jurídico',
          descripcion: `El solicitud ${prestamo.codigo} del cliente ${prestamo.cliente.nombre} fue enviado a cobro jurídico. Días de mora previos: ${prestamo.diasMora}.`,
          resultado: 'Solicitud marcado como JURIDICO',
        }
        break

      case 'actualizar_tasa_mora':
        // Modificar la tasa moratoria de este solicitud
        datosActualizacion = {
          tasaMoraPersonalizada: parseFloat(tasaMoraPersonalizada),
        }
        bitacoraEntrada = {
          tipo: 'OTRO',
          titulo: 'Tasa de mora actualizada',
          descripcion: `Se actualizó la tasa moratoria personalizada del solicitud ${prestamo.codigo} a ${tasaMoraPersonalizada}%. Tasa anterior: ${prestamo.tasaMoraPersonalizada ?? 'no personalizada (usaba diaria*360)'}.`,
          resultado: 'Tasa de mora personalizada guardada',
        }
        break

      case 'guardar_firma':
        // Guard: la firma solo aplica a solicitudes que ya fueron desembolsados (ACTIVO, EN_MORA, JURIDICO)
        if (!['ACTIVO', 'EN_MORA', 'JURIDICO', 'PENDIENTE_ACEPTACION'].includes(prestamo.estado)) {
          return NextResponse.json(
            { success: false, error: `No se puede guardar firma: el solicitud está en estado ${prestamo.estado}.` },
            { status: 400 }
          )
        }
        // Guardar referencia a firma electrónica
        if (datosFirma) {
          const firma = await db.firmaElectronica.create({
            data: {
              prestamoId: prestamo.id,
              clienteId: prestamo.clienteId,
              tipo: datosFirma.tipo || 'PAGARE',
              imagenFirma: datosFirma.imagenFirma,
              otpValidado: datosFirma.otpValidado || false,
              otpCodigo: datosFirma.otpCodigo || null,
              otpFechaValidacion: datosFirma.otpValidado ? new Date() : null,
              documentoFirmado: datosFirma.documentoFirmado || null,
            },
          })
          datosActualizacion.firmaId = firma.id
          // Persistir codeudorFirmaId si la firma es del codeudor
          if (datosFirma.firmanteRol === 'CODEUDOR' || datosFirma.esFirmaCodeudor) {
            datosActualizacion.codeudorFirmaId = firma.id
          }
          bitacoraEntrada = {
            tipo: 'FIRMA',
            titulo: `Firma electrónica guardada (${datosFirma.firmanteRol || 'DEUDOR'})`,
            descripcion: `Se registró firma electrónica ${firma.id} para el solicitud ${prestamo.codigo}. OTP validado: ${datosFirma.otpValidado ? 'sí' : 'no'}.`,
            resultado: 'Firma electrónica persistida y vinculada al solicitud',
          }
        }
        break

      default:
        return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
    }

    const actualizado = await db.prestamo.update({
      where: { id },
      data: datosActualizacion,
      include: { cliente: true },
    })

    // Registrar en bitácora del solicitud (todas las acciones excepto guardar_firma pura sin contexto)
    if (bitacoraEntrada) {
      try {
        await db.bitacoraPrestamo.create({
          data: {
            prestamoId: prestamo.id,
            prestamoCodigo: prestamo.codigo,
            usuarioNombre: 'Sistema (PATCH)',
            tipo: bitacoraEntrada.tipo,
            titulo: bitacoraEntrada.titulo,
            descripcion: bitacoraEntrada.descripcion,
            resultado: bitacoraEntrada.resultado,
          },
        })
      } catch (e) {
        console.error('[PATCH /prestamos/[id]] bitácora falló:', e)
      }
    }

    // NOTA: La carga del fondo de garantía a la caja CAJA-GARANTIA se hace
    // MANUALMENTE por el administrador desde el módulo de Cajas Menores.
    // Ya no se carga automáticamente al activar el solicitud.
    // El solicitud sigue registrado con el monto del fondo de garantía
    // (campo fondoGarantiaMonto) para referencia, pero el saldo de la caja
    // se gestiona 100% manual.

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// === DELETE - ELIMINAR SOLICITUD COMPLETO (con todos sus registros) ===
// Borra en cascada: pagos, firmas electrónicas, tokens de firma, notificaciones,
// documentos del gestor, bitácora, caso jurídico (si existe), y el solicitud mismo.
// Útil para corregir errores de creación.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`prestamo-delete:${clientInfo.ip}`, 5)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const motivo = searchParams.get('motivo') || 'Eliminación por error'

    // Buscar el solicitud con todas sus relaciones
    const prestamo = await db.prestamo.findUnique({
      where: { id },
      include: {
        cliente: true,
        pagos: true,
        firmas: true,
        tokensFirma: true,
        notificaciones: true,
        casoJuridico: {
          include: {
            cronologias: true,
            documentos: true,
            alertas: true,
          },
        },
        documentos: true,
      },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrado' },
        { status: 404 }
      )
    }

    // Contar bitácoras por separado (no se puede incluir directamente)
    const totalBitacoras = await db.bitacoraPrestamo.count({ where: { prestamoId: id } })

    // Guardar info para el audit log ANTES de borrar
    const infoPrestamo = {
      id: prestamo.id,
      codigo: prestamo.codigo,
      clienteId: prestamo.clienteId,
      clienteNombre: prestamo.cliente.nombre,
      clienteCedula: prestamo.cliente.cedula,
      montoPrincipal: prestamo.montoPrincipal,
      estado: prestamo.estado,
      totalPagos: prestamo.pagos.length,
      totalFirmas: prestamo.firmas.length,
      totalTokensFirma: prestamo.tokensFirma.length,
      totalNotificaciones: prestamo.notificaciones.length,
      totalDocumentos: prestamo.documentos.length,
      totalBitacoras,
      tieneCasoJuridico: !!prestamo.casoJuridico,
    }

    // === Borrar en $transaction (atómico) ===
    // Incluye FKs previamente omitidos que causaban P2003:
    // Refinanciacion, PagoProgramado, MovimientoCaja, CodigoConfirmacion.
    await db.$transaction(async (tx) => {
      // 1. Borrar pagos
      await tx.pago.deleteMany({ where: { prestamoId: id } })

      // 2. Borrar tokens de firma
      await tx.tokenFirma.deleteMany({ where: { prestamoId: id } })

      // 3. Borrar firmas electrónicas
      await tx.firmaElectronica.deleteMany({ where: { prestamoId: id } })

      // 4. Borrar notificaciones
      await tx.notificacionLog.deleteMany({ where: { prestamoId: id } })

      // 5. Borrar documentos del gestor vinculados al solicitud
      await tx.documentoGestor.deleteMany({ where: { prestamoId: id } })

      // 6. Borrar bitácora del solicitud
      await tx.bitacoraPrestamo.deleteMany({ where: { prestamoId: id } })

      // 7. Borrar caso jurídico (si existe) y sus relaciones
      if (prestamo.casoJuridico) {
        const casoId = prestamo.casoJuridico.id
        await tx.cronologiaCaso.deleteMany({ where: { casoId } })
        await tx.documentoLegal.deleteMany({ where: { casoId } })
        await tx.alertaLegal.deleteMany({ where: { casoId } })
        await tx.casoJuridico.delete({ where: { id: casoId } })
      }

      // 8. Borrar FKs faltantes que causaban P2003
      // Refinanciaciones donde este solicitud es el origen (relación 1:N)
      await tx.refinanciacion.deleteMany({ where: { prestamoId: id } }).catch(() => {})

      // Pagos programados (si existen como tabla separada)
      await tx.pagoProgramado.deleteMany({ where: { prestamoId: id } }).catch(() => {})

      // Movimientos de caja asociados al solicitud (no los borramos —
      // son registros contables; en su lugar, desvinculamos el FK
      // seteando prestamoId=null para preservar la trazabilidad)
      await tx.movimientoCaja.updateMany({
        where: { prestamoId: id },
        data: { prestamoId: null },
      }).catch(() => {})

      // Códigos de confirmación (OTP dual)
      await tx.codigoConfirmacion.deleteMany({ where: { prestamoId: id } }).catch(() => {})

      // 9. Borrar el solicitud
      await tx.prestamo.delete({ where: { id } })
    })

    // 9. Crear audit log inmutable
    await db.auditLog.create({
      data: {
        usuarioId: user.id === 'system' ? null : user.id,
        usuarioNombre: user.nombre,
        accion: 'PRESTAMO_ELIMINADO',
        modulo: 'prestamos',
        entidadId: id,
        entidadNombre: `${prestamo.codigo} - ${prestamo.cliente.nombre}`,
        detalles: JSON.stringify({
          ...infoPrestamo,
          motivo,
        }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      },
    })

    return NextResponse.json({
      success: true,
      mensaje: `Solicitud ${prestamo.codigo} eliminado completamente. Se borraron: ${infoPrestamo.totalPagos} pagos, ${infoPrestamo.totalFirmas} firmas, ${infoPrestamo.totalNotificaciones} notificaciones, ${infoPrestamo.totalDocumentos} documentos, ${infoPrestamo.totalBitacoras} entradas de bitácora${infoPrestamo.tieneCasoJuridico ? ', 1 caso jurídico' : ''}.`,
      data: {
        codigo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
        registrosBorrados: {
          pagos: infoPrestamo.totalPagos,
          firmas: infoPrestamo.totalFirmas,
          tokensFirma: infoPrestamo.totalTokensFirma,
          notificaciones: infoPrestamo.totalNotificaciones,
          documentos: infoPrestamo.totalDocumentos,
          bitacoras: infoPrestamo.totalBitacoras,
          casoJuridico: infoPrestamo.tieneCasoJuridico ? 1 : 0,
        },
      },
    })
  } catch (error: any) {
    console.error('[DELETE solicitud] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
