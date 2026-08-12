import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, getTasaMoraAnual, formatearMoneda } from '@/lib/finanzas'
import { generarCodigoOtp, hashOtp, verificarOtp, registrarOtp, validarEmailEntregable } from '@/lib/otp'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { enviarEmail } from '@/lib/email'
import crypto from 'crypto'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// =====================================================
// Helper: Registrar ingresos automáticos en cajas correspondientes
// (Tarea U) — Se ejecuta cuando el préstamo pasa a ACTIVO tras la
// aceptación de T&C. Registra los ingresos por:
//   • Flexibilidad Financiera    → CAJA-FLEXIBILIDAD
//   • Días causados (corte)      → CAJA-INGRESOS-CAUSADOS
//   • Pagaré + Carta             → CAJA-PAGARE-CARTA
//   • Tarifa de Uso de Plataforma → CAJA-USO-PLATAFORMA
// Solo registra los ingresos que apliquen al préstamo y que no se hayan
// registrado antes (idempotente vía tarifaPlataformaCargada / flag en
// la descripción del movimiento).
// =====================================================
async function registrarIngresosCajasPorActivacion(prestamoId: string) {
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    select: {
      id: true,
      codigo: true,
      flexibilidadFinanciera: true,
      flexibilidadCosto: true,
      flexibilidadModalidad: true,
      flexibilidadActivada: true,
      valorDiasCausados: true,
      cobroPagareCarta: true,
      valorPagareCarta: true,
      cobroTarifaPlataforma: true,
      valorTarifaPlataforma: true,
      tarifaPlataformaCargada: true,
      cliente: { select: { nombre: true } },
    },
  })
  if (!prestamo) return null

  // Buscar las 4 cajas (deben existir — creadas por scripts/_seed-cajas-tarea-u.cjs)
  const codigosCajas = ['CAJA-FLEXIBILIDAD', 'CAJA-INGRESOS-CAUSADOS', 'CAJA-PAGARE-CARTA', 'CAJA-USO-PLATAFORMA']
  const cajas = await db.cajaMenor.findMany({ where: { codigo: { in: codigosCajas } } })
  const cajaPorCodigo: Record<string, string> = {}
  for (const c of cajas) cajaPorCodigo[c.codigo] = c.id

  const ingresos: Array<{ cajaCodigo: string; monto: number; concepto: string; referencia: string }> = []

  // 1) Flexibilidad Financiera
  if (prestamo.flexibilidadFinanciera && prestamo.flexibilidadActivada && (prestamo.flexibilidadCosto || 0) > 0) {
    ingresos.push({
      cajaCodigo: 'CAJA-FLEXIBILIDAD',
      monto: prestamo.flexibilidadCosto,
      concepto: `Flexibilidad Financiera (${prestamo.flexibilidadModalidad || 'BASICA'}) — Préstamo ${prestamo.codigo}`,
      referencia: prestamo.codigo,
    })
  }

  // 2) Días causados (valorDiasCausados)
  if ((prestamo.valorDiasCausados || 0) > 0) {
    ingresos.push({
      cajaCodigo: 'CAJA-INGRESOS-CAUSADOS',
      monto: prestamo.valorDiasCausados!,
      concepto: `Ingresos por días causados (periodo de corte) — Préstamo ${prestamo.codigo}`,
      referencia: prestamo.codigo,
    })
  }

  // 3) Pagaré + Carta
  if (prestamo.cobroPagareCarta && (prestamo.valorPagareCarta || 0) > 0) {
    ingresos.push({
      cajaCodigo: 'CAJA-PAGARE-CARTA',
      monto: prestamo.valorPagareCarta,
      concepto: `Pagaré + Carta de Instrucciones — Préstamo ${prestamo.codigo}`,
      referencia: prestamo.codigo,
    })
  }

  // 4) Tarifa de Uso de Plataforma (solo si no se ha cargado antes)
  if (prestamo.cobroTarifaPlataforma && !prestamo.tarifaPlataformaCargada && (prestamo.valorTarifaPlataforma || 0) > 0) {
    ingresos.push({
      cajaCodigo: 'CAJA-USO-PLATAFORMA',
      monto: prestamo.valorTarifaPlataforma,
      concepto: `Tarifa de Uso de Plataforma — Préstamo ${prestamo.codigo}`,
      referencia: prestamo.codigo,
    })
  }

  if (ingresos.length === 0) return { registrados: 0 }

  // Verificar duplicados: buscar movimientos previos con la misma referencia+concepto
  const movsPrevios = await db.movimientoCaja.findMany({
    where: {
      referencia: prestamo.codigo,
      tipo: 'INGRESO',
      concepto: { in: ingresos.map((i) => i.concepto) },
    },
    select: { concepto: true },
  })
  const conceptosPrevios = new Set(movsPrevios.map((m) => m.concepto))

  const ingresosANuevo = ingresos.filter((i) => !conceptosPrevios.has(i.concepto))
  if (ingresosANuevo.length === 0) return { registrados: 0, yaRegistrados: ingresos.length }

  // Transacción: crear movimientos + actualizar saldos + marcar tarifaPlataformaCargada
  await db.$transaction(async (tx) => {
    for (const ing of ingresosANuevo) {
      const cajaId = cajaPorCodigo[ing.cajaCodigo]
      if (!cajaId) {
        console.warn(`[registrarIngresosCajasPorActivacion] Caja ${ing.cajaCodigo} no encontrada, saltando...`)
        continue
      }
      await tx.movimientoCaja.create({
        data: {
          cajaId,
          tipo: 'INGRESO',
          monto: ing.monto,
          concepto: ing.concepto,
          referencia: ing.referencia,
          prestamoId,
          creadoPor: 'Sistema (auto-activación)',
          ambito: 'NEGOCIO',
        },
      })
      await tx.cajaMenor.update({
        where: { id: cajaId },
        data: {
          saldoActual: { increment: ing.monto },
          totalIngresos: { increment: ing.monto },
        },
      })
    }

    // Marcar tarifaPlataformaCargada=true si se registró
    if (prestamo.cobroTarifaPlataforma && !prestamo.tarifaPlataformaCargada) {
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { tarifaPlataformaCargada: true },
      })
    }
  })

  return { registrados: ingresosANuevo.length }
}

// =====================================================
// Helper: cancelar crédito anterior si el préstamo actual es renovación
// (Tarea T) — Se ejecuta únicamente cuando el cliente completa la aceptación
// de T&C del nuevo préstamo. El crédito anterior se cancela en ese momento
// (no antes) para que el cliente no pierda su crédito activo mientras no
// haya aceptado formalmente las nuevas condiciones.
// =====================================================
async function cancelarPrestamoAnteriorSiRenovacion(prestamoNuevoId: string) {
  const nuevo = await db.prestamo.findUnique({
    where: { id: prestamoNuevoId },
    select: {
      id: true,
      codigo: true,
      renovacionPendienteTyc: true,
      renovacionPrestamoAnteriorId: true,
      montoPrincipal: true,
      cliente: { select: { id: true, nombre: true } },
    },
  })

  if (!nuevo) return null
  if (!nuevo.renovacionPendienteTyc || !nuevo.renovacionPrestamoAnteriorId) return null

  const anteriorId = nuevo.renovacionPrestamoAnteriorId

  // Transacción atómica: cancela el anterior + bitácoras + audit log + marca el nuevo
  const resultado = await db.$transaction(async (tx) => {
    const anterior = await tx.prestamo.findUnique({
      where: { id: anteriorId },
      include: { cliente: { select: { nombre: true } } },
    })
    if (!anterior) {
      // El crédito anterior ya no existe (posible purga de BD). Solo limpiamos la bandera.
      await tx.prestamo.update({
        where: { id: prestamoNuevoId },
        data: {
          renovacionPendienteTyc: false,
          renovacionFechaCancelacionAnterior: new Date(),
        },
      })
      return { anterior: null, nuevo }
    }

    const saldoAnterior = anterior.saldoTotal || 0
    const capitalNuevo = nuevo.montoPrincipal
    const excedente = Math.max(0, capitalNuevo - saldoAnterior)
    const diferencia = saldoAnterior - capitalNuevo

    // 1) Cancelar el crédito anterior
    await tx.prestamo.update({
      where: { id: anteriorId },
      data: {
        estado: 'CANCELADO',
        saldoCapital: 0,
        saldoInteres: 0,
        saldoTotal: 0,
        notas: `Finalizado por renovación - nuevo préstamo: ${nuevo.codigo} (aceptado por el cliente el ${new Date().toLocaleString('es-CO')})`,
      },
    })

    // 2) Bitácora del crédito ANTERIOR
    await tx.bitacoraPrestamo.create({
      data: {
        prestamoId: anteriorId,
        prestamoCodigo: anterior.codigo,
        usuarioNombre: 'Sistema',
        tipo: 'OTRO',
        titulo: `CRÉDITO CANCELADO POR RENOVACIÓN (T&C ACEPTADOS)`,
        descripcion:
          `Este crédito fue finalizado (CANCELADO) porque el cliente aceptó los T&C del nuevo préstamo ${nuevo.codigo}.\n\n` +
          `═══ ORIGEN DEL CIERRE ═══\n` +
          `• Crédito anterior (este): ${anterior.codigo}\n` +
          `• Saldo pendiente al cierre: ${formatearMoneda(saldoAnterior)}\n` +
          `• Estado anterior: ${anterior.estado}\n` +
          `• Estado actual: CANCELADO\n\n` +
          `═══ NUEVO CRÉDITO ═══\n` +
          `• Nuevo código: ${nuevo.codigo}\n` +
          `• Capital nuevo: ${formatearMoneda(capitalNuevo)}\n` +
          `• Excedente entregado al cliente: ${formatearMoneda(excedente)}\n` +
          (diferencia > 0
            ? `• Cliente abonó diferencia: ${formatearMoneda(diferencia)}\n`
            : '') +
          `\n📅 Fecha de cancelación: ${new Date().toLocaleString('es-CO')}`,
        resultado: `Cancelado → renovación ${nuevo.codigo}`,
        fechaEvento: new Date(),
      },
    })

    // 3) Bitácora del NUEVO crédito (aviso de cancelación del anterior)
    await tx.bitacoraPrestamo.create({
      data: {
        prestamoId: nuevo.id,
        prestamoCodigo: nuevo.codigo,
        usuarioNombre: 'Sistema',
        tipo: 'OTRO',
        titulo: `CRÉDITO ANTERIOR CANCELADO (T&C ACEPTADOS)`,
        descripcion:
          `El cliente aceptó los T&C de este préstamo, por lo que el crédito anterior ${anterior.codigo} fue CANCELADO automáticamente.\n\n` +
          `═══ DETALLE ═══\n` +
          `• Crédito anterior: ${anterior.codigo}\n` +
          `• Saldo pendiente cancelado: ${formatearMoneda(saldoAnterior)}\n` +
          `• Excedente entregado al cliente: ${formatearMoneda(excedente)}\n` +
          (diferencia > 0
            ? `• Diferencia abonada por el cliente: ${formatearMoneda(diferencia)}\n`
            : '') +
          `\n📅 Fecha: ${new Date().toLocaleString('es-CO')}`,
        resultado: `Crédito anterior ${anterior.codigo} cancelado`,
        fechaEvento: new Date(),
      },
    })

    // 4) Audit log
    await tx.auditLog.create({
      data: {
        usuarioNombre: 'Sistema',
        accion: 'PRESTAMO_ANTERIOR_CANCELADO_TRAS_TYC',
        modulo: 'prestamos',
        entidadId: nuevo.id,
        entidadNombre: `${nuevo.codigo} - ${nuevo.cliente?.nombre || ''}`,
        detalles: JSON.stringify({
          prestamoAnteriorId: anteriorId,
          prestamoAnteriorCodigo: anterior.codigo,
          prestamoAnteriorEstadoPrevio: anterior.estado,
          prestamoNuevoId: nuevo.id,
          prestamoNuevoCodigo: nuevo.codigo,
          saldoAnterior,
          capitalNuevo,
          excedente,
          diferencia: diferencia > 0 ? diferencia : 0,
        }),
        exito: true,
      },
    })

    // 5) Marcar el nuevo préstamo: ya no está pendiente de T&C para la renovación
    await tx.prestamo.update({
      where: { id: prestamoNuevoId },
      data: {
        renovacionPendienteTyc: false,
        renovacionFechaCancelacionAnterior: new Date(),
      },
    })

    return { anterior, nuevo }
  })

  return resultado
}

// GET /api/prestamos/[id]/aceptar-tyc-otp
// Ejecuta check_otp automáticamente — usado por el portal del cliente
// para saber si ya hay un OTP activo (no expirado) y NO generar uno nuevo.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prestamoId } = await params
    return await checkOTP(prestamoId)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prestamoId } = await params
    const body = await req.json()
    const { accion } = body

    if (accion === 'enviar_otp') return await enviarOTP(prestamoId, body)
    if (accion === 'validar_otp') return await validarOTP(prestamoId, body)
    if (accion === 'confirmar_con_foto') return await confirmarConFoto(prestamoId, body)
    if (accion === 'guardar_fotos_simple') return await guardarFotosSimple(prestamoId, body)
    if (accion === 'guardar_firma_manuscrita') return await guardarFirmaManuscrita(prestamoId, body)
    if (accion === 'confirmar_activacion') return await confirmarActivacion(prestamoId)
    if (accion === 'check_otp') return await checkOTP(prestamoId)

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

async function enviarOTP(prestamoId: string, body: any) {
  const { canal } = body
  const canalFinal = canal || 'AMBOS'
  const prestamo = await db.prestamo.findUnique({ where: { id: prestamoId }, include: { cliente: true } })
  if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  // === Permitir OTP en estados SOLICITUD o PENDIENTE_ACEPTACION ===
  // El flujo de firma del cliente se habilita cuando la solicitud web fue aprobada.
  // El préstamo puede estar en estado SOLICITUD (recién creado) o PENDIENTE_ACEPTACION.
  // FIX 2026-08-12: También permitir si hay una firma EN PROGRESO (PENDIENTE,
  // FOTOS_SUBIDAS, FIRMA_DIBUJADA, OTP_ENVIADO) aunque el estado del préstamo
  // haya cambiado — esto evita bloquear al cliente si el préstamo cambió de
  // estado mientras la firma estaba en curso.
  if (prestamo.estado !== 'PENDIENTE_ACEPTACION' && prestamo.estado !== 'SOLICITUD') {
    // Verificar si hay una firma en progreso para este préstamo
    const firmaEnProgreso = await db.firmaElectronica.findFirst({
      where: {
        prestamoId,
        estadoFirma: { in: ['PENDIENTE', 'FOTOS_SUBIDAS', 'FIRMA_DIBUJADA', 'OTP_ENVIADO'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!firmaEnProgreso) {
      return NextResponse.json({
        success: false,
        error: `El préstamo no está pendiente de aceptación (estado actual: ${prestamo.estado}). Solo se puede enviar OTP a préstamos en SOLICITUD o PENDIENTE_ACEPTACION, o que tengan una firma electrónica en progreso.`,
      }, { status: 400 })
    }
    // Hay una firma en progreso — permitir continuar
  }
  if (!prestamo.cliente) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
  if (canalFinal === 'EMAIL' && !prestamo.cliente.email) return NextResponse.json({ success: false, error: 'El cliente no tiene correo electrónico' }, { status: 400 })

  // === Validar que el email sea entregable (no @test.com, @example.com, etc.) ===
  // Estos dominios no tienen servidor MX y siempre soft-bouncean con
  // "connection timeout", dando la impresión falsa de que el correo no funciona.
  if ((canalFinal === 'EMAIL' || canalFinal === 'AMBOS') && prestamo.cliente.email) {
    const validacionEmail = validarEmailEntregable(prestamo.cliente.email)
    if (!validacionEmail.esValido) {
      // Si el canal es AMBOS, todavía podemos intentar WhatsApp
      if (canalFinal === 'EMAIL') {
        return NextResponse.json({
          success: false,
          error: 'El correo del cliente ("' + prestamo.cliente.email + '") pertenece a un dominio de prueba que no recibe correos. Actualiza el email del cliente a una dirección real.',
          codigo: 'EMAIL_NO_ENTREGABLE',
          motivo: validacionEmail.motivo,
        }, { status: 400 })
      }
    }
  }

  // === PROTECCIÓN: NO generar OTP nuevo si hay uno ACTIVO y no validado ===
  // Si el cliente vuelve a entrar al portal o vuelve a pedir OTP, pero ya tiene
  // uno vigente (no expirado, no validado), se mantiene el mismo código y NO se
  // genera uno nuevo. Solo cuando expire (5 min) se podrá generar otro.
  const firmaExistente = await db.firmaElectronica.findFirst({
    where: {
      prestamoId,
      tipo: 'TYC',
      estadoFirma: { in: ['OTP_ENVIADO', 'FOTOS_SUBIDAS'] },
      otpEnviado: true,
      otpFechaEnvio: { not: null },
      otpValidado: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (firmaExistente && firmaExistente.otpFechaEnvio) {
    const exp = new Date(firmaExistente.otpFechaEnvio.getTime() + 5 * 60000)
    const ahora = new Date()
    if (ahora < exp && !firmaExistente.otpValidado) {
      // OTP aún vigente — NO generar uno nuevo
      const segundosRestantes = Math.max(0, Math.floor((exp.getTime() - ahora.getTime()) / 1000))
      return NextResponse.json({
        success: true,
        data: {
          firmaId: firmaExistente.id,
          otpEnviado: true,
          canal: firmaExistente.otpCanal,
          segundosRestantes,
          emailDestino: prestamo.cliente.email || null,
          telefonoDestino: prestamo.cliente.telefono,
          reutilizado: true, // indica que NO se generó uno nuevo
        },
        mensaje: `Ya tienes un código activo. Revisa tu WhatsApp/correo. Tiempo restante: ${Math.floor(segundosRestantes / 60)}:${(segundosRestantes % 60).toString().padStart(2, '0')}.`,
      })
    }
  }

  // === Generar nuevo OTP (no hay activo o ya expiró) ===
  const otp = generarCodigoOtp('numeric', 6)
  let firma = await db.firmaElectronica.findFirst({ where: { prestamoId, tipo: 'TYC', estadoFirma: { in: ['PENDIENTE', 'OTP_ENVIADO'] } }, orderBy: { createdAt: 'desc' } })
  if (firma) {
    firma = await db.firmaElectronica.update({ where: { id: firma.id }, data: { otpEnviado: true, otpCodigo: hashOtp(otp), otpCanal: canalFinal, otpFechaEnvio: new Date(), estadoFirma: 'OTP_ENVIADO', intentosOTP: 0, otpValidado: false } })
  } else {
    firma = await db.firmaElectronica.create({ data: { prestamoId, clienteId: prestamo.cliente.id, tipo: 'TYC', imagenFirma: '', otpEnviado: true, otpCodigo: hashOtp(otp), otpCanal: canalFinal, otpFechaEnvio: new Date(), estadoFirma: 'OTP_ENVIADO' } })
  }

  // Registrar en OtpRegistro (trazabilidad centralizada)
  const otpRegistro = await registrarOtp({
    clienteId: prestamo.cliente.id,
    clienteCedula: prestamo.cliente.cedula,
    clienteNombre: prestamo.cliente.nombre,
    codigoPlano: otp,
    metodo: canalFinal as 'WHATSAPP' | 'EMAIL' | 'AMBOS',
    destinatario: canalFinal === 'EMAIL' ? (prestamo.cliente.email || '') : (prestamo.cliente.telefono || ''),
    tipo: 'FIRMA_ELECTRONICA',
    entidadRefId: firma.id,
    descripcion: `OTP aceptación TyC préstamo ${prestamo.codigo}`,
    maxIntentos: firma.maxIntentos,
    expiraEnMinutos: 5,
    guardarCodigoPlano: false,
  })

  let envioWhatsApp: any = null
  if (canalFinal === 'WHATSAPP' || canalFinal === 'AMBOS') {
    const mensaje = `🔐 *CÓDIGO DE VERIFICACIÓN - ACEPTACIÓN DE PRÉSTAMO*\n\nHola *${prestamo.cliente.nombre}*,\n\nPara confirmar la aceptación de los Términos y Condiciones de tu préstamo *${prestamo.codigo}*, ingresa el siguiente código:\n\n  >>  ${otp}  <<\n\n⏰ El código expira en 5 minutos.\n⚠️ No compartas este código con nadie.`
    envioWhatsApp = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
    await guardarNotificacion({ db, prestamoId, telefono: prestamo.cliente.telefono, tipo: 'OTP', mensaje, envio: envioWhatsApp })
  }

  let envioEmail: any = null
  if ((canalFinal === 'EMAIL' || canalFinal === 'AMBOS') && prestamo.cliente.email) {
    // Intentar primero con plantilla editable de BD; fallback a inline
    const { enviarEmailPlantilla } = await import('@/lib/plantillas')
    const tplResult = await enviarEmailPlantilla('OTP_EMAIL', prestamo.cliente.email, {
      clienteNombre: prestamo.cliente.nombre,
      otp,
      prestamoCodigo: prestamo.codigo,
    })
    if (tplResult.success && tplResult.usadaPlantilla) {
      envioEmail = tplResult
    } else {
      envioEmail = await enviarEmail({ to: prestamo.cliente.email, subject: `Código de Verificación - Préstamo ${prestamo.codigo}`, text: `Tu código es: ${otp}`, html: `<div style="font-size:36px;font-weight:bold;color:#1e40af;text-align:center;padding:20px;">${otp}</div><p>Expira en 5 minutos.</p>` })
    }
  }

  return NextResponse.json({ success: true, data: { firmaId: firma.id, otpEnviado: true, canal: canalFinal, segundosRestantes: 300, emailDestino: prestamo.cliente.email || null, telefonoDestino: prestamo.cliente.telefono, whatsapp: envioWhatsApp, email: envioEmail }, mensaje: `Código enviado por ${canalFinal === 'WHATSAPP' ? 'WhatsApp' : canalFinal === 'EMAIL' ? 'correo' : 'WhatsApp y correo'}.` })
}

async function validarOTP(prestamoId: string, body: any) {
  const { otpIngresado } = body
  if (!otpIngresado) return NextResponse.json({ success: false, error: 'Código requerido' }, { status: 400 })
  const firma = await db.firmaElectronica.findFirst({ where: { prestamoId, tipo: 'TYC', estadoFirma: 'OTP_ENVIADO' }, orderBy: { createdAt: 'desc' } })
  if (!firma || !firma.otpFechaEnvio) return NextResponse.json({ success: false, error: 'No hay código pendiente' }, { status: 400 })
  const exp = new Date(firma.otpFechaEnvio.getTime() + 5 * 60000)
  if (new Date() > exp) return NextResponse.json({ success: false, error: 'El código ha expirado. Solicita uno nuevo.' }, { status: 400 })
  if (firma.intentosOTP >= firma.maxIntentos) { await db.firmaElectronica.update({ where: { id: firma.id }, data: { estadoFirma: 'RECHAZADA' } }); return NextResponse.json({ success: false, error: 'Has agotado los intentos.' }, { status: 400 }) }
  await db.firmaElectronica.update({ where: { id: firma.id }, data: { intentosOTP: { increment: 1 } } })
  // Reforzado: comparación constant-time contra el hash SHA-256 almacenado
  const otpValido = verificarOtp(String(otpIngresado), firma.otpCodigo || '')
  if (!otpValido) {
    const rest = firma.maxIntentos - (firma.intentosOTP + 1)
    if (rest <= 0) { await db.firmaElectronica.update({ where: { id: firma.id }, data: { estadoFirma: 'RECHAZADA' } }); return NextResponse.json({ success: false, error: 'Código incorrecto. Intentos agotados.' }, { status: 400 }) }
    return NextResponse.json({ success: false, error: `Código incorrecto. Te quedan ${rest} intento(s).` }, { status: 400 })
  }
  await db.firmaElectronica.update({ where: { id: firma.id }, data: { otpValidado: true, otpFechaValidacion: new Date() } })
  return NextResponse.json({
    success: true,
    mensaje:
      'Código verificado. Ahora sube la foto de tu cédula y luego la selfie sosteniendo la cédula.',
  })
}

async function confirmarConFoto(prestamoId: string, body: any) {
  const { fotoDocumentoBase64, fotoSelfieBase64 } = body

  // === VALIDACIONES (v5.0): ambas fotos son obligatorias ===
  // El flujo correcto es:
  //   1. Cliente recibe OTP por correo y lo valida.
  //   2. Cliente sube foto de su cédula (frente + reverso si aplica).
  //   3. Cliente toma selfie sosteniendo la cédula.
  //   4. Ambas fotos se guardan en FirmaElectronica, en DocumentoGestor
  //      (trazabilidad) y se incluyen en el pagaré PDF.
  if (!fotoDocumentoBase64) {
    return NextResponse.json(
      {
        success: false,
        error:
          'La foto del documento de identidad es obligatoria. Sube una foto clara de tu cédula.',
      },
      { status: 400 }
    )
  }
  if (!fotoSelfieBase64) {
    return NextResponse.json(
      {
        success: false,
        error:
          'La selfie sosteniendo la cédula es obligatoria. Toma una foto donde se vea tu rostro y la cédula.',
      },
      { status: 400 }
    )
  }

  // Validar que ambas sean imágenes válidas (NO permitir SVG por seguridad XSS)
  const validarImagen = (data: string): boolean => {
    if (!data.startsWith('data:image/')) return false
    // Permitir jpeg, png, webp. NO SVG (puede contener scripts).
    return (
      data.startsWith('data:image/jpeg') ||
      data.startsWith('data:image/png') ||
      data.startsWith('data:image/webp')
    )
  }
  if (!validarImagen(fotoDocumentoBase64)) {
    return NextResponse.json(
      { success: false, error: 'La foto del documento debe ser JPEG, PNG o WebP.' },
      { status: 400 }
    )
  }
  if (!validarImagen(fotoSelfieBase64)) {
    return NextResponse.json(
      { success: false, error: 'La selfie debe ser JPEG, PNG o WebP.' },
      { status: 400 }
    )
  }

  // Limitar tamaño: cada foto máximo ~10MB (base64 ~14MB)
  const MAX_SIZE = 14 * 1024 * 1024
  if (fotoDocumentoBase64.length > MAX_SIZE || fotoSelfieBase64.length > MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: 'Las fotos exceden el tamaño máximo permitido (10MB cada una).' },
      { status: 400 }
    )
  }

  const firma = await db.firmaElectronica.findFirst({
    where: {
      prestamoId,
      tipo: 'TYC',
      otpValidado: true,
      estadoFirma: { in: ['OTP_ENVIADO', 'FOTOS_SUBIDAS'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { prestamo: { include: { cliente: true } } },
  })
  if (!firma) {
    return NextResponse.json(
      { success: false, error: 'No hay verificación OTP pendiente. Valida el código primero.' },
      { status: 400 }
    )
  }
  const prestamo = firma.prestamo
  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // === Calcular hashes SHA-256 de ambas fotos ===
  const hashDocumento = crypto
    .createHash('sha256')
    .update(fotoDocumentoBase64)
    .digest('hex')
  const hashSelfie = crypto.createHash('sha256').update(fotoSelfieBase64).digest('hex')

  // === Actualizar FirmaElectronica con ambas fotos ===
  await db.firmaElectronica.update({
    where: { id: firma.id },
    data: {
      fotoDocumento: fotoDocumentoBase64,
      fotoDocumentoHash: hashDocumento,
      fotoSelfie: fotoSelfieBase64,
      fotoSelfieHash: hashSelfie,
      fechaSubidaFotos: new Date(),
      estadoFirma: 'COMPLETADA',
      fechaFirmaCompleta: new Date(),
    },
  })

  // === Guardar en DocumentoGestor (trazabilidad de documentación) ===
  // 1. Foto de la cédula
  await db.documentoGestor.create({
    data: {
      prestamoId,
      clienteId: prestamo.clienteId,
      tipo: 'FOTO_CEDULA',
      titulo: `Foto de cédula - Aceptación T&C ${prestamo.codigo}`,
      descripcion: `Foto del documento de identidad (cédula) subida por el cliente al aceptar T&C del préstamo ${prestamo.codigo}. Hash SHA-256: ${hashDocumento}.`,
      archivoBase64: fotoDocumentoBase64,
      archivoNombre: `cedula_${prestamo.codigo}.jpg`,
      archivoTipo: 'image/jpeg',
      archivoTamano: fotoDocumentoBase64.length,
      subidoPor: prestamo.cliente?.nombre || 'Cliente',
    },
  })

  // 2. Selfie con cédula
  await db.documentoGestor.create({
    data: {
      prestamoId,
      clienteId: prestamo.clienteId,
      tipo: 'FOTO_SELFI',
      titulo: `Selfie con cédula - Aceptación T&C ${prestamo.codigo}`,
      descripcion: `Selfie sosteniendo la cédula, subida por el cliente al aceptar T&C del préstamo ${prestamo.codigo}. Hash SHA-256: ${hashSelfie}.`,
      archivoBase64: fotoSelfieBase64,
      archivoNombre: `selfie_${prestamo.codigo}.jpg`,
      archivoTipo: 'image/jpeg',
      archivoTamano: fotoSelfieBase64.length,
      subidoPor: prestamo.cliente?.nombre || 'Cliente',
    },
  })

  // === Bitácora del préstamo (trazabilidad) ===
  await db.bitacoraPrestamo.create({
    data: {
      prestamoId,
      prestamoCodigo: prestamo.codigo,
      usuarioNombre: prestamo.cliente?.nombre || 'Cliente',
      tipo: 'FIRMA',
      titulo: 'T&C aceptados con OTP + foto cédula + selfie',
      descripcion: `Cliente validó OTP por correo y subió:
- Foto de su cédula de identidad (hash: ${hashDocumento.slice(0, 16)}...).
- Selfie sosteniendo la cédula (hash: ${hashSelfie.slice(0, 16)}...).
Ambas fotos fueron guardadas en DocumentoGestor y se incluyen como respaldo de firma en el pagaré PDF.`,
      resultado: 'Préstamo activado',
    },
  })

  // === Activar el préstamo ===
  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: new Date(),
  })
  const prestamoActualizado = await db.prestamo.update({
    where: { id: prestamoId },
    data: {
      estado: 'ACTIVO',
      tycAceptado: true,
      tycFechaAceptacion: new Date(),
      fechaDesembolso: new Date(),
      fechaVencimiento: calculo.fechaVencimiento,
      firmaId: firma.id,
    },
    include: { cliente: true },
  })

  // === Tarea T: Si este préstamo es una renovación, cancelar el crédito anterior ===
  // El cliente ya aceptó los T&C, completó OTP + fotos + (en este flujo) ya está ACTIVO.
  // Es el momento seguro para cancelar el crédito anterior.
  let renovacionCancelacionInfo: { anteriorCodigo?: string; anteriorCancelado?: boolean } = {}
  try {
    const res = await cancelarPrestamoAnteriorSiRenovacion(prestamoId)
    if (res?.anterior) {
      renovacionCancelacionInfo = {
        anteriorCodigo: res.anterior.codigo,
        anteriorCancelado: true,
      }
    }
  } catch (e) {
    // No bloquear la activación del nuevo préstamo si falla la cancelación del anterior
    console.error('[aceptar-tyc-otp/confirmarConFoto] Error cancelando crédito anterior:', e)
  }

  // === Tarea U: Registrar ingresos automáticos en cajas correspondientes ===
  // (Flexibilidad, Días causados, Pagaré+Carta, Tarifa Plataforma)
  try {
    await registrarIngresosCajasPorActivacion(prestamoId)
  } catch (e) {
    console.error('[aceptar-tyc-otp/confirmarConFoto] Error registrando ingresos en cajas:', e)
  }

  // === Notificar al cliente por correo (canal obligatorio) ===
  const mensajeCorreo = `
Hola ${prestamo.cliente.nombre},

Tu préstamo ${prestamo.codigo} ha sido activado exitosamente.

DETALLES:
- Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}
- Cuota: $${prestamo.montoCuota.toLocaleString('es-CO')}
- Cuotas: ${prestamo.numeroCuotas}
- Total a pagar: $${prestamo.totalPagar.toLocaleString('es-CO')}

DOCUMENTACIÓN:
- Tu foto de cédula y selfie con cédula fueron guardadas como respaldo de firma.
- Estas imágenes se incluyen en tu pagaré electrónico como evidencia de identidad.

Si no reconoces esta activación, contacta inmediatamente al administrador.

— Jo*** Se*** Al*** D** R**
  `.trim()

  try {
    if (prestamo.cliente.email) {
      await enviarEmail({
        to: prestamo.cliente.email,
        subject: `Préstamo ${prestamo.codigo} activado — Jo*** Se*** Al*** D** R**`,
        text: mensajeCorreo,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
  <h2 style="color: #1e40af;">Préstamo activado</h2>
  <p>Hola <strong>${prestamo.cliente.nombre}</strong>,</p>
  <p>Tu préstamo <strong>${prestamo.codigo}</strong> ha sido activado exitosamente.</p>
  <h3>Detalles:</h3>
  <ul>
    <li>Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}</li>
    <li>Cuota: $${prestamo.montoCuota.toLocaleString('es-CO')}</li>
    <li>Cuotas: ${prestamo.numeroCuotas}</li>
    <li>Total a pagar: $${prestamo.totalPagar.toLocaleString('es-CO')}</li>
  </ul>
  <h3>Documentación:</h3>
  <p>Tu foto de cédula y selfie con cédula fueron guardadas como respaldo de firma. Estas imágenes se incluyen en tu pagaré electrónico como evidencia de identidad.</p>
  <p style="color: #6b7280; font-size: 13px;">Si no reconoces esta activación, contacta inmediatamente al administrador.</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">Jo*** Se*** Al*** D** R** v5.0</p>
</div>`,
      })
    }
  } catch (err) {
    // No fallar la activación si el correo falla
    console.error('[aceptar-tyc-otp] Error enviando correo de confirmación:', err)
  }

  // Notificación WhatsApp opcional (si el cliente tiene teléfono, no es OTP)
  const mensaje = `✅ *PRÉSTAMO ACTIVADO*\n\nHola *${prestamo.cliente.nombre}*,\n\nTu préstamo *${prestamo.codigo}* ha sido activado.\n\n• Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}\n• Cuota: $${prestamo.montoCuota.toLocaleString('es-CO')}\n• Cuotas: ${prestamo.numeroCuotas}\n• Total: $${prestamo.totalPagar.toLocaleString('es-CO')}\n\nSe envió comprobante a tu correo electrónico.`
  if (prestamo.cliente.telefono) {
    try {
      const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
      await guardarNotificacion({
        db,
        prestamoId,
        telefono: prestamo.cliente.telefono,
        tipo: 'ACTIVACION',
        mensaje,
        envio,
      })
    } catch {}
  }

  return NextResponse.json({
    success: true,
    mensaje:
      '¡Términos aceptados! Tu préstamo ha sido activado. Se guardó tu foto de cédula y selfie como respaldo de firma.',
    data: {
      prestamo: prestamoActualizado,
      firmaId: firma.id,
      hashDocumento,
      hashSelfie,
    },
  })
}

async function checkOTP(prestamoId: string) {
  const firma = await db.firmaElectronica.findFirst({ where: { prestamoId, tipo: 'TYC', estadoFirma: { in: ['OTP_ENVIADO', 'FOTOS_SUBIDAS'] }, otpEnviado: true, otpFechaEnvio: { not: null } }, orderBy: { createdAt: 'desc' } })
  if (!firma || !firma.otpFechaEnvio) return NextResponse.json({ success: true, data: { activo: false } })
  const exp = new Date(firma.otpFechaEnvio.getTime() + 5 * 60000)
  if (new Date() > exp) return NextResponse.json({ success: true, data: { activo: false, expirado: true } })
  const segundosRestantes = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000))
  return NextResponse.json({ success: true, data: { activo: true, canal: firma.otpCanal, segundosRestantes, minutosRestantes: Math.floor(segundosRestantes / 60), otpValidado: firma.otpValidado, verificado: firma.otpValidado, intentosUsados: firma.intentosOTP, intentosMaximos: firma.maxIntentos, fechaEnvio: firma.otpFechaEnvio, fechaExpiracion: exp } })
}

// =====================================================
// NUEVAS ACCIONES — Flujo de firma del cliente desde el portal
// (cuando la solicitud fue aprobada/convertida en préstamo)
// =====================================================

// === guardar_fotos_simple: guarda fotos SIN requerir OTP validado ===
// Paso 1 del flujo: el cliente sube cédula + selfie.
// NO activa el préstamo — solo registra las fotos en la FirmaElectronica.
async function guardarFotosSimple(prestamoId: string, body: any) {
  const { fotoDocumentoBase64, fotoSelfieBase64 } = body
  if (!fotoDocumentoBase64 || !fotoSelfieBase64) {
    return NextResponse.json({ success: false, error: 'Ambas fotos son obligatorias (cédula y selfie).' }, { status: 400 })
  }
  const validarImagen = (data: string): boolean => {
    if (!data.startsWith('data:image/')) return false
    return data.startsWith('data:image/jpeg') || data.startsWith('data:image/png') || data.startsWith('data:image/webp')
  }
  if (!validarImagen(fotoDocumentoBase64) || !validarImagen(fotoSelfieBase64)) {
    return NextResponse.json({ success: false, error: 'Las fotos deben ser JPEG, PNG o WebP.' }, { status: 400 })
  }
  const MAX_SIZE = 14 * 1024 * 1024
  if (fotoDocumentoBase64.length > MAX_SIZE || fotoSelfieBase64.length > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'Las fotos exceden el tamaño máximo (10MB cada una).' }, { status: 400 })
  }

  const prestamo = await db.prestamo.findUnique({ where: { id: prestamoId }, include: { cliente: true } })
  if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })

  // Buscar o crear FirmaElectronica(tipo='TYC')
  let firma = await db.firmaElectronica.findFirst({
    where: { prestamoId, tipo: 'TYC' },
    orderBy: { createdAt: 'desc' },
  })
  const hashDocumento = crypto.createHash('sha256').update(fotoDocumentoBase64).digest('hex')
  const hashSelfie = crypto.createHash('sha256').update(fotoSelfieBase64).digest('hex')

  if (firma) {
    await db.firmaElectronica.update({
      where: { id: firma.id },
      data: {
        fotoDocumento: fotoDocumentoBase64,
        fotoDocumentoHash: hashDocumento,
        fotoSelfie: fotoSelfieBase64,
        fotoSelfieHash: hashSelfie,
        fechaSubidaFotos: new Date(),
        estadoFirma: 'FOTOS_SUBIDAS',
      },
    })
  } else {
    firma = await db.firmaElectronica.create({
      data: {
        prestamoId,
        clienteId: prestamo.clienteId,
        tipo: 'TYC',
        imagenFirma: '',
        fotoDocumento: fotoDocumentoBase64,
        fotoDocumentoHash: hashDocumento,
        fotoSelfie: fotoSelfieBase64,
        fotoSelfieHash: hashSelfie,
        fechaSubidaFotos: new Date(),
        estadoFirma: 'FOTOS_SUBIDAS',
        firmanteRol: 'DEUDOR',
        firmanteNombre: prestamo.cliente?.nombre || '',
        firmanteCedula: prestamo.cliente?.cedula || '',
      },
    })
  }

  // Guardar en DocumentoGestor (trazabilidad)
  await db.documentoGestor.create({
    data: {
      prestamoId,
      clienteId: prestamo.clienteId,
      tipo: 'FOTO_CEDULA',
      titulo: `Foto de cédula - ${prestamo.codigo}`,
      descripcion: `Subida por el cliente en el flujo de firma del portal.`,
      archivoBase64: fotoDocumentoBase64,
      archivoNombre: `cedula_${prestamo.codigo}.jpg`,
      archivoTipo: 'image/jpeg',
      archivoTamano: Math.floor(fotoDocumentoBase64.length * 0.75),
      subidoPor: 'CLIENTE_PORTAL',
    },
  })
  await db.documentoGestor.create({
    data: {
      prestamoId,
      clienteId: prestamo.clienteId,
      tipo: 'FOTO_SELFI',
      titulo: `Selfie - ${prestamo.codigo}`,
      descripcion: `Subida por el cliente en el flujo de firma del portal.`,
      archivoBase64: fotoSelfieBase64,
      archivoNombre: `selfie_${prestamo.codigo}.jpg`,
      archivoTipo: 'image/jpeg',
      archivoTamano: Math.floor(fotoSelfieBase64.length * 0.75),
      subidoPor: 'CLIENTE_PORTAL',
    },
  })

  return NextResponse.json({ success: true, message: 'Fotos guardadas correctamente.' })
}

// === guardar_firma_manuscrita: guarda la firma dibujada en canvas ===
// Paso 2 del flujo: el cliente dibuja su firma manuscrita.
async function guardarFirmaManuscrita(prestamoId: string, body: any) {
  const { imagenFirmaBase64 } = body
  if (!imagenFirmaBase64 || !imagenFirmaBase64.startsWith('data:image/png')) {
    return NextResponse.json({ success: false, error: 'La firma debe ser una imagen PNG válida.' }, { status: 400 })
  }

  const prestamo = await db.prestamo.findUnique({ where: { id: prestamoId }, include: { cliente: true } })
  if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })

  let firma = await db.firmaElectronica.findFirst({
    where: { prestamoId, tipo: 'TYC' },
    orderBy: { createdAt: 'desc' },
  })

  if (firma) {
    await db.firmaElectronica.update({
      where: { id: firma.id },
      data: {
        imagenFirma: imagenFirmaBase64,
        estadoFirma: 'FIRMA_DIBUJADA',
      },
    })
  } else {
    firma = await db.firmaElectronica.create({
      data: {
        prestamoId,
        clienteId: prestamo.clienteId,
        tipo: 'TYC',
        imagenFirma: imagenFirmaBase64,
        estadoFirma: 'FIRMA_DIBUJADA',
        firmanteRol: 'DEUDOR',
        firmanteNombre: prestamo.cliente?.nombre || '',
        firmanteCedula: prestamo.cliente?.cedula || '',
      },
    })
  }

  return NextResponse.json({ success: true, message: 'Firma manuscrita guardada correctamente.' })
}

// === confirmar_activacion: activa el préstamo después de OTP validado ===
// Paso final: marca la firma como COMPLETADA y activa el préstamo.
// Requiere que el OTP haya sido validado previamente.
async function confirmarActivacion(prestamoId: string) {
  const firma = await db.firmaElectronica.findFirst({
    where: { prestamoId, tipo: 'TYC', otpValidado: true },
    orderBy: { createdAt: 'desc' },
    include: { prestamo: { include: { cliente: true } } },
  })
  if (!firma) {
    return NextResponse.json({ success: false, error: 'Debes validar el OTP antes de activar el crédito.' }, { status: 400 })
  }
  if (firma.estadoFirma === 'COMPLETADA') {
    return NextResponse.json({ success: true, message: 'El préstamo ya estaba activado.', yaActivado: true })
  }
  if (!firma.fotoDocumento || !firma.fotoSelfie) {
    return NextResponse.json({ success: false, error: 'Faltan las fotos. Vuelve al paso 1.' }, { status: 400 })
  }
  if (!firma.imagenFirma) {
    return NextResponse.json({ success: false, error: 'Falta la firma manuscrita. Vuelve al paso 2.' }, { status: 400 })
  }

  // Calcular fecha de vencimiento del préstamo
  const prestamo = firma.prestamo
  let fechaVencimiento: Date | null = null
  if (prestamo) {
    try {
      const calc = calcularPrestamo({
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(prestamo),
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia as any,
      })
      fechaVencimiento = calc.fechaVencimiento || null
    } catch (e) {
      // Si falla el cálculo, no bloquear la activación
    }
  }

  // Marcar firma como completada
  await db.firmaElectronica.update({
    where: { id: firma.id },
    data: {
      estadoFirma: 'COMPLETADA',
      fechaFirmaCompleta: new Date(),
    },
  })

  // Activar el préstamo
  await db.prestamo.update({
    where: { id: prestamoId },
    data: {
      firmaId: firma.id,
      tycAceptado: true,
      tycFechaAceptacion: new Date(),
      estado: 'ACTIVO',
      fechaDesembolso: new Date(),
      fechaVencimiento: fechaVencimiento,
    },
  })

  // === Tarea T: Si este préstamo es una renovación, cancelar el crédito anterior ===
  // El cliente ya completó todo el flujo (fotos + firma manuscrita + OTP validado)
  // y el préstamo quedó ACTIVO. Es el momento seguro para cancelar el crédito anterior.
  let renovacionCancelacionInfo: { anteriorCodigo?: string; anteriorCancelado?: boolean } = {}
  try {
    const res = await cancelarPrestamoAnteriorSiRenovacion(prestamoId)
    if (res?.anterior) {
      renovacionCancelacionInfo = {
        anteriorCodigo: res.anterior.codigo,
        anteriorCancelado: true,
      }
    }
  } catch (e) {
    // No bloquear la activación del nuevo préstamo si falla la cancelación del anterior
    console.error('[aceptar-tyc-otp/confirmarActivacion] Error cancelando crédito anterior:', e)
  }

  // === Tarea U: Registrar ingresos automáticos en cajas correspondientes ===
  // (Flexibilidad, Días causados, Pagaré+Carta, Tarifa Plataforma)
  try {
    await registrarIngresosCajasPorActivacion(prestamoId)
  } catch (e) {
    console.error('[aceptar-tyc-otp/confirmarActivacion] Error registrando ingresos en cajas:', e)
  }

  // Bitácora
  try {
    await db.bitacoraPrestamo.create({
      data: {
        prestamoId,
        prestamoCodigo: prestamo?.codigo || '',
        usuarioNombre: 'Cliente (Portal)',
        tipo: 'OTRO',
        titulo: 'Préstamo activado por el cliente',
        descripcion:
          `El cliente completó el flujo de firma (fotos + firma manuscrita + OTP) desde el portal. Firma ID: ${firma.id}.` +
          (renovacionCancelacionInfo.anteriorCancelado
            ? `\n\n♻️ Como este crédito es una renovación, el crédito anterior ${renovacionCancelacionInfo.anteriorCodigo} fue CANCELADO automáticamente.`
            : ''),
      },
    })
  } catch (e) {
    // No bloquear
  }

  return NextResponse.json({
    success: true,
    message:
      'Préstamo activado correctamente.' +
      (renovacionCancelacionInfo.anteriorCancelado
        ? ` El crédito anterior ${renovacionCancelacionInfo.anteriorCodigo} fue cancelado automáticamente.`
        : ''),
    data: { prestamoId, estado: 'ACTIVO', firmaId: firma.id },
  })
}
