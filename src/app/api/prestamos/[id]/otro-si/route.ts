import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { buildAbsoluteUrl } from '@/lib/url'
import {
  generarHtmlOtroSi,
  generarCodigoOtroSi,
  generarDescripcionAutomatica,
  TipoModificacionOtroSi,
  CuotaModificada,
} from '@/lib/otro-si'

// =====================================================
// GET /api/prestamos/[id]/otro-si
// Lista todos los Otros Síes de un préstamo.
// =====================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { id: prestamoId } = await params
    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    const otrosSi = await db.otroSiCambioFecha.findMany({
      where: { prestamoId },
      include: { firma: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: otrosSi,
      prestamo: {
        id: prestamo.id,
        codigo: prestamo.codigo,
        flexibilidadFinanciera: prestamo.flexibilidadFinanciera,
        flexibilidadActivada: prestamo.flexibilidadActivada,
        flexibilidadCosto: prestamo.flexibilidadCosto,
        cliente: {
          id: prestamo.cliente.id,
          nombre: prestamo.cliente.nombre,
          cedula: prestamo.cliente.cedula,
          telefono: prestamo.cliente.telefono,
          email: prestamo.cliente.email,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST /api/prestamos/[id]/otro-si
// Crea un nuevo Otro Sí y, si el cliente ya pagó el costo del beneficio
// (flexibilidadActivada = true), dispara la firma electrónica con OTP.
//
// Body:
//   {
//     tipoModificacion: 'CAMBIO_FECHA' | 'TRASLADO_CUOTA',
//     modificaciones: [{ cuota, fechaAnterior, fechaNueva }],
//     descripcion?: string  // si no se envía, se autogenera
//     activarFirma?: boolean // default true → dispara firma con OTP
//   }
// =====================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { id: prestamoId } = await params
    const body = await req.json()
    const { tipoModificacion, modificaciones, descripcion, activarFirma = true } = body

    // === Validaciones ===
    if (!tipoModificacion || !['CAMBIO_FECHA', 'TRASLADO_CUOTA'].includes(tipoModificacion)) {
      return NextResponse.json(
        { success: false, error: 'tipoModificacion debe ser CAMBIO_FECHA o TRASLADO_CUOTA' },
        { status: 400 }
      )
    }
    if (!Array.isArray(modificaciones) || modificaciones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'modificaciones debe ser un arreglo con al menos un elemento' },
        { status: 400 }
      )
    }

    // Validar cada modificación
    for (const m of modificaciones) {
      if (!m.cuota || !m.fechaAnterior || !m.fechaNueva) {
        return NextResponse.json(
          { success: false, error: 'Cada modificación debe tener: cuota, fechaAnterior, fechaNueva' },
          { status: 400 }
        )
      }
    }

    // Para TRASLADO_CUOTA solo se permite una modificación a la vez
    if (tipoModificacion === 'TRASLADO_CUOTA' && modificaciones.length > 1) {
      return NextResponse.json(
        { success: false, error: 'Para TRASLADO_CUOTA solo se permite trasladar una cuota a la vez' },
        { status: 400 }
      )
    }

    // === Cargar préstamo + cliente ===
    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    // === Validar que el préstamo tenga Flexibilidad Financiera activada ===
    if (!prestamo.flexibilidadFinanciera) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Este crédito no tiene adquirido el beneficio de Flexibilidad Financiera. No se pueden generar Otros Síes.',
          codigo: 'FLEXIBILIDAD_NO_ADQUIRIDA',
        },
        { status: 400 }
      )
    }

    // === Validar que el beneficio esté activado (cliente ya pagó el costo) ===
    // Si no está activado, el Otro Sí se puede crear en estado PENDIENTE_PAGO,
    // pero NO se puede firmar. El frontend debería impedir llegar aquí sin pago,
    // pero el backend también valida.
    if (!prestamo.flexibilidadActivada && activarFirma) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El beneficio de Flexibilidad Financiera aún no ha sido activado. El cliente debe pagar el costo adicional primero.',
          codigo: 'FLEXIBILIDAD_NO_ACTIVADA',
          flexibilidadCosto: prestamo.flexibilidadCosto,
        },
        { status: 400 }
      )
    }

    // === Generar código consecutivo ===
    const conteoPrevio = await db.otroSiCambioFecha.count({ where: { prestamoId } })
    const codigo = generarCodigoOtroSi(conteoPrevio)

    // === Descripción (auto si no se envía) ===
    const descripcionFinal =
      descripcion && descripcion.trim().length > 0
        ? descripcion.trim()
        : generarDescripcionAutomatica(
            tipoModificacion as TipoModificacionOtroSi,
            modificaciones as CuotaModificada[]
          )

    // === Serializar modificaciones como JSON ===
    const modificacionesJson = JSON.stringify(modificaciones)

    // === Crear el Otro Sí ===
    const nuevoOtroSi = await db.otroSiCambioFecha.create({
      data: {
        prestamoId,
        codigo,
        tipoModificacion,
        fechasAnteriores: modificacionesJson,
        fechasNuevas: modificacionesJson,
        descripcion: descripcionFinal,
        estado: activarFirma ? 'PENDIENTE_FIRMA' : 'PENDIENTE_FIRMA',
        solicitadoPor: 'Gestor', // TODO: obtener del JWT
      },
    })

    // === Generar el HTML del documento ===
    const html = generarHtmlOtroSi({
      codigo,
      tipoModificacion: tipoModificacion as TipoModificacionOtroSi,
      prestamoCodigo: prestamo.codigo,
      clienteNombre: prestamo.cliente.nombre,
      clienteCedula: prestamo.cliente.cedula,
      clienteTelefono: prestamo.cliente.telefono || undefined,
      clienteEmail: prestamo.cliente.email || undefined,
      montoPrincipal: prestamo.montoPrincipal,
      montoCuota: prestamo.montoCuota,
      numeroCuotas: prestamo.numeroCuotas,
      frecuencia: prestamo.frecuencia,
      modificaciones: modificaciones as CuotaModificada[],
      descripcion: descripcionFinal,
      fechaGeneracion: new Date(),
    })

    // === Si se solicita activar firma, crear FirmaElectronica + enviar OTP ===
    let firmaInfo: any = null
    if (activarFirma && prestamo.flexibilidadActivada) {
      // Crear firma electrónica tipo OTRO_SI (usamos tipo existente ACUERDO_PAGO
      // que es semánticamente compatible, ya que la columna tipo es String)
      const firmaCreada = await db.firmaElectronica.create({
        data: {
          prestamoId: prestamo.id,
          clienteId: prestamo.cliente.id,
          tipo: 'ACUERDO_PAGO', // tipo existente — Otro Sí es un acuerdo de pago
          imagenFirma: '',
          otpCanal: 'EMAIL', // Por defecto, OTP por correo
          estadoFirma: 'PENDIENTE',
          esFirmaCodeudor: false,
          firmanteRol: 'DEUDOR',
          firmanteNombre: prestamo.cliente.nombre,
          firmanteCedula: prestamo.cliente.cedula,
        },
      })

      // Vincular la firma al Otro Sí
      await db.otroSiCambioFecha.update({
        where: { id: nuevoOtroSi.id },
        data: { firmaId: firmaCreada.id },
      })

      // === Generar token de firma pública (link) ===
      const crypto = await import('crypto')
      const tokenCreado = crypto.randomBytes(32).toString('hex')
      const fechaExp = new Date()
      fechaExp.setDate(fechaExp.getDate() + 7)

      await db.tokenFirma.create({
        data: {
          token: tokenCreado,
          firmaId: firmaCreada.id,
          prestamoId: prestamo.id,
          clienteId: prestamo.cliente.id,
          fechaExpiracion: fechaExp,
        },
      })

      const linkFirma = buildAbsoluteUrl(`/firma/${tokenCreado}`)

      // === Enviar OTP por correo ===
      let otpEnviado = false
      let otpError: string | null = null
      if (prestamo.cliente.email) {
        try {
          const { generarCodigoOtp, hashOtp, registrarOtp } = await import('@/lib/otp')
          const { enviarEmail } = await import('@/lib/email')
          const otp = generarCodigoOtp('numeric', 6)

          const subject = `Código de Verificación - Otro Sí ${codigo} - Préstamo ${prestamo.codigo}`
          const textContent = `Estimado/a ${prestamo.cliente.nombre},

Tu código de verificación para firmar el Otro Sí "${codigo}" del préstamo ${prestamo.codigo} es:

  >>  ${otp}  <<

Este código expira en 5 minutos.
No compartas este código con nadie.

Saludos,
Sistema de Gestión de Préstamos`

          const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e40af;">🔐 Código de Verificación — Otro Sí</h2>
  <p>Hola <strong>${prestamo.cliente.nombre}</strong>,</p>
  <p>Tu código para firmar electrónicamente el Otro Sí <strong>${codigo}</strong> del préstamo <strong>${prestamo.codigo}</strong> es:</p>
  <div style="background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
    <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace;">${otp}</div>
  </div>
  <p style="color: #6b7280; font-size: 12px;">⏰ Expira en 5 minutos<br>
  ⚠️ No compartas este código con nadie.</p>
</div>`

          await enviarEmail({
            to: prestamo.cliente.email,
            subject,
            text: textContent,
            html: htmlContent,
          })

          // Registrar OTP centralizado
          await registrarOtp({
            clienteId: prestamo.cliente.id,
            clienteCedula: prestamo.cliente.cedula,
            clienteNombre: prestamo.cliente.nombre,
            codigoPlano: otp,
            metodo: 'EMAIL',
            destinatario: prestamo.cliente.email,
            tipo: 'FIRMA_ELECTRONICA',
            entidadRefId: firmaCreada.id,
            descripcion: `OTP Otro Sí ${codigo} préstamo ${prestamo.codigo}`,
            maxIntentos: 5,
            expiraEnMinutos: 5,
            ipSolicitud: null,
            userAgent: null,
            guardarCodigoPlano: false,
          })

          // Guardar OTP hasheado en la firma
          await db.firmaElectronica.update({
            where: { id: firmaCreada.id },
            data: {
              otpEnviado: true,
              otpCodigo: hashOtp(otp),
              otpCanal: 'EMAIL',
              otpFechaEnvio: new Date(),
              estadoFirma: 'OTP_ENVIADO',
            },
          })

          otpEnviado = true
        } catch (e: any) {
          console.error('[otro-si] Error enviando OTP:', e)
          otpError = e?.message || 'Error enviando OTP'
        }
      }

      firmaInfo = {
        firmaId: firmaCreada.id,
        linkFirma,
        token: tokenCreado,
        expiracion: fechaExp.toISOString(),
        otpEnviado,
        otpError,
        otpCanal: 'EMAIL',
        emailDestino: prestamo.cliente.email || null,
      }
    }

    // === Registrar en bitácora del préstamo ===
    await db.bitacoraPrestamo.create({
      data: {
        prestamoId,
        prestamoCodigo: prestamo.codigo,
        usuarioNombre: 'Gestor',
        tipo: 'OTRO',
        titulo: `OTRO SÍ CREADO: ${codigo}`,
        descripcion:
          `Se generó el Otro Sí ${codigo} (${tipoModificacion}) para el préstamo ${prestamo.codigo}.\n\n` +
          `Tipo de modificación: ${tipoModificacion === 'CAMBIO_FECHA' ? 'Cambio de fecha de pago' : 'Traslado de cuota al final'}\n` +
          `Cantidad de cuotas modificadas: ${modificaciones.length}\n\n` +
          `Descripción: ${descripcionFinal}\n\n` +
          (activarFirma && firmaInfo
            ? `Firma electrónica: ${firmaInfo.otpEnviado ? 'OTP enviado a ' + (prestamo.cliente.email || '') : 'Pendiente de envío'}\n` +
              `Link de firma: ${firmaInfo.linkFirma}\n`
            : 'Firma no activada (pendiente de pago del beneficio).\n'),
        resultado: `Otro Sí ${codigo} creado`,
        fechaEvento: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: nuevoOtroSi,
      html,
      firma: firmaInfo,
      mensaje: activarFirma
        ? `Otro Sí ${codigo} creado. ${firmaInfo?.otpEnviado ? `Se envió un código OTP al correo ${prestamo.cliente.email} para que el cliente firme.` : 'No se pudo enviar el OTP. Revisa el email del cliente.'}`
        : `Otro Sí ${codigo} creado (pendiente de activación de firma).`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// PATCH /api/prestamos/[id]/otro-si
// Activa el beneficio de Flexibilidad Financiera (marca como pagado).
// Body: { accion: 'activar_flexibilidad' }
// =====================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { id: prestamoId } = await params
    const body = await req.json()
    const { accion } = body

    if (accion === 'activar_flexibilidad') {
      const prestamo = await db.prestamo.findUnique({
        where: { id: prestamoId },
        include: { cliente: true },
      })
      if (!prestamo) {
        return NextResponse.json(
          { success: false, error: 'Préstamo no encontrado' },
          { status: 404 }
        )
      }
      if (!prestamo.flexibilidadFinanciera) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Este crédito no tiene adquirido el beneficio de Flexibilidad Financiera.',
          },
          { status: 400 }
        )
      }
      if (prestamo.flexibilidadActivada) {
        return NextResponse.json(
          {
            success: false,
            error:
              'El beneficio ya está activado para este crédito.',
          },
          { status: 400 }
        )
      }

      const actualizado = await db.prestamo.update({
        where: { id: prestamoId },
        data: {
          flexibilidadActivada: true,
          flexibilidadFechaActivacion: new Date(),
        },
      })

      // Bitácora
      await db.bitacoraPrestamo.create({
        data: {
          prestamoId,
          prestamoCodigo: prestamo.codigo,
          usuarioNombre: 'Gestor',
          tipo: 'OTRO',
          titulo: 'FLEXIBILIDAD FINANCIERA ACTIVADA',
          descripcion:
            `Se activó el beneficio de Flexibilidad Financiera para el préstamo ${prestamo.codigo}.\n\n` +
            `Costo cobrado: $${prestamo.flexibilidadCosto.toLocaleString('es-CO')}\n` +
            `Cliente: ${prestamo.cliente.nombre} (CC ${prestamo.cliente.cedula})\n` +
            `Fecha de activación: ${new Date().toLocaleString('es-CO')}\n\n` +
            `A partir de este momento, el cliente puede solicitar:\n` +
            `  1. Cambio de fecha de pago (genera Otro Sí)\n` +
            `  2. Traslado de una cuota al final del crédito (genera Otro Sí)\n`,
          resultado: 'Flexibilidad Financiera activada',
          fechaEvento: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: actualizado,
        mensaje:
          'Beneficio de Flexibilidad Financiera activado. El cliente ya puede solicitar Otros Síes.',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Usa: activar_flexibilidad' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
