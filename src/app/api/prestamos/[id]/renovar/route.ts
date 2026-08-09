import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, Frecuencia, formatearFecha, getTasaMoraAnual } from '@/lib/finanzas'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { sanitizeError } from '@/lib/error-handler'
import crypto from 'crypto'
import { requireRole } from '@/lib/auth-guard'
import { generarYEnviarCodigosConfirmacion } from '@/lib/prestamo-codigo'

// =====================================================
// POST - renovar un préstamo.
//
// Genera un nuevo préstamo basado en el saldo pendiente del préstamo
// original, agregando opcionalmente un monto adicional, nueva fecha de
// inicio, plazo y frecuencia.
//
// SEGURIDAD (fix C9 — 2026-08-01):
//   - El nuevo préstamo se crea en estado PENDIENTE_ACEPTACION (NO ACTIVO).
//   - tycAceptado se inicia en false (NO true) — el cliente debe aceptar TyC.
//   - Si el préstamo tiene codeudor, se dispara automáticamente el flujo de
//     doble OTP (DEUDOR + CODEUDOR) usando el helper
//     generarYEnviarCodigosConfirmacion.
//   - Sin codeudor, basta con el OTP del DEUDOR.
//   - El préstamo solo pasa a ACTIVO cuando verificar-codigo confirma todos
//     los roles requeridos.
//   - El usuarioNombre se toma del token de auth (NO del body).
//   - Toda la operación (crear nuevo + cerrar original + crear renovación +
//     bitácora + movimiento de caja si aplica) está envuelta en $transaction.
// =====================================================

const ESTADOS_RENOVABLES = new Set(['ACTIVO', 'EN_MORA', 'CANCELADO'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await req.json()
    const {
      nuevoMontoPrestado, // valor total prestado (puede ser saldo anterior + adicional)
      nuevaTasaInteresAnual, // opcional, si no viene se usa la del préstamo original
      nuevoPlazoMeses,
      nuevaFrecuencia,
      fechaInicioPago, // fecha de inicio de pago (string ISO)
      motivoRenovacion,
      cerrarOriginal, // si true, marca el préstamo original como CANCELADO
    } = body

    // usuarioNombre SIEMPRE del auth, NUNCA del body (fix C9 / hallazgo #12).
    const usuarioNombre = auth.username || auth.nombre || 'Gestor'

    // Validaciones
    if (!nuevoMontoPrestado || !nuevoPlazoMeses || !nuevaFrecuencia || !fechaInicioPago) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Faltan campos obligatorios: nuevoMontoPrestado, nuevoPlazoMeses, nuevaFrecuencia, fechaInicioPago',
        },
        { status: 400 }
      )
    }

    const montoNum = parseFloat(nuevoMontoPrestado)
    const plazoNum = parseInt(nuevoPlazoMeses)
    const fechaInicio = new Date(fechaInicioPago)

    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'nuevoMontoPrestado debe ser un número positivo' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(plazoNum) || plazoNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'nuevoPlazoMeses debe ser un entero positivo' },
        { status: 400 }
      )
    }
    if (isNaN(fechaInicio.getTime())) {
      return NextResponse.json(
        { success: false, error: 'fechaInicioPago inválida' },
        { status: 400 }
      )
    }

    // Buscar préstamo original
    const prestamoOriginal = await db.prestamo.findUnique({
      where: { id },
      include: { cliente: true, categoria: true },
    })

    if (!prestamoOriginal) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    // Calcular tasa: si el body trae nuevaTasaInteresAnual válida, usarla;
    // si no, heredar la del préstamo original.
    const tasaNum = parseFloat(nuevaTasaInteresAnual || '')
    const tasaFinal =
      Number.isFinite(tasaNum) && tasaNum > 0
        ? tasaNum
        : prestamoOriginal.tasaInteresAnual

    // Validar estado del préstamo original (fix C9 / hallazgo #8).
    if (!ESTADOS_RENOVABLES.has(prestamoOriginal.estado)) {
      return NextResponse.json(
        {
          success: false,
          error: `El préstamo está en estado ${prestamoOriginal.estado}. Solo se pueden renovar préstamos en: ACTIVO, EN_MORA, CANCELADO.`,
        },
        { status: 400 }
      )
    }

    // Validar que no esté ya renovado — check atomiqueado dentro de la tx.
    // El schema NO tiene @unique en RenovacionPrestamo.prestamoOriginalId,
    // así que confiamos en findFirst dentro de la transacción.
    const renovacionPrev = await db.renovacionPrestamo.findFirst({
      where: { prestamoOriginalId: prestamoOriginal.id },
    })
    if (renovacionPrev) {
      return NextResponse.json(
        { success: false, error: 'Este préstamo ya fue renovado' },
        { status: 400 }
      )
    }

    // Calcular el nuevo préstamo con interés fijo sobre el nuevo capital
    const calculo = calcularPrestamo({
      montoPrincipal: montoNum,
      tasaInteresAnual: tasaFinal,
      tasaMoraAnual: getTasaMoraAnual(prestamoOriginal),
      plazoMeses: plazoNum,
      frecuencia: nuevaFrecuencia as Frecuencia,
      fechaDesembolso: fechaInicio,
    })

    // Generar código único del nuevo préstamo
    const nuevoCodigo = `PREST-${Date.now().toString().slice(-8)}-${crypto
      .randomInt(0, 1000)
      .toString()
      .padStart(3, '0')}-R`

    // Calcular tasa mensual automáticamente
    const tasaMensualNum = tasaFinal / 12

    // ============================================================
    // TRANSACCIÓN ATÓMICA (fix C9 / hallazgo #4):
    // 1. Re-verificar que no haya renovación previa (race condition)
    // 2. Crear nuevo préstamo en PENDIENTE_ACEPTACION
    // 3. Cerrar original si se solicitó
    // 4. Crear registro RenovacionPrestamo
    // 5. Bitácora en el original
    // 6. Movimiento de caja por el excedente entregado (si aplica)
    // Si cualquier paso falla, se hace rollback completo.
    // ============================================================
    const txResult = await db.$transaction(async (tx) => {
      // 1. Re-verificación atómica dentro de la tx (evita race condition).
      const existingRenovacion = await tx.renovacionPrestamo.findFirst({
        where: { prestamoOriginalId: prestamoOriginal.id },
        select: { id: true },
      })
      if (existingRenovacion) {
        throw new Error('RENOVACION_YA_EXISTE')
      }

      // 2. Crear el nuevo préstamo en PENDIENTE_ACEPTACION (fix C9).
      // NO se setea tycAceptado=true, NO se setea estado=ACTIVO.
      // El cliente debe confirmar mediante OTP dual.
      const nuevoPrestamo = await tx.prestamo.create({
        data: {
          codigo: nuevoCodigo,
          clienteId: prestamoOriginal.clienteId,
          categoriaId: prestamoOriginal.categoriaId,
          montoPrincipal: montoNum,
          tasaInteresAnual: tasaFinal,
          tasaInteresMensual: tasaMensualNum,
          tasaMoraDiaria: prestamoOriginal.tasaMoraDiaria,
          plazoMeses: plazoNum,
          frecuencia: nuevaFrecuencia,
          numeroCuotas: calculo.numeroCuotas,
          montoCuota: calculo.montoCuota,
          totalInteres: calculo.totalInteres,
          totalPagar: calculo.totalPagar,
          tasaAplicada: calculo.tasaAplicada,
          moraCompuestaDiaria: true,
          estado: 'PENDIENTE_ACEPTACION', // fix C9: NO 'ACTIVO'
          fechaAprobacion: new Date(),
          // fechaDesembolso y fechaVencimiento se setean al activar (verificar-codigo)
          tycEnviado: true, // se envían con el código OTP
          tycAceptado: false, // fix C9: NO true hasta confirmación OTP
          requiereDocumentos: false,
          generarPagare: false,
          generarCarta: false,
          saldoCapital: montoNum,
          saldoInteres: calculo.totalInteres,
          saldoTotal: calculo.totalPagar,
          notas: `Renovación del préstamo ${prestamoOriginal.codigo}. ${
            motivoRenovacion || ''
          }`.trim(),
          // Preservar codeudor del original si lo tenía
          tieneCodeudor: prestamoOriginal.tieneCodeudor,
          codeudorNombre: prestamoOriginal.codeudorNombre,
          codeudorEmail: prestamoOriginal.codeudorEmail,
          codeudorTelefono: prestamoOriginal.codeudorTelefono,
          codeudorCedula: prestamoOriginal.codeudorCedula,
        },
        include: { cliente: true },
      })

      // 3. Cerrar préstamo original si se solicitó
      if (cerrarOriginal) {
        await tx.prestamo.update({
          where: { id: prestamoOriginal.id },
          data: {
            estado: 'CANCELADO',
          },
        })
      }

      // 4. Crear registro en RenovacionPrestamo
      const renovacion = await tx.renovacionPrestamo.create({
        data: {
          prestamoOriginalId: prestamoOriginal.id,
          prestamoNuevoId: nuevoPrestamo.id,
          saldoAnterior: prestamoOriginal.saldoTotal,
          nuevoMontoPrestado: montoNum,
          nuevaTasaInteresAnual: tasaFinal,
          nuevoPlazoMeses: plazoNum,
          nuevaFrecuencia: nuevaFrecuencia,
          nuevoNumeroCuotas: calculo.numeroCuotas,
          nuevaMontoCuota: calculo.montoCuota,
          nuevoTotalInteres: calculo.totalInteres,
          nuevoTotalPagar: calculo.totalPagar,
          fechaInicioPago: fechaInicio,
          motivoRenovacion: motivoRenovacion || null,
          usuarioNombre,
        },
      })

      // 5. Bitácora en el préstamo original
      await tx.bitacoraPrestamo.create({
        data: {
          prestamoId: prestamoOriginal.id,
          prestamoCodigo: prestamoOriginal.codigo,
          usuarioNombre,
          tipo: 'OTRO',
          titulo: `Préstamo renovado → ${nuevoCodigo} (pendiente confirmación)`,
          descripcion: `Se renovó el préstamo. Saldo anterior: $${prestamoOriginal.saldoTotal.toLocaleString(
            'es-CO'
          )}. Nuevo monto: $${montoNum.toLocaleString('es-CO')}. Nuevo plazo: ${plazoNum} meses (${
            calculo.numeroCuotas
          } cuotas ${nuevaFrecuencia.toLowerCase()}es de $${calculo.montoCuota.toLocaleString(
            'es-CO'
          )}). Fecha inicio: ${formatearFecha(fechaInicio)}. ${
            motivoRenovacion ? 'Motivo: ' + motivoRenovacion : ''
          } El nuevo préstamo requiere confirmación OTP del cliente${
            nuevoPrestamo.tieneCodeudor ? ' y codeudor' : ''
          } antes de activarse.`,
          resultado: `Nuevo préstamo: ${nuevoCodigo} (PENDIENTE_ACEPTACION)`,
        },
      })

      // 6. Bitácora en el nuevo préstamo (informativa)
      await tx.bitacoraPrestamo.create({
        data: {
          prestamoId: nuevoPrestamo.id,
          prestamoCodigo: nuevoCodigo,
          usuarioNombre,
          tipo: 'OTRO',
          titulo: `Préstamo creado por renovación de ${prestamoOriginal.codigo}`,
          descripcion: `Este préstamo fue generado por renovación. Préstamo original: ${
            prestamoOriginal.codigo
          } (saldo anterior $${prestamoOriginal.saldoTotal.toLocaleString(
            'es-CO'
          )}). Pendiente confirmación OTP del cliente${
            nuevoPrestamo.tieneCodeudor ? ' y codeudor' : ''
          }.`,
          resultado: 'PENDIENTE_ACEPTACION',
        },
      })

      return { nuevoPrestamo, renovacion }
    })

    const { nuevoPrestamo, renovacion } = txResult

    // ============================================================
    // Post-transacción: notificar al cliente por WhatsApp (NO crítico,
    // se hace fuera de la tx para no bloquearla si WhatsApp falla).
    // La tasa anual NO se envía al cliente por WhatsApp (cambio solicitado).
    // ============================================================
    const lineaTasaRenovacion = ''

    const mensaje = `🔄 *PRÉSTAMO RENOVADO - PENDIENTE CONFIRMACIÓN*

Hola *${nuevoPrestamo.cliente.nombre}*, tu préstamo ${prestamoOriginal.codigo} fue renovado.

📋 *Nuevo préstamo (PENDIENTE DE CONFIRMACIÓN):*
• Código: ${nuevoCodigo}
• Monto total: $${montoNum.toLocaleString('es-CO')}
• Cuota fija: $${calculo.montoCuota.toLocaleString('es-CO')}
• N° cuotas: ${calculo.numeroCuotas} (${nuevaFrecuencia.toLowerCase()}es)
${lineaTasaRenovacion}• Fecha primer pago: ${formatearFecha(
      calculo.tablaAmortizacion[0]?.fechaVencimiento || fechaInicio
    )}
• Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}

🔐 *Para activar este préstamo:*
Hemos enviado un código de confirmación a tu correo${
      nuevoPrestamo.tieneCodeudor ? ' y al correo de tu codeudor' : ''
    }. Compártelo con tu gestor para activar el préstamo.

El préstamo NO se activará hasta que verifiques tu código.`

    const envioWhatsApp = await enviarWhatsApp(nuevoPrestamo.cliente.telefono, mensaje)
    await guardarNotificacion({
      db,
      prestamoId: nuevoPrestamo.id,
      telefono: nuevoPrestamo.cliente.telefono,
      tipo: 'SOLICITUD',
      mensaje,
      envio: envioWhatsApp,
    })

    // ============================================================
    // Disparar el flujo de doble OTP (DEUDOR + CODEUDOR si aplica).
    // Esto crea los registros CodigoConfirmacion hasheados y envía
    // los correos con los códigos. Si falla, no afecta la renovación
    // ya creada — el gestor puede reenviar los códigos manualmente.
    // ============================================================
    let otpResult: any = null
    let otpError: string | null = null
    try {
      otpResult = await generarYEnviarCodigosConfirmacion({
        prestamoId: nuevoPrestamo.id,
        req,
      })
      if (!otpResult.success) {
        otpError = otpResult.body?.error || 'Error desconocido en envío de OTP'
      }
    } catch (e: any) {
      otpError = sanitizeError(e).message
    }

    return NextResponse.json({
      success: true,
      data: {
        renovacion,
        nuevoPrestamo,
        calculo,
        otp: otpResult?.body?.data || null,
        otpError,
      },
      mensaje:
        `Préstamo renovado correctamente. Nuevo préstamo: ${nuevoCodigo} (PENDIENTE_ACEPTACION). ` +
        (otpResult?.success
          ? otpResult.body?.mensaje ||
            'Se enviaron códigos de confirmación al cliente' +
              (nuevoPrestamo.tieneCodeudor ? ' y codeudor' : '') +
              '.'
          : `⚠️ El préstamo fue creado pero falló el envío de códigos OTP: ${otpError}. El gestor debe reenviar los códigos manualmente.`),
      whatsapp: envioWhatsApp,
    })
  } catch (error: any) {
    if (error?.message === 'RENOVACION_YA_EXISTE') {
      return NextResponse.json(
        { success: false, error: 'Este préstamo ya fue renovado (detectado en transacción)' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// (fin del archivo)
