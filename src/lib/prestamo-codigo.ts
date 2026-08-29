// =====================================================
// Helper compartido: generar y enviar código(s) OTP de
// confirmación por correo para un solicitud.
//
// REGLA DE NEGOCIO:
//   Si el solicitud tiene tieneCodeudor=true y codeudorEmail
//   seteado, se generan y envían DOS códigos (uno al DEUDOR
//   y otro al CODEUDOR). El solicitud se activa solo cuando
//   AMBOS roles hayan verificado su código.
//
//   Si NO hay codeudor, se genera un solo código para el
//   DEUDOR (comportamiento legacy).
//
// Usado por:
//   - /api/prestamos/[id]/enviar-codigo
//   - /api/prestamos/[id]/enviar-confirmacion  (cuando metodo='CORREO')
// =====================================================

import { db } from '@/lib/db'
import { calcularPrestamo, formatearFecha, getTasaMoraAnual } from '@/lib/finanzas'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { enviarEmail } from '@/lib/email'
import { hashOtp } from '@/lib/otp'
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

function generarCodigoAlfanumerico(longitud = 6): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < longitud; i++) {
    out += caracteres[crypto.randomInt(0, caracteres.length)]
  }
  return out
}

// Helper: detecta si un valor almacenado en CodigoConfirmacion.codigo es un
// hash SHA-256 (64 hex chars) o un código plano legacy (6 chars).
// Esto permite la migración transparente: los códigos nuevos se guardan
// hasheados; los antiguos (plaintext) se siguen aceptando y se migran
// on-the-fly al verificarse.
export function esCodigoHasheado(valor: string | null | undefined): boolean {
  if (!valor || typeof valor !== 'string') return false
  return /^[a-f0-9]{64}$/i.test(valor)
}

function buildEmailContent(opts: {
  nombreDestinatario: string
  rol: 'DEUDOR' | 'CODEUDOR'
  prestamo: any
  calculo: any
  codigo: string
}): { subject: string; text: string; html: string } {
  const { nombreDestinatario, rol, prestamo, calculo, codigo } = opts
  const rolLabel = rol === 'CODEUDOR' ? 'Codeudor' : 'Titular'
  const subject = `Código de Confirmación (${rolLabel}) - Solicitud ${prestamo.codigo}`

  const textContent = `Estimado/a ${nombreDestinatario},

Tu rol en este solicitud es: ${rolLabel.toUpperCase()}.

DETALLES DEL CRÉDITO:
- Código: ${prestamo.codigo}
- Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}
- Cuota fija: $${calculo.montoCuota.toLocaleString('es-CO')}
- Número de cuotas: ${calculo.numeroCuotas}
- Frecuencia: ${prestamo.frecuencia}
- Tasa de interés anual: ${prestamo.tasaInteresAnual}%
- Tasa moratoria: ${prestamo.tasaMoraDiaria}% diario
- Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}
- Primer pago: ${formatearFecha(calculo.tablaAmortizacion[0]?.fechaVencimiento)}

TU CÓDIGO DE CONFIRMACIÓN ES:

  >>  ${codigo}  <<

Para activar este solicitud:
1. Comparte este código con tu gestor.
2. Tu gestor lo ingresará en el sistema.
${rol === 'CODEUDOR'
      ? '3. Como este solicitud tiene codeudor, el solicitud se activará solo cuando tanto el TITULAR como el CODEUDOR hayan verificado su código.\n'
      : '3. Una vez verificado, el solicitud se activará.\n'
    }
IMPORTANTE:
- Este código expira en 24 horas.
- No compartas este código con nadie que no sea tu gestor autorizado.

Saludos,
Sistema de Gestión de Solicitudes`

  const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 22px;">Solicitud Aprobado ✅</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">Código de Confirmación · <strong>${rolLabel}</strong></p>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px; color: #374151;">Estimado/a <strong>${nombreDestinatario}</strong>,</p>
    <p style="color: #6b7280;">Tu rol en este solicitud es <strong>${rolLabel}</strong>. A continuación los detalles:</p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <table style="width: 100%; font-size: 14px; color: #374151;">
        <tr><td style="padding: 4px 0; color: #6b7280;">Código:</td><td style="font-weight: bold;">${prestamo.codigo}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Monto:</td><td style="font-weight: bold;">$${prestamo.montoPrincipal.toLocaleString('es-CO')}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Cuota fija:</td><td style="font-weight: bold;">$${calculo.montoCuota.toLocaleString('es-CO')}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">N° cuotas:</td><td style="font-weight: bold;">${calculo.numeroCuotas}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Frecuencia:</td><td style="font-weight: bold;">${prestamo.frecuencia}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Tasa anual:</td><td style="font-weight: bold;">${prestamo.tasaInteresAnual}%</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Tasa moratoria:</td><td style="font-weight: bold;">${prestamo.tasaMoraDiaria}% diario</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Total a pagar:</td><td style="font-weight: bold; color: #1e40af;">$${calculo.totalPagar.toLocaleString('es-CO')}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Primer pago:</td><td style="font-weight: bold;">${formatearFecha(calculo.tablaAmortizacion[0]?.fechaVencimiento)}</td></tr>
      </table>
    </div>
    <div style="background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: bold;">🔐 TU CÓDIGO DE CONFIRMACIÓN (${rolLabel.toUpperCase()})</p>
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace; padding: 8px 0;">${codigo}</div>
      <p style="margin: 8px 0 0; color: #6b7280; font-size: 12px;">Vence en 24 horas</p>
    </div>
    ${rol === 'CODEUDOR'
      ? `<div style="background: #ede9fe; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #6d28d9;">⚠️ Solicitud con codeudor</p>
          <p style="margin: 0; color: #4c1d95; font-size: 14px;">
            Este solicitud cuenta con codeudor. El solicitud NO se activará hasta que tanto el
            <strong>titular</strong> como el <strong>codeudor</strong> hayan verificado su respectivo código.
          </p>
        </div>`
      : ''
    }
    <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-weight: bold; color: #1e40af;">¿Cómo activar tu solicitud?</p>
      <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px;">
        <li>Comparte este código con tu gestor.</li>
        <li>Tu gestor lo ingresará en el sistema.</li>
        <li>Una vez verificado${rol === 'CODEUDOR' ? ' (junto con el del titular)' : ''}, el solicitud se activará.</li>
      </ol>
    </div>
    <div style="background: #fee2e2; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 12px; color: #991b1b;">
      ⚠️ No compartas este código con nadie que no sea tu gestor autorizado.<br>
      Si no solicitaste este solicitud, ignora este mensaje.
    </div>
    <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">
      Sistema de Gestión de Solicitudes<br>
      Este es un correo automático, no respondas a esta dirección.
    </p>
  </div>
</div>`

  return { subject, text: textContent, html: htmlContent }
}

export interface EnviarCodigosResult {
  success: boolean
  status: number
  body: any
}

export async function generarYEnviarCodigosConfirmacion(opts: {
  prestamoId: string
  req: NextRequest
}): Promise<EnviarCodigosResult> {
  const { prestamoId, req } = opts
  const clientInfo = getClientInfo(req)

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { cliente: true },
  })

  if (!prestamo) {
    return { success: false, status: 404, body: { success: false, error: 'Solicitud no encontrado' } }
  }

  if (prestamo.estado !== 'SOLICITUD' && prestamo.estado !== 'PENDIENTE_ACEPTACION') {
    return {
      success: false,
      status: 400,
      body: {
        success: false,
        error: `El solicitud está en estado ${prestamo.estado}. Solo se puede enviar código a solicitudes en SOLICITUD o PENDIENTE_ACEPTACION.`,
      },
    }
  }

  if (!prestamo.cliente.email) {
    return {
      success: false,
      status: 400,
      body: {
        success: false,
        error: 'El cliente no tiene correo electrónico registrado. Actualiza la ficha del cliente.',
      },
    }
  }

  const requiereCodeudor =
    prestamo.tieneCodeudor === true &&
    typeof prestamo.codeudorEmail === 'string' &&
    prestamo.codeudorEmail.trim().length > 0

  if (requiereCodeudor && !prestamo.codeudorNombre) {
    return {
      success: false,
      status: 400,
      body: {
        success: false,
        error: 'El solicitud tiene codeudor pero falta el nombre del codeudor. Edita el solicitud antes de enviar el código.',
      },
    }
  }

  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: new Date(),
  })

  const fechaExpiracion = new Date()
  fechaExpiracion.setHours(fechaExpiracion.getHours() + 24)

  // Borrar códigos anteriores (cualquier rol)
  await db.codigoConfirmacion.deleteMany({ where: { prestamoId } })

  const destinatarios: Array<{
    rol: 'DEUDOR' | 'CODEUDOR'
    nombre: string
    email: string
    codigo: string
  }> = [
    {
      rol: 'DEUDOR',
      nombre: prestamo.cliente.nombre,
      email: prestamo.cliente.email,
      codigo: generarCodigoAlfanumerico(),
    },
  ]

  if (requiereCodeudor) {
    destinatarios.push({
      rol: 'CODEUDOR',
      nombre: prestamo.codeudorNombre!,
      email: prestamo.codeudorEmail!.trim(),
      codigo: generarCodigoAlfanumerico(),
    })
  }

  const codigosCreados: Array<{ id: string; rol: string; codigo: string; email: string }> = []
  for (const d of destinatarios) {
    // SECURITY: el código se almacena HASHEADO (SHA-256) en CodigoConfirmacion.codigo.
    // El código plano solo se envía por correo al destinatario y se mantiene en
    // memoria durante esta función para el audit log / mensaje de respuesta.
    // Si la BD se filtra, los códigos no son reversibles.
    const rec = await db.codigoConfirmacion.create({
      data: {
        prestamoId,
        rol: d.rol,
        codigo: hashOtp(d.codigo),
        emailCliente: d.email,
        fechaExpiracion,
      },
    })
    codigosCreados.push({ id: rec.id, rol: d.rol, codigo: d.codigo, email: d.email })
  }

  await db.prestamo.update({
    where: { id: prestamoId },
    data: {
      estado: 'PENDIENTE_ACEPTACION',
      metodoConfirmacion: 'CORREO',
      fechaAprobacion: new Date(),
      tycEnviado: true,
    },
  })

  // WhatsApp al deudor
  // La tasa anual NO se envía al cliente por WhatsApp (cambio solicitado).
  // Solo se mantiene en el email HTML para registro documental.
  const lineaTasa = ''

  const mensajeWhatsApp = requiereCodeudor
    ? `✅ *SOLICITUD APROBADO - CÓDIGOS DE CONFIRMACIÓN*

Hola *${prestamo.cliente.nombre}*, tu solicitud ${prestamo.codigo} fue aprobado.

📋 *Características del crédito:*
• Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}
• Cuota fija: $${calculo.montoCuota.toLocaleString('es-CO')}
• N° cuotas: ${calculo.numeroCuotas}
${lineaTasa}• Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}

🔐 *SOLICITUD CON CODEUDOR — Requiere doble confirmación*
Hemos enviado un código a TU correo (${prestamo.cliente.email}) y OTRO código al correo del codeudor (${prestamo.codeudorEmail}).

El solicitud se activará ÚNICAMENTE cuando ambas partes entreguen su código a su gestor.`
    : `✅ *SOLICITUD APROBADO - CÓDIGO DE CONFIRMACIÓN*

Hola *${prestamo.cliente.nombre}*, tu solicitud ${prestamo.codigo} fue aprobado.

📋 *Características del crédito:*
• Monto: $${prestamo.montoPrincipal.toLocaleString('es-CO')}
• Cuota fija: $${calculo.montoCuota.toLocaleString('es-CO')}
• N° cuotas: ${calculo.numeroCuotas}
${lineaTasa}• Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}

🔐 *Hemos enviado un código de confirmación a tu correo electrónico:*
${prestamo.cliente.email}

Para activar tu solicitud, comparte ese código con tu gestor.
El código expira en 24 horas.`

  const envioWhatsApp = await enviarWhatsApp(prestamo.cliente.telefono, mensajeWhatsApp)
  await guardarNotificacion({
    db,
    prestamoId,
    telefono: prestamo.cliente.telefono,
    tipo: 'TYC',
    mensaje: mensajeWhatsApp,
    envio: envioWhatsApp,
  })

  // Enviar correos
  const resultadosEmail: Array<any> = []
  for (const d of destinatarios) {
    const { subject, text, html } = buildEmailContent({
      nombreDestinatario: d.nombre,
      rol: d.rol,
      prestamo,
      calculo,
      codigo: d.codigo,
    })
    const r = await enviarEmail({ to: d.email, subject, text, html })
    resultadosEmail.push({
      rol: d.rol,
      email: d.email,
      codigo: d.codigo,
      success: r.success,
      isEthereal: r.isEthereal,
      previewUrl: r.previewUrl,
      error: r.error,
    })
  }

  await registrarAuditLog({
    usuarioNombre: 'Sistema',
    accion: 'CODIGO_CONFIRMACION_ENVIADO',
    modulo: 'prestamos',
    entidadId: prestamoId,
    entidadNombre: prestamo.codigo,
    detalles: JSON.stringify({
      requiereCodeudor,
      destinatarios: destinatarios.map(d => ({ rol: d.rol, email: d.email })),
      // SECURITY: NO persistir códigos OTP en plano en audit log.
      // Los hashes están en CodigoConfirmacion.codigo; el plano solo en memoria.
      codigosHashed: codigosCreados.map(c => ({ rol: c.rol, email: c.email, id: c.id })),
      expiracion: fechaExpiracion.toISOString(),
      prestamoCodigo: prestamo.codigo,
      // resultadosEmail puede contener el código plano en modo Ethereal (dev);
      // en producción los correos reales no incluyen el código en el resultado.
      resultadosEmail: resultadosEmail.map((r: any) => ({
        rol: r.rol,
        email: r.email,
        success: r.success,
        isEthereal: r.isEthereal,
        // Solo incluir código plano si es Ethereal (dev); en prod se omite
        ...(r.isEthereal ? { codigo: r.codigo } : {}),
        previewUrl: r.previewUrl,
        error: r.error,
      })),
    }),
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
  })

  const fallidos = resultadosEmail.filter((r: any) => !r.success)
  const alMenosUnoReal = resultadosEmail.some((r: any) => r.success && !r.isEthereal)
  const todosEthereal = resultadosEmail.every((r: any) => r.isEthereal)
  const todosFallidos = resultadosEmail.every((r: any) => !r.success)

  let mensajeRespuesta: string
  if (fallidos.length === 0 && alMenosUnoReal) {
    mensajeRespuesta = requiereCodeudor
      ? `✅ Se enviaron 2 códigos de confirmación: uno al TITULAR (${destinatarios[0].email}) y otro al CODEUDOR (${destinatarios[1].email}). El solicitud se activará solo cuando el gestor verifique AMBOS códigos.`
      : `✅ Código de confirmación enviado al correo ${destinatarios[0].email}. Se notificó al cliente por WhatsApp que revise su correo.`
  } else if (todosEthereal) {
    mensajeRespuesta = `⚠️ MODO DE PRUEBA: NO hay SMTP configurado. Se generaron ${resultadosEmail.length} código(s) pero los correos se enviaron por Ethereal (no llegaron a destino real). Códigos generados: ${resultadosEmail.map((r: any) => `${r.rol}=${r.codigo}`).join(', ')}. Configura una conexión EMAIL_SMTP en Conexiones API para envíos reales.`
  } else {
    const detallesFallo = fallidos.map((f: any) => `${f.rol}→${f.email} (${f.error})`).join('; ')
    mensajeRespuesta = `⚠️ Envío parcial: ${fallidos.length} de ${resultadosEmail.length} correo(s) fallaron. Detalle: ${detallesFallo}. Códigos generados: ${resultadosEmail.map((r: any) => `${r.rol}=${r.codigo}`).join(', ')}.`
  }

  if (todosFallidos) {
    return {
      success: false,
      status: 500,
      body: {
        success: false,
        error: mensajeRespuesta,
        data: { codigos: codigosCreados },
      },
    }
  }

  return {
    success: true,
    status: 200,
    body: {
      success: true,
      data: {
        requiereCodeudor,
        codigos: codigosCreados,
        expiracion: fechaExpiracion.toISOString(),
        prestamoCodigo: prestamo.codigo,
        resultadosEmail: resultadosEmail.map((r: any) => ({
          rol: r.rol,
          email: r.email,
          emailEnviado: r.success && !r.isEthereal,
          emailIsEthereal: r.isEthereal,
          emailPreviewUrl: r.previewUrl,
          emailError: r.error,
        })),
      },
      whatsapp: envioWhatsApp,
      mensaje: mensajeRespuesta,
      smtpConfigurado: alMenosUnoReal,
    },
  }
}
