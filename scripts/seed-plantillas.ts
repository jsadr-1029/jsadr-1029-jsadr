// =====================================================
// SEED — Plantillas iniciales del sistema
// =====================================================
// Carga todas las plantillas base (WhatsApp y Email) que el
// sistema usa para comunicarse con los clientes.
//
// Estas plantillas quedan en BD y el admin puede editarlas,
// activarlas/desactivarlas y crear nuevas desde
// Administración → Plantillas.
//
// Marcadas con sistema=true para que no se puedan eliminar
// (solo editar). Así garantizamos que el sistema siempre
// tenga un mensaje por defecto para cada evento.
// =====================================================

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const db = new PrismaClient()

// =====================================================
// PLANTILLAS WHATSAPP
// =====================================================
const PLANTILLAS_WHATSAPP = [
  {
    codigo: 'SOLICITUD_PRESTAMO_WA',
    nombre: 'Solicitud de Préstamo (WhatsApp)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.solicitud',
    descripcion: 'Se envía cuando se registra una nueva solicitud de préstamo.',
    asunto: null,
    contenido: `🏦 *SOLICITUD DE PRÉSTAMO REGISTRADA*

Hola *{{clienteNombre}}*,

Hemos registrado tu solicitud de préstamo:
📋 Código: *{{prestamoCodigo}}*
💰 Monto solicitado: *{{montoSolicitado}}*
📅 Plazo: *{{plazoMeses}} meses*
📈 Tasa: *{{tasaInteres}}% mensual*

Te notificaremos en cuanto sea aprobada.

_Mensaje automático - Por favor no respondas a este número_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'montoSolicitado', 'plazoMeses', 'tasaInteres']),
  },
  {
    codigo: 'APROBACION_PRESTAMO_WA',
    nombre: 'Aprobación de Préstamo (WhatsApp)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.aprobacion',
    descripcion: 'Se envía cuando un préstamo es aprobado.',
    asunto: null,
    contenido: `✅ *PRÉSTAMO APROBADO*

Hola *{{clienteNombre}}*,

¡Tu préstamo *{{prestamoCodigo}}* fue aprobado!
💰 Monto: *{{monto}}*
💵 Cuota: *{{montoCuota}}*
📅 Cuotas: *{{numeroCuota}}/{{totalCuotas}}*
🗓️ Primer vencimiento: *{{fechaVencimiento}}*

Para desembolsar, confirma tu aceptación:
🔗 {{enlacePortal}}

_Mensaje automático - Por favor no respondas_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'monto', 'montoCuota', 'numeroCuota', 'totalCuotas', 'fechaVencimiento', 'enlacePortal']),
  },
  {
    codigo: 'DESEMBOLSO_WA',
    nombre: 'Desembolso Realizado (WhatsApp)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.desembolso',
    descripcion: 'Se envía cuando se realiza el desembolso del préstamo.',
    asunto: null,
    contenido: `💸 *DESEMBOLSO REALIZADO*

Hola *{{clienteNombre}}*,

Te informamos que se realizó el desembolso:
📋 Préstamo: *{{prestamoCodigo}}*
💰 Monto: *{{monto}}*
🏦 Cuenta: {{banco}} ****{{numeroCuenta}}

Tu préstamo quedó ACTIVO.

_Mensaje automático_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'monto', 'banco', 'numeroCuenta']),
  },
  {
    codigo: 'RECORDATORIO_PAGO_WA',
    nombre: 'Recordatorio de Pago (WhatsApp)',
    categoria: 'PAGOS',
    evento: 'pago.recordatorio',
    descripcion: 'Recordatorio automático 1 día antes del vencimiento de la cuota.',
    asunto: null,
    contenido: `⏰ *RECORDATORIO DE PAGO*

Hola *{{clienteNombre}}*,

Te recordamos tu próxima cuota:
📋 Préstamo: *{{prestamoCodigo}}*
💵 Valor cuota: *{{montoCuota}}*
📅 Cuota: *{{numeroCuota}}/{{totalCuotas}}*
🗓️ Vence: *{{fechaVencimiento}}*

Evita cargos por mora realizando tu pago a tiempo.

_Mensaje automático - Por favor no respondas_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'montoCuota', 'numeroCuota', 'totalCuotas', 'fechaVencimiento']),
  },
  {
    codigo: 'AVISO_MORA_WA',
    nombre: 'Aviso de Mora (WhatsApp)',
    categoria: 'PAGOS',
    evento: 'pago.mora',
    descripcion: 'Se envía cuando un pago está vencido.',
    asunto: null,
    contenido: `⚠️ *PAGO VENCIDO*

Hola *{{clienteNombre}}*,

Tu pago del préstamo *{{prestamoCodigo}}* está vencido:
💵 Cuota: *{{montoCuota}}*
⏱️ Días de mora: *{{diasMora}}*
💰 Saldo pendiente: *{{saldoPendiente}}*

🚨 Genera intereses de mora diarios.
Regulariza cuanto antes para evitar mayor afectación.

_Mensaje automático_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'montoCuota', 'diasMora', 'saldoPendiente']),
  },
  {
    codigo: 'PAGO_CONFIRMADO_WA',
    nombre: 'Pago Confirmado (WhatsApp)',
    categoria: 'PAGOS',
    evento: 'pago.confirmado',
    descripcion: 'Confirmación al cliente cuando su pago es aplicado.',
    asunto: null,
    contenido: `✅ *PAGO CONFIRMADO*

Hola *{{clienteNombre}}*,

Hemos registrado tu pago:
📋 Préstamo: *{{prestamoCodigo}}*
💰 Monto recibido: *{{monto}}*
📅 Cuota: *{{numeroCuota}}/{{totalCuotas}}*
💵 Saldo pendiente: *{{saldoPendiente}}*

¡Gracias por tu pago puntual!

_Mensaje automático_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'monto', 'numeroCuota', 'totalCuotas', 'saldoPendiente']),
  },
  {
    codigo: 'OTP_WA',
    nombre: 'Código de Verificación OTP (WhatsApp)',
    categoria: 'SEGURIDAD',
    evento: 'otp.generado',
    descripcion: 'Código OTP para verificación de identidad.',
    asunto: null,
    contenido: `🔐 *CÓDIGO DE VERIFICACIÓN*

Hola *{{clienteNombre}}*,

Tu código de verificación es:

*{{otp}}*

⏱️ Válido por 10 minutos.
🔒 No compartas este código con nadie.

_Mensaje automático - Por favor no respondas_`,
    variables: JSON.stringify(['clienteNombre', 'otp']),
  },
  {
    codigo: 'COBRO_JURIDICO_WA',
    nombre: 'Aviso Cobro Jurídico (WhatsApp)',
    categoria: 'JURÍDICO',
    evento: 'prestamo.juridico',
    descripcion: 'Se envía cuando el préstamo pasa a cobro jurídico.',
    asunto: null,
    contenido: `⚖️ *AVISO COBRO JURÍDICO*

Hola *{{clienteNombre}}*,

Tu préstamo *{{prestamoCodigo}}* fue derivado a cobro jurídico:
💰 Saldo total: *{{saldoPendiente}}*
⏱️ Días de mora: *{{diasMora}}*

Comunicate urgentemente para evitar mayores consecuencias legales.

_Mensaje automático_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'saldoPendiente', 'diasMora']),
  },
  {
    codigo: 'ESTADO_CUENTA_WA',
    nombre: 'Estado de Cuenta (WhatsApp)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.estado_cuenta',
    descripcion: 'Resumen del estado de cuenta del préstamo.',
    asunto: null,
    contenido: `📊 *ESTADO DE CUENTA*

Hola *{{clienteNombre}}*,

Resumen de tu préstamo *{{prestamoCodigo}}*:
💰 Saldo pendiente: *{{saldoPendiente}}*
💵 Próxima cuota: *{{montoCuota}}*
🗓️ Próximo vencimiento: *{{fechaVencimiento}}*
📅 Cuotas pagadas: *{{numeroCuota}}/{{totalCuotas}}*

_Mensaje automático_`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'saldoPendiente', 'montoCuota', 'fechaVencimiento', 'numeroCuota', 'totalCuotas']),
  },
  {
    codigo: 'BIENVENIDA_CLIENTE_WA',
    nombre: 'Bienvenida de Cliente (WhatsApp)',
    categoria: 'CLIENTES',
    evento: 'cliente.creado',
    descripcion: 'Mensaje de bienvenida al crear un nuevo cliente.',
    asunto: null,
    contenido: `👋 *BIENVENIDO(A)*

Hola *{{clienteNombre}}*,

Tu cuenta fue creada exitosamente.
Ya puedes acceder al portal del cliente para:
✓ Ver tus préstamos
✓ Simular nuevos préstamos
✓ Consultar saldos y pagos
✓ Firmar documentos

🔗 Accede aquí: {{enlacePortal}}

_Mensaje automático_`,
    variables: JSON.stringify(['clienteNombre', 'enlacePortal']),
  },
]

// =====================================================
// PLANTILLAS EMAIL
// =====================================================
const PLANTILLAS_EMAIL = [
  {
    codigo: 'BIENVENIDA_CLIENTE_EMAIL',
    nombre: 'Bienvenida de Cliente (Email)',
    categoria: 'CLIENTES',
    evento: 'cliente.creado',
    descripcion: 'Email de bienvenida al crear un nuevo cliente.',
    asunto: '👋 Bienvenido(a) a JSADR — Tu cuenta fue creada',
    contenido: `Hola {{clienteNombre}},

Tu cuenta en JSADR fue creada exitosamente.

Ya puedes acceder al portal del cliente para:
- Ver tus préstamos
- Simular nuevos préstamos
- Consultar saldos y pagos
- Firmar documentos

Accede aquí: {{enlacePortal}}

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">👋 ¡Bienvenido(a) a JSADR!</h1>
            <p style="color:#c7d2fe;margin:6px 0 0 0;font-size:13px;">Tu cuenta fue creada exitosamente</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Tu cuenta en JSADR fue creada exitosamente. Ya puedes acceder al portal del cliente para:
            </p>
            <ul style="margin:0 0 24px 20px;padding:0;font-size:14px;line-height:1.8;color:#4b5563;">
              <li>Ver tus préstamos</li>
              <li>Simular nuevos préstamos</li>
              <li>Consultar saldos y pagos</li>
              <li>Firmar documentos electrónicamente</li>
            </ul>
            <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;">💡 Accede al portal:</p>
            <p style="margin:0 0 24px 0;">
              <a href="{{enlacePortal}}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Ingresar al Portal</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático. Para soporte, contacta a tu gestor.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'enlacePortal', 'anioActual']),
  },
  {
    codigo: 'RECORDATORIO_PAGO_EMAIL',
    nombre: 'Recordatorio de Pago (Email)',
    categoria: 'PAGOS',
    evento: 'pago.recordatorio',
    descripcion: 'Email de recordatorio de pago (1 día antes del vencimiento).',
    asunto: '⏰ Recordatorio: tu cuota vence {{diasRestantesTexto}}',
    contenido: `Hola {{clienteNombre}},

Te recordamos que tienes una cuota pendiente que vence {{diasRestantesTexto}}.

Préstamo: {{prestamoCodigo}}
Cuota #: {{numeroCuota}} de {{totalCuotas}}
Monto a pagar: {{montoCuota}}
Fecha de vencimiento: {{fechaVencimiento}}

Evita intereses moratorios pagando a tiempo.

Para realizar tu pago, ingresa al portal del cliente:
{{enlacePortal}}

Si ya realizaste el pago, ignora este correo.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">⏰ Recordatorio de Pago</h1>
            <p style="color:#c7d2fe;margin:6px 0 0 0;font-size:13px;">Tu cuota vence {{diasRestantesTexto}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Te recordamos que tienes una cuota pendiente que <strong>vence {{diasRestantesTexto}}</strong>.
              Paga a tiempo para evitar intereses moratorios.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:8px;">Préstamo</td>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:8px;text-align:right;">Cuota</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;font-weight:600;color:#1f2937;padding-bottom:16px;">{{prestamoCodigo}}</td>
                    <td style="font-size:15px;font-weight:600;color:#1f2937;padding-bottom:16px;text-align:right;">{{numeroCuota}}/{{totalCuotas}}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:6px;">Fecha de vencimiento</td>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:6px;text-align:right;">Monto a pagar</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;font-weight:600;color:#1f2937;">{{fechaVencimiento}}</td>
                    <td style="font-size:18px;font-weight:700;color:#dc2626;text-align:right;">{{montoCuota}}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;">💡 Para realizar tu pago, ingresa al portal del cliente:</p>
            <p style="margin:0 0 24px 0;">
              <a href="{{enlacePortal}}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Ingresar al Portal</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático. Si ya realizaste el pago, ignora este correo.<br>
              Para soporte, contacta a tu gestor.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'numeroCuota', 'totalCuotas', 'montoCuota', 'fechaVencimiento', 'diasRestantesTexto', 'enlacePortal', 'anioActual']),
  },
  {
    codigo: 'OTP_EMAIL',
    nombre: 'Código OTP (Email)',
    categoria: 'SEGURIDAD',
    evento: 'otp.generado',
    descripcion: 'Email con código OTP para verificación de identidad.',
    asunto: '🔐 Tu código de verificación - JSADR',
    contenido: `Hola {{clienteNombre}},

Tu código de verificación es: {{otp}}

Este código expira en 10 minutos.

Si no solicitaste este código, ignora este correo.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">🔐 Código de Verificación</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;text-align:center;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Tu código de verificación es:
            </p>
            <div style="font-size:36px;font-weight:bold;color:#1e40af;text-align:center;padding:20px;background:#f9fafb;border-radius:8px;letter-spacing:8px;margin-bottom:24px;">
              {{otp}}
            </div>
            <p style="margin:0 0 24px 0;font-size:13px;color:#6b7280;">
              ⏱️ Expira en 10 minutos. No compartas este código con nadie.
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Si no solicitaste este código, ignora este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'otp', 'anioActual']),
  },
  {
    codigo: 'APROBACION_PRESTAMO_EMAIL',
    nombre: 'Aprobación de Préstamo (Email)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.aprobacion',
    descripcion: 'Email al aprobar un préstamo.',
    asunto: '✅ Préstamo aprobado - {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

¡Buenas noticias! Tu préstamo {{prestamoCodigo}} fue aprobado.

Detalles:
- Monto: {{monto}}
- Cuota: {{montoCuota}}
- Cuotas: {{numeroCuota}}/{{totalCuotas}}
- Primer vencimiento: {{fechaVencimiento}}

Para desembolsar, debes aceptar los términos y condiciones desde el portal:
{{enlacePortal}}

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">✅ Préstamo Aprobado</h1>
            <p style="color:#dcfce7;margin:6px 0 0 0;font-size:13px;">Código: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              ¡Buenas noticias! Tu préstamo fue aprobado. A continuación los detalles:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{monto}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Cuota:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{montoCuota}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Cuotas:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{numeroCuota}}/{{totalCuotas}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Primer vencimiento:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{fechaVencimiento}}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;">
              💡 Para desembolsar, debes aceptar los términos y condiciones desde el portal:
            </p>
            <p style="margin:0 0 24px 0;">
              <a href="{{enlacePortal}}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Aceptar Términos</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático. Para soporte, contacta a tu gestor.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'monto', 'montoCuota', 'numeroCuota', 'totalCuotas', 'fechaVencimiento', 'enlacePortal', 'anioActual']),
  },
  {
    codigo: 'FIRMA_SOLICITUD_EMAIL',
    nombre: 'Solicitud de Firma Electrónica (Email)',
    categoria: 'FIRMA',
    evento: 'firma.solicitada',
    descripcion: 'Email con enlace para firmar electrónicamente el pagaré.',
    asunto: '✍️ Firma electrónica requerida - Préstamo {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Tu préstamo {{prestamoCodigo}} está listo para firma.

Para firmar electrónicamente el pagaré, accede al siguiente enlace:
{{enlaceFirma}}

El enlace expira en 48 horas.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">✍️ Firma Electrónica Requerida</h1>
            <p style="color:#ede9fe;margin:6px 0 0 0;font-size:13px;">Préstamo: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Tu préstamo está listo para firma. Para continuar con el proceso, debes firmar
              electrónicamente el pagaré.
            </p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;">
              Haz clic en el siguiente botón para iniciar la firma:
            </p>
            <p style="margin:0 0 24px 0;">
              <a href="{{enlaceFirma}}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Firmar Documento</a>
            </p>
            <p style="margin:0 0 24px 0;font-size:13px;color:#dc2626;">
              ⏱️ El enlace expira en 48 horas.
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Si no solicitaste este préstamo, contacta inmediatamente a tu gestor.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'enlaceFirma', 'anioActual']),
  },
  {
    codigo: 'PAGO_CONFIRMADO_EMAIL',
    nombre: 'Pago Confirmado (Email)',
    categoria: 'PAGOS',
    evento: 'pago.confirmado',
    descripcion: 'Confirmación al cliente cuando su pago es aplicado.',
    asunto: '✅ Pago confirmado - Préstamo {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Hemos registrado tu pago correctamente.

Detalles del pago:
- Préstamo: {{prestamoCodigo}}
- Monto recibido: {{monto}}
- Cuota: {{numeroCuota}} de {{totalCuotas}}
- Saldo pendiente: {{saldoPendiente}}

¡Gracias por tu pago puntual!

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">✅ Pago Confirmado</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Hemos registrado tu pago correctamente. ¡Gracias por tu pago puntual!
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Préstamo:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{prestamoCodigo}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto recibido:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{monto}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Cuota:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{numeroCuota}} de {{totalCuotas}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Saldo pendiente:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{saldoPendiente}}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático. Para soporte, contacta a tu gestor.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'monto', 'numeroCuota', 'totalCuotas', 'saldoPendiente', 'anioActual']),
  },
  {
    codigo: 'AVISO_MORA_EMAIL',
    nombre: 'Aviso de Mora (Email)',
    categoria: 'PAGOS',
    evento: 'pago.mora',
    descripcion: 'Email al cliente cuando un pago entra en mora.',
    asunto: '⚠️ Pago vencido - Préstamo {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Tu pago del préstamo {{prestamoCodigo}} está vencido.

Detalles:
- Cuota: {{montoCuota}}
- Días de mora: {{diasMora}}
- Saldo pendiente: {{saldoPendiente}}

🚨 Genera intereses de mora diarios.
Regulariza cuanto antes para evitar mayor afectación.

Para realizar tu pago, ingresa al portal:
{{enlacePortal}}

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">⚠️ Pago Vencido</h1>
            <p style="color:#fee2e2;margin:6px 0 0 0;font-size:13px;">Préstamo: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Tu pago del préstamo <strong>{{prestamoCodigo}}</strong> está vencido. Genera intereses
              de mora diarios. Regulariza cuanto antes para evitar mayor afectación.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#991b1b;">Cuota:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{montoCuota}}</td></tr>
                  <tr><td style="padding:6px 0;color:#991b1b;">Días de mora:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{diasMora}}</td></tr>
                  <tr><td style="padding:6px 0;color:#991b1b;">Saldo pendiente:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{saldoPendiente}}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;">💡 Realiza tu pago desde el portal:</p>
            <p style="margin:0 0 24px 0;">
              <a href="{{enlacePortal}}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Pagar Ahora</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Si ya realizaste el pago, ignora este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'montoCuota', 'diasMora', 'saldoPendiente', 'enlacePortal', 'anioActual']),
  },
  {
    codigo: 'COBRO_JURIDICO_EMAIL',
    nombre: 'Cobro Jurídico (Email)',
    categoria: 'JURÍDICO',
    evento: 'prestamo.juridico',
    descripcion: 'Email al derivar el préstamo a cobro jurídico.',
    asunto: '⚖️ Cobro Jurídico - Préstamo {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Tu préstamo {{prestamoCodigo}} fue derivado a cobro jurídico.

Detalles:
- Saldo total: {{saldoPendiente}}
- Días de mora: {{diasMora}}

Comunicate urgentemente para evitar mayores consecuencias legales.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1f2937,#374151);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">⚖️ Cobro Jurídico</h1>
            <p style="color:#d1d5db;margin:6px 0 0 0;font-size:13px;">Préstamo: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Tu préstamo fue derivado a cobro jurídico. Te recomendamos comunicarte urgentemente
              para evitar mayores consecuencias legales.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Saldo total:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{saldoPendiente}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Días de mora:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{diasMora}}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Comunicate con el área jurídica lo antes posible.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'saldoPendiente', 'diasMora', 'anioActual']),
  },
  {
    codigo: 'RECUPERAR_CLAVE_EMAIL',
    nombre: 'Recuperar Clave (Email)',
    categoria: 'SEGURIDAD',
    evento: 'auth.recuperar_clave',
    descripcion: 'Email con enlace para recuperar contraseña.',
    asunto: '🔐 Recuperación de clave - JSADR',
    contenido: `Hola {{clienteNombre}},

Hemos recibido una solicitud para restablecer tu clave.

Para continuar, accede al siguiente enlace:
{{enlaceRecuperacion}}

Si no solicitaste este cambio, ignora este correo.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">🔐 Recuperación de Clave</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Hemos recibido una solicitud para restablecer tu clave. Para continuar, haz clic en el siguiente botón:
            </p>
            <p style="margin:0 0 24px 0;">
              <a href="{{enlaceRecuperacion}}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Restablecer Clave</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Si no solicitaste este cambio, ignora este correo y tu clave permanecerá sin cambios.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'enlaceRecuperacion', 'anioActual']),
  },
  {
    codigo: 'DESEMBOLSO_EMAIL',
    nombre: 'Desembolso Realizado (Email)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.desembolso',
    descripcion: 'Email al realizar el desembolso del préstamo.',
    asunto: '💸 Desembolso realizado - Préstamo {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Te informamos que se realizó el desembolso de tu préstamo.

Detalles:
- Préstamo: {{prestamoCodigo}}
- Monto: {{monto}}
- Cuenta: {{banco}} ****{{numeroCuenta}}

Tu préstamo quedó ACTIVO.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#0891b2,#06b6d4);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">💸 Desembolso Realizado</h1>
            <p style="color:#cffafe;margin:6px 0 0 0;font-size:13px;">Préstamo: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Te informamos que se realizó el desembolso de tu préstamo. Tu préstamo quedó ACTIVO.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Préstamo:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{prestamoCodigo}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{monto}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Cuenta:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{banco}} ****{{numeroCuenta}}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'monto', 'banco', 'numeroCuenta', 'anioActual']),
  },
  {
    codigo: 'SOLICITUD_PRESTAMO_EMAIL',
    nombre: 'Solicitud de Préstamo (Email)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.solicitud',
    descripcion: 'Email al registrar una nueva solicitud de préstamo.',
    asunto: '📋 Solicitud registrada - {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Hemos registrado tu solicitud de préstamo.

Detalles:
- Código: {{prestamoCodigo}}
- Monto solicitado: {{montoSolicitado}}
- Plazo: {{plazoMeses}} meses
- Tasa: {{tasaInteresAnual}}% anual

Te notificaremos en cuanto sea aprobada.

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">📋 Solicitud de Préstamo</h1>
            <p style="color:#c7d2fe;margin:6px 0 0 0;font-size:13px;">Código: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Hemos registrado tu solicitud de préstamo. Te notificaremos en cuanto sea aprobada.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Código:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{prestamoCodigo}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Monto solicitado:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{montoSolicitado}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Plazo:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{plazoMeses}} meses</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Tasa:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{tasaInteresAnual}}% anual</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'montoSolicitado', 'plazoMeses', 'tasaInteresAnual', 'anioActual']),
  },
  {
    codigo: 'ESTADO_CUENTA_EMAIL',
    nombre: 'Estado de Cuenta (Email)',
    categoria: 'PRÉSTAMOS',
    evento: 'prestamo.estado_cuenta',
    descripcion: 'Email con el estado de cuenta del préstamo.',
    asunto: '📊 Estado de cuenta - Préstamo {{prestamoCodigo}}',
    contenido: `Hola {{clienteNombre}},

Aquí tienes el resumen de tu préstamo {{prestamoCodigo}}:

- Saldo pendiente: {{saldoPendiente}}
- Próxima cuota: {{montoCuota}}
- Próximo vencimiento: {{fechaVencimiento}}
- Cuotas pagadas: {{numeroCuota}} de {{totalCuotas}}

Saludos,
Equipo JSADR`,
    contenidoHtml: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#6366f1);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">📊 Estado de Cuenta</h1>
            <p style="color:#c7d2fe;margin:6px 0 0 0;font-size:13px;">Préstamo: {{prestamoCodigo}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px 0;font-size:16px;">Hola <strong>{{clienteNombre}}</strong>,</p>
            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">
              Aquí tienes el resumen de tu préstamo.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;">Saldo pendiente:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{saldoPendiente}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Próxima cuota:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{montoCuota}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Próximo vencimiento:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{fechaVencimiento}}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Cuotas pagadas:</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{numeroCuota}} de {{totalCuotas}}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:18px;">
              Este es un mensaje automático.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">© {{anioActual}} JSADR · Sistema de Gestión de Préstamos</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    variables: JSON.stringify(['clienteNombre', 'prestamoCodigo', 'saldoPendiente', 'montoCuota', 'fechaVencimiento', 'numeroCuota', 'totalCuotas', 'anioActual']),
  },
]

async function main() {
  console.log('=== SEED PLANTILLAS ===')
  console.log(`Total plantillas WhatsApp: ${PLANTILLAS_WHATSAPP.length}`)
  console.log(`Total plantillas Email: ${PLANTILLAS_EMAIL.length}`)

  let created = 0
  let updated = 0
  let skipped = 0

  // Procesar WhatsApp
  for (const p of PLANTILLAS_WHATSAPP) {
    const tipo = 'WHATSAPP'
    const data = {
      codigo: p.codigo,
      nombre: p.nombre,
      tipo,
      categoria: p.categoria,
      descripcion: p.descripcion,
      asunto: null as string | null,
      contenido: p.contenido,
      contenidoHtml: null as string | null,
      variables: p.variables,
      sistema: true,
      activa: true,
      evento: p.evento,
    }

    const existente = await db.plantilla.findUnique({ where: { codigo: p.codigo } })
    if (existente) {
      await db.plantilla.update({
        where: { id: existente.id },
        data: {
          nombre: data.nombre,
          categoria: data.categoria,
          descripcion: data.descripcion,
          asunto: data.asunto,
          contenido: data.contenido,
          contenidoHtml: data.contenidoHtml,
          variables: data.variables,
          evento: data.evento,
        },
      })
      updated++
      console.log(`  ✓ Actualizada: ${p.codigo}`)
    } else {
      await db.plantilla.create({ data })
      created++
      console.log(`  + Creada: ${p.codigo}`)
    }
  }

  // Procesar Email
  for (const p of PLANTILLAS_EMAIL) {
    const tipo = 'EMAIL'
    const data = {
      codigo: p.codigo,
      nombre: p.nombre,
      tipo,
      categoria: p.categoria,
      descripcion: p.descripcion,
      asunto: p.asunto as string | null,
      contenido: p.contenido,
      contenidoHtml: p.contenidoHtml as string | null,
      variables: p.variables,
      sistema: true,
      activa: true,
      evento: p.evento,
    }

    const existente = await db.plantilla.findUnique({ where: { codigo: p.codigo } })
    if (existente) {
      await db.plantilla.update({
        where: { id: existente.id },
        data: {
          nombre: data.nombre,
          categoria: data.categoria,
          descripcion: data.descripcion,
          asunto: data.asunto,
          contenido: data.contenido,
          contenidoHtml: data.contenidoHtml,
          variables: data.variables,
          evento: data.evento,
        },
      })
      updated++
      console.log(`  ✓ Actualizada: ${p.codigo}`)
    } else {
      await db.plantilla.create({ data })
      created++
      console.log(`  + Creada: ${p.codigo}`)
    }
  }

  console.log(`\n=== RESUMEN ===`)
  console.log(`Creadas: ${created}`)
  console.log(`Actualizadas: ${updated}`)
  console.log(`Omitidas: ${skipped}`)

  const total = await db.plantilla.count()
  console.log(`Total plantillas en BD: ${total}`)
}

main()
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
